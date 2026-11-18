---
schema: flow
last-updated: 2026-08-14
---

# Flow: Cargo Release Submit (+ Status Check + Data Restore)

## Overview

The cargo release flow allows an authenticated user to submit a request for releasing cargo from a port, check the release status, and (for QA/non-production) restore data to its pre-submission state. It spans three repos: the frontend initiates, the gateway bridges REST↔gRPC, and `ne-import-shipment-api` owns all business logic and data.

## Repos Involved

| Repo | Role | API version used |
|---|---|---|
| `ne-manage-shipment-frontend` | Initiates requests from user action | Calls gateway v1/v2 REST |
| `ne-api-gateway` | REST ↔ gRPC bridge | v1 REST in, gRPC out to import-shipment-api |
| `ne-import-shipment-api` | gRPC server, owns DB + queue | gRPC, package `importShipment` |

> **Note on naming confusion**: The gateway's `cargo-release` module (path `/v1/cargo-release/*`)
> connects to `ne-import-shipment-api` using `package cargoRelease` (gateway-side proto).
> The gateway's `import-shipment` module has a *separate* cargo-release controller (v2 status check).

## Submit Flow

```
[User clicks Submit in browser]
        │
        ▼
FE: postSubmitCargoReleaseRequest()
    POST /v1/cargo-release/submit
    Body: SubmitCargoReleaseRequest { requestDetails, releaseToParty, attachments, submitter, ... }
    File: ne-manage-shipment-frontend/src/modules/cargo-release/apis/postSubmitCargoReleaseRequest.ts
        │
        ▼
Gateway: CargoReleaseController.submitRequest()  [v1]
    src/modules/cargo-release/controllers/cargo-release.controller.ts
    Guard: AuthGuard (JWT token required)
    Adds userId to gRPC metadata
        │ gRPC submitRequest
        ▼
ne-import-shipment-api: CargoReleaseController.submitRequest()
    src/modules/cargo-release/cargo-release.controller.ts
    Guards: PreventSubmitInvalidContainerGuard, PreventSubmitDuplicateContainersGuard
    Calls: CargoReleaseService.requestMultipleCargoRelease(dto, userId)
        │
        ├─ requestRepository.insertRequestV2(dto, userId)
        │    INSERT into cargoReleaseRequest
        │    Unique key: (blNo, sortedContainerNos)
        │    Stores full DTO in data jsonb column (includes bookingNo)
        │
        └─ sendEmail(dto, requestId)
             Enqueues 2 BullMQ jobs on queue CARGO_RELEASE_REQUEST_SUBMITTED:
               - SEND_EMAIL_TO_LOCAL_OFFICE
               - SEND_EMAIL_TO_USERS
             Consumer: cargo-release-submission.consumer.ts
             Inserts cargoReleaseMail rows (status=null initially)
             Sends via SendGrid, updates status → DELIVERED or ERROR
```

## Status Check Flow (v2)

```
FE: getCargoReleaseRequestStatusV2(bookingNo)
    GET /v2/cargo-release/request-status/:blNo   ← :blNo is actually bookingNo here (naming bug)
    File: ne-manage-shipment-frontend/src/shared/api/getCargoReleaseRequestStatusV2.ts
        │
        ▼
Gateway: CargoReleaseV2Controller  [import-shipment module, v2]
    src/modules/import-shipment/controllers/cargo-release-v2.controller.ts
        │ gRPC getCargoReleaseRequestStatusV2
        ▼
ne-import-shipment-api: CargoReleaseService.getCargoReleaseRequestStatusV2()
    1. Calls ImportShipmentService.getImportShipmentDetail({ bookingNo })
       → Gets actual blNo from billOfLadingInfo.blNo
    2. Queries cargoReleaseRequest by blNo → gets submitted container sets
    3. Calls LaunchDarkly flag VIEW_CARGO_RELEASE_STATUS
    4. Returns: { blNo, submittedContainers, containers, releasedContainers, canRequestCargoRelease }
```

## Data Restore Flow (QA automation)

```
QA automation tool
    DELETE /v1/cargo-release/restore/:bookingNo
    (no auth header required)
        │
        ▼
Gateway: CargoReleaseController.restoreCargoReleaseData()
    src/modules/cargo-release/controllers/cargo-release.controller.ts
    Inline env check: if NODE_ENV=production → 403 ForbiddenException
        │ gRPC restoreCargoReleaseData({ bookingNo })
        ▼
ne-import-shipment-api: CargoReleaseController.restoreCargoReleaseData()
    Inline env check: if NODE_ENV=production → 403 ForbiddenException
    Calls: CargoReleaseService.restoreCargoReleaseData(bookingNo)
        │
        └─ requestRepository.deleteRequestsByBookingNo(bookingNo)
             DELETE FROM cargoReleaseRequest
             WHERE data->'requestDetails'->>'bookingNo' = :bookingNo
             (cargoReleaseMail rows cascade-delete automatically)
    Returns: { deletedCount: number }
```

## Step-by-Step Breakdown

### Submit Flow

### 1. User (Browser) → Clicks Submit
- **What**: User fills in the cargo release form and clicks the submit button in the web UI.
- **Why**: This is the entry point of the entire flow; no request exists until the user explicitly submits.
- **How**: UI action triggers `postSubmitCargoReleaseRequest()` in `ne-manage-shipment-frontend/src/modules/cargo-release/apis/postSubmitCargoReleaseRequest.ts`.

### 2. Frontend → Gateway: `POST /v1/cargo-release/submit`
- **What**: HTTP POST with JWT bearer token, carrying the full `SubmitCargoReleaseRequest` body.
- **Why**: The gateway is the single REST entry point — the frontend never calls microservices directly.
- **How**: The body includes `requestDetails` (bookingNo, blNo, containers), `releaseToParty`, `attachments`, `submitter`.

### 3. Gateway: `CargoReleaseController.submitRequest()` validates and bridges
- **What**: Auth guard validates the JWT, extracts `userId`, and forwards the request as a gRPC call.
- **Why**: The gateway translates REST ↔ gRPC and enforces auth before any service logic runs.
- **How**: `ne-api-gateway/src/modules/cargo-release/controllers/cargo-release.controller.ts` — `userId` added to gRPC metadata.
- **Notes**: ⚠️ Uses `package cargoRelease` proto (`CARGO_RELEASE_PACKAGE`), NOT the `importShipment` package. Two separate proto packages exist in the gateway talking to the same backend — see [Naming / Gotchas](#naming--gotchas).

### 4. Gateway → `ne-import-shipment-api`: gRPC `submitRequest`
- **What**: gRPC call crosses the service boundary.
- **Why**: Business logic and data ownership live in `ne-import-shipment-api`.
- **How**: gRPC client configured via `CARGO_RELEASE_PACKAGE`, method `submitRequest`.

### 5. `ne-import-shipment-api`: Guard Validation
- **What**: Two guards run before the handler method executes.
- **Why**: Prevent invalid or duplicate container submissions before any DB write.
- **How**: `PreventSubmitInvalidContainerGuard` — checks containers are valid. `PreventSubmitDuplicateContainersGuard` — checks the same container set hasn't been submitted for this BL.

### 6. `ne-import-shipment-api`: `CargoReleaseService.requestMultipleCargoRelease(dto, userId)`
- **What**: Main orchestration method — writes to DB and enqueues emails.
- **Why**: Separates the synchronous request path (DB write) from the async side effect (email sending).
- **How**: `ne-import-shipment-api/src/modules/cargo-release/services/cargo-release.service.ts`

  **6.1** `requestRepository.insertRequestV2(dto, userId)`
  - Inserts into `cargoReleaseRequest` table.
  - Unique constraint: `(blNo, sortedContainerNos)` — prevents exact duplicate submissions.
  - `sortedContainerNos` is computed `@BeforeInsert` (sorted, comma-joined).
  - Stores the full DTO in `data jsonb`, which includes `bookingNo` at `data.requestDetails.bookingNo`.

  **6.2** `sendEmail(dto, requestId)`
  - Enqueues 2 BullMQ jobs on queue `CARGO_RELEASE_REQUEST_SUBMITTED`:
    - `SEND_EMAIL_TO_LOCAL_OFFICE`
    - `SEND_EMAIL_TO_USERS`
  - The HTTP response is already returned to the client before email jobs run.

### 7. BullMQ Consumer: `cargo-release-submission.consumer.ts` (async)
- **What**: Picks up the email jobs and sends emails via SendGrid.
- **Why**: Decoupled from the sync request path — email failures don't block submission or the response to the user.
- **How**: Consumer inserts `cargoReleaseMail` rows (status `null`), sends via SendGrid, updates status → `DELIVERED` or `ERROR`.

---

### Status Check Flow (v2)

### 1. Frontend → Gateway: `GET /v2/cargo-release/request-status/:blNo`
- **What**: Frontend polls for the release status of a booking, passing `bookingNo` as the `:blNo` path param.
- **Why**: User wants to see which containers are released and whether re-submission is possible.
- **How**: `ne-manage-shipment-frontend/src/shared/api/getCargoReleaseRequestStatusV2.ts`
- **Notes**: ⚠️ The URL param is named `:blNo` but the frontend passes `bookingNo` — a naming bug in the gateway route definition. The value is actually `bookingNo`, not `blNo`.

### 2. Gateway: `CargoReleaseV2Controller` (in `import-shipment` module, not `cargo-release` module)
- **What**: Receives the request in the `import-shipment` gateway module.
- **Why**: The v2 status check was added later and placed in the `import-shipment` module, separate from the v1 `cargo-release` module.
- **How**: `ne-api-gateway/src/modules/import-shipment/controllers/cargo-release-v2.controller.ts`
- **Notes**: ⚠️ This controller uses the `importShipment` proto package — different from the `cargoRelease` package used by v1 endpoints, but both target the same `ne-import-shipment-api` gRPC server.

### 3. Gateway → `ne-import-shipment-api`: gRPC `getCargoReleaseRequestStatusV2`
- **What**: gRPC call using the `importShipment` package.
- **How**: `IMPORT_SHIPMENT_PACKAGE` gRPC client.

### 4. `ne-import-shipment-api`: `CargoReleaseService.getCargoReleaseRequestStatusV2(bookingNo)`
- **What**: Resolves `bookingNo` to `blNo`, queries release data, and applies a feature flag.
- **How**: `ne-import-shipment-api/src/modules/cargo-release/services/cargo-release.service.ts`

  **4.1** Calls `ImportShipmentService.getImportShipmentDetail({ bookingNo })`
  - Resolves the actual `blNo` from `billOfLadingInfo.blNo` (bookingNo ≠ blNo).

  **4.2** Queries `cargoReleaseRequest` by `blNo`
  - Gets all submitted container sets for this BL.

  **4.3** Checks LaunchDarkly flag `VIEW_CARGO_RELEASE_STATUS`
  - Flag controls whether the status view is enabled for this customer.

  **4.4** Returns `{ blNo, submittedContainers, containers, releasedContainers, canRequestCargoRelease }`

---

### Data Restore Flow (QA automation)

### 1. QA Tool → Gateway: `DELETE /v1/cargo-release/restore/:bookingNo`
- **What**: QA automation calls this endpoint after a test run to wipe all cargo release data for a given booking number.
- **Why**: Allows the test to be re-run from a clean state (submit again) without manual DB cleanup.
- **How**: No auth header required — access is controlled by environment only.

### 2. Gateway: Inline env check → gRPC forward
- **What**: The handler checks `process.env['NODE_ENV'] === 'production'` and throws `403 ForbiddenException` if true; otherwise forwards via gRPC.
- **Why**: No separate guard class needed — the restriction is simple and only applies to one endpoint.
- **How**: `ne-api-gateway/src/modules/cargo-release/controllers/cargo-release.controller.ts` → `restoreCargoReleaseData()` method.
- **Notes**: Blocked on `NODE_ENV=production`. Open on all other envs (test, stage, unicorn-stage, etc.).

### 3. `ne-import-shipment-api`: Inline env check → delete
- **What**: gRPC handler also checks `NODE_ENV=production` and throws `ForbiddenException` if true, as a defence-in-depth measure.
- **Why**: Even if the gateway check were bypassed (e.g., direct gRPC call in tests), the API layer won't execute a destructive operation in production.
- **How**: `ne-import-shipment-api/src/modules/cargo-release/cargo-release.controller.ts` → `restoreCargoReleaseData()` method.

### 4. `ne-import-shipment-api`: `requestRepository.deleteRequestsByBookingNo(bookingNo)`
- **What**: Deletes all `cargoReleaseRequest` rows associated with the booking number.
- **Why**: "Restore" means returning to the never-submitted state — the only way to fully reset is a hard delete.
- **How**: `DELETE WHERE data->'requestDetails'->>'bookingNo' = :bookingNo` using PostgreSQL jsonb operators (`->` returns jsonb, `->>` returns text).
- **Notes**:
  - ⚠️ Jsonb query does NOT work with SQLite (e2e-test env uses `simple-json` not `jsonb`).
  - `cargoReleaseMail` rows cascade-delete automatically via `FK onDelete: 'CASCADE'`.
  - Returns `{ deletedCount: number }`.

---

## Naming / Gotchas

- **`blNo` vs `bookingNo`**: `blNo` = Bill of Lading number (post-sail, DB primary key). `bookingNo` = Booking confirmation number (pre-sail, user-facing). The v2 status route `:blNo` param actually receives `bookingNo` — a naming bug in the gateway.
- **Two proto packages, one gRPC server**: `cargoRelease` (v1 gateway module) and `importShipment` (v2 gateway module) both connect to `ne-import-shipment-api`, but as different proto packages. Mixing them causes runtime errors.

## Error / Edge Cases

| Scenario | Behaviour | Notes |
|---|---|---|
| Duplicate container set submitted | Guard rejects before DB write | `PreventSubmitDuplicateContainersGuard` |
| Restore called in production | `403 Forbidden` | Inline `NODE_ENV=production` check in both gateway + API controllers |
| `bookingNo` has no submissions | `{ deletedCount: 0 }` | No error thrown |
| Email send fails | `cargoReleaseMail.status = ERROR` | Submission itself is NOT rolled back |

## API Surface Summary

```
cargoReleaseRequest
├── id               uuid PK
├── blNo             varchar(30)      ← BL number (NOT bookingNo)
├── containerNos     text[]
├── sortedContainerNos text           ← comma-separated sorted containers
├── status           varchar(30)      ← null | SUCCESS | FAILED
├── submissionCount  int
├── data             jsonb            ← full SubmitRequest DTO (includes bookingNo at data.requestDetails.bookingNo)
├── createdByUserId  varchar(255)
├── updatedByUserId  varchar(255)
├── createdAt        timestamp
└── updatedAt        timestamp

UNIQUE INDEX: (blNo, sortedContainerNos)
INDEX: (blNo)

cargoReleaseMail
├── id          uuid PK
├── emailType   varchar(30)  ← TO_LOCAL_OFFICE | TO_USERS
├── messageId   varchar(255) unique nullable  ← SendGrid message ID
├── status      varchar(30)  ← null | DELIVERED | ERROR | RETRIED
├── reason      varchar(255) nullable
├── errorType   varchar(30)  nullable
├── requestId   FK → cargoReleaseRequest.id (CASCADE DELETE)
├── createdAt   timestamp
└── updatedAt   timestamp
```

## API Surface Summary

| Method | Path | Service | Auth | Notes |
|---|---|---|---|---|
| `POST` | `/v1/cargo-release/submit` | `ne-import-shipment-api` | JWT (AuthGuard) | |
| `GET` | `/v1/cargo-release/request-status/:blNo` | `ne-import-shipment-api` | JWT (AuthGuard) | v1; param is blNo |
| `GET` | `/v2/cargo-release/request-status/:blNo` | `ne-import-shipment-api` | JWT (AuthGuard) | v2; param is actually bookingNo |
| `POST` | `/v1/cargo-release/attachments/get-presigned-url` | `ne-import-shipment-api` | JWT (AuthGuard) | |
| `POST` | `/v1/cargo-release/retry-send-email` | `ne-import-shipment-api` | `retry_send_email_api_key` header | internal |
| `DELETE` | `/v1/cargo-release/restore/:bookingNo` | `ne-import-shipment-api` | None (blocked by env in prod) | QA only |

## References

- `ne-manage-shipment-frontend/src/modules/cargo-release/apis/postSubmitCargoReleaseRequest.ts`
- `ne-manage-shipment-frontend/src/shared/api/getCargoReleaseRequestStatusV2.ts`
- `ne-api-gateway/src/modules/cargo-release/controllers/cargo-release.controller.ts`
- `ne-api-gateway/src/modules/cargo-release/protos/cargo-release.proto`
- `ne-import-shipment-api/src/modules/cargo-release/cargo-release.controller.ts`
- `ne-import-shipment-api/src/modules/cargo-release/services/cargo-release.service.ts`
- `ne-import-shipment-api/src/modules/cargo-release/repositories/cargo-release-request.repository.ts`
- `ne-import-shipment-api/src/modules/cargo-release/entities/cargo-release-request.entity.ts`
- `ne-import-shipment-api/src/modules/cargo-release/protos/cargo-release.proto`

## Related

- [Cargo Release Business Domain]({{AGENT_HOME}}/companies/ots/domain/cargo-release.md)
- [ne-import-shipment-api Cargo Release Feature]({{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/features/cargo-release.md)
