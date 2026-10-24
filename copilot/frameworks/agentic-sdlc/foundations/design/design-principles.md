---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: DP
subject: design
---

# Design Principles

What is true of well-designed code at the function/class/module level, independent of language. Reviews cite the rule ids in this file.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| DP-1 | Single Responsibility (S) | A unit has one reason to change — one actor or one policy it serves | A service that validates input, computes prices, and writes audit logs | llm | knowledge/software-design/design-principles/single-responsibility.md |
| DP-2 | Open/Closed (O) | New behaviour of an established kind is added by adding code, not by editing a central switch | A growing `if type == ...` chain edited for every new variant | llm | knowledge/software-design/design-principles/open-closed.md |
| DP-3 | Liskov Substitution (L) | Every implementation of an abstraction honours its contract (pre-conditions not stronger, post-conditions not weaker, no surprise failures) | A subtype that fails with "not supported" for an inherited operation | llm | knowledge/software-design/design-principles/liskov-substitution.md |
| DP-4 | Interface Segregation (I) | Consumers depend only on the operations they call | A consumer forced to implement or fake ten methods to use one | llm | knowledge/software-design/design-principles/interface-segregation.md |
| DP-5 | Dependency Inversion (D) | Policy depends on abstractions it owns; details implement them | Domain code importing a database driver or HTTP client | llm | knowledge/software-design/design-principles/dependency-inversion.md |
| DP-6 | DRY | Each piece of *knowledge* (rule, invariant, mapping) has one authoritative home | The same validation rule copied into three handlers | llm | knowledge/software-design/design-principles/dry.md |
| DP-7 | KISS | The simplest design that meets the stated requirement is chosen; extra complexity has a named reason | A plugin system for a feature with one variant | llm (fallback) | knowledge/software-design/design-principles/kiss-and-yagni.md |
| DP-8 | YAGNI | No speculative extension points, options, or layers without a current requirement in `spec.md` | Config flags nobody sets; an abstract base with one subclass "for later" | llm | knowledge/software-design/design-principles/kiss-and-yagni.md |
| DP-9 | Composition over inheritance | Behaviour is reused by composing collaborators; inheritance only for a true is-a with a stable contract | Deep hierarchies used to share helper methods | llm | knowledge/software-design/oop/composition-over-inheritance.md |
| DP-10 | Separation of concerns | Domain logic, I/O, presentation, and orchestration live in different units | Business rules inside request handlers or query strings | llm | knowledge/software-design/design-principles/separation-of-concerns.md |
| DP-11 | Least astonishment | Names, signatures, defaults, and side effects match what a reader would predict | `getUser()` that also creates one; a boolean parameter that inverts behaviour | llm | knowledge/software-design/design-principles/least-astonishment.md |

## Interpreting

**Rules**

**Interpreting the rules**

- **DRY is about knowledge, not text.** Two identical-looking snippets that encode *different* rules may stay duplicated; merging them couples unrelated changes. Prefer duplication over the wrong abstraction (rule of three in `../code/refactoring.md`).
- **KISS and YAGNI outrank Open/Closed for new code.** Introduce the extension point when the second concrete variant arrives, not before.
- **Dependency inversion is applied at boundaries, not everywhere.** In-process collaborators inside one module need no interface; ports at layer boundaries do (`clean-architecture.md`).
- **Least astonishment covers failure too.** A function that can fail says so in its signature or documented contract, in the form given by the stack profile's `idiom.errors`.

**Tensions and default resolutions**

| Tension | Default resolution |
|---|---|
| DRY vs. module independence | Prefer independence across module/service boundaries; apply DRY within a module |
| Open/Closed vs. YAGNI | YAGNI until a second concrete variant exists |
| SRP vs. KISS (too many tiny units) | Split only when the parts change for different reasons |
| Dependency inversion vs. KISS | Add an abstraction only where a second implementation exists or a test must substitute I/O |

**Review checks**

- A finding citing a DP rule names the unit, the rule, and the concrete change pressure that makes it matter (format in `../review/review-rubrics.md`).
- Speculative generality (DP-8) is a finding even when the code is otherwise clean.
- A DP finding without a plausible change scenario is at most `minor`.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/design-principles.md`: this foundation file.
- `{{AGENT_HOME}}/knowledge/software-design/design-principles/`: knowledge docs backing DP-1…DP-8, DP-10, DP-11.
- `{{AGENT_HOME}}/knowledge/software-design/oop/composition-over-inheritance.md`: knowledge doc backing DP-9.

**External authoritative sources:**
- Robert C. Martin, *Agile Software Development: Principles, Patterns, and Practices* (2002) — SOLID.
- Andrew Hunt & David Thomas, *The Pragmatic Programmer* (1999) — DRY.
- Gamma, Helm, Johnson, Vlissides, *Design Patterns* (1994) — "favor object composition over class inheritance".
- Barbara Liskov & Jeannette Wing, "A Behavioral Notion of Subtyping" (1994).
- Sandi Metz, "The Wrong Abstraction" (2016).

## Related

- `clean-architecture.md` — dependency inversion at architectural scale.
- `domain-driven-design.md` — where responsibility boundaries come from.
- `../quality/maintainability.md` — the quality contract these principles serve.
- `../code/coding-standards.md`, `../code/refactoring.md`
