---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Role Definition (`agent-role/v2`)

**Applies to:** `agents/<role-id>.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** the role's own instance (through its wrapper); the Orchestrator, to build launch prompts · **Loaded as:** the role's identity; its Preset list defines ①

The tool-neutral definition of one role: what it owns, what it always knows (Preset), what it expects at runtime, how it acts in each mode, and how it reviews. Wrappers in each tool only point here. **No language or tool names** appear in this file. Those come from the stack profile at runtime.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Must match `conventions.md` §1 |
| `tag` | yes | Task tag, e.g. `[Eng]` |
| `model-tier` | yes | `Top` · `Mid` (`conventions.md` §9) |
| `phases` | yes | e.g. `[P2, P4, P6]` |
| `rubric-prefix` | yes, if the role reviews | e.g. `ENG` → `ENG-R1…` |

## Required structure

````markdown
# Role: <Name> (`<role-id>`)

## Identity
<two sentences: what it owns; the boundary with its nearest neighbour role (who wins, per conventions §7)>

## Does NOT do
- <non-responsibility> → <role that does it>

## Preset knowledge
<!-- ① Always loaded, in this order. Paths under foundations/. -->
| Doc | Why this role needs it | Modes |
|---|---|---|
| foundations/<subject>/<name>.md | <one line> | all \| review \| decide … |

## Runtime inputs
<!-- ② and ③ -->
| Input | Required | Source |
|---|---|---|
| stack | yes \| no \| n/a | component/layer in docs/architecture.md |
| <other dimension> | … | … |
| state.<key> | … | launch prompt |

## Trees owned
| Tree | Prefix | Phase |
|---|---|---|

## Modes
### mode: propose
### mode: decide
### mode: execute
<what it produces; definition of done: tier-1 checks pass before replying>
### mode: review
<which rubric ids; only rules whose Enforced by = llm, plus confirming tier-1 results>
<!-- A mode the role never runs in stays as a heading with "Not used: <reason>." -->

## Review rubric
| Id | Check | Enforced by | Severity if failed |
|---|---|---|---|
| <PFX>-R1 | … | llm | blocker \| major \| minor |

## Standalone use
<what it does when invoked directly with no Orchestrator: how it resolves profiles (request → docs/architecture.md → manifest → ask), which checks become N/A, what it never writes>

## Escalate when
- <condition>

## Output
Every reply follows `schemas/message.schema.md`.
````

## Rules

- The Preset list holds **only** `foundations/` paths. A stack or paradigm file in Preset is an error. Those are profiles (②).
- There is no cap on the Preset list (D6). Every entry still needs a "Why" line, so additions are deliberate.
- The rubric uses the rule-table spirit. Each check has `Enforced by`. Checks marked `lint`, `typecheck` or `test` are confirmed from tool output, not re-judged.
- Trees are cited by node id (`PDM-Q2`), never paraphrased.
- No language or tool names (V6).

## Example

````markdown
---
schema: agent-role/v2
last-updated: 2026-10-04
id: engineering
tag: "[Eng]"
model-tier: Mid
phases: [P2, P4, P6]
rubric-prefix: ENG
---
# Role: Engineering (`engineering`)

## Identity
Owns how code is written inside the boundaries `architecture` sets. Structure disputes → architecture (conventions §7).

## Preset knowledge
| Doc | Why | Modes |
|---|---|---|
| foundations/code/coding-standards.md | baseline code rules (CS-*) | all |
| foundations/design/domain-driven-design.md | aggregate rules DDD-7..14 apply to code | all |
| foundations/review/review-rubrics.md | severity scale | review |

## Runtime inputs
| Input | Required | Source |
|---|---|---|
| stack | yes (code tasks) | component/layer |
| paradigm | no (absent = no paradigm constraint) | component/layer |

## Review rubric
| Id | Check | Enforced by | Severity |
|---|---|---|---|
| ENG-R10 | Code follows the assigned paradigm's PDM rules, or names an escape hatch | llm (PDM rules marked lint are confirmed from cmd.lint) | major |
````

## Checks

| Check | Tool |
|---|---|
| Front-matter `id` and `tag` match `conventions.md` §1 | `validate.mjs` |
| Every Preset path exists under `foundations/` | `validate.mjs` |
| Rubric ids use `rubric-prefix` and are unique | `validate.mjs` |
| No tool names from any stack's `tools` slot (V6) | `validate.mjs` |

## Changes from v1

- `## Knowledge` (taxonomy-routed) is replaced by `## Preset knowledge` (an explicit list) and `## Runtime inputs`.
- `## Responsibilities` is merged into `## Identity` and `## Modes`.
- New: `## Review rubric` as a table with `Enforced by`; `## Standalone use`.
- The header line becomes front-matter.
