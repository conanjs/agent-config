---
schema: repo-overview
last-updated: 2026-09-20
---

# Repo: ne-shipment-api

## Purpose

NestJS gRPC microservice that owns export shipment dashboard/detail data (bookings, containers,
OSL, Container+/IoT, invoices, SAP receivables). Called by `ne-api-gateway` over gRPC; itself
calls out to an upstream Apigee-fronted e-commerce shipment API for shipment/booking detail,
plus SAP and mailer integrations.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Inbound | gRPC (`@nestjs/microservices`) |
| Outbound (upstream) | HTTP via internal `apigee` module client (Apigee-fronted REST) |
| DB | PostgreSQL (`typeorm`) |
| Listen address | `::1` (IPv6 loopback — see OTS local-dev-testing conventions) |

## Entry Point

`src/main.ts` — boots a hybrid Nest app; gRPC microservice listens per `MicroserviceOptions`,
HTTP listens on `PORT` (default `3000`) bound to `::1`.

## Module Map

```
src/modules/
├── apigee/              ← HTTP client wrapper for upstream Apigee-fronted shipment API
├── shipment-dashboard/   ← Shipment list + detail (bookings, containers, OSL, Container+/IoT, invoices)
├── shipment-customers/   ← Customer-level shipment data
├── sap/                  ← SAP accounts-receivable office lookups
├── mailer-service/       ← Outbound notification emails
├── user-setting/         ← Saved filters / column preferences
├── systems/              ← System-to-system config
├── cloud-storage/        ← File storage integration
├── config/               ← App config service
└── shared/                ← Cross-module utilities
```

## Features

- [Container+ VAS](features/container-plus-vas.md)

## External Integrations

| System | Protocol | Direction | Purpose |
|---|---|---|---|
| Apigee-fronted e-commerce shipment API | HTTP (`apigeeClient`) | Outbound | Source of truth for `getShipmentDetail` incl. `iotContainer` (Container+), `booking`, `containers`, `osl`. Base path `/v1/ecommerce/shipments`. |
| PostgreSQL | TypeORM | Outbound | Shipment list customization columns, saved filters, IoT container quantity mappings for list view. |
| SAP | HTTP | Outbound | Accounts-receivable office lookup (`getSAPAccountReceivableOffices`). |
| `ne-api-gateway` | gRPC | Inbound | Serves `ShipmentDetailResponse`/`ShipmentListResponse` etc. |

## Env Vars (Key)

| Var | Purpose |
|---|---|
| `PORT` | HTTP listen port (default `3000`) |
| Apigee client config (see `src/modules/apigee/`) | Base URL / auth for upstream shipment API — check `.env.*` files locally, do not commit real values here |

## References

- `src/main.ts`
- `src/modules/shipment-dashboard/services/shipment.service.ts:799-839` (`getShipmentDetail`)
- `src/modules/shipment-dashboard/protos/shipment.proto`
- `src/modules/apigee/`

## Related

- [Container+ VAS Feature](features/container-plus-vas.md)
- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
- [ne-api-gateway Overview]({{AGENT_HOME}}/companies/ots/repos/ne-api-gateway/overview.md)
