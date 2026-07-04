# Prompt for Claude Code: Project Zomboid Build 42 Sandbox Config Web Editor

Copy everything below into Claude Code, in a folder that contains your `SandboxVars.lua` file (or point it to the file's path).

---

## Goal

Build a single-page web app (viewer + editor) for a Project Zomboid Build 42 `SandboxVars.lua` server config file. The app must:

1. Parse the **actual** `SandboxVars.lua` file I provide (attached in this folder as `SandboxVars.lua`) — do not hardcode a parameter list from memory, since Build 42 has hundreds of fields and they must match my file exactly, including nested tables.
2. Render every parameter as an editable form control, grouped by section.
3. Show a "?" icon next to every single parameter that opens/reveals an explanation tooltip or popover.
4. Support a language toggle (Ukrainian ⇄ English) that switches ALL UI text: section names, parameter labels, tooltip explanations, enum option labels, buttons, etc.
5. Let me export my edits back out as a valid `SandboxVars.lua` file.

## Step 1 — Build a parser (do this first, don't skip)

Write a parser (Node script or build-time script) that reads `SandboxVars.lua` and produces a structured JSON schema. The file has this shape:

```lua
SandboxVars = {
    VERSION = 6,
    -- Comment describing the parameter. Default = X
    -- 1 = Option A
    -- 2 = Option B
    ParamName = 4,
    ...
    NestedSection = {
        -- comment
        SubParam = true,
    },
}
```

For each parameter, extract:
- **key** — the Lua variable name (e.g. `ZombieRespawn`)
- **path** — full dotted path including nesting (e.g. `ZombieLore.Speed`, `ZombieConfig.PopulationMultiplier`)
- **value** — the current value in the file (number, float, boolean, or string)
- **type** — infer from the value: `boolean`, `integer`, `float`, `string`, or `enum`
  - It's an **enum** if the comment block above it contains lines like `-- 1 = Something` — collect all `N = Label` pairs as the enum options, in order.
- **description** — the free-text comment line(s) above the parameter that are NOT `N = Label` option lines and NOT `Min:`/`Max:`/`Default:` metadata. Strip any embedded formatting tags like `<BHC>`, `<RGB:...>` etc. but preserve the actual warning text they wrap (e.g. "[!] It is recommended that you DO NOT change this. [!]" should still show, just without the color-tag markup).
- **min / max / default** — parse from patterns like `Min: 0.00 Max: 4.00 Default: 0.80` when present in the comment.
- **section** — the top-level or nested table name it lives under (root params go in a "General" section). Sections to expect include things like population/zombie basics, loot categories, time/world settings, `ZombieLore`, `ZombieConfig`, `MultiplierConfig` (skill XP rates), `Basement`, `Map`, and others — derive them from the actual nesting in the file, don't assume this list is exhaustive.

Output this as `config-schema.json`, an array of section objects, each containing an array of parameter objects with the fields above.

**Validation step:** after parsing, print a count of total parameters found and a count per section, so I can sanity-check nothing was dropped. Also flag (in the console) any parameter that has a numeric value but no comment at all, since it'll need a fallback description.

## Step 2 — Translations

Every parameter needs BOTH an English and a Ukrainian description, plus translated section names, enum option labels, and UI chrome (buttons, headers, search placeholder, etc.).

- Use the parsed English comment as the English description (`en`).
- Generate accurate Ukrainian translations (`uk`) for every description, section name, and enum label. Keep the Lua **key names themselves untranslated** (e.g. `ZombieRespawn` stays as-is — only the human-readable label/description is translated).
- Store translations in a structure like:

```json
{
  "ZombieRespawn": {
    "label": { "en": "Zombie Respawn", "uk": "Відродження зомбі" },
    "description": { "en": "How frequently new zombies are added to the world.", "uk": "..." },
    "options": {
      "1": { "en": "High", "uk": "Високо" },
      "2": { "en": "Normal", "uk": "Нормально" }
    }
  }
}
```
- For the human-readable **label** (as opposed to the raw Lua key), auto-generate a readable form by splitting the camelCase key into words (e.g. `WaterShutModifier` → "Water Shut Modifier"), then let a native-sounding Ukrainian equivalent be written based on the parameter's actual meaning from its description — not a literal word-for-word translation of the camelCase split.

## Step 3 — Frontend

Plain HTML/CSS/JS (or React if you prefer, your call) single-page app, no backend required, runs by opening `index.html` or via a simple dev server.

**Layout:**
- Left sidebar: list of sections (collapsible), clicking scrolls/filters to that section. Show parameter count per section.
- Top bar: language toggle switch (🇺🇦 / 🇬🇧 or "UK / EN"), a search box that filters parameters by name/label/description across all sections (search should work in whichever language is active), and "Load file" / "Export .lua" buttons.
- Main panel: parameters grouped under section headers, each parameter as a row/card with:
  - Label (translated)
  - Input control matched to type:
    - `boolean` → toggle switch
    - `enum` → dropdown/select showing translated option labels
    - `integer`/`float` → number input with min/max enforced (slider optional, but a plain number input is fine), showing the allowed range and default next to the field
    - `string` → text input
  - A "?" icon button next to the label — clicking (or hovering on desktop) shows the translated description in a tooltip/popover. Keep it keyboard-accessible (focusable, dismissible with Escape).
  - A small "reset to default" icon if a Default value was found in the comments.
- Values that differ from their default should be visually marked (e.g. a colored dot or "modified" badge) so I can see at a glance what I've changed.

**Behavior:**
- On load, read `config-schema.json` (or let me upload a `SandboxVars.lua` file directly via the "Load file" button and re-run the parser client-side or via a small local script).
- Editing a field updates in-memory state immediately.
- "Export .lua" button regenerates a valid `SandboxVars.lua` file: same structure, same key order, same nesting, VERSION line preserved, comments preserved above each parameter (in whatever language was active at export time — actually, default to always writing English comments into the exported file regardless of UI language, since the file itself is consumed by the game/server, not a human reading Ukrainian — but ask me to confirm this assumption before finalizing if it seems ambiguous), and updated values reflecting my edits. Trigger a download of the file.
- Persist my edits and language choice in localStorage so reloading the page doesn't lose my work.

## Step 4 — Polish

- Responsive enough to use on a laptop screen at least (mobile is a nice-to-have, not required).
- Dark theme by default (this is a game server config tool, dark UI fits).
- No external network calls needed at runtime — everything should work offline once loaded.

## Deliverables

1. `parse-config.js` (or equivalent) — the Lua parser
2. `config-schema.json` — parsed structure from my actual file
3. `translations.json` — EN/UK translation data
4. `index.html` + CSS/JS (or React app) — the actual editor UI
5. A short `README.md` explaining how to run it locally

Ask me for clarification only if something in my actual `SandboxVars.lua` doesn't fit the patterns described above (e.g. an unusual comment format) — otherwise proceed and make reasonable judgment calls, noting any assumptions in the README.
