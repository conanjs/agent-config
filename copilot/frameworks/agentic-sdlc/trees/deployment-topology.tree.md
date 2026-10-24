---
schema: tree/v2
last-updated: 2026-10-04
prefix: DT
owner: devops
phases: [P1, P4, P7]
feeds: environments, pipeline steps, rollback plan and rollout order recorded in `plan.md`
---

# Deployment Topology (DT)

Decides whether a change alters deployment, what environments it needs, how it is rolled back, and (multi-repo) in which order services deploy. It does NOT decide internal code structure (architecture) or contract versioning rules (contract-change tree, owned by system-architecture). DevOps never creates or requests credentials itself.

## Overview

```
DT-Q1 Does the change alter deployment at all?
├─ NO  → existing pipeline runs as-is. Done.
└─ YES → DT-Q2 Topology already exists?
          ├─ YES → inherit; add minimum new step/resource → DT-Q4
          └─ NO  → DT-Q3 Who uses it?
                    ├─ Demo / internal prototype → single env, deploy on merge → DT-Q4
                    └─ Real users → staging + production, manual promotion → DT-Q4
DT-Q4 How is it rolled back?
├─ Stateless code     → redeploy previous version
├─ Schema / data      → expand-then-contract
└─ Risky behaviour    → feature flag, default off
                       → DT-Q5 (multi-repo only)
DT-Q5 Does it change a contract?
├─ YES → provider deploys first; old version live until all consumers migrate
└─ NO  → deploy independently
```

## Nodes

### DT-Q1 — Does the change alter deployment at all?
- **Criteria:** New service, new env var or secret, new infra resource, schema migration, new scheduled job, or new external integration — from `plan.md`, `data-model.md` and task paths.
- **Branches:**
  - NO → no deploy change; existing pipeline runs as-is. Done.
  - YES → DT-Q2
- **Default:** YES when `plan.md` lists any new resource, secret or migration; NO otherwise. (NO is required for the fix fast path.)
- **Escalate when:** the change needs a new cloud account, paid service or recurring cost.

### DT-Q2 — Does a deployment topology already exist?
- **Criteria:** CI/CD workflow files, IaC, documented environments in `docs/architecture.md`.
- **Branches:**
  - YES → inherit; add only the minimum new step or resource → DT-Q4
  - NO → DT-Q3
- **Default:** YES if any pipeline file exists.
- **Escalate when:** the existing topology cannot host the change without restructuring environments.

### DT-Q3 — Who uses it?
- **Criteria:** Mission type and audience in `blueprint.md` / `spec.md`.
- **Branches:**
  - Demo / internal prototype → single environment, deploy on merge to main → DT-Q4
  - Real users → staging + production, manual promotion gate between them → DT-Q4
- **Default:** Real users — the safer topology when the audience is unstated.
- **Escalate when:** the environment needs credentials the agent does not have.

### DT-Q4 — How is this change rolled back?
- **Criteria:** Whether the change carries state (schema, data), and how visible its behaviour is to users.
- **Branches:**
  - Stateless code change → redeploy previous version
  - Schema / data migration → expand-then-contract: backward-compatible migration ships first, destructive step only in a later release
  - Risky user-facing behaviour → behind a feature flag, default off
- **Default:** Stateless → redeploy previous version.
- **Tie-breaker:** if several apply, combine them, strictest first: expand-then-contract for the data, feature flag for behaviour, redeploy for the rest.
- **Escalate when:** a production data migration is irreversible.

### DT-Q5 — (multi-repo only) Does it change a contract?
- **Criteria:** The feature's slice task references a contract version change in the system repo; `contracts_provided` / `contracts_consumed` in `docs/architecture.md`.
- **Branches:**
  - YES → provider deploys before consumers; old contract version stays live until every consumer in `service-catalog.yaml` has migrated (versioning per CC-Q2, removal per CC-Q3)
  - NO → deploy independently
- **Default:** NO for a single-repo project (node skipped); YES if the slice task names any contract.
- **Escalate when:** two services must deploy atomically (a cyclic contract dependency) — that is an architecture problem, not a rollout problem.

## Recording

One decision record, `DR-<NNN>: Deployment topology`, in the feature's `specs/<NNN-feature>/research.md`; cross-repo rollout order (DT-Q5) is recorded in the system repo's `research.md` for the system feature.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `conventions.md` ?8 ? fast path requires DT-Q1 = NO.

**External authoritative sources:**
> _None._

## Related

- `contract-change.tree.md` ? versioning rules behind DT-Q5.
- `risk-tier.tree.md` ? exposure changes found here raise the risk tier.
