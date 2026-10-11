---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: CS
subject: code
---

# Coding Standards

How engineering writes code in any language: readable, small, explicit, and mechanically checked. The stack profile supplies the concrete form via `idiom.*` slots and enforces formatting/linting via `cmd.*` slots. Reviews cite `CS-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| CS-1 | Names reveal intent and use the ubiquitous language (`../design/domain-driven-design.md`, DDD-1). Booleans read as predicates (`isActive`, `hasAccess`); functions as verbs. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-2 | Small units. A function does one thing at one level of abstraction; respect the constitution's size/complexity thresholds (default ≤ 50 lines, complexity ≤ 10). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| CS-3 | Few parameters. More than 3–4 parameters, or any boolean flag parameter, becomes a named options structure or separate functions. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-4 | Isolate effects at the edges in the form the assigned paradigm prescribes. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-5 | Control mutation according to ownership and the assigned paradigm. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-6 | Make illegal states unrepresentable. Prefer precise types (value objects, enums/sum types) over primitive strings and nullable bags of fields. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-7 | Explicit absence. Represent "no value" in the stack profile's idiomatic way; never use magic values (`-1`, `""`) to mean absent. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-8 | Errors follow `idiom.errors` and the rules in `error-handling.md`. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-9 | Concurrency follows `idiom.concurrency`: every started task is awaited, joined, or explicitly supervised; every blocking operation is cancellable. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-10 | Dependencies are injected per `idiom.di`; no hidden globals or service locators in domain/application code. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-11 | Configuration per `idiom.config`: read once at startup, validated, typed, passed in; no scattered environment reads; no secrets in code. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-12 | Logging per `idiom.logging`: structured, levelled, with correlation id; no sensitive data; log at the boundary where an error is handled, not at every layer. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-13 | Comments explain why, not what. Delete commented-out code; link decisions to their decision record. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-14 | No magic numbers/strings. Named constants with units in the name (`timeoutMs`, `maxRetries`). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-15 | Public surfaces are documented (doc comment on exported types/functions stating contract, errors, and side effects). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CS-16 | New dependencies need a reason. Adding a third-party package requires a decision record and passing `cmd.audit`. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | script | — |
| CS-17 | Each commit leaves the build green and is scoped to one task. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Mechanical baseline (every task, before review)**

| Slot | Must |
|---|---|
| `cmd.format` | Pass with no diff |
| `cmd.lint` | Pass with zero new warnings/suppressions |
| `cmd.typecheck` | Pass (or `cmd.build` where the compiler is the type checker) |
| `cmd.test_unit` | Pass |

Formatting and lint style are never review topics — if a style rule matters, it goes into the `cmd.lint` configuration, not into a review comment.

**Rules**

**Stack profile slots referenced**

| Slot | Governs |
|---|---|
| `idiom.errors` | How failures are represented and propagated |
| `idiom.concurrency` | Async/parallel primitives, cancellation, structured concurrency |
| `idiom.di` | How dependencies are supplied and wired |
| `idiom.config` | How configuration is loaded, validated, and passed |
| `idiom.logging` | Logger, structure, levels, correlation |

When a stack profile's idiom conflicts with a rule above, the stack profile wins on *form*, this file wins on *intent* — escalate if both can't be met.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Small safe steps | Feature delivery | Keep changes scoped and green; split structural and behavioral work when needed. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/code/coding-standards.md`: this foundation file.

**External authoritative sources:**
- Robert C. Martin, *Clean Code* (2008).
- Steve McConnell, *Code Complete* (2nd ed., 2004).
- Yaron Minsky, "Effective ML" — "make illegal states unrepresentable".
- John Ousterhout, *A Philosophy of Software Design* (2018).

## Related

- `error-handling.md`, `refactoring.md` — sibling engineering procedures.
- `../design/design-principles.md` — the principles behind these rules.
- `../quality/maintainability.md` — the quality contract reviews check.
