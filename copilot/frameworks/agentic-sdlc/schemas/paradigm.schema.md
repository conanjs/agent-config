---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Paradigm Profile (`paradigm/v1`)

**Applies to:** `paradigms/<id>.md` · **Store:** A · **Written by:** framework maintainer (engineering proposes) · **Read by:** roles working on a component or layer with `paradigm: <id>@<major>` · **Loaded as:** ②

A paradigm is **how code is shaped**: how the domain is modeled, where state lives, how behaviour is composed and where effects happen. Examples: `class-modeled` (rich objects, constructor-injected services) and `functional-pipeline` (immutable data, transformation functions, effects at the edges).

A paradigm file is stack-agnostic. How it looks in a given language lives in the stack overlay (`stack-paradigm.schema.md`). This file says WHAT; the overlay says HOW.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | e.g. `class-modeled` |
| `version` | yes | Major version. Components pin `<id>@<major>` |
| `supports` | yes | Stack ids that have an overlay for this paradigm |
| `compatible-with` | no | Paradigms that may sit in other layers of the same component |

## Required structure

```markdown
# Paradigm: <name> (`<id>@<version>`)

## Core idea        <one paragraph + one analogy>
## Use when         <signals that favour it — feeds PDM tree>
## Avoid when       <signals against it>
## Modeling         <how domain concepts are represented>
## State            <where state lives; how it changes>
## Composition      <how behaviour is combined/varied>
## Effects          <where I/O happens; how dependencies arrive>
## Errors shape     <how expected failures surface (form defined by idiom.errors)>
## Testing shape    <what tests look like under this paradigm>

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |

## Escape hatches
| When | Allowed deviation | Must record |
|---|---|---|

## Changelog
| Version | Change | Breaking? |

## References
## Related
```

## Rules

- Rule ids are `PDM-<id>-R<n>`. Rule tables follow `_system.md` §1.2.
- No language syntax, no tool names. A short pseudo-code sketch is allowed in **Modeling**.
- Every stack in `supports` has an overlay file with an Enforcement row for every rule marked `lint`, `typecheck` or `test`.
- **Breaking change** (a rule added or tightened so existing compliant code fails) means bumping `version` and adding a Changelog row. Components on the old major keep it until a decision record moves them.
- `Source` points into `{{AGENT_HOME}}/knowledge/software-design/…` (reference notes written in our own words, never copied book text; see the v2 proposal §6.7).

## Example

```markdown
---
schema: paradigm/v1
last-updated: 2026-10-04
id: class-modeled
version: 1
supports: [typescript-node]
compatible-with: [functional-pipeline]
---
# Paradigm: Class-modeled (`class-modeled@1`)

## Core idea
Each domain concept is an object that owns its data and the rules about it — like a bank account that refuses an
overdraft itself, instead of every teller checking.

## Rules
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PDM-class-modeled-R1 | State is private; changed only through intention-named methods | No public mutable fields on domain types | `role.permissions.push(p)` | lint | {{AGENT_HOME}}/knowledge/software-design/oop/encapsulation.md |
| PDM-class-modeled-R3 | Use cases are types with constructor-injected ports | No exported use-case functions taking repositories as params | `createRole(roles, perms, input)` | lint | {{AGENT_HOME}}/knowledge/software-design/oop/dependency-injection.md |

## Escape hatches
| When | Allowed deviation | Must record |
|---|---|---|
| Pure stateless calculation (e.g. pricing formula) | free function in the domain layer | a one-line comment citing this hatch |
```

## Checks

| Check | Tool |
|---|---|
| Front-matter; all 9 shape sections present | `validate.mjs` |
| An overlay exists per `supports` entry; lint/test rules are mapped there | `validate.mjs` |
| Version bump if a rule changed on a breaking basis | reviewer (llm) at maintainer PR |
