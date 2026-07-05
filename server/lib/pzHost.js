'use strict';

// Helpers for talking to the remote Project Zomboid host: SFTP for the
// SandboxVars file, SSH exec for backups + start/stop, and RCON for player
// warnings, saves, and up/down health checks.
//
// Single-server tool: connection details come from process.env (see
// .env.example), not from anything a client sends.

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
    logsDir: process.env.PZ_LOGS_DIR,
    stopCmd: (process.env.PZ_STOP_CMD || '').trim(),
    startCmd: (process.env.PZ_START_CMD || '').trim(),
    uptimeCmd: (process.env.PZ_UPTIME_CMD || '').trim(),
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

// Shell commands below quote every path (to survive spaces/special chars),
// but double quotes suppress bash's `~` expansion — so a literal "~/foo"
// resolves to a file named "~" and fails. Swap it for $HOME, which *does*
// expand inside double quotes, before it goes into any exec() command.
function shellPath(p) {
  if (p && p.startsWith('~/')) return `$HOME/${p.slice(2)}`;
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

// Like exec(), but for commands that never close their own stdout (e.g.
// `tail -F`): streams chunks to `onData` as they arrive instead of buffering
// until the channel closes. Returns a handle whose close() kills the remote
// command and tears down the SSH connection — callers MUST call it when done
// (e.g. when the client disconnects) or the channel + connection leak.
// `onError` is required: an SSH connection or exec failure has to reach the
// caller (so e.g. the HTTP route can end the response with a message)
// instead of the request just hanging open forever with no data and no close.
function streamExec(command, onData, onError) {
  const cfg = config();
  const conn = new Client();
  let stream = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { if (stream) stream.close(); } catch (e) { /* already gone */ }
    conn.end();
  };
  conn.on('ready', () => {
    conn.exec(command, (err, s) => {
      if (err) { onError(err); close(); return; }
      stream = s;
      s.on('data', (d) => onData(d.toString('utf8')));
      s.stderr.on('data', (d) => onData(d.toString('utf8')));
      s.on('close', close);
    });
  });
  conn.on('error', (err) => { onError(err); close(); });
  conn.connect(cfg.ssh);
  return { close };
}

// List the plain files (not subdirectories) directly inside PZ_LOGS_DIR, e.g.
// "2026-07-05_16-30_admin.txt", "2026-07-05_16-30_chat.txt" — the per-session
// logs PZ writes at the top level of ~/Zomboid/Logs. The rotated `logs_MM-DD`/
// `logs_<year>-MM-DD` subfolders are deliberately excluded. Newest-modified
// first, so the current session's files sort to the top.
async function listLogFiles() {
  const cfg = config();
  if (!cfg.logsDir) throw new Error('PZ_LOGS_DIR is not configured.');
  return withSSH(async (conn) => {
    const dir = shellPath(cfg.logsDir);
    // `find -type f` rather than `ls`: it's virtually never aliased (unlike
    // `ls`, which some shells force into `--color=always`, which would
    // otherwise leak ANSI escape codes into every filename here) and
    // `-type f` is an unambiguous "no folders" filter rather than relying on
    // `ls -p`'s trailing-slash convention. Errors (bad path, no permission)
    // are left to surface via exec()'s non-zero-exit rejection instead of
    // being swallowed — a wrong PZ_LOGS_DIR should show up as a clear error,
    // not silently render as "no log files found".
    let out;
    try {
      out = await exec(
        conn,
        `find "${dir}" -maxdepth 1 -type f -printf '%T@ %f\\n' | sort -rn | sed 's/^[^ ]* //'`
      );
    } catch (err) {
      throw new Error(`Could not list "${cfg.logsDir}": ${err.message}`);
    }
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  });
}

// Log filenames are only ever compared/interpolated after passing through
// here — no slashes, no shell metacharacters — so a client-supplied `file`
// query param can't escape PZ_LOGS_DIR or break out of the quoted tail command.
function sanitizeLogFilename(name) {
  const n = String(name || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(n) || n === '.' || n === '..') {
    throw new Error(`Invalid log filename: "${n}"`);
  }
  return n;
}

// Stream the last ~200 lines of one file inside PZ_LOGS_DIR, then keep
// following it until close() is called.
function streamLogFile(filename, onData, onError) {
  const cfg = config();
  if (!cfg.logsDir) throw new Error('PZ_LOGS_DIR is not configured.');
  const safe = sanitizeLogFilename(filename);
  const full = `${shellPath(cfg.logsDir)}/${safe}`;
  return streamExec(`tail -n 200 -F "${full}"`, onData, onError);
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

// Parse RCON `players` output, e.g.:
//   Players connected (2):
//   -Alice
//   -Bob
// into { up, count, names }. `up: false` means RCON itself was unreachable
// (server down or misconfigured), not "0 players".
async function rconPlayers() {
  let raw;
  try {
    raw = await rconExec('players');
  } catch (e) {
    return { up: false, count: 0, names: [] };
  }
  const lines = String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const names = lines.filter((l) => l.startsWith('-')).map((l) => l.slice(1));
  const header = lines.find((l) => /\(\d+\)/.test(l));
  const count = header ? parseInt(header.match(/\((\d+)\)/)[1], 10) : names.length;
  return { up: true, count, names };
}

// Live uptime (seconds) of the PZ server process, queried fresh over SSH each
// call rather than derived from any "last restart we triggered" bookkeeping —
// that would be wrong after a crash-restart or a manual restart done outside
// this app. Uses PZ_UPTIME_CMD if configured (should print elapsed seconds to
// stdout); otherwise falls back to `ps -o etimes=` on the first process whose
// command line looks like the PZ server. Returns null if it can't be determined.
async function serverUptime() {
  const cfg = config();
  const cmd = cfg.uptimeCmd
    || `ps -o etimes= -p "$(pgrep -f 'ProjectZomboid|start-server|zomboid' | head -n1)"`;
  try {
    const out = await withSSH((conn) => exec(conn, cmd));
    const n = parseInt(String(out).trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

// Shared sanitizer for any client-supplied string headed into an RCON
// command's quoting: strips characters that would break out of the quotes
// (or inject a second command) and caps length so one bad input can't wedge
// the RCON connection. Every helper below that embeds client input MUST run
// it through here first.
function rconArg(s, maxLen = 64) {
  return String(s || '').replace(/[\r\n"]/g, '').trim().slice(0, maxLen);
}

// Broadcast a message to in-game chat via RCON `servermsg`.
async function sendAnnounce(text) {
  const safe = rconArg(text, 200);
  if (!safe) throw new Error('Message is empty.');
  await rconExec(`servermsg "${safe}"`);
  return safe;
}

// ---------------------------------------------------------------------------
// Player admin actions
// ---------------------------------------------------------------------------

function requireName(name) {
  const n = rconArg(name);
  if (!n) throw new Error('Player name is required.');
  return n;
}

async function kickPlayer(name, reason) {
  const n = requireName(name);
  const r = reason ? rconArg(reason, 200) : '';
  return rconExec(r ? `kickuser "${n}" -reason "${r}"` : `kickuser "${n}"`);
}

async function banPlayer(name, opts = {}) {
  const n = requireName(name);
  const parts = [`banuser "${n}"`];
  if (opts.ip) parts.push('-ip');
  if (opts.reason) parts.push(`-r "${rconArg(opts.reason, 200)}"`);
  return rconExec(parts.join(' '));
}

async function unbanPlayer(name) {
  const n = requireName(name);
  return rconExec(`unbanuser "${n}"`);
}

const ACCESS_LEVELS = new Set(['admin', 'moderator', 'overseer', 'gm', 'observer', 'none']);

async function setAccessLevel(name, level) {
  const n = requireName(name);
  const lvl = String(level || '').toLowerCase().trim();
  if (!ACCESS_LEVELS.has(lvl)) {
    throw new Error(`Invalid access level "${level}". Must be one of: ${[...ACCESS_LEVELS].join(', ')}`);
  }
  return rconExec(`setaccesslevel "${n}" "${lvl}"`);
}

async function whitelistAdd(name) {
  const n = requireName(name);
  return rconExec(`addusertowhitelist "${n}"`);
}

async function whitelistRemove(name) {
  const n = requireName(name);
  return rconExec(`removeuserfromwhitelist "${n}"`);
}

// ---------------------------------------------------------------------------
// ServerOptions — unlike SandboxVars these apply live via RCON, no restart.
// ---------------------------------------------------------------------------

// Parse `showoptions` output, e.g. lines like `PVP=false` or `MaxPlayers=32`,
// into a flat list with an inferred type so the UI can reuse the same
// boolean/number/string controls it uses for SandboxVars.
async function getServerOptions() {
  const raw = await rconExec('showoptions');
  const lines = String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const options = [];
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const rawValue = line.slice(eq + 1).trim();
    if (!key) continue;
    let type = 'string';
    let value = rawValue;
    if (/^(true|false)$/i.test(rawValue)) {
      type = 'boolean';
      value = /^true$/i.test(rawValue);
    } else if (rawValue !== '' && !Number.isNaN(Number(rawValue))) {
      type = 'number';
      value = Number(rawValue);
    }
    options.push({ key, value, type });
  }
  return options;
}

async function setServerOption(key, value) {
  const k = rconArg(key, 64);
  if (!k) throw new Error('Option name is required.');
  const v = rconArg(String(value), 200);
  return rconExec(`changeoption ${k} "${v}"`);
}

async function reloadOptions() {
  return rconExec('reloadoptions');
}

// ---------------------------------------------------------------------------
// World/event "toys" — dispatched through a fixed allow-map, never a raw
// client-supplied command string, so the client can only ever trigger one of
// these named actions.
// ---------------------------------------------------------------------------

// NOTE: a few of these (createhorde, thunder, lightning) have argument forms
// that vary by PZ build and haven't been confirmed against the live server
// yet — verify with DRY_RUN=1 (and RCON `help`) before relying on them, and
// fix the command string here (single source of truth) if it's off.
const WORLD_EVENTS = {
  chopper: { needsTarget: false, build: () => 'chopper' },
  gunshot: { needsTarget: false, build: () => 'gunshot' },
  startrain: { needsTarget: false, build: () => 'startrain' },
  stoprain: { needsTarget: false, build: () => 'stoprain' },
  startstorm: { needsTarget: false, build: () => 'startstorm' },
  stopweather: { needsTarget: false, build: () => 'stopweather' },
  alarm: { needsTarget: false, build: () => 'alarm' },
  thunder: { needsTarget: true, build: (n) => `thunder "${n}"` },
  lightning: { needsTarget: true, build: (n) => `lightning "${n}"` },
  createhorde: {
    needsTarget: false,
    needsCount: true,
    build: (n, count) => (n ? `createhorde ${count} "${n}"` : `createhorde ${count}`),
  },
};

async function worldEvent(action, target, count) {
  const spec = WORLD_EVENTS[action];
  if (!spec) throw new Error(`Unknown world action "${action}".`);
  let n = '';
  if (spec.needsTarget) {
    n = requireName(target);
  } else if (target) {
    n = rconArg(target);
  }
  let c;
  if (spec.needsCount) {
    c = parseInt(count, 10);
    if (!Number.isFinite(c) || c < 1) throw new Error('A positive count is required for this action.');
  }
  return rconExec(spec.build(n, c));
}

// ---------------------------------------------------------------------------
// Per-player grants
// ---------------------------------------------------------------------------

async function giveItem(name, item, count) {
  const n = requireName(name);
  const it = rconArg(item, 128);
  if (!it) throw new Error('Item id is required.');
  const c = count ? Math.max(1, parseInt(count, 10) || 1) : 1;
  return rconExec(`additem "${n}" "${it}" ${c}`);
}

async function addXp(name, perk, amount) {
  const n = requireName(name);
  const p = rconArg(perk, 64);
  if (!p) throw new Error('Perk name is required.');
  const a = parseInt(amount, 10);
  if (!Number.isFinite(a)) throw new Error('A numeric XP amount is required.');
  return rconExec(`addxp "${n}" "${p}=${a}"`);
}

async function teleport(name, toName) {
  const n = requireName(name);
  const to = requireName(toName);
  return rconExec(`teleport "${n}" "${to}"`);
}

async function setGodmode(name, on) {
  const n = requireName(name);
  return rconExec(`godmode "${n}" -value ${on ? 'true' : 'false'}`);
}

module.exports = {
  config,
  sleep,
  streamExec,
  listLogFiles,
  streamLogFile,
  readSandboxVars,
  writeSandboxVars,
  backupRemote,
  runStart,
  runStop,
  rconExec,
  rconArg,
  rconIsUp,
  waitForRcon,
  rconPlayers,
  serverUptime,
  sendAnnounce,
  kickPlayer,
  banPlayer,
  unbanPlayer,
  setAccessLevel,
  whitelistAdd,
  whitelistRemove,
  getServerOptions,
  setServerOption,
  reloadOptions,
  worldEvent,
  giveItem,
  addXp,
  teleport,
  setGodmode,
  ACCESS_LEVELS,
  WORLD_EVENTS,
};
