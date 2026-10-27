# Proposals

A proposal compares options for a change before anyone builds it. It is a working document for one decision round. It is **not** where an adopted choice lives: once implemented, each decision moves to a permanent home that agents and developers actually read. The proposal stays as the record of why.

Analogy: a proposal is the shop's comparison sheet for three ovens. Once one oven is bought, the kitchen keeps the manual for that oven by the oven. The comparison sheet goes in the file drawer. If the menu changes, the other ovens on the sheet may become the right choice, so the sheet is kept, and the kitchen manual says which other ovens were considered.

## Lifecycle

| Status | Means | Required |
|---|---|---|
| Draft | Options and a recommendation; nothing built | A decisions table with a recommended answer per row |
| Approved | The owner answered each decision (quote their words) | The answers in the decisions table; a "Lands in" entry per row |
| Implemented | Every decision is in its permanent home | The status line lists commits and any differences from the draft |

## Where each decision lands

The test is who the decision is for and whether more than one answer stays valid.

| Kind of decision | Permanent home | Example |
|---|---|---|
| One answer for every project (the framework's own design) | A `D<n>` entry in `copilot/frameworks/agentic-sdlc/index.md` "Decisions", linking the proposal | D12: each stack reference lives in its own repo |
| Several valid answers; each project picks one | The stack's `idioms.md` "Options" table: default, alternatives, and "choose the alternative when". The tech-stack role offers it at P4 (TC-Q3). The schema requires a tested configuration, so a row is added when its config is proven | Alias mechanism (TSN-15); HTTP status-code source (from reference v2.1.0) |
| A rule that a review or tool can fail | A foundation or stack rule id (`MOD-9`, `CMT-13`, `TSN-13`) | MOD-9: layer-first or feature-first packaging |
| A reusable technique, not a rule | `copilot/patterns/<slug>.pattern.md` and its catalog row | Maintained Variant |
| A fact about a technology | A knowledge doc | Problem Details (RFC 9457) in `knowledge/web-apis/http-error-mapping.md` |

The options the owner did **not** choose are still useful. If they remain valid for some projects, they go in the Options table as alternatives, with the condition that makes them right. If they were rejected outright, the proposal keeps them, and the permanent home links to the proposal ("considered and rejected: see …").

## Rules

1. Every row of a proposal's decisions table names where it lands, before implementation starts.
2. Implementing a proposal includes moving each decision to its home. A proposal is "Implemented" only when no decision lives only in it.
3. A later change to a decision edits its permanent home, not the old proposal. The proposal's status line notes that it was superseded and where.

Proposals written before 2026-10-27 are not retrofitted. Their decisions already landed as D1–D12.

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/index.md`: the "Decisions" list (D1–D12).
- `copilot/frameworks/agentic-sdlc/schemas/stack-idioms.schema.md`: the optional "Options" section of a stack.
- `copilot/patterns/index.md`: the pattern catalog.
- `agentic-sdlc-reference-feature-first.md`: the first proposal written under these rules.

**External authoritative sources:**
- [Michael Nygard, "Documenting Architecture Decisions"](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (2011): a decision record keeps context, decision and consequences, and is superseded rather than edited.
- [ADR GitHub organization, "Architectural Decision Records"](https://adr.github.io/): the considered options are part of the record (MADR's "Considered Options").

## Related

- `copilot/patterns/revise-without-erasing.pattern.md`: when a decision moves into its home, nothing the proposal explained is dropped.
