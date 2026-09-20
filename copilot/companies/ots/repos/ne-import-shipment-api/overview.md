---
schema: repo-overview
last-updated: 2026-09-20
---

# Repo: ne-import-shipment-api

## Purpose

NestJS gRPC microservice for import shipment management. It is the authoritative
owner of cargo release data, email queues, and file attachments for the eCommerce
import shipment feature.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Transport | gRPC (consumed by `ne-api-gateway`) |
| Database | PostgreSQL (TypeORM, separate DB connection per domain) |
| Queue | BullMQ (Redis) |
| Email | SendGrid |
| Storage | GCP Cloud Storage |
| Feature Flags | LaunchDarkly |
| Validation | Zod (`ZodValidationPipe`) |
| External proxy | Apigee |

## Entry Point

gRPC microservice — no HTTP entry point. Serves the `importShipment` proto package; `ne-api-gateway`'s cargo-release and import-shipment modules are the consumer.

## Module Map

```
src/modules/
├── cargo-release/       ← Cargo release requests, emails, file upload
├── import-shipments/    ← Import shipment details (delegates to Apigee/upstream)
├── notification-service/ ← Email templates (React Email)
└── shared/              ← Shared pipes, guards, utils
```

## Features

- [Cargo Release](features/cargo-release.md)

## External Integrations

| System | Protocol | Direction | Purpose |
|---|---|---|---|
| `ne-api-gateway` | gRPC | Inbound | Serves `CargoReleaseService` (`importShipment` package) |
| Apigee | HTTP | Outbound | Upstream import-shipment data |
| SendGrid | HTTP | Outbound | Cargo release notification emails |
| GCP Cloud Storage | HTTP | Outbound | File attachments |

## Env Vars (Key)

| Var | Purpose |
|---|---|
| DB connection (per-domain, TypeORM) | Separate connection string per domain — check `.env.*` files locally |
| SendGrid API config | Email sending — check `.env.*` files locally, do not commit real values here |

## References

- `src/app.module.ts`
- `src/modules/cargo-release/protos/cargo-release.proto`

## Related

- [ne-api-gateway Overview]({{AGENT_HOME}}/companies/ots/repos/ne-api-gateway/overview.md)
- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
