---
schema: domain
last-updated: 2026-11-02
---

# Domain: Cargo Release

_Last updated: 2026-11-02_

## Definition

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
6. **Frontend eligibility gate (`ne-manage-shipment-frontend`)**. The "Request Cargo Release" CTA shows only when **A and B** are both true (`useCheckRequestCargoReleaseAvailable`):
   - **A. Customer country and party.** `userCountry = customerCode.substring(0,2)`. It must be a whitelist key, and the whitelist depends on the branch (re-verified 2026-11-02):
     - `develop` (1db8f789): keys of LD `NE-30813-Cargo-Release-Offices-Info` only.
     - `develop-internal` (3abbfd1e, deployed to internal-test): also adds `ne-80211-cargo-release-NA-offices-info` (MX), and B gains a Mexico path: DEL country = MX while the Mexico LD flag is ON.
     - `userCountry` must also equal the 2-char prefix of the consignee, notify or also-notify code. This is a country match, not an identity match.
   - **B. POD / DEL.** One of these must be true:
     - The POD country is in the whitelist from A.
     - The DEL country is a key of `NE-59540-Cargo-Release-Destination-Offices-Info` **and** the POD country is in `NE-59540-Cargo-Release-Potential-POD-Offices-Info`.
   - On the list, if `ne-53398` is ON and the row status is Released, the CTA is hidden.
7. **Direct URL guard** for `/manage-shipment/cargo-release/{bookingNo}` (`withCargoReleaseAuthorize` + `CargoReleaseView`):
   - Not logged in → login redirect.
   - Whitelist flags empty for the context → `window.location.assign(HOME_PAGE)`.
   - Gate A or B fails after the detail loads → `router.push('/404')`.
   - There is no "access blocked" modal.
8. **Status column, filter and download column** are controlled only by LD `ne-53398-view-cargo-release-status`:
   - FE: the list column and filter options.
   - BE: the PDF/CSV/Excel column, `isFlagActive(..., userMeta)` in `shipment.service.ts`.
   - Exception: the container table on Details also needs `canRequestCargoRelease`.
   - File values are `Cargo Released` or `Not Released`. A "No support" value doesn't exist.

## Status Lifecycle

> _See "Request Statuses" above; no separate state machine documented._

## Naming / Gotchas

- **Route**: the page is `/manage-shipment/cargo-release/{bookingNo}`. There is no `/cargo-release-request` route.
- **`ne-53398-view-cargo-release-status` targeting** (verified 2026-11-02 against the `ecomm-test` LD client-side `evalx` endpoint by varying the context):
  - It uses **individual user-key targeting**. It does not follow `customerCountry` or `customerCode`.
  - The same DE context with a different key evaluated `false`.
  - Keys that evaluated `true`: `GEMTEST1`, `OTSV_BELGIUM.TEST`, `OTSV_GERMANY2.TEST`, `OTSV_MEXICO.TEST`. Keys are case-sensitive; lowercase evaluated `false`.
  - So a hidden status column does **not** prove that the cargo-release whitelist works.
- **Whitelist snapshot, ecomm-test LD, 2026-11-02**. The office flags were identical for DE, AR, KR, LV, SK and US contexts:
  - `NE-30813` keys: IE DK SK FR GH NG NO CZ ES GB LU BE SE FI PT TR GR HU IT ME LI MC NL MA CH MK DE CI EG AT PL
  - `ne-80211` keys: MX
  - `NE-59540` destination keys: LU MC ME MK SK GR LI
  - `NE-59540` potential POD: AL BA BG CY EE GE GR HR SI RO LT LV ME
- **`destinationCode` vs `destinationCountryCode`**: `CargoReleaseView` passes `booking.destinationCode` (a location code such as `SKNOV`) as `destinationCountryCode`. The list and TabDetail pass the real country code. A shipment eligible only through DEL / potential-POD can show the CTA and then 404 on the page. Suspected bug, not yet confirmed at runtime.
- **The download ignores the cargo-release filter.** `ImportDownloadDropdown.getDownloadRequest` doesn't send `cargoReleaseStatus`.

## References

- `ne-manage-shipment-frontend/src/shared/hooks/useCheckRequestCargoReleaseAvailable.ts`
- `ne-manage-shipment-frontend/src/shared-frontend/shared/hooks/useCheckCargoReleaseRegion.ts`
- `ne-manage-shipment-frontend/src/modules/cargo-release/hooks/authorize/withCargoReleaseAuthorize.tsx`
- `ne-manage-shipment-frontend/src/modules/cargo-release/components/CargoReleaseView.tsx`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/hooks/import/useImportActions.tsx`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/hooks/import/content/useFilterStatusItems.ts`
- `ne-import-shipment-api/src/modules/import-shipment/services/shipment.service.ts` (`downloadImportShipmentFile`)
- LaunchDarkly client-side evaluation API: https://launchdarkly.com/docs/sdk/concepts/client-side-server-side
- LaunchDarkly individual targeting: https://launchdarkly.com/docs/home/flags/individual-targeting

## Related

- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
- [ne-import-shipment-api Cargo Release Feature]({{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/features/cargo-release.md)
