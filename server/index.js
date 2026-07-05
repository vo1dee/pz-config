'use strict';

// Sync backend for the PZ SandboxVars editor. Serves the static editor
// (public) and exposes /api routes, gated by Cloudflare Access, that read/
// write this one hardcoded server's SandboxVars file over SSH (config in
// .env) and orchestrate a warned, backed-up restart. Built for a small group
// of friends sharing a single PZ server, not multi-tenant use.

require('dotenv').config();

const path = require('path');
const express = require('express');
const LuaParser = require('../lua-parser.js');
const pz = require('./lib/pzHost');
const accessAuth = require('./lib/accessAuth');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Serve the static editor (repo root: index.html, app.js, css, JSON, etc.).
// This stays public — Cloudflare Access (if configured) only gates /api, and
// the editor itself has nothing to protect.
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT));

// Everything under /api requires a valid Cloudflare Access session (skipped
// with a warning if CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD aren't set).
app.use('/api', accessAuth);

// Identity check the frontend uses to decide whether to show the sync UI. Also
// doubles as the landing page for Cloudflare Access's login redirect: since
// only /api is a protected path, Access can't send a browser straight back to
// "/" after login (it has to land somewhere under /api first) — so the login
// link points here with ?return=<path>, and once Access has authenticated the
// request we bounce the browser on to that path ourselves.
app.get('/api/whoami', (req, res) => {
  const ret = req.query.return;
  if (typeof ret === 'string' && ret.startsWith('/') && !ret.startsWith('//')) {
    return res.redirect(302, ret);
  }
  res.json({ email: req.accessEmail || null });
});

// Quick reachability check the frontend uses to show the countdown/dry-run
// note before a push, and to detect if RCON is currently reachable.
app.get('/api/status', async (req, res) => {
  const cfg = pz.config();
  const configured = Boolean(cfg.ssh.host && cfg.sandboxVarsPath);
  let rconUp = false;
  try { rconUp = await pz.rconIsUp(); } catch (e) { rconUp = false; }
  res.json({ configured, rconUp, dryRun: cfg.dryRun, countdown: cfg.countdown });
});

// Live server info for the status panel: uptime + online players. Polled
// periodically by the UI while the panel is open.
app.get('/api/server/info', async (req, res) => {
  const [players, uptimeSeconds] = await Promise.all([
    pz.rconPlayers(),
    pz.serverUptime(),
  ]);
  res.json({ up: players.up, uptimeSeconds, players: { count: players.count, names: players.names } });
});

// Broadcast a one-off message to in-game chat (no restart involved).
app.post('/api/server/announce', async (req, res) => {
  const message = req.body && req.body.message;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Missing "message" body.' });
  }
  const cfg = pz.config();
  try {
    if (cfg.dryRun) {
      return res.json({ ok: true, dryRun: true, message: `[dry-run] would announce: ${message.trim().slice(0, 200)}` });
    }
    const sent = await pz.sendAnnounce(message);
    res.json({ ok: true, message: sent });
  } catch (err) {
    res.status(502).json({ error: `Announce failed: ${err.message}` });
  }
});

// Pull the remote SandboxVars file so the editor can load it.
app.get('/api/sync/pull', async (req, res) => {
  try {
    const lua = await pz.readSandboxVars();
    const parsed = LuaParser.parseSandboxVars(lua);
    if (!parsed || parsed.totalParams === 0) {
      return res.status(502).json({ error: 'Remote file has no parameters (unexpected format).' });
    }
    res.json({ lua, filename: path.posix.basename(pz.config().sandboxVarsPath), totalParams: parsed.totalParams });
  } catch (err) {
    res.status(502).json({ error: `Pull failed: ${err.message}` });
  }
});

// Push the editor's config to the server: validate -> backup -> warn/countdown
// -> save -> stop -> write (while down) -> start. Streams NDJSON progress so
// the UI can show a live step log even across the countdown + restart.
app.post('/api/sync/push', async (req, res) => {
  const lua = req.body && req.body.lua;
  if (typeof lua !== 'string' || !lua.trim()) {
    return res.status(400).json({ error: 'Missing "lua" body.' });
  }

  // Validate before we touch anything on the server.
  let parsed;
  try {
    parsed = LuaParser.parseSandboxVars(lua);
  } catch (e) {
    return res.status(400).json({ error: `Invalid SandboxVars: ${e.message}` });
  }
  if (!parsed || parsed.totalParams === 0) {
    return res.status(400).json({ error: 'Invalid SandboxVars: no parameters parsed.' });
  }

  const cfg = pz.config();
  res.set('Content-Type', 'application/x-ndjson');
  res.set('Cache-Control', 'no-cache');

  // The client can abort the request (its "Cancel sync" button) any time up
  // until we actually issue the stop command — after that the server is
  // committed to finishing (leaving it stopped with no restart queued would
  // be worse than a config it didn't ask for). `aborted` is checked at each
  // checkpoint before that point of no return; `cancellable: false` on events
  // from 'stop' onward tells the UI to stop offering to cancel.
  // Note: this must be res (not req) — req's 'close' fires as soon as the
  // request body is fully read (i.e. right away, since Express already
  // parsed it), long before the client actually disconnects. res only closes
  // when the underlying connection actually goes away or we call res.end().
  let aborted = false;
  res.on('close', () => { if (!res.writableEnded) aborted = true; });

  const send = (step, status, message, cancellable = true) => {
    try {
      res.write(JSON.stringify({ step, status, message, cancellable, ts: Date.now() }) + '\n');
    } catch (e) { /* client already gone */ }
  };
  const tag = cfg.dryRun ? '[dry-run] ' : '';

  try {
    send('validate', 'ok', `${parsed.totalParams} parameters validated.`);
    if (aborted) return;

    // Backup the current remote file.
    if (cfg.dryRun) {
      send('backup', 'ok', `${tag}would back up current SandboxVars.`);
    } else {
      const dest = await pz.backupRemote();
      send('backup', 'ok', `Backed up current config to ${dest}`);
    }
    if (aborted) return;

    // Warn players with an in-game countdown, then save.
    await runCountdown(cfg, send, () => aborted);
    if (aborted) return;
    if (cfg.dryRun) {
      send('save', 'ok', `${tag}would RCON save.`);
    } else {
      await pz.rconExec('save');
      send('save', 'ok', 'World saved.');
    }
    if (aborted) return;

    // Stop the server so we write the file while it is down. Past this
    // point the sync can no longer be cancelled.
    if (cfg.dryRun) {
      send('stop', 'ok', `${tag}would stop the server.`, false);
    } else {
      await pz.runStop();
      send('stop', 'running', 'Stop issued, waiting for server to go down…', false);
      const down = await pz.waitForRcon(false, 120000);
      send('stop', down ? 'ok' : 'warn', down ? 'Server is down.' : 'Timed out waiting for shutdown; continuing.', false);
    }

    // Write the new SandboxVars.
    if (cfg.dryRun) {
      send('write', 'ok', `${tag}would write ${lua.length} bytes of SandboxVars.`, false);
    } else {
      await pz.writeSandboxVars(lua);
      send('write', 'ok', 'New SandboxVars written.', false);
    }

    // Start the server back up.
    if (cfg.dryRun) {
      send('start', 'ok', `${tag}would start the server.`, false);
    } else {
      await pz.runStart();
      send('start', 'running', 'Start issued, waiting for server to come back…', false);
      const up = await pz.waitForRcon(true, 180000);
      send('start', up ? 'ok' : 'warn', up ? 'Server is back online.' : 'Not responding yet; check the server console.', false);
    }

    send('done', 'ok', cfg.dryRun ? 'Dry run complete — no changes made.' : 'Sync complete.', false);
  } catch (err) {
    send('error', 'error', err.message, false);
  } finally {
    res.end();
  }
});

async function runCountdown(cfg, send, isAborted) {
  const total = Math.max(0, cfg.countdown);
  if (total === 0) return;
  const marks = [...new Set([total, 60, 30, 10, 5].filter((m) => m > 0 && m <= total))].sort((a, b) => b - a);
  send('countdown', 'running', `Warning players — restart in ${total}s.`);
  let prev = total;
  for (const m of marks) {
    if (isAborted()) return;
    if (prev > m) await pz.sleep((prev - m) * 1000);
    if (isAborted()) return;
    if (!cfg.dryRun) {
      await pz.rconExec(`servermsg "Server restarting in ${m} second${m === 1 ? '' : 's'} to apply config changes."`).catch(() => {});
    }
    prev = m;
  }
  if (isAborted()) return;
  if (prev > 0) await pz.sleep(prev * 1000);
  if (isAborted()) return;
  send('countdown', 'ok', 'Countdown finished.');
}

const port = parseInt(process.env.PORT || '8934', 10);
// Listen on all interfaces: this box is reached via a separate reverse proxy
// (nginx proxy manager) rather than a Cloudflare Tunnel, so the proxy needs a
// real network path to this port, not just loopback. The security boundary
// here is therefore NOT "only loopback can connect" — it's (a) Cloudflare
// Access gating the hostname at Cloudflare's edge (only takes effect if the
// DNS record is proxied/orange-cloud — a "DNS only" record bypasses Access
// entirely) and (b) this port not being forwarded from the router/firewall to
// the public internet, so only the proxy (and anything else on the LAN) can
// reach it directly.
app.listen(port, () => {
  console.log(`Zomboid-Web sync backend listening on port ${port}`);
});
