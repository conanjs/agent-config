---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Stack Paradigm Overlay (`stack-paradigm/v1`)

**Applies to:** `stacks/<stack>/paradigms/<paradigm>.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** roles working on a component or layer with that stack + paradigm pair · **Loaded as:** ② (together with the paradigm file)

Shows **how one paradigm looks in one language**, and **how its rules are enforced by that language's tools**. It is the only place that knows both the paradigm and the language, so it is where paradigm rules turn into lint config.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes | Stack id |
| `paradigm` | yes | `<id>@<major>` it implements |

## Required structure

````markdown
# <paradigm> on <stack>

## Shape mapping
| Paradigm section | <language> form |
|---|---|
| Modeling | … |
| State | … |
| Composition | … |
| Effects | … |
| Errors shape | … |
| Testing shape | … |

## Example
```<lang>
<one aggregate + one use case, showing the shape end to end>
```

## Counter-example
```<lang>
<the same thing written in a way that violates the paradigm, each line commented with the rule it breaks>
```

## Enforcement
| Rule | Tool config | Scope (paths) |
|---|---|---|
| PDM-<id>-R<n> | <lint rule / test> | <glob> |

## References
## Related
````

## Rules

- **Shape mapping** has one row per shape section of the paradigm file.
- **Enforcement** has a row for every paradigm rule marked `lint`, `typecheck` or `test`. If the rule can't be mapped in this stack, the row says `llm (fallback): <reason>`.
- Scope paths are generic globs for the default feature-first layout (`src/modules/*/domain/**`, MOD-9). Projects whose layout differs, such as an opted-in layer-first repo (`src/domain/**`), override them in their own lint config, never here.
- Tool names are allowed here, because this file sits inside `stacks/` (V6).

## Example

See the v2 proposal §2.2 (shape mapping and `Role` example) and §7 (Enforcement table for typescript-node).

## Checks

| Check | Tool |
|---|---|
| `paradigm` exists and lists this stack in `supports` | `validate.mjs` |
| Every lint/typecheck/test rule of the paradigm has an Enforcement row | `validate.mjs` |
