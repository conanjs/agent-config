---
schema: tree/v2
last-updated: 2026-10-04
prefix: CC
owner: system-architecture
phases: [P1, P4, P7]
feeds: contract versioning, provider/consumer migration slices, and when an old version may be removed
---

# Contract Change (CC)

Decides how a change to an inter-service contract (sync API spec or async event spec) is versioned, rolled out and retired. Contracts are owned by the system repo; a service repo never changes one locally. It does NOT decide the internal implementation in any service, or deployment environments (deployment topology tree). Contract-first ordering applies: the contract change merges in the system repo before any provider or consumer implements it.

## Overview

```
CC-Q1 Backward compatible (additive only)?
├─ YES → minor version; no consumer change required. Done.
└─ NO  → CC-Q2 Breaking change:
          new major version; both versions live; consumers in
          service-catalog migrate; provider deploys first
          → CC-Q3 Remove old major version?
             ├─ No consumer in service-catalog still consumes it → remove
             └─ Any consumer remains → keep; re-check at next system P7
```

## Nodes

### CC-Q1 — Is the change backward compatible (additive)?
- **Criteria:** Diff of the contract under `contracts/`. Additive = new optional fields, new endpoints, new event types, new optional parameters. Breaking = removed or renamed fields, type changes, a new required field in a request, narrowed enums, changed semantics of an existing field or status code.
- **Branches:**
  - YES → minor version bump (`@v3` stays `v3`, minor recorded in the spec's version field); no consumer change required; provider may deploy any time after the contract merges. Done.
  - NO → CC-Q2
- **Default:** NO when unsure — treat ambiguous changes (semantic changes with an unchanged shape) as breaking.
- **Escalate when:** a change is shape-compatible but alters behaviour consumers rely on (ordering, idempotency, error meaning).

### CC-Q2 — Breaking: how is the new version introduced?
- **Criteria:** `docs/service-catalog.yaml` — every service listing this contract under `consumes`; the system constitution's versioning rules.
- **Branches:**
  - Breaking → new major version file (e.g. `billing.openapi.yaml@v4`) alongside the old; both versions served; one `[Slice]` task for the provider and one per consumer listed in the catalog; provider deploys first, consumers migrate after → CC-Q3
- **Default:** new major version with both versions live — never edit a published major version in place.
- **Escalate when:** the provider cannot serve both versions at once (shared state that cannot be mapped), or a consumer outside the service-catalog is known to use the contract.

### CC-Q3 — May the old major version be removed?
- **Criteria:** `consumes` entries in `docs/service-catalog.yaml` and each consumer repo's `contracts_consumed` in `docs/architecture.md` (checked against the current system repo tag).
- **Branches:**
  - No consumer in service-catalog still consumes the old version → remove it in a later system feature: provider drops support, contract file retired, catalog updated at system P7
  - Any consumer still listed → keep the old version live; re-check at the next system-repo P7
- **Default:** keep — removal requires positive evidence that no consumer remains.
- **Escalate when:** a consumer has not migrated by an agreed deadline, or retiring the old version is needed for a security fix.

## Recording

One decision record per contract change, `DR-<NNN>: Contract <name> <old>→<new>`, in the **system repo's** `specs/<NNN-feature>/research.md`, listing provider, consumers to migrate, and rollout order. Removal of an old version is its own record that supersedes nothing but cites the record that introduced the new version.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `schemas/decision-record.schema.md` ? records emitted by this tree.

**External authoritative sources:**
> _None._

## Related

- `deployment-topology.tree.md` ? applies the rollout order decided here for multi-repo deploys.
- `architecture-pattern-selection.tree.md` ? the microservices outcome that brings contracts into existence.
