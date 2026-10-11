---
schema: topic-index/v1
kind: subtopic
topic: software-design/functional-modeling
last-updated: 2026-10-04
---

# Functional modeling

Functional modeling covers immutable data, pure domain cores, explicit type-shaped alternatives, Result-style workflow composition, and tests for functional-pipeline code. It does not cover object-oriented aggregate modeling; see `software-design/oop/` and `software-design/ddd/` for class-modeled design topics.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [immutability.md](immutability.md) | concept | Immutable core data, structural sharing, TypeScript readonly types, and runtime cost notes | verified |
| [functional-core.md](functional-core.md) | concept | Functional core / imperative shell, impure-pure-impure sandwich, thin shell, and decisions-as-data | verified |
| [types-as-rules.md](types-as-rules.md) | concept | Illegal states as unrepresentable types, discriminated unions, parse-don't-validate, and workflow outcomes | verified |
| [pipelines.md](pipelines.md) | concept | Small named workflow steps, Result chaining, railway-oriented programming, and effect boundaries | verified |
| [testing.md](testing.md) | concept | Table/example-driven and property-based tests for pure cores, plus shell integration testing | verified |

## References
- [Domain Modeling Made Functional](https://fsharpforfunandprofit.com/ddd/) — Scott Wlaschin / F# for Fun and Profit, living. Backs: subtopic scope.
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — Gary Bernhardt / Destroy All Software, 2012. Backs: subtopic scope.
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites every concept doc in this subtopic.

## Related
- `software-design/ddd/`
- `software-design/oop/`
- `js-runtime/v8-hidden-classes.md`
