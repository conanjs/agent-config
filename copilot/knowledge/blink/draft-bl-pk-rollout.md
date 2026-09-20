# BLink Draft BL Actions — Restricting an Existing Global Feature to PK Customers

Case study from breaking down a Jira story: "As a PK customer, I want Action buttons
in Export Shipment Overview when BL status is AWAITING DRAFT BL APPROVAL (CUSTOMER),
DRAFT BL CHANGE REQUESTED, or DRAFT BL APPROVED, so I can navigate to BLink." Repos:
`ne-manage-shipment-frontend`, `ne-api-gateway`, `ne-shipment-api`,
`ne-import-shipment-api`.

**Core fact driving this whole story:** the BLink integration (fetch a guest URL,
open it in a new tab) and the "hide Confirm Draft BL" mechanism are **already fully
built and shipped** — behind global LaunchDarkly flags. "Global" means the flag is
either on for every customer worldwide or off for every customer; there has never
been a per-country or per-customer conditional in this code path. This story does not
add BLink — it adds a **geographic + role gate** in front of logic that already
exists.

---

## 1. Actors

| Actor | Role | Analogy |
|---|---|---|
| `ne-manage-shipment-frontend` | Decides which action buttons render, from data it already has | The storefront |
| `ne-api-gateway` | REST facade; has an existing, currently-unused proxy (`POST /si-submissions/blink-url`) for fetching a Blink URL server-side | Reception desk |
| `ne-shipment-api` | gRPC BFF — relays upstream data, computes nothing | A clerk repeating what head office said |
| Upstream OPUS / booking gRPC service | Real system of record for BL status, party codes, `bdrFlag` | Head office (black box, outside these repos) |
| BLink (`blink.one-line.com`) | External ONE app where the customer actually edits/approves the draft BL | A linked partner site the app hands the customer off to |

## 2. BL status glossary (in scope for this story)

Opaque upstream strings (`blStatusCode`/`blStatusName`), forwarded as-is by
`ne-shipment-api`. No backend enum defines them; they only exist as hardcoded labels
on the frontend (`useStatusList.tsx:118-145`).

| Code | Meaning |
|---|---|
| `BLA` | Awaiting Draft BL Approval (Customer) |
| `BLL` | Draft BL Change Requested |
| `BLT` | Draft BL Approved |
| `BLRP` | Ready for BL Print (not in scope, context only) |

## 3. Existing flow A — "Confirm Draft BL" (status BLA only)

Pure client-side navigation, **not an API call** — clicking it does not itself
transition any status.

1. **Frontend** — row loads with `blStatusCode='BLA'`, `bdrFlag`, `customerCode`
   already present (`shipmentList.response.ts:76-79`, `shipment.controller.ts:58-64`).
2. **Frontend** — status→action config includes `'BL Draft Confirm'` for BLA in both
   Action and To-do columns (`shipmentActionsStatusMapping.ts:226-230`, `:399-410`).
3. **Frontend** — two independent hide-rules can suppress it: a global flag
   (`HIDE_BL_DRAFT_CONFIRM_TODO_ACTION_FOR_AWAITING_BL_DRAFT_APPROVAL_STATUS`) hides
   the To-do entry for *all* BLA rows; a narrower rule hides it from *both* columns
   only when `bdrFlag === 'Y'` (`ShipmentTodo.tsx:56-59`,
   `useExcludeActionsFollowFlags.ts:103-108`).
4. **Frontend** — on click, `blDraftConfirm()` navigates to an internal route
   (`/documentation/bl-confirm` or legacy `/documentation/bl-revise`) with query
   params. No gRPC call.

## 4. Existing flow B — "Draft BL Change Request" (the BLink hop; BLA/BLL/BLT)

1. **Frontend** — config includes `'BL Draft Change Request'`: unconditional for
   BLA, flag-gated by `NEW_SI` for BLL, flag-gated by
   `DRAFT_BL_CHANGE_REQUEST_ACTION_FOR_DRAFT_BL_APPROVED_STATUS` for BLT
   (`shipmentActionsStatusMapping.ts:44, 248-259, 407, 423-425`).
2. **Frontend** — if flag
   `SHIPMENT_OVERVIEW_BLINK_URL_INTEGRATION_TO_BL_DRAFT_CHANGE_REQUEST_ACTION` is on,
   `useBlinkIntegration` fires (`ActionItem.tsx:31-74`).
3. **BLink** — browser **directly** POSTs to
   `{NEXT_PUBLIC_BLINK_ENDPOINT}/api/authentication/ecom-guest` with
   `{bookingNumber, ecomAccessToken, draftViewMode:'workspace'}`
   (`getBlinkGuestUrl.ts:15-25`). Gateway and Shipment API are **not** in this call —
   the user's own NE access token goes straight to the external BLink domain. Flagged
   as a non-blocking architecture note, not something this story needs to fix.
4. **BLink** — returns `{data:{url}}`, a short-lived pre-authenticated workspace URL.
5. **Frontend** — `window.open(url, '_blank')` (`ActionItem.tsx:170-182, 210-247`).

## 5. Why a `customerCode`/PK check is needed even though the feature "already exists"

The feature existing in code is not the same as it being reachable only by the right
audience. Today, visibility of both actions is controlled by exactly two kinds of
condition, neither of which is geographic:

- **Global boolean flags** — on/off for every customer at once (e.g.
  `SHIPMENT_OVERVIEW_BLINK_URL_INTEGRATION_TO_BL_DRAFT_CHANGE_REQUEST_ACTION`).
- **Per-row role matching** — does the logged-in user's `customerCode` match this
  specific booking's `shipperCode`/`forwarderCode`/`eBookingPartyCode`/
  `controlPartyCode` (`useExcludeActionsFollowFlags.ts:19-89`). This already exists
  for *other* actions; it has just never been combined with a country condition.

There is **no existing mechanism that limits a feature to one country's customers**.
The business wants BLink shown to Pakistan customers only (a controlled regional
rollout — read: BLink likely isn't validated/onboarded for other countries yet), which
a global on/off flag cannot express. So the `customerCode` check isn't rebuilding
anything — it's a **new AND condition** layered onto gating that already exists:
`getCountryCode(userInfo.customerCode) === 'PK'` AND *(existing role match)* AND
*(status in BLA/BLL/BLT)`. The pattern for country-from-customerCode already exists
elsewhere (`getCountryCode()` = `customerCode.slice(0,2)`,
`useCheckCargoReleaseRegion.ts`), and a constant `PAKISTAN_CODE='PK'` already exists
unused (`region.constants.ts:117`) — so this is wiring, not invention.

## 6. Confirming: hide "Confirm Draft BL" for Awaiting Draft BL Approval

Yes, correct — but scoped narrowly. Per the ticket AC: when status = Awaiting Draft
BL Approval (Customer) = `BLA`, hide **"Confirm Draft BL" from the To-do column
only**. The Action-column entry, and the `blDraftConfirm()` click behavior, are
explicitly called out as **out of scope / unchanged**. So this is "remove it from the
to-do checklist," not "remove the button" — it stays clickable from the Action menu.

Two open items on this specific rule (see `ne-51016` flag /
`HIDE_BL_DRAFT_CONFIRM_TODO_ACTION_FOR_AWAITING_BL_DRAFT_APPROVAL_STATUS` for the
prior, broader version of this same idea):

- The ticket's Given/When/Then for this hide-rule doesn't restate the PK
  precondition — it's only implied by the story's Out-of-scope note ("Customer code
  not starts with PK... will not be affected"). Worth confirming explicitly with the
  PM: PK-only, or global?
- Today's existing hide only fires when `bdrFlag==='Y' AND status==='BLA'`
  (narrower). The new ask is "whenever status=BLA" (broader, for PK). Need to confirm
  whether `bdrFlag` still matters for PK, or whether status alone should now be
  sufficient — i.e., is this an OR onto the existing rule, or a replacement of it.

## 7. Gating logic today (reference table)

| Action | Column | Status | Current condition |
|---|---|---|---|
| Confirm Draft BL | Action | BLA | Shown unless `bdrFlag==='Y'` |
| Confirm Draft BL | To-do | BLA | Hidden if global flag on, or `bdrFlag==='Y'` |
| Draft BL Change Request | Action | BLA | Unconditional |
| Draft BL Change Request | Action | BLL | Only if flag `NEW_SI` on |
| Draft BL Change Request | Action | BLT | Only if flag `DRAFT_BL_CHANGE_REQUEST_ACTION_FOR_DRAFT_BL_APPROVED_STATUS` on |

None of this checks customer country today — that's the gap this story closes.

## 8. Backend scope

`ne-shipment-api` needs little-to-no change — `customerCode`, `blStatusCode`,
`bdrFlag`, and all party codes are already exposed in the shipment list response
(`shipmentList.response.ts`). It's a thin gRPC BFF; it computes none of this itself,
just relays it from the upstream OPUS/booking service. `ne-import-shipment-api` is
confirmed unrelated (Import flow, no shared enum/package with the Export API).

## 9. Task breakdown (as scoped for Jira)

1. **[FE, spike]** Decide PK-eligibility rollout mechanism: hardcode `PAKISTAN_CODE`
   vs. a new LD flag holding a country list (mirrors `EXCLUDE_CANCEL_FEE_COUNTRIES`).
2. **[FE, M]** Gate "Draft BL Change Request" by PK + role across BLA/BLL/BLT
   (`shipmentActionsStatusMapping.ts:399-427`, `useExcludeActionsFollowFlags.ts`).
3. **[FE, S]** Hide "Confirm Draft BL" from To-do for PK + BLA
   (`ShipmentTodo.tsx:56-59`) — Action column and click handler untouched.
4. **[FE, S]** Confirm which field means "Booking Requester" — `isRequester` vs.
   `isBookingCopyable` (`booking.interface.ts:56,72`); only the latter is used today,
   for a different purpose.
5. **[FE, S]** BLink fetch-failure error message — ticket names the scenario with no
   Given/When/Then; blocked on UX copy before sizing.
6. **[QA, M]** Test matrix: role × status × PK/non-PK × `bdrFlag`, both columns.
7. **[Cross-team, discussion]** Whether the direct browser→BLink token call should
   move behind the Gateway's existing `si-submissions/blink-url` proxy — non-blocking,
   separate from PK scoping.
8. **[FE, cleanup]** Remove stray uncommitted debug `console.log` in
   `ExportTable.tsx:112-116` (unrelated to this feature).

---

## References
- `ne-manage-shipment-frontend/src/modules/shipment-overview/models/shipmentActionsStatusMapping.ts` — status→action/todo config
- `.../components/Export/ExportTable/hooks/useExcludeActionsFollowFlags.ts` — Action column role/flag filtering
- `.../components/ShipmentTodo/ShipmentTodo.tsx` — To-do column resolution and overrides
- `.../components/ActionItem/ActionItem.tsx` — Blink URL fetch + new-tab navigation
- `shared-frontend/shared/constants/featureFlagConstants.ts:342-370` — flag definitions
- `shared-frontend/shared/hooks/useCheckCargoReleaseRegion.ts`, `handleString.ts` — existing country-from-customerCode pattern
- `ne-manage-shipment-frontend/src/modules/shipment-overview/shared/constants/new-si/region.constants.ts:117` — `PAKISTAN_CODE` constant
- `ne-shipment-api/src/modules/shipment-dashboard/controllers/shipment.controller.ts` — list/detail/checklist gRPC endpoints
- `ne-shipment-api/src/modules/shipment-dashboard/dtos/responses/shipmentList.response.ts` — `BillOfLading`/`BookingInfo` fields
- `ne-shipment-api/src/utils/utils.service.ts:35-40` — `convertToCustomerCountry()`
- `ne-api-gateway/src/modules/shipping-instruction/controllers/si-submissions.controller.ts:296-300` — existing unused server-side Blink URL proxy
- No external/public documentation applies — BLink and the OPUS-derived BL status codes are internal ONE/NE proprietary systems with no public spec.

## Related
- NE-51016 — "confirm draft BL to-do column for awaiting draft BL approval" (flag origin)
- NE-48366 — original Blink URL flag
- NE-62200, NE-63967, NE-71095, NE-71157, NE-72799, NE-75248 — prior commits that iteratively built today's flag-gated implementation (per git log)
- Full detailed flow doc + Jira task cards published as an artifact during grooming: "PK BLink Rollout" (2026-08-27)
