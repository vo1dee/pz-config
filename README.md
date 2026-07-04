# Project Zomboid B42 Sandbox Config Editor

A single-page, offline-first web app for viewing and editing a Project Zomboid
Build 42 `SandboxVars.lua` server config. Every one of the 269 parameters found
in the provided `SandboxVars.lua` is rendered as an editable field, grouped by
section, with a "?" help button and English/Ukrainian translations.

## Running it locally

Because the app loads `config-schema.json` and `translations.json` via
`fetch()`, it needs to be served over HTTP (opening `index.html` directly with
`file://` will fail due to browser CORS restrictions on local file fetches).
Any static file server works, for example:

```bash
python3 -m http.server 8934
# then open http://localhost:8934/index.html
```

or, if you have Node:

```bash
npx serve .
```

No build step, no dependencies, no network calls at runtime. The static editor is
fully standalone — the optional sync backend below is only needed to push/pull
config to a live server.

## Syncing to/from a live server

The editor edits **SandboxVars**, which a browser can't send to a game server on
its own (RCON is raw TCP, and SandboxVars aren't exposed over RCON anyway — they
live in a `_SandboxVars.lua` file and only apply on server restart). So sync is
handled by a small optional Node backend in [`server/`](server/) that serves the
editor **and** reaches your PZ host over SSH. See
[docs/adr/0002](docs/adr/0002-server-sync-over-ssh.md) for why.

Requirements: a self-hosted Linux PZ server you can reach over SSH, with RCON
enabled.

```bash
cd server
npm install
cp .env.example .env      # then edit: SSH creds, remote SandboxVars path,
                          # start/stop commands, RCON, countdown, backups
npm start                 # serves the editor + API on http://localhost:8934
```

Open the served URL (not `python3 -m http.server`) and two buttons appear next to
**Export .lua**:

- **Sync from server** — SFTP-reads the remote `_SandboxVars.lua` and loads it into
  the editor (same parser as *Load file*).
- **Sync to server** — after a confirm dialog, the backend: validates the config →
  **backs up** the current remote file (timestamped, keeps the newest `BACKUP_KEEP`)
  → warns players with an in-game countdown (`RESTART_COUNTDOWN_SECONDS`) → saves →
  stops the server → writes the new `_SandboxVars.lua` while it's down → starts it
  back up. Progress streams into a live step log in the dialog.

Set `DRY_RUN=1` in `.env` to walk the whole push flow (with the real config
validated) without writing anything or restarting — useful for a first test. SSH
and RCON credentials stay server-side in `.env` (gitignored) and are never sent to
the browser.

## Files

| File | Purpose |
|---|---|
| `lua-parser.js` | Shared Lua parser/generator. Exports `parseSandboxVars(text)` and `generateLua(sections, values, version)`. Loaded directly as a `<script>` in the browser and via `require()` in Node — same code both places, no logic duplication. |
| `parse-config.js` | Node CLI wrapper around `lua-parser.js`. Regenerates `config-schema.json` from a `SandboxVars.lua` file and prints a per-section parameter count plus a warning list of any parameter with no comment at all. Run with `node parse-config.js [input.lua] [output.json]`. |
| `config-schema.json` | Parsed structure of the provided `SandboxVars.lua`: `{ version, sections: [{ name, paramCount, params: [...] }] }`. Each parameter carries `key`, `path`, `section`, `value`, `type`, `description`, `min`, `max`, `default`, `options`. |
| `build_translations.py` | The script used to generate `translations.json`. Not needed to run the app — kept for reference/maintenance if you want to add more languages or fix a translation. |
| `translations.json` | EN/UK translations keyed by parameter `path`: `label`, `description`, and `options` (for enums), plus a `ui` block for all interface chrome and a `sections` block for section names. |
| `index.html`, `style.css`, `app.js` | The editor UI itself. Plain HTML/CSS/JS, no framework, no build step. |
| `server/` | Optional Node backend for live-server sync: `index.js` (Express static + `/api/status`, `/api/sync/pull`, `/api/sync/push`), `lib/pzHost.js` (SSH/SFTP/RCON helpers), `.env.example` (config). Reuses `lua-parser.js` to validate any pushed config server-side. |

## Using the app

- **First visit** — before anything else, you choose "Start from scratch" (every parameter set to its documented default) or "Import file" (load an existing `SandboxVars.lua`). This only appears when there's no saved session in this browser; see [docs/adr/0001](docs/adr/0001-onboarding-scratch-vs-import.md) for what "from scratch" actually means.
- **Sidebar** — jump to a section; shows a live parameter count per section.
- **Search** — filters parameters by label, description, or raw key name, in whichever language is currently active.
- **Language toggle** (top right, EN/UK flags) — switches every piece of UI text: section names, labels, descriptions, enum option labels, buttons.
- **"?" button** — click, hover, or focus+Enter to see a translated explanation of that parameter. Escape or click-away dismisses it.
- **Modified indicator** — a card gets a highlighted amber border and dot the moment its value differs from the documented default (including values that were already non-default in the file you loaded — several were, e.g. `MultiplierConfig.Global` ships at `2.0` against a documented default of `1.0`).
- **Reset-to-default (↺)** — appears only when the source comment actually documented a default value; resets just that field.
- **Load file** — parses a different `SandboxVars.lua` client-side (same parser as the Node CLI) and replaces the current schema. Unknown/custom keys that aren't in `translations.json` fall back to an auto-generated label (camelCase → words) and the English comment text parsed straight from that file.
- **Export .lua** — regenerates a complete `SandboxVars.lua`: same key order, same nesting, `VERSION` line preserved, current values written in, comments regenerated in English. The first time you export, a one-time dialog explains the "always English comments" behavior (see Assumptions below); after that it exports immediately.
- **Sync from server / Sync to server** — only shown when the [`server/`](server/) backend is running and configured; push backs up + restarts the live server. See [Syncing to/from a live server](#syncing-tofrom-a-live-server) above.
- Your edits and language choice are saved to `localStorage` automatically, so a page reload doesn't lose your work. If you loaded a custom file, that parsed schema is also cached so a reload restores it without re-uploading.

## Assumptions and judgment calls made while building this

- **Export always writes English comments**, regardless of the UI language at the time you click Export — confirmed with the requester before building, since the file is read by the game server, not by a person browsing it in Ukrainian. A one-time in-app notice explains this the first time you export.
- **`config-schema.json` is `{ version, sections: [...] }`, not a bare array of sections.** The prompt describing this project asked for "an array of section objects," but the `VERSION = 6` line needs to survive a full parse → edit → export round-trip, and there's no natural place to put it inside a plain array (a bare JS/JSON array can't carry a named `version` property through `JSON.stringify`). Wrapping it in a small object was the least surprising fix.
- **Ten parameters have no free-text description at all in the source file** (e.g. `StartYear`, `InsaneLootFactor`, `GeneratorTileRange`, `ZombiesCountBeforeDelete` — full list is printed by `parse-config.js` on every run). `translations.json` supplies a hand-written English/Ukrainian description for all of these so nothing shows a blank tooltip; the app also has a generic fallback ("No description available." / "Опис відсутній.") for any future custom key that isn't in `translations.json` at all (e.g. a modded config with extra fields).
- **Some Lua keys collide across sections** (`Farming` and `Strength` each appear once at the root level and once inside `MultiplierConfig`/`ZombieLore` with a different meaning). Both the schema and `translations.json` key everything by the full dotted `path` (e.g. `MultiplierConfig.Farming`), not the bare key, to keep these distinct.
- **Reset-to-default** only appears when the original comment actually contained a parseable `Min:/Max:/Default:` line or a `Default = <EnumLabel>` line. A handful of string-type fields (e.g. `LootItemRemovalList`) never had a documented default, so there's deliberately no reset control for them.
- Verified end-to-end with a Node/jsdom smoke test (language toggle, search, enum/boolean/number editing, reset-to-default, load-file re-parse, and the export dialog flow) since no interactive browser was available in this environment — all passed with zero JS errors. A parse → generate → re-parse round-trip against the actual `SandboxVars.lua` also confirmed all 269 values and the comment formatting come back byte-for-byte equivalent to the source file.
