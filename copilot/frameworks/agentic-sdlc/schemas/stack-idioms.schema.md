---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Stack Idioms (`stack-idioms/v1`)

**Applies to:** `stacks/<id>/idioms.md` · **Store:** A · **Written by:** framework maintainer; promoted from the learning loop · **Read by:** roles working on a component with this stack · **Loaded as:** ②

How the stack-agnostic rules **look in this language**, plus rules that are true only in this language (runtime and performance behaviour, language conventions). This is where knowledge about one stack builds up over time. Each new rule is short and has an id. Its explanation lives in a knowledge doc, which the rule cites in its `Source` column.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes | The stack id |
| `rule-prefix` | yes | e.g. `TSN` for typescript-node, `GO`, `PY`, `RS` |

## Required structure

````markdown
# Idioms: <display name> (`<stack id>`)

## idiom.errors
<2–4 lines of explanation>
```<lang>
<good example>
```
## idiom.concurrency
## idiom.di
## idiom.config
## idiom.logging

## Language conventions
<subset of the style_guide that matters and isn't formatter-enforced>
| Id | Rule | Holds when | Typical violation | Enforced by | Source |

## Runtime & performance
| Id | Rule | Holds when | Typical violation | Enforced by | Source |

## Enforcement
| Rule | Tool config |
|---|---|
| <foundation/stack rule id> | <lint rule / test / config that enforces it in this stack> |

## References
## Related
````

## Rules

- The five `idiom.*` sections always exist and match the slot names in `index.md`.
- Rule tables follow `_system.md` §1.2, with ids `<rule-prefix>-<n>`.
- **Enforcement** maps every foundation rule marked `lint`, `typecheck` or `test` to concrete config for this stack, or says `llm (fallback): <reason>`. Paradigm rules are mapped in the paradigm overlay instead.
- Runtime-internals rules (V8, GC, GIL…) must have a `Source` into `{{AGENT_HOME}}/knowledge/`. The explanation is never written here.

## Example

```markdown
## Runtime & performance
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| TSN-12 | In hot paths, initialize every field in the constructor; never add properties later | Objects of one type share one shape | `obj.extra = x` after construction inside a loop | llm | {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md |

## Enforcement
| Rule | Tool config |
|---|---|
| CS-2 (unit size) | `max-lines-per-function: 50`, `complexity: 10` |
| FF-1 (layer deps) | boundary rules generated from docs/architecture.md §4 |
```

## Checks

| Check | Tool |
|---|---|
| Five idiom sections present | `validate.mjs` |
| Every foundation rule with `lint`, `typecheck` or `test` is mapped or has a fallback | `validate.mjs` (warning) |
| Runtime & performance rules have a `Source` | `validate.mjs` |
