# OTS Knowledge Base

> **Purpose**: Accumulated architecture, flow, and business knowledge across OTS repos.
> Reading these docs + targeted source reads replaces full codebase exploration.
> Updated every time a feature is worked on.

This is one instance of the **Company KB Framework**, defined at [`{{AGENT_HOME}}/frameworks/company-kb/`]({{AGENT_HOME}}/frameworks/company-kb) — see [`conventions.md`]({{AGENT_HOME}}/frameworks/company-kb/conventions.md) for writing rules and [`schemas/_system.md`]({{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md) for the schema-compliance mechanism. The framework definition is shared, not duplicated per company; this `ots/` folder holds only OTS's own content. If a second company's knowledge base is ever added, it lives as a sibling folder under `{{AGENT_HOME}}/companies/`, using the same shared framework.

**Structure:** flat (see `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md#structure-options` for what this means and the alternative).

## System

| System | Purpose | Path | Docs |
|---|---|---|---|
| OTS Shipment | System-level context map and service catalog for the four OTS repos | `system/` | [architecture](system/architecture.md), [service catalog](system/service-catalog.yaml) |

## Repos

| Repo | Purpose | Path | Doc |
|---|---|---|---|
| `ne-manage-shipment-frontend` | React frontend for import shipment management | `{{OTS_REPOS_ROOT}}/ne-manage-shipment-frontend` | [overview](repos/ne-manage-shipment-frontend/overview.md) |
| `ne-api-gateway` | NestJS REST gateway, bridges FE ↔ gRPC microservices | `{{OTS_REPOS_ROOT}}/ne-api-gateway` | [overview](repos/ne-api-gateway/overview.md) |
| `ne-import-shipment-api` | NestJS gRPC microservice, owns cargo-release DB + queue | `{{OTS_REPOS_ROOT}}/ne-import-shipment-api` | [overview](repos/ne-import-shipment-api/overview.md) |
| `ne-shipment-api` | NestJS gRPC microservice, owns export shipment dashboard/detail (bookings, OSL, Container+/IoT) | `{{OTS_REPOS_ROOT}}/ne-shipment-api` | [overview](repos/ne-shipment-api/overview.md) |

`{{OTS_REPOS_ROOT}}` is defined in `global-variables.md` — see there for why it isn't defined in this file instead.

## Cross-repo Flows

| Flow | Repos involved |
|---|---|
| [Cargo Release Submit](flows/cargo-release-submit.md) | FE → gateway → import-shipment-api |
| [Container+ Shipment Detail](flows/container-plus-shipment-detail.md) | FE → gateway → shipment-api → upstream Apigee |

## Business Domains

- [Cargo Release](domain/cargo-release.md)
- [Container Plus (VAS)](domain/container-plus.md)

## Infrastructure

- [GKE Clusters](infra/gke-clusters.md)
- [Local Dev Testing Setup](infra/local-dev-testing.md) — IPv6/Citrix workaround, auth stubs, full test cycle, quick revert
- [Container+ Test Data Lookup](infra/container-plus-test-data-lookup.md) — recipe for finding real upstream Apigee test bookings covering the 8 Container+ display scenarios

## Conventions

See the Company KB Framework's [conventions.md]({{AGENT_HOME}}/frameworks/company-kb/conventions.md) — shared across every company instance, not specific to OTS.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` — schema-compliance mechanism every doc here follows.
- `{{AGENT_CONFIG_REPO}}`/`global-variables.md` — defines `{{OTS_REPOS_ROOT}}` used in the repo table above.

## Related

- `{{AGENT_HOME}}/frameworks/company-kb/conventions.md` — writing rules and update triggers.
- Every doc linked from the tables above.
