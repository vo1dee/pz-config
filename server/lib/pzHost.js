'use strict';

// Helpers for talking to the remote Project Zomboid host: SFTP for the
// SandboxVars file, SSH exec for backups + start/stop, and RCON for player
// warnings, saves, and up/down health checks.

const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { Rcon } = require('rcon-client');

function config() {
  const cfg = {
    ssh: {
      host: process.env.SSH_HOST,
      port: parseInt(process.env.SSH_PORT || '22', 10),
      username: process.env.SSH_USER,
    },
    sandboxVarsPath: process.env.PZ_SANDBOXVARS_PATH,
    stopCmd: (process.env.PZ_STOP_CMD || '').trim(),
    startCmd: (process.env.PZ_START_CMD || '').trim(),
    rcon: {
      host: process.env.RCON_HOST,
      port: parseInt(process.env.RCON_PORT || '27015', 10),
      password: process.env.RCON_PASSWORD,
    },
    countdown: parseInt(process.env.RESTART_COUNTDOWN_SECONDS || '60', 10),
    backupDir: (process.env.BACKUP_DIR || '').trim(),
    backupKeep: parseInt(process.env.BACKUP_KEEP || '10', 10),
    dryRun: process.env.DRY_RUN === '1',
  };

  if (process.env.SSH_KEY_PATH) {
    cfg.ssh.privateKey = fs.readFileSync(process.env.SSH_KEY_PATH);
    if (process.env.SSH_KEY_PASSPHRASE) cfg.ssh.passphrase = process.env.SSH_KEY_PASSPHRASE;
  } else if (process.env.SSH_PASSWORD) {
    cfg.ssh.password = process.env.SSH_PASSWORD;
  }
  return cfg;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SFTP treats relative paths as relative to the login dir (home), so turn a
// leading ~/ into a home-relative path.
function sftpPath(p) {
  if (p && p.startsWith('~/')) return p.slice(2);
  return p;
}

// Open an SSH connection and hand it to `fn`, always closing it afterwards.
function withSSH(fn) {
  const cfg = config();
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

async function readSandboxVars() {
  return withSSH(async (conn, cfg) => {
    const sftp = await sftpOf(conn);
    const remote = sftpPath(cfg.sandboxVarsPath);
    return new Promise((resolve, reject) => {
      let data = '';
      const rs = sftp.createReadStream(remote);
      rs.on('data', (d) => { data += d.toString('utf8'); });
      rs.on('error', reject);
      rs.on('end', () => resolve(data));
    });
  });
}

async function writeSandboxVars(content) {
  return withSSH(async (conn, cfg) => {
    const sftp = await sftpOf(conn);
    const remote = sftpPath(cfg.sandboxVarsPath);
    await new Promise((resolve, reject) => {
      const ws = sftp.createWriteStream(remote);
      ws.on('error', reject);
      ws.on('close', resolve);
      ws.end(Buffer.from(content, 'utf8'));
    });
  });
}

// Copy the current file to a timestamped backup and prune old ones. Uses the
// remote shell so a leading ~/ in paths is expanded there.
async function backupRemote() {
  return withSSH(async (conn, cfg) => {
    const file = cfg.sandboxVarsPath;
    const base = path.posix.basename(file);
    const dir = cfg.backupDir || `${path.posix.dirname(file)}/sandboxvars-backups`;
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
  });
}

async function runStart() {
  const cfg = config();
  if (!cfg.startCmd) throw new Error('PZ_START_CMD is not configured');
  return withSSH((conn) => exec(conn, cfg.startCmd));
}

async function runStop() {
  const cfg = config();
  if (cfg.stopCmd) return withSSH((conn) => exec(conn, cfg.stopCmd));
  // Fall back to a graceful RCON quit (saves, then shuts the server down).
  return rconExec('quit');
}

async function rconExec(command) {
  const cfg = config();
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

async function rconIsUp() {
  try {
    await rconExec('players');
    return true;
  } catch (e) {
    return false;
  }
}

async function waitForRcon(up, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await rconIsUp()) === up) return true;
    await sleep(3000);
  }
  return false;
}

module.exports = {
  config,
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
