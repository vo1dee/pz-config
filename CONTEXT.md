# Project Zomboid B42 Sandbox Config Editor

A single-page editor for a Project Zomboid Build 42 `SandboxVars.lua` server config.

## Language

**Start from scratch**:
The onboarding choice that populates every parameter with its documented `default` value (from `config-schema.json`'s `default` field), not the bundled example file's shipped `value`. For the ~49 parameters that have no documented default at all (e.g. `LootItemRemovalList`, `StarterKit`), this falls back to the bundled example's `value` instead, since there is no other valid value to export.
_Avoid_: "reset", "blank slate" (fields are never left null/empty — every field always has a valid exportable value)

**Documented default**:
The `Default:` value parsed from a parameter's source comment in the original `SandboxVars.lua`, stored as `default` in `config-schema.json`. Distinct from the parameter's shipped `value`, which is what the bundled example file actually had that field set to — the two differ for several parameters (e.g. `MultiplierConfig.Global` ships at `2.0` against a documented default of `1.0`).
_Avoid_: "the default" (ambiguous between this and the shipped value)
