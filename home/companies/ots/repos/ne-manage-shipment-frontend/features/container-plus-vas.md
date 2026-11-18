---
schema: feature
repo: ne-manage-shipment-frontend
last-updated: 2026-10-30
---

# Feature: Container+ VAS Card

## Overview

Renders the "Container+" card inside the VAS tab of the Export Shipment Detail view, showing
IoT reefer-container monitoring status/price/channel info for shipments that purchased the
Container+ value-added service. Card content is role- and contract-case-gated per the business
rules in the [Container Plus domain doc]({{AGENT_HOME}}/companies/ots/domain/container-plus.md).

## Business Rules

See [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md) for the full rule set
(8-case matrix, status lifecycle, contract-case pricing rule). FE-specific implementation
notes:

- Card only renders if `containerPlusVisible` is true: `showContainerPlus` LD flag (pilot) AND
  `shipmentDetail.iotContainer` is truthy.
- Detail fields (`showNoOfIotContainer`, `showTotalPrice`, `showDateRequested`, `showStatus`,
  `showRequestedChannel`) are all-or-nothing, gated by `isRequester || isCNPT`.
- Total Price row only renders at all when `contractType` is `'No Contract'` or `'Not Trial'`
  (`isNoContract`) — **this will break once `contractType` is removed from the backend proto**
  (NE-66300, both `ne-api-gateway`#3355 and `ne-shipment-api`#422 are open). Must migrate to the
  new per-container `priceSeeable` flag when the new `containerList[]` shape ships.
- Date shown is `requestedInfo.requestedDate` while `status=REQUESTED`, else
  `addedInfo.addedDate` while `status=ADDED` (current flat shape). New shape collapses both to
  a single `requestedDate` per list item — see domain doc rule 5.
- Reefer container count link (`x{n}`) navigates the user to the Container tab
  (`ShipmentDetailTab.Container`) via `handleSelectTab`.

## Data Model

**Current (pre-NE-66300) shape** — `ShipmentDetail.iotContainer`:
```
IOTContainerInfo
├── status                string           ← 'REQUESTED' | 'ADDED'
├── requestedChannel      string           ← 'BOOKING' | 'ADHOC'
├── requestedInfo
│   ├── iotContainerQuantity.reefer   number
│   └── requestedDate     string
└── addedInfo (optional)
    ├── iotContainerQuantity.reefer   number
    ├── totalPrice         number (optional)
    ├── requestedDate      string
    └── addedDate          string
```

**Target (post-NE-66300) shape** — matches new proto `IOTContainerDetail` (not yet consumed
by FE code as of this writing):
```
IOTContainerDetail
├── containerList[]
│   ├── containerNo        string
│   ├── status             string   ← per-container status
│   ├── requestedChannel   string
│   ├── requestedDate      string   ← used for BOTH requested + added date
│   ├── reefer              'Y'|'N' ← select first item where reefer='Y'
│   ├── priceSeeable        'Y'|'N' ← replaces contractType-based isNoContract check
│   └── addedType (optional int)    ← meaning unconfirmed, not yet consumed anywhere
├── totalPrice (optional number)     ← parent-level, not per container
└── iotContainerQuantity.reefer      ← parent-level count
```

`BookingInfo.contractType` (used today for `isNoContract`) is being removed from the proto
entirely in the same change.

## Key Code Paths

- `src/modules/shipment-overview/hooks/api/export-shipment/useGetShipmentDetailQuery.ts` —
  fetches `ShipmentDetail` via React Query.
- `src/modules/shipment-overview/api/exportShipment/getShipmentDetail.ts` —
  `GET /v2/shipments/{bookingNo}` through `safeApiClient` (→ ne-api-gateway).
- `src/modules/shipment-overview/hooks/api/export-shipment/useVASVisibleCondition.ts` —
  `containerPlusVisible = showContainerPlus && !!shipmentDetail.iotContainer`.
- `src/modules/shipment-overview/hooks/useLDShowContainerPlusCard.ts` — LD flag
  `SHIPMENT_OVERVIEW_CONTAINER_PLUS_CARD` + pilot flag `useLDReeferIotContainer()`.
- `src/modules/shipment-overview/hooks/useLDReeferIotContainer.ts` — LD flag
  `EXPORT_SHIPMENT_REEFER_IOT_CONTAINER` (pilot-customer gate).
- `src/modules/shipment-overview/hooks/useContainerPlusContentVisibility.ts` — all-or-nothing
  field visibility by `isRequester || isCNPT`.
- `src/modules/shipment-overview/components/Export/TabDetailV2/VAS/VASTab.tsx` — mounts
  `ContainerPlusCard` alongside `OSLCard`.
- `src/modules/shipment-overview/components/Export/TabDetailV2/VAS/ContainerPlus/ContainerPlusCard.tsx` —
  main card component: `isNoContract` check (line ~42), reefer link, total price, status tag,
  requested channel, `InlineBanner` for `REQUESTED` state (contract vs no-contract message).
- `.../ContainerPlus/ContainerInformation.tsx` — generic label/value row, hidden when
  `visible=false`.
- `.../ContainerPlus/ContainerRequestChannel.tsx` — renders "via BOOKING" / "via AD-HOC REQUEST"
  tag from `CONTAINER_PLUS_CHANNEL_LABEL`.
- `src/modules/shipment-overview/constants/container-plus.ts` — `CONTAINER_PLUS_STATUS`,
  `CONTAINER_PLUS_CHANNEL`, `CONTAINER_PLUS_CHANNEL_LABEL`, `BOOKING_CONTRACT_TYPE`.
- `src/modules/shipment-overview/models/shipmentDetail.ts:69-102` — `IOTContainerInfo`,
  `IOTContainerRequestedInfo`, `IOTContainerAddedInfo` type defs (current flat shape).
- `src/shared-frontend/shared/hooks/api/useCheckContainerPlusPermission.ts` /
  `useCheckContainerPlusForEnhancement.ts` — separate LD-gated permission checks used for the
  "What's New"/promotion surfaces (`CONTAINER_PLUS_PROMOTION`,
  `CONTAINER_PLUS_WHATS_NEW_ENHANCEMENT` flags, plus `MenuItemEnum.CONTAINER_PLUS` menu perm) —
  distinct from the shipment-detail card gating above.
- `src/shared-frontend/shared/components/VASTermsAndRulesModal/ContainerPlus/` — T&Cs modal
  content shown from the VAS tab.

## API Methods

| Method | Type | Input | Output | Notes |
|---|---|---|---|---|
| `GET /v2/shipments/{bookingNo}` | REST (via `ne-api-gateway`) | `bookingNo` path param | `ShipmentDetail` incl. `iotContainer` | Same endpoint used for the whole Shipment Detail page, not Container+-specific |

## Config / Env Vars

| Flag/Var | Purpose | Required | Default |
|---|---|---|---|
| LD flag `SHIPMENT_OVERVIEW_CONTAINER_PLUS_CARD` | Master toggle for showing the Container+ card in Shipment Detail | Yes | off |
| LD flag `EXPORT_SHIPMENT_REEFER_IOT_CONTAINER` | Pilot-customer gate (combined with above) | Yes | off |
| LD flag `CONTAINER_PLUS_PROMOTION` | Separate: gates Container+ promo/menu visibility | Yes | off |
| LD flag `CONTAINER_PLUS_WHATS_NEW_ENHANCEMENT` | Separate: gates "What's New" enhancement content | Yes | off |
| `NEXT_PUBLIC_PAGE_ENDPOINT` | Base URL used to build the "Learn More" link to `/one-solutions/whats-new/container-plus` | Yes | — |

## References

- All file paths listed under "Key Code Paths" above.
- `ne-shipment-api` PR #422 — `feat(NE-66300): update proto shipment to integrate iot` (**MERGED** 2026-09-08, commit `9581f91f`)
- `ne-api-gateway` PR #3355 — `feat(NE-66300): update proto shipment to integrate container iot` (**MERGED** 2026-09-08, commit `c8ddd47b`)

## Related

- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [ne-shipment-api Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/features/container-plus-vas.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
- [Container+ VAS Tooltip]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas-tooltip.md) — one-time Product Fruits tooltip pointing at this card (`data-tourguide="container-plus-card"`).
