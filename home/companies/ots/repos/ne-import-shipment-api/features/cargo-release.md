---
schema: feature
repo: ne-import-shipment-api
last-updated: 2026-08-14
---

# Feature: Cargo Release

## Purpose

Owns the entire server-side cargo release lifecycle:
- Persists cargo release requests to a dedicated Postgres DB
- Enqueues and sends notification emails via BullMQ + SendGrid
- Exposes gRPC methods consumed by `ne-api-gateway`
- Proxies EU empty return location data from Apigee

## Module Location

`src/modules/cargo-release/`

## Key Files

| File | Role |
|---|---|
| `cargo-release.controller.ts` | gRPC method handlers |
| `services/cargo-release.service.ts` | Business logic orchestration |
| `repositories/cargo-release-request.repository.ts` | DB queries (TypeORM query builder) |
| `entities/cargo-release-request.entity.ts` | `cargoReleaseRequest` table ORM entity |
| `entities/cargo-release-mail.entity.ts` | `cargoReleaseMail` table ORM entity |
| `consumers/cargo-release-submission.consumer.ts` | BullMQ consumer — sends emails |
| `proxy/cargo-release-apigee.proxy.ts` | Apigee HTTP proxy for EU empty return locations |
| `guards/prevent-submit-duplicate-containers.guard.ts` | Blocks re-submission of already-submitted containers |
| `guards/prevent-submit-invalid-container.guard.ts` | Validates container numbers exist in the BL |
| `schema/submit-request.schema.ts` | Zod validation for submit payload |
| `schema/restore-cargo-release.schema.ts` | Zod validation for restore endpoint |
| `protos/cargo-release.proto` | gRPC service definition (package `importShipment`) |

## gRPC Methods

| Method | Input | Output | Notes |
|---|---|---|---|
| `submitRequest` | `SubmitRequest` | `SubmitResponse` | Inserts DB row + enqueues emails |
| `getCargoReleaseRequestStatus` | `{ blNo }` | `{ blNo, status, submissionCount, containerNos }` | Legacy v1 |
| `getCargoReleaseRequestStatusV2` | `{ blNo }` (= bookingNo) | `{ blNo, submittedContainers, containers, releasedContainers, canRequestCargoRelease }` | Resolves via ImportShipmentService |
| `getPresignedUrl` | `{ attachments[] }` | `{ signedUrls[] }` | GCS presigned URLs for file upload |
| `getEuDefaultEmptyReturnLocations` | `{ blNo }` | container list | Via Apigee proxy |
| `retrySendEmail` | `{ messageIds[], maxEmails? }` | `{ totalFound }` | Re-enqueues failed emails |
| `restoreCargoReleaseData` | `{ bookingNo }` | `{ deletedCount }` | **QA only** — deletes all requests for a bookingNo |

## Data Restore Endpoint (NE-74823)

**Purpose**: QA automation calls this to reset cargo release state before each test run.

**How it works**:
- Accepts `bookingNo` (the booking number QA submits in tests)
- Queries `cargoReleaseRequest.data->'requestDetails'->>'bookingNo'` (jsonb)
- Deletes all matching rows → `cargoReleaseMail` rows cascade-delete automatically
- Returns `{ deletedCount }` for QA to verify

**Key file**: `repositories/cargo-release-request.repository.ts` → `deleteRequestsByBookingNo()`

**Note**: This uses a jsonb query on the `data` column. Not for e2e-test SQLite environment.

## External Dependencies

| Dependency | What for |
|---|---|
| BullMQ (Redis) | Email job queue |
| SendGrid | Email delivery |
| GCP Storage | Attachment uploads (presigned URLs) |
| Apigee | EU empty return location data |
| LaunchDarkly | Feature flag `VIEW_CARGO_RELEASE_STATUS` |
| ImportShipmentService | Resolve bookingNo → blNo + container list |

## References

- `src/modules/cargo-release/` (entire module)
- `src/database/unit-of-work/cargo-release/` (separate DB connection setup)
- `src/database/cr-migrations/` (Postgres migrations for this feature)

## Related

- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
- [Cargo Release Business Domain]({{AGENT_HOME}}/companies/ots/domain/cargo-release.md)
