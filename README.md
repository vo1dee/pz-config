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

To push/pull config directly to a running PZ server over SSH:

```bash
cd server
npm install
cp .env.example .env   # fill in SSH/RCON details
npm start               # serves editor + API on http://localhost:8934
```

This adds **Sync from server** / **Sync to server** buttons. Syncing to a
server backs it up, restarts it, and applies the new config. See
[`server/`](server/) and [docs/adr/0002](docs/adr/0002-server-sync-over-ssh.md)
for details.

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
