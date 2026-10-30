---
schema: schema/v1
last-updated: 2026-10-24
---

# Schema: Charter (`charter/v1`)

**Applies to:** `charters/<agent-id>.charter.md` · **Written by:** the Foundry's builder (human or agent), then reviewed by a human · **Read by:** the agent's wrappers, the Resolver, the validator

A Charter is the tool-neutral definition of **one agent**: who it is, what it may not do, what it knows, how it decides, what it may learn, and how much freedom it has. It reuses the section names and meaning of `agent-role/v2` but is a separate schema (see `proposals/agent-foundry-charter-and-floors.md` §Q1). It drops SDLC-only fields (`phases`, `model-tier`, `tag`) and adds `Knowledge bindings`, `Lens`, `Autonomy` and `Eval`.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `charter/v1` |
| `id` | yes | Kebab-case agent id; equals the file name stem |
| `rubric-prefix` | yes, if the agent reviews | 2–5 capitals, e.g. `PRR` |
| `autonomy` | yes | `suggest-only` · `comment` · `request-changes` |
| `last-updated` | yes | Date |

## Required structure

````markdown
# Charter: <Name> (`<id>`)

## Identity
<two sentences: what it owns; the boundary with the humans and with other agents>

## Does NOT do
- <non-responsibility> → <who does it>

## Principles
<`all`, or a list of FP-ids (default: all)>

## Knowledge bindings
| Kind | Names | Why |
|---|---|---|
| rules | <rule prefixes or ids from foundations/> | … |
| references | <knowledge topics> | … |
| facts | <repo / system / zone map> | … |

## Runtime inputs
| Input | Required | Source |
|---|---|---|

## Decision flow
| Tree | Prefix | Used for |
|---|---|---|

## Modes
### mode: review
<what it produces; what it never does>

## Review rubric
| Id | Check | Rules | Enforced by | Severity if failed |
|---|---|---|---|---|
| <PFX>-R1 | … | Q-SEC-5, RUB-5 | llm | blocker |

## Lens
| Key | Value |
|---|---|
| scopes | `team:<name>`, `repo:<name>`, `path:<glob>` |
| may | lower severity one step · add check · add waiver |
| may not | touch any rule in `floors.md` |
| promotion | `trees/lesson-promotion.tree.md` |

## Autonomy
| Level | Allowed | Moves up when |
|---|---|---|
| suggest-only | Private summary to the author | start |
| comment | Public comments | thresholds in `## Eval` |
| request-changes | Mark "changes requested" for blockers | thresholds in `## Eval` |

Never: approve or merge.

## Eval
| Metric | Meaning | Threshold to move up | Threshold to move down |
|---|---|---|---|
| acceptance rate | share of comments humans accepted | … | … |
| noise rate | share dismissed as irrelevant | … | … |
| missed blockers | real blockers the agent missed | 0 | any |
| floor recall | floor findings still found after any Lens change | 100% | below 100% |

Golden set: `<path>` (past PRs with the human outcome).

## Escalate when
- <condition>

## Output
Every reply follows `agentic-sdlc/schemas/message.schema.md` (`message/v2`), with `provenance` added to each finding.

## References
## Related
````

## Rules

- **Autonomy is a front-matter value, not a hand edit.** Raising it needs a PR that cites the Eval run.
- The `Review rubric` is the **only** place severities are defined for this agent (the rule tables have none).
- Every rubric row that lists a floor rule has severity `blocker`.
- Knowledge bindings name things; they never copy rule or reference text.
- Trees are cited by node id, never paraphrased.
- No language or tool names in the Charter body (tool glue lives in wrappers).
- `Does NOT do` must include "approve or merge" for any reviewing agent.

## Checks

| Check | Tool |
|---|---|
| Front-matter keys present; `id` equals file name stem | `validate-foundry.mjs` |
| Every required section present | `validate-foundry.mjs` |
| Rubric ids use `rubric-prefix` and are unique | `validate-foundry.mjs` |
| Floor rules in the rubric are `blocker` | `validate-foundry.mjs` |
| Each tree listed under `Decision flow` exists | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `agentic-sdlc/schemas/agent-role.schema.md`: the schema whose section names are reused.
- `../resolver.md`, `../floors.md`.

## Related

- `lesson.schema.md`, `waiver.schema.md`.
