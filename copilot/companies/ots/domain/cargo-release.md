# Cargo Release — Business Domain

_Last updated: 2026-08-13_

## What Is Cargo Release?

Cargo Release is a digital request workflow that allows importers (consignees) to request
the release of their cargo from the port/terminal. Instead of paper-based delivery orders,
the customer submits a digital request through the ONE eCommerce portal.

## Key Terminology

| Term | Meaning |
|---|---|
| **BL No** (`blNo`) | Bill of Lading number — the legal document number issued after cargo is loaded. Stored as the primary key in the cargo release DB. |
| **Booking No** (`bookingNo`) | Booking confirmation number — created before the ship sails. Used as the user-facing identifier in the UI. |
| **Consignee** | The party receiving the cargo (the customer submitting the request). |
| **Release-to Party** | The party authorized to pick up the cargo (may differ from consignee). |
| **Local Office** | The ONE regional office that processes the physical release at the port. |
| **POD** | Port of Discharge — where the cargo arrives. |
| **DEL** | Place of Delivery. |
| **SOC** | Shipper Owned Container — cannot have an empty return location requested. |
| **Empty Return Depot** | Location where empty containers must be returned after cargo release. |

## Request Statuses

### `CargoReleaseRequestStatus` (stored on `cargoReleaseRequest` entity)

| Value | Meaning |
|---|---|
| `null` | Submitted but not yet processed |
| `SUCCESS` | Request successfully processed by ONE systems |
| `FAILED` | Processing failed |

### `CargoReleaseMailStatus` (stored on `cargoReleaseMail` entity)

| Value | Meaning |
|---|---|
| `null` | Email queued but not yet sent |
| `DELIVERED` | Email delivered via SendGrid |
| `ERROR` | Email send failed (errorType + reason columns have detail) |
| `RETRIED` | Email was retried via the retry-send-email endpoint |

### `CargoReleaseMailType`

| Value | Meaning |
|---|---|
| `TO_LOCAL_OFFICE` | Notification email to the ONE local office handling the release |
| `TO_USERS` | Confirmation email to the customer who submitted |

## Business Rules

1. A cargo release request is uniquely identified by `(blNo, sortedContainerNos)`.
   Multiple requests can exist for the same `blNo` but with different container sets.
2. Once containers are submitted, they cannot be submitted again for the same BL
   (the `PreventSubmitDuplicateContainersGuard` enforces this).
3. SOC containers cannot have a requested empty return location.
4. Each submission triggers 2 emails: one to local office, one to the customer.
5. The `canRequestCargoRelease` flag is `false` when all containers are either
   submitted or already released.

## Related

- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
- [ne-import-shipment-api Cargo Release Feature]({{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/features/cargo-release.md)
