# Project Zomboid B42 Sandbox Config Editor

A web app for viewing and editing a Project Zomboid Build 42
`SandboxVars.lua` config file, with English/Ukrainian translations and help
text for every parameter.

## Run it

Needs to be served over HTTP (not opened via `file://`):

```bash
python3 -m http.server 8934
# open http://localhost:8934/index.html
```

No build step, no dependencies.

## Sync to a live server (optional)

A small Node backend can push/pull config directly to **one** PZ server over
SSH — built for a group of friends sharing a single server, not multi-tenant
use. The server's SSH/RCON details live in `server/.env`, not in the browser.

```bash
cd server
npm install
cp .env.example .env   # fill in SSH/RCON details, and Cloudflare Access creds
npm start               # serves editor + API on http://localhost:8934
```

Sync is gated behind login: put a Cloudflare Access application in front of
`/api` (allow-listing the emails of people you trust) and set
`CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` in `.env`. Only signed-in users see
the **Sync from server** / **Sync to server** buttons; syncing to the server
backs it up, restarts it, and applies the new config. See [`server/`](server/)
and [docs/adr/0002](docs/adr/0002-server-sync-over-ssh.md) for details.

## Files

- `index.html`, `app.js`, `style.css` — the editor UI
- `lua-parser.js` — parses/generates `SandboxVars.lua` (shared by browser + Node)
- `config-schema.json` — parsed parameter data
- `translations.json` — EN/UK text
- `server/` — optional sync backend

## Using the app

- Choose **Start from scratch** or **Import file** on first visit
- Use the sidebar or search to find a parameter
- Click **?** for help on any field
- Modified fields are highlighted; **↺** resets to default
- **Export .lua** downloads your config
- Your progress is saved automatically in the browser
