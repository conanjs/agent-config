# Container+ Test Data Lookup — Recipe

_Last updated: 2026-09-08_

> **Goal**: given Apigee credentials, find real booking numbers whose Container+ (`iotContainer`)
> data covers each of the 8 display scenarios (see
> [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)), so the team can test the new
> `containerList[]`-based UI (NE-66300) against real data instead of hunting for it themselves.

## Why This Doc Exists

The Container+ card data does **not** originate in any of `ne-manage-shipment-frontend`,
`ne-api-gateway`, or `ne-shipment-api` — all three simply relay `iotContainer` from an upstream
Apigee-fronted e-commerce shipment API. None of their test suites/fixtures contain realistic
`containerList` sample data. Confirmed by:
- `ne-shipment-api/src/modules/shipment-dashboard/services/shipment.service.ts:799-839` — spreads
  `...data` (incl. `iotContainer`) straight through with zero local transformation.
- Repo-wide search of all 3 repos for `containerList`/`priceSeeable`/`IOTContainerListItem` found
  no fixtures, mocks, or seed data — only the proto/DTO type declarations themselves.

So the only way to get real qualifying test bookings is to query the upstream system directly.

## ⚠️ Credential Handling

**Never write the actual Apigee token/API key value into this file or any other file in this
knowledge base, git repo, or committed artifact.** Store it only in:
- A local, gitignored `.env` (see `ne-shipment-api/.env.apigee` / `.env.example` for the expected
  var names/shape used by `src/modules/apigee/`), or
- The session's own credential mechanism (ask the user to supply it per-session as an
  environment variable or header value passed directly to `curl`/an HTTP client at request time).

When a future session is given the token, the recipe below is how to use it — but treat the doc
itself as permanently credential-free.

## Recipe (once token/key is provided)

1. Confirm the upstream base path and auth header shape from
   `ne-shipment-api/src/modules/apigee/` (client config) and the relevant `.env.*` file locally
   (do not print secret values into chat/logs).
2. Call, per candidate booking number:
   ```
   GET {APIGEE_BASE_URL}/v1/ecommerce/shipments/{bookingNo}/{userId}
   Header: <auth header name from apigee client config> = <token/key>
   ```
3. Inspect the response's `iotContainer` field:
   - **Pre-migration shape** (if upstream hasn't rolled out NE-66300 yet): `status`,
     `requestedChannel`, `requestedInfo`, `addedInfo?`.
   - **Post-migration shape**: `containerList[]` with `containerNo`, `status`,
     `requestedChannel`, `requestedDate`, `reefer`, `priceSeeable`, `addedType?`.
4. Classify each qualifying booking against the 8-case matrix
   (see [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md#business-rules) rule 4):

   | Case | Contract | Channel | Status | What to check in response |
   |---|---|---|---|---|
   | 1 | RMB/RMP/Trial filed | BOOKING | REQUESTED | `requestedChannel='BOOKING'`, `status='REQUESTED'`, `priceSeeable='N'` (or old: `booking.contractType` in `Trial`/`RMB`/`RMP`) |
   | 2 | RMB/RMP/Trial filed | BOOKING | ADDED | same channel, `status='ADDED'`, `priceSeeable='N'` |
   | 3 | RMB/RMP/Trial filed | AD-HOC | REQUESTED | `requestedChannel='ADHOC'`, `status='REQUESTED'`, `priceSeeable='N'` |
   | 4 | RMB/RMP/Trial filed | AD-HOC | ADDED | `requestedChannel='ADHOC'`, `status='ADDED'`, `priceSeeable='N'` |
   | 5 | No contract / Not Trial | BOOKING | REQUESTED | `requestedChannel='BOOKING'`, `status='REQUESTED'`, `priceSeeable='Y'` |
   | 6 | No contract / Not Trial | BOOKING | ADDED | `requestedChannel='BOOKING'`, `status='ADDED'`, `priceSeeable='Y'`, `totalPrice` populated |
   | 7 | No contract / Not Trial | AD-HOC | REQUESTED | `requestedChannel='ADHOC'`, `status='REQUESTED'`, `priceSeeable='Y'` |
   | 8 | No contract / Not Trial | AD-HOC | ADDED | `requestedChannel='ADHOC'`, `status='ADDED'`, `priceSeeable='Y'`, `totalPrice` populated |

5. Record the qualifying `bookingNo` + `userId`/`customerCode` (and which environment —
   dev/stage/UAT — it was found in) for each of the 8 rows, so QA can reuse them directly.

## Known Unknowns (verify before relying on this recipe)

- Exact auth header name/scheme for the Apigee client (`apiKey` header vs OAuth bearer token) —
  read from `ne-shipment-api/src/modules/apigee/` at time of use, don't assume.
- Whether there's a search/list endpoint upstream to filter by contract type + IoT status
  directly (would avoid probing individual booking numbers one at a time) — not found in any of
  the 3 repos; ask the Container+/IoT backend team.
- `addedType` field's real meaning is unconfirmed (see domain doc gotchas) — do not use it as a
  case-classification signal until confirmed.

## Related

- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
- [ne-shipment-api Overview]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/overview.md)
