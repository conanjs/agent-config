---
schema: domain
last-updated: 2026-09-08
---

# Domain: Container Plus (VAS)

## Definition

**Container+** is a Value Added Service (VAS) offered on export shipments that gives the
customer live IoT (reefer/refrigerated) container monitoring data — i.e. remote visibility
into a reefer container's temperature/status while in transit. Think of it as an add-on
"tracking subscription" attached to a booking, similar to how OSL (Online Shipping List) is
another VAS attached to the same booking.

It is sold as a surcharge under two named products:
- **RMB** — REMOTE MONITORING
- **RMP** — REMOTE MONITORING (PREMIUM)

A shipment can acquire Container+ in one of two ways (`requestedChannel`):
- **BOOKING** — requested at the time the booking/contract was made.
- **AD-HOC REQUEST** — requested later, outside of the booking flow.

## Business Rules

1. **Card visibility** (Shipment Overview → Shipment Detail → VAS tab): the Container+ card
   only renders when the shipment has an `iotContainer` payload AND the customer is pilot/flagged
   in for the feature (see feature doc for exact flag names).
2. **Field-level visibility is all-or-nothing**, gated by shipment-level role:
   - `isRequester` (the user/party who requested the booking) OR `isCNPT` (contract party) → see
     all fields.
   - Any other party role (Shipper, Consignee, Notify Party, etc., per the permission matrix in
     the Jira ticket) → card is hidden entirely for non-Container+ shipments, or shown with all
     detail fields hidden if the shipment does have Container+.
3. **Two contract-pricing cases** determine which banner text shows / which Jira-table row applies:
   - **Case 1 — Contract filed with RMB/RMP or Trial**: banner "Reefer container availability is
     subject to final confirmation…" (shown while REQUESTED).
   - **Case 2 — No contract / contract not filed RMB/RMP / Not Trial**: banner "…availability
     **and total price** are subject to final confirmation…" (shown while REQUESTED).
   - This was historically derived from `booking.contractType` (`'No Contract' | 'Not Trial'`
     → Case 2) — confirmed **dead in production** (see Naming/Gotchas). **Confirmed replacement
     (post NE-66300 merge, 2026-09-08)**: selected container item's `addedType` field — `1` or `2`
     → Case 1 (contract), `3` or `4` → Case 2 (no contract). Working hypothesis (unconfirmed):
     the two values within each pair are channel-specific — `1`=Case1+BOOKING, `2`=Case1+ADHOC,
     `3`=Case2+BOOKING, `4`=Case2+ADHOC.
   - **Total Price visibility is a SEPARATE, simpler rule** (confirmed by product owner,
     2026-09-08): the Total Price row renders whenever selected item's `priceSeeable === 'Y'`
     AND status ≠ REQUESTED — **regardless of `addedType`/case**. This deliberately does not
     enforce "Case 1 never shows price" in code; if `priceSeeable='Y'` on a Case 1 (contract)
     record, price still shows. In practice `priceSeeable` is `N` on every `REQUESTED`-status
     record (no price data exists yet, regardless of case) and only becomes meaningful once
     `status='ADDED'` — see corrected mock data, `ne-shipment-api/find-data/mock-container-plus/`.
4. **8 display permutations** = 2 statuses (`REQUESTED` | `ADDED`) × 2 channels
   (`BOOKING` | `AD-HOC REQUEST`) × 2 contract cases (Case 1 | Case 2). All 8 share the same
   card title/content/"Learn More" link; they differ only in: which fields show, the
   banner text, and whether price shows.
5. **Container selection rule (NE-66300, merged 2026-09-08)**: the upstream payload moved from a
   single flat `iotContainer` object to `iotContainer.containerList[]` (one entry per physical
   container). The FE/consuming logic must **use the first item in `containerList` where
   `reefer === 'Y'`** to populate the card:
   - `status` → IoT request status (`REQUESTED` | `ADDED`)
   - `requestedChannel` → IoT requested channel (`BOOKING` | `ADHOC`)
   - `requestedDate` → used for **both** "Date of request" (status=REQUESTED) and "Date of
     confirmation/added" (status=ADDED) — there is no longer a separate `addedDate` field.
   - `priceSeeable` → sole authority on whether Total Price row/value is rendered (see rule 3).
   - `addedType` → confirmed meaning: 1/2 = Case 1 (contract), 3/4 = Case 2 (no contract).
     Confirmed present regardless of status (REQUESTED or ADDED), despite the "added" name.
   - `totalPrice` lives at the parent `iotContainer` level (not per container item).
   - **As of 2026-09-08, both backend PRs implementing this shape are MERGED** (`ne-shipment-api`
     PR #422 → `9581f91f`, `ne-api-gateway` PR #3355 → `c8ddd47b`), but
     `ne-manage-shipment-frontend`'s `ContainerPlusCard.tsx` has **not yet been migrated** to
     consume it — it still reads the old flat shape. See mock payloads for pre-migration testing:
     `ne-shipment-api/find-data/mock-container-plus/`.
6. **Users cannot edit or cancel** a shipment associated with IoT Containers (Container+) —
   this is a hard restriction stated in the acceptance criteria, not currently enforced in code
   as of this writing (verify before relying on it).

## Status Lifecycle

```
        request Container+           ONE approves / confirms
(no VAS) ───────────────────→ REQUESTED ───────────────────→ ADDED
```

| From | Event | To | Notes |
|---|---|---|---|
| _(none)_ | Customer requests Container+ (via booking or ad-hoc) | `REQUESTED` | `requestedChannel` fixed at this point (`BOOKING` or `ADHOC`) |
| `REQUESTED` | ONE confirms/approves the request | `ADDED` | Total price (if `priceSeeable=Y`) and reefer container count become visible |

> No `CANCELLED`/`REJECTED` status has been observed in code or the Jira spec as of this writing.

## Naming / Gotchas

- **`RMB` vs `RMP`**: easy to swap — RMB = standard "Remote Monitoring", RMP = "Remote
  Monitoring **Premium**". Both are contract-level surcharge types, distinct from `Trial`
  (a trial period, not a paid surcharge) and `No Contract`/`Not Trial` (no such surcharge
  filed at all).
- **`isCNPT`**: appears throughout the codebase without a spelled-out definition in
  comments/docs — treat as "Contract Party" per the Jira permission matrix (contrasted with
  `isRequester` = booking requestor). Confirm with the team before relying on this
  interpretation for new logic.
- **`contractType` and `isCNPT` are DEAD fields in production today** — confirmed by inspecting
  real captured apix-test Apigee responses (`ne-shipment-api/find-data/OTSV_BELGIUM.TEST/`):
  neither field is ever present in `booking`, across 10 sample list items and 1 full shipment
  detail response. In `ne-shipment-api`, `contractType` has **no computation path** in
  `shipment.service.ts` (the function that builds `getShipmentDetail`'s response) — the only
  `contractType` logic in that repo lives in an unrelated `shipment-customers` module
  (DB column `BKG_CTRT_TP_NM`, used by a different controller entirely). This strongly suggests
  `isNoContract`'s reliance on `booking.contractType` in `ContainerPlusCard.tsx` has likely never
  actually evaluated to a meaningful case in production — it silently falls through to
  "hide total price" always, regardless of the real Case 1/Case 2 split. This is presumably the
  real motivation for NE-66300 replacing it with the per-container `priceSeeable` flag.
- **`contractType` was removed from the wire contract** (both `ne-api-gateway` PR #3355 and
  `ne-shipment-api` PR #422 — **both MERGED into `develop` on 2026-09-08**, commits `c8ddd47b`
  and `9581f91f` respectively) — any FE logic still reading `booking.contractType`
  (`ContainerPlusCard.tsx`'s `isNoContract`) is now reading a field that **no longer exists on the
  wire**. FE has **not yet been migrated** as of this writing (last FE commit touching this
  component was `NE-66287`, predating the NE-66300 merge) — must be migrated to the new
  per-container `priceSeeable` flag.
- **`addedType` (new optional int field) — meaning CONFIRMED** (2026-09-08, by product owner):
  `1` or `2` → Case 1 (contract filed RMB/RMP/Trial), `3` or `4` → Case 2 (no contract). Confirmed
  present on a container item regardless of status (REQUESTED or ADDED), despite the "added"
  name. **Still unconfirmed**: whether the two values within each pair (1 vs 2, 3 vs 4) carry
  distinct meaning — working hypothesis in the mock data is that they're channel-specific
  (1=BOOKING, 2=ADHOC for Case1; 3=BOOKING, 4=ADHOC for Case2), but this has not been explicitly
  verified. Confirmed separately: `addedType` does **not** gate Total Price visibility —
  `priceSeeable` alone does that, independent of `addedType`/case (see Business Rules rule 3).
- **Data does not originate in `ne-shipment-api` or `ne-api-gateway`** — both simply relay the
  `iotContainer` payload from an upstream Apigee system
  (`/v1/ecommerce/shipments/{bookingNo}/{userId}`, see
  `ne-shipment-api/src/modules/shipment-dashboard/services/shipment.service.ts:799-839`)
  untouched. Neither repo's test suites/fixtures contain realistic `containerList` sample data.
- **No real test data exists in apix-test (as of 2026-09-08)** for either the `OTSV_BELGIUM.TEST`
  or `GEMTEST1` test accounts — queries using the upstream `iotContainerType=R` filter param
  (confirmed as the correct filter via `shipment.service.ts:193`) consistently returned
  `total: 0` across multiple date ranges for `OTSV_BELGIUM.TEST`/`customerCode=BE100917`.
  `GEMTEST1` couldn't even be resolved as a valid `byEComUserId` alone (needs a paired
  `customerCode`, which returns `406 NOT_ACCEPTABLE` if guessed incorrectly). **Approach pivoted
  to constructing mock JSON payloads instead of hunting for live data** — see
  `ne-shipment-api/find-data/mock-container-plus/README.md` for 8 ready-made mock
  `ShipmentDetailResponse` payloads (one per display case) built on the new `containerList[]`
  shape, cloned from a real captured template.

## References

- `ne-manage-shipment-frontend/src/modules/shipment-overview/constants/container-plus.ts`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/models/shipmentDetail.ts:69-102`
- `ne-shipment-api/src/modules/shipment-dashboard/dtos/responses/shipmentDetail.response.ts`
- `ne-shipment-api/src/modules/shipment-dashboard/protos/shipment.proto` (message `IOTContainerDetail`)
- `ne-api-gateway/src/modules/shipment/protos/shipment.proto` (message `IOTContainerDetail`)
- Jira: `[Container+][VAS] Integrate Container+ card into Shipment detail / VAS tab (integration)` (NE-66300)

## Related

- [ne-manage-shipment-frontend Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md)
- [ne-shipment-api Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/features/container-plus-vas.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
