---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: RLS
subject: delivery
---

# Release Pipeline

How devops builds the CI/CD flow from the stack profile's `cmd.*` slots, promotes artifacts through environments, and makes every release reversible and observable. Reviews cite `RLS-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| RLS-1 | Pipeline = slots. CI invokes only `cmd.*` slots; no improvised commands in pipeline definitions. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-2 | Build once, promote the same artifact. The artifact built in CI is the one deployed to every environment; only configuration differs. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-3 | Config and secrets are environment-injected (`idiom.config`), never baked into the artifact (`../delivery/threat-modeling.md`, THR-1). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-4 | Main is always releasable. Merges require green CI and review (G5); a red main is fixed or reverted first. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-5 | Every deploy is reversible — by redeploying the previous artifact or flipping a flag — and the rollback has been exercised. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-6 | Migrations are expand-then-contract (below); a migration never breaks the currently running version. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-7 | Incomplete features ship dark behind a flag, default off; flags have an owner and a removal date. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-8 | Deploys are observable: each release is annotated with version and commit; error rate and latency are compared before/after. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-9 | Automated rollback trigger: if post-deploy health or SLO burn exceeds the threshold, roll back without waiting for a human. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RLS-10 | Least-privilege CI identity; production deploy credentials are scoped to the deploy stage only. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**CI stages (every pull request)**

| # | Stage | Runs | Fails the build when |
|---|---|---|---|
| 1 | Install | `cmd.install` | Lockfile out of date or resolution fails |
| 2 | Format | `cmd.format` | Any diff |
| 3 | Lint | `cmd.lint` | Any error, including architecture rules (`../review/fitness-functions.md`) |
| 4 | Typecheck | `cmd.typecheck` | Any type error |
| 5 | Unit tests | `cmd.test_unit` | Any failure; coverage below constitution floor |
| 6 | Integration + contract tests | `cmd.test_integration` | Any failure; contract incompatibility |
| 7 | Dependency audit | `cmd.audit` | Unaccepted high/critical finding |
| 8 | Build artifact | `cmd.build` | Build fails; artifact is versioned and immutable |

The stack profile's `ci_template` composes exactly these slots, so CI and local checks can't diverge. Stages 2–4 may run in parallel; 5–7 after 1.

**Rules**

**Environments and promotion gates**

| Environment | Purpose | Promotion gate into it |
|---|---|---|
| **ephemeral / preview** | Per-PR verification | CI stages 1–8 green |
| **staging** | Production-like integration, E2E for P1 stories | Merged to main; E2E smoke passes after deploy |
| **production** | Users | Staging green; G5 approved; change window/approval if the constitution requires; progressive rollout (canary → full) with health checks at each step |

**Expand-then-contract (schema & contract changes)**

| Phase | Release | Do |
|---|---|---|
| 1. Expand | N | Add new column/field/endpoint/event version; old remains; code writes both (or old) |
| 2. Migrate | N | Backfill data; switch reads to new behind a flag |
| 3. Switch | N+1 | All consumers on the new shape; verify usage of old = 0 |
| 4. Contract | N+2 | Remove old column/field/version (`../design/contract-design.md`, CON-12) |

Never combine expand and contract in one release. Each step is independently deployable and reversible.

**Feature flags**

- Kinds: **release** (temporary, hides incomplete work), **ops** (kill switch for a dependency), **permission** (entitlements). Only release flags are expected to be removed.
- Both flag states are tested for the flagged path.
- Stale release flags (past removal date) are a review finding.

**Observability basics (required before first production release)**

| Signal | Minimum |
|---|---|
| Logs | Structured (`idiom.logging`), correlation id, no secrets/PII |
| Metrics | Rate, errors, duration per entry point; saturation of pools/queues |
| Traces | Propagated trace context across service hops |
| Health | Liveness and readiness endpoints (`../quality/reliability.md`, Q-REL-7) |
| Alerts | On SLO burn rate, not on individual errors |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Process completeness | Fast feedback | Keep required evidence, but choose the lightest check that proves the rule. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/delivery/release-pipeline.md`: this foundation file.

**External authoritative sources:**
- Jez Humble & David Farley, *Continuous Delivery* (2010).
- Forsgren, Humble, Kim, *Accelerate* (2018) — DORA metrics.
- Pete Hodgson, "Feature Toggles (aka Feature Flags)", martinfowler.com (2017).
- Danilo Sato, "ParallelChange" (expand/contract), martinfowler.com (2014).
- W3C Trace Context Recommendation; Google SRE Workbook — "Alerting on SLOs".

## Related

- `../quality/reliability.md` — Q-REL-9, Q-REL-10.
- `../delivery/testing-strategy.md` — which test levels run in which stage.
- `../delivery/threat-modeling.md` — secrets and dependency audit.
- `../review/fitness-functions.md` — automated checks in the lint/test stages.
