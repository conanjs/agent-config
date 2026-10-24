---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Decision Tree (`tree/v2`)

**Applies to:** `trees/<name>.tree.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** the owning role, in `decide` mode only · **Loaded as:** ③-adjacent (named in a decide-mode launch prompt; never preset)

A **flowchart of questions that ends in a choice**, plus the rules for when to stop and ask a human. Each node has an id, so decision records can cite the exact path taken.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `prefix` | yes | 2–5 capital letters, unique (e.g. `PDM`) |
| `owner` | yes | Role id |
| `phases` | yes | e.g. `[P1, P4]` |
| `feeds` | yes | What the outcome sets (e.g. `docs/architecture.md §3 paradigm`) |

## Required structure

````markdown
# <Tree name> (<PREFIX>)

<one paragraph: what this tree decides and what it does NOT decide>

## Overview
```
<ASCII tree of all nodes and branches>
```

## Nodes
### <PREFIX>-Q1 — <question>
- **Criteria:** <evidence that answers it and where to find it>
- **Branches:**
  - <answer> → <next node | outcome>
- **Default:** <answer when evidence is missing>
- **Tie-breaker:** <only if a branch lists several outcomes>
- **Escalate when:** <condition where the default is unsafe>

## Trade-off tables
| Option | Strengths | Costs | Choose when |

## Recording
<which decision record id pattern this tree produces, and where>

## References
## Related
````

## Rules

- Node headings are exactly `### <PREFIX>-Q<n>[a-z] — <question>`.
- Every node has `Default` and `Escalate when` (V8).
- Outcomes name concepts, not tools (V6). Stack and paradigm ids are allowed as outcomes.
- `## Trade-off tables` may be `> _None._`.

## Checks

| Check | Tool |
|---|---|
| `prefix` unique across trees; all node ids use it | `validate.mjs` |
| Default and Escalate-when on every node | `validate.mjs` |
| Every branch target exists | `validate.mjs` |

## Changes from v1

- Location moves `principles/contextual/` → `trees/`.
- The header line becomes front-matter. The validator now reads `prefix` from front-matter instead of a hardcoded regex.
- References and Related are now required.
