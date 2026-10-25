---
schema: schema-system/v1
last-updated: 2026-10-24
---

# Agent Foundry: Schema System

Same meta-schema as `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/_system.md` §2: front-matter, required structure, rules, example, checks. This file lists what is specific to the Foundry.

## 1. Registry

| Schema id | File | Applies to |
|---|---|---|
| `charter/v1` (alias: Charter) | `charter.schema.md` | `charters/<agent-id>.charter.md` |
| `lesson/v1` | `lesson.schema.md` | `<lens>/lessons/LS-<n>.md` |
| `waiver/v1` | `waiver.schema.md` | `<lens>/waivers/WV-<n>.md` |
| `zone-map/v1` | `zone-map.schema.md` | `<lens>/zones.md` |
| `context-pack/v1` | `context-pack.schema.md` | runtime only (not committed) |
| `tree/v2` | **owned by agentic-sdlc**: `agentic-sdlc/schemas/tree.schema.md` | `trees/*.tree.md` |
| `floors/v1`, `resolver/v1`, `principles/v1` | defined by the file itself | `floors.md`, `resolver.md`, `principles.md` |

## 2. Shared front-matter

```yaml
---
schema: <id>/v<major>
last-updated: YYYY-MM-DD
---
```

Versioning follows agentic-sdlc: a major version changes when an existing file would stop complying.

## 3. Ids

| Thing | Format | Example |
|---|---|---|
| Charter | `<agent-id>` kebab-case | `pr-reviewer` |
| Charter rubric check | `<PFX>-R<n>`, prefix from the Charter front-matter `rubric-prefix` | `PRR-R4` |
| Lesson | `LS-<n>` unique within a lens | `LS-007` |
| Waiver | `WV-<n>` unique within a lens | `WV-003` |
| Tree | `<PFX>-Q<n>` | `PRV-Q5` |
| Principle | `FP-<n>` | `FP-2` |

## 4. A "lens" folder

A lens is a folder with a fixed shape. It may live in a project repo (`docs/lens/`) or in the Company KB (`companies/<co>/lens/<team>/`).

```text
<lens>/
├── index.md        scope: team and repo names, owners
├── zones.md        zone-map/v1
├── lessons/        LS-*.md (lesson/v1)
└── waivers/        WV-*.md (waiver/v1)
```

## 5. Shared rules

- Ids are never reused after deletion. A retired lesson stays on disk with `status: retired`.
- Dates are `YYYY-MM-DD`.
- A file that adjusts or waives a rule in `floors.md` is invalid.

## References

**Local artifacts:**
- `agentic-sdlc/schemas/_system.md`: the host schema system.
- `../floors.md`.

## Related

- Each `*.schema.md` in this folder.
