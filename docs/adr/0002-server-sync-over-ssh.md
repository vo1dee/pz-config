# Live-server sync goes over SSH (file + restart), not RCON

We wanted "Sync to/from server" buttons next to Export so the editor can push its
config to a live Project Zomboid server and pull the server's current config back,
mirroring the RCON workflow in [pz-admin](https://github.com/beyenilmez/pz-admin/blob/main/rcon.go).
Two hard facts shaped the design.

**RCON can't do it.** RCON is a raw TCP protocol, so a browser can't speak it
directly regardless — and more fundamentally, PZ's RCON options commands
(`showoptions`/`changeoption`/`reloadoptions`, which is all pz-admin uses) operate
on **ServerOptions** (the `servertest.ini`: PVP, MaxPlayers, PauseEmpty…), *not* on
the **SandboxVars** this editor edits. SandboxVars live in a `_SandboxVars.lua`
file, are read at server startup, and only take effect after a **full restart**.
There is no RCON command that reads or writes them.

**So sync is file-based over SSH.** We added a small optional Node backend
(`server/`) that serves the static editor and reaches the (self-hosted Linux) PZ
host over SSH: SFTP to read/write `_SandboxVars.lua`, SSH `exec` to run the
configured stop/start commands, and RCON used only for player warnings, `save`, and
up/down health checks. The push sequence is deliberately ordered to be safe:
validate the incoming config (via the shared `lua-parser.js`) → **back up** the
current remote file (timestamped, pruned to `BACKUP_KEEP`) → warn players with an
in-game countdown → `save` → **stop** the server → write the new file *while it's
down* (so nothing races a shutdown rewrite) → **start** it again. Progress streams
back as NDJSON so the UI shows a live step log across the ~minute-long restart.

Consequences and trade-offs:

- **Applying SandboxVars requires a restart, which disconnects players.** This is
  inherent to how PZ loads sandbox config, not a choice — hence the countdown +
  backup rather than a "live apply."
- **The static editor stays dependency-free and standalone.** The backend is
  opt-in; without it, `/api/status` fails and the sync buttons simply stay hidden,
  so `python3 -m http.server` keeps working exactly as before.
- **Credentials stay server-side.** SSH keys/passwords and the RCON password live in
  `server/.env` (gitignored) and are never exposed to the browser; the client only
  ever sends/receives Lua text.
- **Scope: self-hosted Linux + SSH only.** Docker, game-panel APIs (Pterodactyl),
  and managed GSP hosts (FTP + web-panel restart) were considered but not built;
  they'd slot in as alternative transports behind the same `/api` routes.
