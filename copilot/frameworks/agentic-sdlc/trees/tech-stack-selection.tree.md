---
schema: tree/v2
last-updated: 2026-10-04
prefix: TS
owner: tech-stack
phases: [P1, P4]
feeds: the language and primary data store per component, recorded in `plan.md` and mapped to a stack in `docs/architecture.md` (`components:`)
---

# Tech Stack Selection (TS)

Decides which language (and so which stack profile) a component uses, and which primary data store it relies on. It does NOT decide tools inside a stack (that is the toolchain tree) or how the code is structured (architecture pattern tree). Org standards and existing code always outrank a fresh choice: a greenfield choice is the last resort, not the first question.

## Overview

```
TS-Q0 Org standards fix the stack?
├─ YES → use them (deviation = escalate) ─────────────────────┐
└─ NO  → TS-Q1 Mission states a stack?                        │
          ├─ YES → use it ────────────────────────────────────┤
          └─ NO  → TS-Q2 Extending an existing codebase?      │
                    ├─ YES → inherit ─────────────────────────┤
                    └─ NO  → TS-Q3 Greenfield: dominant constraint
                              ├─ I/O-bound API     → TypeScript | Go
                              ├─ CPU / data proc.  → Go | Rust | Python+native
                              ├─ ML / data science → Python
                              ├─ Systems / perf    → Rust | Go
                              └─ None dominant     → TypeScript ─┤
                                                                 ▼
                                                   TS-Q4 Data store
```

## Nodes

### TS-Q0 — Do org standards fix the stack?
- **Criteria:** The system repo's constitution (`.specify/memory/constitution.md`), the `stack:` of sibling services in `docs/service-catalog.yaml`, and the company-kb entry for this company (`copilot/companies/<company>/`) if one exists. A rule counts only if it is written down, not inferred from habit.
- **Branches:**
  - YES → use the mandated stack → TS-Q4
  - NO → TS-Q1
- **Default:** NO, when no system repo, constitution or company-kb entry exists.
- **Escalate when:** the mandated stack cannot satisfy a constraint stated in the spec (e.g. a required library exists only in another ecosystem) — deviation from an org standard is a human decision.

### TS-Q1 — Does the mission state a stack explicitly?
- **Criteria:** The human's mission text, `blueprint.md`, or `spec.md` names a language or framework as a requirement (not as an example).
- **Branches:**
  - YES → use it → TS-Q4
  - NO → TS-Q2
- **Default:** NO — a stack mentioned only in passing ("something like Go") is treated as a preference, recorded as a criterion for TS-Q3.
- **Escalate when:** the stated stack conflicts with a TS-Q0 standard or with a stated constraint (e.g. "Python" plus "sub-millisecond latency").

### TS-Q2 — Is this extending an existing codebase or system?
- **Criteria:** P0 stack detection (manifest files present in the repo), `components:` in `docs/architecture.md`, or an existing service this component joins.
- **Branches:**
  - YES → inherit the existing stack → TS-Q4
  - NO → TS-Q3
- **Default:** YES whenever any manifest file is present — never introduce a second stack into a repo as a side effect of a feature.
- **Escalate when:** the inherited stack cannot satisfy a stated constraint, or the feature would add a second language to the same repo.

### TS-Q3 — Greenfield: what is the dominant constraint?
- **Criteria:** Non-functional requirements in `spec.md` (throughput, latency, CPU vs I/O profile), required libraries, and the team-familiarity statement in the constitution.
- **Branches:**
  - I/O-bound API service → TypeScript | Go
  - CPU-bound / data processing → Go | Rust | Python with native extensions
  - ML / data-science heavy → Python
  - Systems / embedded / performance-critical → Rust | Go
  - No dominant constraint → TypeScript
- **Default:** No dominant constraint → TypeScript.
- **Tie-breaker:** applied in order whenever a branch lists more than one option:
  1. Language already used elsewhere in the same system (`service-catalog.yaml`) — fewer stacks to operate.
  2. Team familiarity stated in the constitution.
  3. Required libraries exist and are maintained for that ecosystem.
  4. Still tied → first option listed, recorded with `Confidence: low` so it surfaces at the gate.
- **Escalate when:** no available stack exists for the chosen language, or two constraints of equal weight point to different branches.

### TS-Q4 — Which primary data store?
- **Criteria:** Data shape and consistency needs from `spec.md` and `data-model.md`; write volume and region requirements; stores already operated by the system (`service-catalog.yaml`, existing infra).
- **Branches:** see the table below; an existing store in the codebase or system is inherited first.
- **Default:** Relational, ACID → PostgreSQL.
- **Escalate when:** any row's escalation trigger below holds, or the feature needs a store not yet operated anywhere in the system (new operational cost).

| Need | Default | Escalation trigger |
|---|---|---|
| Relational, ACID | PostgreSQL | Multi-region active-active, or >10k writes/sec stated |
| Document / flexible schema | Stack-dependent (e.g. MongoDB) | Strong cross-document consistency required |
| Cache / queue | Redis | Durability requirements exceed Redis's guarantees |

## Recording

One decision record per component for the language (`DR-<NNN>: Stack for <component>`) and one for the primary data store, appended to the feature's `specs/<NNN-feature>/research.md` in the format of `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/decision-record.schema.md`. The chosen stack is then written into `docs/architecture.md` `components:` at P7.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `schemas/repo-architecture.schema.md` ? `stack:` component field written after this decision.

**External authoritative sources:**
> _None._

## Related

- `toolchain-selection.tree.md` ? runs after this tree, inside the chosen stack.
- `architecture-pattern-selection.tree.md` ? structure of the code, decided alongside at P4.
