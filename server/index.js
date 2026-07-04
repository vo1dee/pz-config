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
  const send = (step, status, message) => {
    res.write(JSON.stringify({ step, status, message, ts: Date.now() }) + '\n');
  };
  const tag = cfg.dryRun ? '[dry-run] ' : '';

  try {
    send('validate', 'ok', `${parsed.totalParams} parameters validated.`);

    // Backup the current remote file.
    if (cfg.dryRun) {
      send('backup', 'ok', `${tag}would back up current SandboxVars.`);
    } else {
      const dest = await pz.backupRemote();
      send('backup', 'ok', `Backed up current config to ${dest}`);
    }

    // Warn players with an in-game countdown, then save.
    await runCountdown(cfg, send);
    if (cfg.dryRun) {
      send('save', 'ok', `${tag}would RCON save.`);
    } else {
      await pz.rconExec('save');
      send('save', 'ok', 'World saved.');
    }

    // Stop the server so we write the file while it is down.
    if (cfg.dryRun) {
      send('stop', 'ok', `${tag}would stop the server.`);
    } else {
      await pz.runStop();
      send('stop', 'running', 'Stop issued, waiting for server to go down…');
      const down = await pz.waitForRcon(false, 120000);
      send('stop', down ? 'ok' : 'warn', down ? 'Server is down.' : 'Timed out waiting for shutdown; continuing.');
    }

    // Write the new SandboxVars.
    if (cfg.dryRun) {
      send('write', 'ok', `${tag}would write ${lua.length} bytes of SandboxVars.`);
    } else {
      await pz.writeSandboxVars(lua);
      send('write', 'ok', 'New SandboxVars written.');
    }

    // Start the server back up.
    if (cfg.dryRun) {
      send('start', 'ok', `${tag}would start the server.`);
    } else {
      await pz.runStart();
      send('start', 'running', 'Start issued, waiting for server to come back…');
      const up = await pz.waitForRcon(true, 180000);
      send('start', up ? 'ok' : 'warn', up ? 'Server is back online.' : 'Not responding yet; check the server console.');
    }

    send('done', 'ok', cfg.dryRun ? 'Dry run complete — no changes made.' : 'Sync complete.');
  } catch (err) {
    send('error', 'error', err.message);
  } finally {
    res.end();
  }
});

async function runCountdown(cfg, send) {
  const total = Math.max(0, cfg.countdown);
  if (total === 0) return;
  const marks = [...new Set([total, 60, 30, 10, 5].filter((m) => m > 0 && m <= total))].sort((a, b) => b - a);
  send('countdown', 'running', `Warning players — restart in ${total}s.`);
  let prev = total;
  for (const m of marks) {
    if (prev > m) await pz.sleep((prev - m) * 1000);
    if (!cfg.dryRun) {
      await pz.rconExec(`servermsg "Server restarting in ${m} second${m === 1 ? '' : 's'} to apply config changes."`).catch(() => {});
    }
    prev = m;
  }
  if (prev > 0) await pz.sleep(prev * 1000);
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
