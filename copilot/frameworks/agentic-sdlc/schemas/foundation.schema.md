---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Foundation (`foundation/v2`)

**Applies to:** `foundations/<subject>/<name>.md` (subjects: `code`, `design`, `quality`, `delivery`, `review`) · **Store:** A · **Written by:** framework maintainer; promoted from the learning loop · **Read by:** every role that lists it in its Preset · **Loaded as:** ①

A foundation holds **universal rules**: true in every language and every paradigm. It is normative and short. Explanations, history and deep material belong in the global knowledge base. A foundation rule links there through its `Source` column.

**Put it in a foundation only if** it should bind every task of every role that presets this file. If it is true only for one language → `stacks/`. If only for one modeling style → `paradigms/`. If it is an explanation → `knowledge/`.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `rule-prefix` | yes | e.g. `CS`, `EH`, `DP`, `DDD` (unique across the framework) |
| `subject` | yes | `code` · `design` · `quality` · `delivery` · `review` (matches the folder) |

## Required structure

```markdown
# <Title>

<one paragraph: what this governs; what it deliberately leaves to stacks/paradigms>

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|

## Interpreting
<edge cases: how to apply a rule when it's unclear; one bullet per case, citing the rule id>

## Tensions
| Rule A | Rule B | Default resolution |
|---|---|---|

## References
## Related
```

## Rules

- Rule-table format follows `_system.md` §1.2. Ids use `rule-prefix`.
- **Paradigm-neutral wording.** A rule that favours one paradigm (v1's CS-4 "pure core", CS-5 "immutability by default") is rewritten neutrally. For example, "effects are isolated at the edges, in the form the paradigm prescribes", with the paradigm's own rules giving the detail. Otherwise it moves to that paradigm.
- **Language-neutral wording.** No tool names (V6). Refer to stack slots instead (`idiom.errors`, `cmd.lint`).
- `Source` points into `{{AGENT_HOME}}/knowledge/` when the rule was distilled from a reference doc.
- No section may contain long explanation. Anything over about 5 lines per rule moves to a knowledge doc.

## Example

```markdown
---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: DDD
subject: design
---
# Domain-Driven Design

Rules for modeling the domain. How the model is expressed (objects vs. data + functions) is the paradigm's job.

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| DDD-8 | Change aggregate state only through the root | Outside code calls root operations, never edits members | A use case pushes into `role.permissions` | llm | {{AGENT_HOME}}/knowledge/software-design/ddd/aggregates.md |

## Interpreting
- DDD-8 under functional-pipeline: "the root" is the module that owns the aggregate's transition functions.

## Tensions
| Rule A | Rule B | Default resolution |
|---|---|---|
| DDD-8 | CS-2 small units | Keep invariants on the root even if the root grows; split by sub-entity, not by bypassing the root |
```

## Checks

| Check | Tool |
|---|---|
| Front-matter keys; `subject` matches the folder | `validate.mjs` |
| Rule ids unique and prefixed; `Enforced by` is a valid value | `validate.mjs` |
| Every `Source` path exists | `validate.mjs` |
| No stack tool names (V6) | `validate.mjs` |

## Changes from v1

- Location moves from `principles/{declarative,procedural,meta}/…` to `foundations/<subject>/…`.
- New front-matter keys `rule-prefix` and `subject`. The rule table gains `Enforced by` and `Source`. `## Tensions` becomes a table.
