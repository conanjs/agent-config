---
schema: paradigm/v1
last-updated: 2026-10-04
id: functional-pipeline
version: 1
supports: [typescript-node]
compatible-with: [class-modeled]
---

# Paradigm: Functional pipeline (`functional-pipeline@1`)

## Core idea

Model the core as a clear series of transformations from input to output, with side effects kept at the edges. Analogy: an assembly line transforms raw material through visible stations; receiving and shipping happen at the doors, not inside every station.

## Use when

Use this when the component's main job is parsing, validating, enriching, filtering, routing, reporting, importing, exporting, or otherwise transforming data without owning long-lived identity.

## Avoid when

Avoid using this alone for rule-rich state that must stay valid across many operations. If the component owns persistent identity and invariants, use a behavior-owning model for that core and keep pipelines at the boundary if useful.

## Modeling

Represent data with plain immutable records and explicit alternatives. Each step receives a value and returns a new value or an expected failure. The shape of the data communicates the workflow stage.

## State

Core transformations do not mutate shared state. A step either returns a changed value or an explicit failure. Any durable state is loaded before the core pipeline and saved after it by the shell.

## Composition

Compose small named steps in the order work happens: parse, validate, decide, map, and persist through the shell. Branching is represented as explicit alternatives instead of hidden flags.

## Effects

Effects live in the imperative shell: reading inputs, calling external systems, writing state, logging, and scheduling. The functional core receives already-loaded facts and returns decisions the shell can enact.

## Errors shape

Expected failures are values that travel through the pipeline. A failing step stops or routes the pipeline according to the workflow's explicit error policy. Unexpected failures remain outside the core and follow the active stack's exceptional-error idiom.

## Testing shape

Core tests are table-shaped: input, expected output, expected failure. Shell tests verify adapter wiring and effect ordering separately from core transformation rules.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PDM-functional-pipeline-R1 | Keep core data immutable across transformation steps | Each step returns a new value or explicit failure | A validation step mutates a shared request object in place | typecheck | knowledge/software-design/functional-modeling/immutability.md |
| PDM-functional-pipeline-R2 | Keep I/O out of core transformation steps | Core steps receive facts and return decisions without external calls | A validation function queries storage directly | lint | knowledge/software-design/functional-modeling/functional-core.md |
| PDM-functional-pipeline-R3 | Model workflow alternatives explicitly | Success, validation failure, and rejected cases are named in the data shape | A boolean flag controls several unrelated branches | llm | knowledge/software-design/functional-modeling/types-as-rules.md |
| PDM-functional-pipeline-R4 | Compose workflows from small named steps | A reader can follow the pipeline order without opening every step | One large routine parses, validates, calls adapters, and formats output | llm | knowledge/software-design/functional-modeling/pipelines.md |
| PDM-functional-pipeline-R5 | Keep the imperative shell thin | The shell only loads inputs, calls the core, and applies returned decisions | Business rules live in controllers, jobs, or adapters | lint | knowledge/software-design/functional-modeling/functional-core.md |
| PDM-functional-pipeline-R6 | Test core transformations with table examples | Tests cover representative inputs and failures without real external systems | Only end-to-end tests cover validation logic | llm | knowledge/software-design/functional-modeling/testing.md |

## Escape hatches

| When | Allowed deviation | Must record |
|---|---|---|
| A transformation is performance-critical and copying is too expensive | Use localized mutation hidden behind a pure-looking boundary | Decision record or code comment naming the measured constraint |
| A boundary API forces mutable data | Normalize into immutable core data before the first core step | Boundary mapper location in the task or decision record |
| A subdomain grows persistent identity and invariants | Split that subdomain into a class-modeled component or layer | New `PDM-<component>` decision record |

## Changelog

| Version | Change | Breaking? |
|---|---|---|
| 1.0.0 | Initial functional-pipeline paradigm for v2 migration | No |

## References

**Local artifacts:**
- `schemas/paradigm.schema.md` — required paradigm profile structure.
- `trees/paradigm-selection.tree.md` — selects this paradigm at PDM-Q3.
- `stacks/typescript-node/paradigms/functional-pipeline.md` — first concrete stack overlay and enforcement mapping.

**External authoritative sources:**
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — modeling workflows and constraints with functional concepts.
- [F# for Fun and Profit: Domain Modeling Made Functional](https://fsharpforfunandprofit.com/ddd/) — public articles by Wlaschin on functional domain modeling.
- [Gary Bernhardt, “Functional Core, Imperative Shell”](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — core/shell separation.

## Related

- `class-modeled.md` — contrasting paradigm for invariant-owning domain state.
- `../trees/paradigm-selection.tree.md` — decision tree that chooses between paradigms.
