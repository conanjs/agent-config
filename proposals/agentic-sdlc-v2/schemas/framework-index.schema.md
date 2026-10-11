---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Framework Index (`framework-index/v1`)

**Applies to:** `index.md` at the framework root · **Store:** A · **Written by:** framework maintainer · **Read by:** humans first; the Orchestrator at session start · **Loaded as:** n/a (an orientation doc, not a rule source)

The single summary of the whole framework: what it is, how the parts connect, and where each file lives. It **explains**; it does not define rules. Any rule it mentions is linked to the file that owns it (`conventions.md`, a role file, a foundation). If this file and an owning file disagree, the owning file wins and this file is fixed.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `framework-version` | yes | e.g. `2.0.0-draft` |
| `status` | yes | `draft` · `active` · `deprecated` |

## Required structure

```markdown
# <Framework name>
<one-paragraph definition + one analogy>

## 1. At a glance            — one diagram of the whole system
## 2. Actors                 — every role: id, tag, owns, model tier
## 3. Knowledge kinds        — Rule / Reference / Fact
## 4. Knowledge homes        — stores A–D, what each holds, how it is loaded
## 5. Loading model          — ① preset ② profiles ③ state; precedence
## 6. Profiles               — the dimension registry (stack, framework, paradigm, …)
## 7. Workflow               — phases P0–P7 and gates G0–G5
## 8. One task end to end    — a worked trace with a diagram
## 9. Enforcement            — tools first, then LLM review
## 10. Standalone use        — using one role without the Orchestrator
## 11. Learning loop         — how lessons flow back into stores
## 12. File map              — every file → its schema
## 13. How to extend         — checklists: add a role, stack, paradigm, foundation, dimension, knowledge doc, integration
## 14. Glossary
## 15. Status & decisions    — version, decisions taken, open questions
## References
## Related
```

## Rules

- Every section exists, in this order (an empty one says `> _None yet._`).
- No rule ids are **defined** here. Rule ids only appear as links to the file that defines them.
- §12 lists every schema in `schemas/_system.md` §4. The validator compares the two lists.
- §13 checklists are numbered and name every file that must change.

## Example

`proposals/agentic-sdlc-v2/README.md`, which will become the v2 `index.md`.

## Checks

| Check | Tool |
|---|---|
| All 15 numbered sections plus References/Related are present, in order | `validate.mjs` |
| §12 schema set = `_system.md` §4 schema set | `validate.mjs` |
| Every relative link resolves | `validate.mjs` |
