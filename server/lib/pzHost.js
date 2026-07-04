'use strict';

// Helpers for talking to a remote Project Zomboid host: SFTP for the
// SandboxVars file, SSH exec for backups + start/stop, and RCON for player
// warnings, saves, and up/down health checks.
//
// Unlike the original version, none of this reads server-wide config from
// process.env: every call takes an explicit `cfg` object built by
// buildConfig() from the connection profile the caller (browser) supplies.
// That's what lets each logged-in user sync against their *own* server
// without the backend ever storing anyone's SSH key or RCON password.

const path = require('path');
const { Client } = require('ssh2');
const { Rcon } = require('rcon-client');

// Build a per-request cfg from a plain object (the "server" profile posted by
// the frontend, sourced from that user's browser localStorage). Throws with a
// user-facing message if required fields are missing or malformed — never
// touches process.env or the filesystem.
function buildConfig(input) {
  const s = input && typeof input === 'object' ? input : {};

  const host = (s.sshHost || '').trim();
  const username = (s.sshUser || '').trim();
  const sandboxVarsPath = (s.sandboxVarsPath || '').trim();
  if (!host) throw new Error('Server settings: SSH host is required.');
  if (!username) throw new Error('Server settings: SSH user is required.');
  if (!sandboxVarsPath) throw new Error('Server settings: SandboxVars path is required.');

  const privateKey = typeof s.sshPrivateKey === 'string' ? s.sshPrivateKey.trim() : '';
  const password = typeof s.sshPassword === 'string' ? s.sshPassword : '';
  if (!privateKey && !password) {
    throw new Error('Server settings: provide either an SSH private key or an SSH password.');
  }

  const ssh = {
    host,
    port: toInt(s.sshPort, 22),
    username,
  };
  if (privateKey) {
    ssh.privateKey = privateKey;
    if (s.sshKeyPassphrase) ssh.passphrase = s.sshKeyPassphrase;
  } else {
    ssh.password = password;
  }

  const cfg = {
    ssh,
    sandboxVarsPath,
    stopCmd: (s.stopCmd || '').trim(),
    startCmd: (s.startCmd || '').trim(),
    rcon: {
      host: (s.rconHost || '').trim(),
      port: toInt(s.rconPort, 27015),
      password: s.rconPassword || '',
    },
    countdown: toInt(s.countdown, 60),
    backupDir: (s.backupDir || '').trim(),
    backupKeep: toInt(s.backupKeep, 10),
    dryRun: Boolean(s.dryRun),
  };
  return cfg;
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SFTP treats relative paths as relative to the login dir (home), so turn a
// leading ~/ into a home-relative path.
function sftpPath(p) {
  if (p && p.startsWith('~/')) return p.slice(2);
  return p;
}

// Shell commands below quote every path (to survive spaces/special chars),
// but double quotes suppress bash's `~` expansion — so a literal "~/foo"
// resolves to a file named "~" and fails. Swap it for $HOME, which *does*
// expand inside double quotes, before it goes into any exec() command.
function shellPath(p) {
  if (p && p.startsWith('~/')) return `$HOME/${p.slice(2)}`;
  return p;
}

// Open an SSH connection and hand it to `fn`, always closing it afterwards.
function withSSH(fn, cfg) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const done = (err, val) => {
      if (settled) return;
      settled = true;
      conn.end();
      if (err) reject(err); else resolve(val);
    };
    conn.on('ready', () => Promise.resolve(fn(conn, cfg)).then((v) => done(null, v), done));
    conn.on('error', done);
    conn.connect(cfg.ssh);
  });
}

function sftpOf(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

// Run a shell command over SSH; rejects on non-zero exit.
function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`command exited ${code}: ${command}\n${stderr || stdout}`));
      });
    });
  });
}

async function readSandboxVars(cfg) {
  return withSSH(async (conn) => {
    const sftp = await sftpOf(conn);
    const remote = sftpPath(cfg.sandboxVarsPath);
    return new Promise((resolve, reject) => {
      let data = '';
      const rs = sftp.createReadStream(remote);
      rs.on('data', (d) => { data += d.toString('utf8'); });
      rs.on('error', reject);
      rs.on('end', () => resolve(data));
    });
  }, cfg);
}

async function writeSandboxVars(content, cfg) {
  return withSSH(async (conn) => {
    const sftp = await sftpOf(conn);
    const remote = sftpPath(cfg.sandboxVarsPath);
    await new Promise((resolve, reject) => {
      const ws = sftp.createWriteStream(remote);
      ws.on('error', reject);
      ws.on('close', resolve);
      ws.end(Buffer.from(content, 'utf8'));
    });
  }, cfg);
}

// Copy the current file to a timestamped backup and prune old ones. Uses the
// remote shell so a leading ~/ in paths is expanded there.
async function backupRemote(cfg) {
  return withSSH(async (conn) => {
    const file = shellPath(cfg.sandboxVarsPath);
    const base = path.posix.basename(cfg.sandboxVarsPath);
    const dir = shellPath(cfg.backupDir || `${path.posix.dirname(cfg.sandboxVarsPath)}/sandboxvars-backups`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = `${dir}/${base}.bak-${stamp}`;
    await exec(conn, `mkdir -p "${dir}" && cp "${file}" "${dest}"`);
    if (cfg.backupKeep > 0) {
      // Keep the newest N backups for this file, delete the rest.
      await exec(
        conn,
        `ls -1t "${dir}/${base}.bak-"* 2>/dev/null | tail -n +${cfg.backupKeep + 1} | ` +
          `while IFS= read -r f; do rm -f "$f"; done`
      );
    }
    return dest;
  }, cfg);
}

async function runStart(cfg) {
  if (!cfg.startCmd) throw new Error('Server settings: start command is not configured');
  return withSSH((conn) => exec(conn, cfg.startCmd), cfg);
}

async function runStop(cfg) {
  if (cfg.stopCmd) return withSSH((conn) => exec(conn, cfg.stopCmd), cfg);
  // Fall back to a graceful RCON quit (saves, then shuts the server down).
  return rconExec('quit', cfg);
}

async function rconExec(command, cfg) {
  const rcon = await Rcon.connect({
    host: cfg.rcon.host,
    port: cfg.rcon.port,
    password: cfg.rcon.password,
    timeout: 5000,
  });
  try {
    return await rcon.send(command);
  } finally {
    await rcon.end().catch(() => {});
  }
}

async function rconIsUp(cfg) {
  try {
    await rconExec('players', cfg);
    return true;
  } catch (e) {
    return false;
  }
}

async function waitForRcon(up, timeoutMs, cfg) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await rconIsUp(cfg)) === up) return true;
    await sleep(3000);
  }
  return false;
}

module.exports = {
  buildConfig,
  sleep,
  readSandboxVars,
  writeSandboxVars,
  backupRemote,
  runStart,
  runStop,
  rconExec,
  rconIsUp,
  waitForRcon,
};
