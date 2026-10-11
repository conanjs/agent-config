---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: REF
subject: code
---

# Refactoring

How engineering changes the structure of code without changing its behaviour — safely, in small verified steps, and only when it pays. Reviews cite `REF-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| REF-1 | Behaviour is preserved. A refactoring changes no observable behaviour; if a test's expected result must change, it isn't a refactoring. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| REF-2 | Green before, green after, green between. `cmd.test_unit` passes before starting and after every step. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| REF-3 | Characterize first. Untested code gets characterization tests that pin current behaviour (including odd behaviour) before it's restructured. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| REF-4 | Small steps. Each step is one named refactoring (below) that can be reverted on its own. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| REF-5 | Separate commits. Structural changes and behavioural changes are never in the same commit. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| REF-6 | Stay in scope. Refactor only what the task touches plus what the task needs; record other opportunities as a follow-up note, not a drive-by change. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| REF-7 | Public contracts don't move in a refactor. Changing an external contract is a contract change (`../design/contract-design.md`) with its own versioning. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| REF-8 | Prefer duplication over the wrong abstraction. If an abstraction keeps growing flags/conditionals, inline it back and re-extract along the real seams. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| REF-9 | Leave it better, measurably. The refactor should reduce a metric (size, complexity, coupling, duplication) or resolve a cited rule violation. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |

## Interpreting

**When to refactor**

| Trigger | Action |
|---|---|
| **Preparatory** — the planned change is hard in the current shape | Refactor first ("make the change easy, then make the easy change"), as a separate commit |
| **Rule of three** — the same knowledge appears a third time | Extract the shared abstraction (`../design/design-principles.md`, DP-6) |
| **Comprehension** — you had to puzzle out what code does | Rename/extract so the next reader doesn't |
| **Review finding** cites Q-MAINT / DP / CA rules | Refactor within the task's scope |
| **Fitness function fails** (cycle, size, direction) | Refactor until it passes; never raise the threshold silently |

Don't refactor: code you aren't otherwise touching in this task (log it instead); code without tests until characterization tests exist; during a fast-path fix beyond what the fix needs.

**Rules**

**Catalog — common smells and the refactoring that fixes them**

| Smell | Refactoring |
|---|---|
| Long function | Extract Function; Replace Temp with Query |
| Long parameter list / flag argument | Introduce Parameter Object; Split into separate functions |
| Primitive obsession | Replace Primitive with Value Object |
| Feature envy (method uses another object's data more than its own) | Move Function |
| Switch on type repeated in several places | Replace Conditional with Polymorphism |
| Divergent change (one unit changes for many reasons) | Split Phase; Extract Class/Module |
| Shotgun surgery (one change touches many units) | Move Function/Field; Combine into one module |
| Business logic in adapter | Move into a use case or domain object (`../design/clean-architecture.md`, CA-3) |
| Speculative generality | Inline Function/Class; Remove Dead Code |
| Hidden dependency (global, static access) | Inject via constructor/parameter (`idiom.di`) |

**Procedure**

1. Confirm green (`cmd.test_unit`); add characterization tests if coverage is missing (REF-3).
2. Name the smell and the target refactoring.
3. Apply one step; run `cmd.format`, `cmd.lint`, `cmd.typecheck`, `cmd.test_unit`.
4. Commit with a message naming the refactoring.
5. Repeat until the target metric or rule is satisfied; then do the behavioural change in a new commit.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Small safe steps | Feature delivery | Keep changes scoped and green; split structural and behavioral work when needed. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/code/refactoring.md`: this foundation file.

**External authoritative sources:**
- Martin Fowler, *Refactoring: Improving the Design of Existing Code* (2nd ed., 2018) — catalog at refactoring.com.
- Michael Feathers, *Working Effectively with Legacy Code* (2004) — characterization tests, seams.
- Kent Beck, "make the change easy, then make the easy change" (2012).
- Sandi Metz, "The Wrong Abstraction" (2016).

## Related

- `coding-standards.md`, `error-handling.md` — sibling engineering procedures.
- `../quality/maintainability.md` — the contract refactoring serves.
- `../review/fitness-functions.md` — metrics a refactor should improve.
- `../delivery/testing-strategy.md` — test safety net.
