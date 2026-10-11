---
schema: tree/v2
last-updated: 2026-10-04
prefix: RT
owner: security
phases: [P1, P4, P6]
feeds: the feature risk tier (LOW / MEDIUM / HIGH) and the security controls it switches on
---

# Risk Tier (RT)

Assigns one risk tier per feature. It does NOT produce the threat model itself or decide fixes — it decides how much security scrutiny the feature gets. **Default is fail-closed:** when the answer to any question is unknown, take the YES branch. Re-run at P6 whenever a task touches a path the P4 walk did not anticipate.

## Overview

```
RT-Q1 Authn/authz, payments, secrets/keys, cryptography, or PII?
├─ YES → HIGH
└─ NO  → RT-Q2 Changes infrastructure exposure?
          ├─ YES → HIGH
          └─ NO  → RT-Q3 New untrusted-input surface or networked third-party dependency?
                    ├─ YES → MEDIUM
                    └─ NO  → LOW
```

## Nodes

### RT-Q1 — Does it touch authn/authz, payments, secrets/keys, cryptography, or personal data (PII)?
- **Criteria:** `spec.md` user stories and entities, `data-model.md` fields (names, emails, addresses, identifiers), task file paths touching auth, session, key or payment code.
- **Branches:**
  - YES → HIGH
  - NO → RT-Q2
- **Default:** YES when unknown (fail-closed).
- **Escalate when:** the feature handles a regulated data class (health, payment card, government ID) or the constitution names a compliance regime — security cannot self-certify; human review required.

### RT-Q2 — Does it change infrastructure exposure?
- **Criteria:** IAM/permission changes, network rules, new public endpoints, CORS changes, new cloud resources — from `plan.md`, IaC paths and the deployment-topology walk.
- **Branches:**
  - YES → HIGH
  - NO → RT-Q3
- **Default:** YES when unknown (fail-closed).
- **Escalate when:** the change grants broader permissions than the task needs, or opens a resource to the public internet.

### RT-Q3 — Does it add a new untrusted-input surface or a new third-party dependency with network/filesystem access?
- **Criteria:** New public or webhook endpoint, file upload, deserialization of external data, user-supplied query or template; any new dependency in the manifest that performs network or filesystem I/O.
- **Branches:**
  - YES → MEDIUM
  - NO → LOW
- **Default:** YES when unknown (fail-closed).
- **Escalate when:** a new dependency is unmaintained, has known unresolved advisories from `cmd.audit`, or comes from an unverified source.

## Trade-off tables

| Tier | What it switches on |
|---|---|
| **LOW** | Mechanical checks only: dependency audit (`cmd.audit`) + secret scan added to the P6 script worker |
| **MEDIUM** | LOW + security review of every P6 task touching the new surface; input-validation checklist from `declarative/quality/security.md` |
| **HIGH** | MEDIUM + STRIDE-lite threat-model table in `plan.md` before G3; test-depth tree's security branch forced (unit tests mandatory); security review on every task in the feature; security sign-off before G5 |

A tier only ever rises during a feature. Lowering it requires a new decision record approved by the human.

## Recording

One decision record, `DR-<NNN>: Risk tier`, in the feature's `specs/<NNN-feature>/research.md` (preview at P1 marked `Confidence: low`, final at P4). A P6 re-run that raises the tier writes a new record that supersedes the previous one. A human lifting a security block is recorded with `Decided by: human`.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `conventions.md` ?7, ?8 ? security block precedence and fast-path LOW requirement.

**External authoritative sources:**
> _None._

## Related

- `test-strategy-depth.tree.md` ? a HIGH tier forces TD-Q2.
- `deployment-topology.tree.md` ? exposure changes found there feed RT-Q2.
