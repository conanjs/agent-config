---
schema: tree/v2
last-updated: 2026-10-04
prefix: AP
owner: architecture
phases: [P1, P4]
feeds: the structure recorded in `docs/architecture.md` and `plan.md` (single project, modular monolith, or microservices)
---

# Architecture Pattern Selection (AP)

Decides the top-level shape of the system: one layered project, a modular monolith, or several independently deployed services. It does NOT decide the language (tech stack tree), deployment environments (deployment topology tree), or contract details between services (owned by system-architecture). Default bias: the simplest structure that does not foreclose splitting later.

## Overview

```
AP-Q1 Team size / deployment independence?
├─ Single team, single cadence        → AP-Q2
└─ Multiple teams, independent deploy → microservices
                                         (ESCALATE; triggers system-architecture + system repo)
AP-Q2 Expected complexity growth?
├─ Demo / prototype / low growth → single project, layered
├─ Moderate, modular growth      → modular monolith
└─ High, clear domain seams      → modular monolith now; microservices only if AP-Q1 changes
```

## Nodes

### AP-Q1 — How many teams, and is independent deployment needed?
- **Criteria:** Team structure stated in the mission, constitution or company-kb; owners in `service-catalog.yaml` if a system repo exists; stated need for different release cadences or independent scaling.
- **Branches:**
  - Single team, single deploy cadence → AP-Q2
  - Multiple teams needing independent deploys → microservices; this triggers the system-architecture role and a system repo (`platform-architecture/`), after which system-architecture runs the contract-change tree (CC-Q1) for every contract between services
- **Default:** Single team, single deploy cadence.
- **Escalate when:** the microservices branch is reached — it adds real operational cost (more pipelines, contracts, on-call surface), so it is confirmed by the human, never chosen silently.

### AP-Q2 — How much complexity growth is expected?
- **Criteria:** Mission type (demo, internal tool, product), number of bounded contexts visible in `spec.md` and `data-model.md`, stated roadmap.
- **Branches:**
  - Demo / prototype / low growth → single project, layered
  - Moderate, modular growth → modular monolith (bounded contexts as internal modules with enforced dependency direction)
  - High growth with clear domain seams → modular monolith, with module boundaries drawn on those seams; microservices only if AP-Q1 also supports it
- **Default:** modular monolith — the simplest structure that does not foreclose splitting later.
- **Escalate when:** growth signals are high but AP-Q1 answered single team — record the tension at the gate rather than splitting pre-emptively.

## Trade-off tables

| Option | Strengths | Costs | Choose when |
|---|---|---|---|
| Single project, layered | Fastest to build; one deploy | Boundaries erode as it grows | Demo, prototype, short-lived tool |
| Modular monolith | Clear module seams; one deploy; cheap to split later | Needs discipline on dependency direction | Default; most products |
| Microservices | Independent deploy and scaling per team | Contracts, distributed failure modes, more ops | Several teams with independent cadence, confirmed by human |

## Recording

One decision record, `DR-<NNN>: Architecture pattern`, in the feature's `specs/<NNN-feature>/research.md`; for a microservices outcome the record also goes in the system repo's `research.md`, and `docs/system-architecture.md` is created there.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `schemas/repo-architecture.schema.md` ? where this tree result is recorded in projects.

**External authoritative sources:**
> _None._

## Related

- `contract-change.tree.md` ? run by system-architecture once services exist.
- `deployment-topology.tree.md` ? environments and rollout for whatever shape this tree picks.
