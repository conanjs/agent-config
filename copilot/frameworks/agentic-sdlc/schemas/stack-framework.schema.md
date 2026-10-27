---
schema: schema/v1
last-updated: 2026-10-28
---

# Schema: Stack Framework (`stack-framework/v1`)

**Applies to:** `stacks/<stack>/frameworks/<fw>.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** roles working on a component with `framework: <fw>` · **Loaded as:** ②

Rules for using one application framework (Express, Gin, FastAPI…) **inside** this framework's architecture. It says where the framework's pieces go in the layers, and what they must not do. It is not a tutorial on the framework. Tutorials go in `{{AGENT_HOME}}/knowledge/`.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes | Parent stack id |
| `framework` | yes | Framework id (= file name) |
| `rule-prefix` | yes | e.g. `EXP` for express |
| `versions` | yes | Supported major versions, e.g. `[4, 5]` |

## Required structure

```markdown
# <framework> on <stack>

## Placement
| Framework piece | Layer | Location |
|---|---|---|

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |

## Enforcement
| Rule | Tool config |

## Example
<short good example per placement row, if not obvious>

## References
## Related
```

## Rules

- **Placement** names layers by their `docs/architecture.md` §4 names (`interface`, `application`…) or the generic clean-architecture ring names.
- Rules never restate a stack or foundation rule. They cite it ("see CS-8").

## Example

```markdown
## Placement
| Framework piece | Layer | Location |
|---|---|---|
| Router / route handlers | interface | src/modules/<module>/interface/routes/ (one router per resource, mounted in main.ts) |
| Middleware | interface | src/modules/shared/interface/ (authn, authz, rate limit only) |

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| EXP-1 | Handlers parse input, call one use case, map the result | A handler has no business branching | Permission check logic inside a handler | llm | — |
```

## Checks

| Check | Tool |
|---|---|
| Listed in the parent stack's `frameworks` front-matter | `validate.mjs` |
| Rule ids prefixed and unique | `validate.mjs` |
