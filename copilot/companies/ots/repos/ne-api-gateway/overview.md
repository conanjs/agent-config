---
schema: repo-overview
last-updated: 2026-09-20
---

# Repo: ne-api-gateway

## Purpose

NestJS REST API gateway that sits between the React frontend and all gRPC microservices.
Handles authentication, request routing, and protocol translation (REST ↔ gRPC).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Inbound | REST/HTTP (Fastify — `NestFastifyApplication`) |
| Outbound | gRPC (`@nestjs/microservices`) |
| Auth | Auth0 JWT (`AuthGuard`), API key guards for internal endpoints |

## Entry Point

`src/main.ts` — Fastify-based Nest app. Listens via `app.listen(PORT, '::1')`, default port `3000`, IPv6 loopback (same convention as `ne-shipment-api`; see OTS local-dev-testing conventions).

## Module Map

```
src/modules/
├── auth/           ← JWT guard, API key guards, token management
├── cargo-release/  ← Bridges to ne-import-shipment-api CargoReleaseService (package cargoRelease)
│   ├── controllers/cargo-release.controller.ts   ← v1 REST endpoints
│   ├── interfaces/cargo-release.service.interface.ts
│   ├── protos/cargo-release.proto                ← package cargoRelease
│   └── providers/grpc-cargo-release.provider.ts  ← CARGO_RELEASE_PACKAGE
├── import-shipment/ ← v2 status check, also uses CargoReleaseService (package importShipment)
├── bookings/       ← Booking management
└── tracking/       ← Cargo tracking
```

## Features

- Cargo Release — this repo's own bridging role isn't documented as a feature doc yet; see `{{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/features/cargo-release.md` for the owning repo's version in the meantime.
- [Container+ VAS (passthrough)](features/container-plus-vas.md)

## External Integrations

| System | Protocol | Direction | Purpose |
|---|---|---|---|
| `ne-import-shipment-api` | gRPC | Outbound | Cargo release + import shipment status |
| `ne-shipment-api` | gRPC | Outbound | Export shipment dashboard/detail |
| Auth0 | JWT | Inbound (verification) | User-facing endpoint auth (`AuthGuard`) |

## Env Vars (Key)

| Var | Purpose |
|---|---|
| `PORT` | Listen port (default `3000`) |
| `RETRY_SEND_CR_EMAIL_API_KEY` | API key for `RetrySendEmailAPIGuard` (retry-email endpoint) |
| `CARGO_RELEASE_RESTORE_API_KEY` | API key for `CargoReleaseRestoreAPIGuard` (QA restore endpoint) |

(Many more per-integration gRPC URLs/API keys exist, e.g. `AOQ_*`, `BL_*`, `BOOKING_*` — see `.env.example` for the full list; these three are the ones every task touching auth actually needs.)

## Auth Guard Reference

_Repo-specific addendum, not part of the `repo-overview` schema — kept because API-gateway-style repos need this and no other repo in this KB does yet. Flag for a framework decision if a second gateway-style repo needs the same thing (formalize as an optional schema section then, rather than duplicating ad hoc)._

| Guard | Header | Env var | Used on |
|---|---|---|---|
| `AuthGuard` | `Authorization: Bearer <jwt>` | Auth0 config | All user-facing endpoints |
| `RetrySendEmailAPIGuard` | `retry_send_email_api_key` | `RETRY_SEND_CR_EMAIL_API_KEY` | Retry email endpoint |
| `CargoReleaseRestoreAPIGuard` | `cargo_release_restore_api_key` | `CARGO_RELEASE_RESTORE_API_KEY` | QA restore endpoint |

## References

- `src/modules/cargo-release/controllers/cargo-release.controller.ts`
- `src/modules/cargo-release/protos/cargo-release.proto`
- `src/modules/auth/guard/index.ts`

## Related

- [ne-import-shipment-api Overview]({{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/overview.md)
- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
