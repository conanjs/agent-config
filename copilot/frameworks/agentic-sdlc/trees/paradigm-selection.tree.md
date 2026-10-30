---
schema: tree/v2
last-updated: 2026-10-04
prefix: PDM
owner: engineering
phases: [P1, P4]
feeds: docs/architecture.md §3 component `paradigm:` or §4 layer override, plus a `PDM-<component>` decision record
---

# Paradigm Selection (PDM)

Decides the modeling paradigm for a component or layer. It does NOT choose the language, framework, toolchain, architecture pattern, or testing depth; it only decides how code should model state, behavior, effects, and errors after the component boundary is known.

## Overview

```
PDM-Q1 Does existing code in this component follow one paradigm consistently?
├─ YES → keep it (retrofit; no rewrite)
└─ NO / greenfield → PDM-Q2
PDM-Q2 Does the component own invariants enforced across operations?
├─ YES → class-modeled
└─ NO  → PDM-Q3
PDM-Q3 Is it an input→output transform with no persistent identity?
├─ YES → functional-pipeline
└─ NO  → PDM-Q4
PDM-Q4 Does the project constitution declare a default paradigm?
├─ YES → use that default
└─ NO  → ASK at G0
```

## Nodes

### PDM-Q1 — Does existing code in this component follow one paradigm consistently?
- **Criteria:** Inspect the current component and its architecture entry. Consistent means the domain and application code already use one clear shape for modeling state, behavior, effects, and errors.
- **Branches:**
  - YES → keep the existing paradigm; retrofit the architecture record and decision record, but do not rewrite code only to rename the paradigm. Done.
  - NO / greenfield → PDM-Q2
- **Default:** NO for greenfield or mixed code.
- **Escalate when:** keeping the current shape would conflict with an approved constitution rule or a security block.

### PDM-Q2 — Does the component own invariants enforced across operations?
- **Criteria:** `spec.md`, `data-model.md`, and domain language show lifecycle states, identity, aggregate consistency, permission rules, limits, or other invariants that must hold across more than one operation.
- **Branches:**
  - YES → class-modeled
  - NO → PDM-Q3
- **Default:** YES when the spec names persistent business entities with rules that can be violated by later operations.
- **Escalate when:** invariants are shared across components or services and ownership is unclear.

### PDM-Q3 — Is it an input→output transform with no persistent identity?
- **Criteria:** The component is a script, parser, converter, report builder, stateless handler, or workflow whose core job is transforming inputs into outputs without owning long-lived domain identity.
- **Branches:**
  - YES → functional-pipeline
  - NO → PDM-Q4
- **Default:** NO when the component stores or revisits business state.
- **Escalate when:** the component mixes a rule-rich core with a large transformation shell and the split should become a layer override.

### PDM-Q4 — Does the project constitution declare a default paradigm?
- **Criteria:** `.specify/memory/constitution.md` or `docs/architecture.md` declares a project default paradigm for this component kind or layer.
- **Branches:**
  - YES → use the declared default
  - NO → ASK at G0
- **Default:** ASK at G0 — absence of a default is not consent to invent one silently.
- **Escalate when:** the default conflicts with the evidence from PDM-Q2 or PDM-Q3.

## Trade-off tables

| Option | Strengths | Costs | Choose when |
|---|---|---|---|
| Keep existing paradigm | Avoids churn; preserves working code | May preserve weak modeling if the current shape is accidental | Existing code is consistent and not blocked by higher-priority rules |
| class-modeled | Centralizes invariants on domain concepts with identity | More ceremony for simple transforms | Rule-rich domain state must stay valid across operations |
| functional-pipeline | Keeps transformations explicit and easy to test | Can scatter invariants if persistent identity exists | Core work is input→output with effects at the edge |
| ASK at G0 | Prevents silent architectural drift | Slows planning until answered | Evidence and constitution do not point to one paradigm |

## Recording

Write one paradigm decision record per component as `PDM-<component>` in `specs/<feature>/research.md`. Later changes use `PDM-<component>-2`, `PDM-<component>-3`, and so on, with `Supersedes` set. The chosen paradigm is declared in `docs/architecture.md` §3 for the component, or in §4 as a layer override, as `paradigm: <id>@<major>`.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` §2.3 and §5.2 — PDM selection behavior and tree overview.
- `schemas/tree.schema.md` — `tree/v2` node format and validation rules.
- `schemas/decision-record.schema.md` — `PDM-<component>` decision record id form.
- `schemas/repo-architecture.schema.md` — component and layer `paradigm:` fields.

**External authoritative sources:**
> _None._

## Related

- `../paradigms/class-modeled.md` — class-modeled paradigm selected by PDM-Q2.
- `../paradigms/functional-pipeline.md` — functional-pipeline paradigm selected by PDM-Q3.
- `tech-stack-selection.tree.md` — selects the stack independently of this tree.
