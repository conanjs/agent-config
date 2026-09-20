---
schema: flow
last-updated: 2026-09-08
---

# Flow: Container+ Shipment Detail

## Overview

Loads the Container+ (IoT reefer monitoring VAS) card data as part of the Export Shipment
Detail page's VAS tab. Triggered when a customer opens Shipment Overview → Export Shipment →
Shipment Detail for a booking that has Container+ (`iotContainer` present). Terminal outcome:
the Container+ card renders with status/price/channel info gated by role and contract-pricing
case (see [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)).

## Repos Involved

| Repo | Role | API version used |
|---|---|---|
| `ne-manage-shipment-frontend` | Fetches + renders `ShipmentDetail.iotContainer` in the Container+ card | REST `v2` |
| `ne-api-gateway` | Thin REST↔gRPC passthrough, no transformation | gRPC (proto `IOTContainerDetail`) |
| `ne-shipment-api` | gRPC service; itself calls upstream Apigee API and passes `iotContainer` through untouched | gRPC (proto `IOTContainerDetail`) + upstream HTTP `v1` |
| _(upstream, external)_ | Apigee-fronted e-commerce shipment API — actual source/owner of `iotContainer` data | HTTP `v1` (`/v1/ecommerce/shipments/{bookingNo}/{userId}`) |

## Diagram

```
Customer (browser)
    │  opens Shipment Detail
    ▼
ne-manage-shipment-frontend
    │  useGetShipmentDetailQuery → getShipmentDetail.ts
    │  GET /v2/shipments/{bookingNo}
    ▼
ne-api-gateway
    │  shipment.controller.ts:getShipmentDetail() → gRPC call, no transform
    ▼
ne-shipment-api
    │  shipment.service.ts:getShipmentDetail() (line 799)
    │  GET {APIGEE_SHIPMENT_API_URL}/{bookingNo}/{userId}
    ▼
Upstream Apigee-fronted shipment API  (external system — true source of iotContainer)
    │  returns { ..., iotContainer: {...} }
    ▼
ne-shipment-api  ──spreads `...data` untouched──▶ ne-api-gateway ──▶ ne-manage-shipment-frontend
    │
    ▼
VASTab.tsx → useVASVisibleCondition() → ContainerPlusCard.tsx renders
```

## Step-by-Step Breakdown

### 1. Customer → Open Shipment Detail
- **What**: Customer navigates to an export shipment's detail page and lands on/opens the VAS tab.
- **Why**: Entry point for viewing all VAS (OSL + Container+) info for that booking.
- **How**: `VASTab.tsx` mounts, reads `shipmentDetail` prop already fetched by the parent detail page via `useGetShipmentDetailQuery`.

### 2. Frontend → Fetch Shipment Detail
- **What**: FE calls the gateway REST endpoint for the full shipment detail payload (not
  Container+-specific — `iotContainer` is one field among many).
- **Why**: Single endpoint serves the whole Shipment Detail page (booking, containers, sailings,
  invoice, OSL, iotContainer).
- **How**: `useGetShipmentDetailQuery.ts` → `getShipmentDetail.ts:GET /v2/shipments/{bookingNo}`.

### 3. Gateway → Passthrough to gRPC
- **What**: Gateway forwards the call to `ne-shipment-api` over gRPC, unmodified.
- **Why**: Gateway's role is protocol translation (REST↔gRPC) only, not business logic, for
  this endpoint.
- **How**: `ne-api-gateway/src/modules/shipment/controllers/shipment.controller.ts:90-98`.
- **Notes**: ⚠️ No Container+-specific logic exists in the gateway at all.

### 4. ne-shipment-api → Call Upstream Apigee API
- **What**: Service calls the upstream Apigee-fronted e-commerce shipment API for the full
  shipment detail, including `iotContainer`.
- **Why**: `ne-shipment-api` does not own Container+ data — it's sourced from an external system
  (likely the Container+/IoT monitoring backend, fronted by Apigee).
- **How**: `shipment.service.ts:799-808` — `this.apigeeClient.get<ShipmentDetailResponse>(\`${APIGEE_SHIPMENT_API_URL}/${bookingNo}/${userId}\`)`, where `APIGEE_SHIPMENT_API_URL = '/v1/ecommerce/shipments'` (`shipment.service.ts:111`).

### 5. ne-shipment-api → Reshape Response (iotContainer passthrough)
- **What**: Response is rebuilt with `containers`, `booking`, `osl`, `referenceNo` explicitly
  re-mapped — but `iotContainer` is left untouched via the `...data` spread.
- **Why**: Only fields with FE-specific derivations (e.g. booking flags, OSL tier logic) need
  local remapping; `iotContainer` doesn't, since upstream shape = FE shape (today).
- **How**: `shipment.service.ts:830-839`.
- **Notes**: ⚠️ This is exactly why the ongoing `containerList[]` restructure (PRs below) is a
  pure proto/DTO type change with no accompanying service logic — the actual data transformation
  (if any, e.g. "pick first item where reefer=Y") is expected to happen **upstream** or in the
  **frontend**, not in this repo.

### 6. Frontend → Compute Visibility & Render Card
- **What**: FE decides whether to show the VAS tab / Container+ card, then which fields to show.
- **Why**: Card content is gated by LD feature flags (pilot rollout) and by shipment role
  (`isRequester`/`isCNPT`) and contract-pricing case.
- **How**: `useVASVisibleCondition.ts` → `VASTab.tsx` → `ContainerPlusCard.tsx` (uses
  `useContainerPlusContentVisibility.ts` for field-level gating).

## Error / Edge Cases

| Scenario | Behaviour | Notes |
|---|---|---|
| `shipmentDetail.iotContainer` is undefined | Container+ card not rendered at all | `containerPlusVisible` short-circuits in `useVASVisibleCondition.ts` |
| User is not `isRequester`/`isCNPT` but shipment has Container+ | Card renders but all detail fields hidden | `useContainerPlusContentVisibility.ts` returns `HIDE_ALL_FIELDS` |
| **Realized risk (confirmed 2026-09-08)**: `ne-shipment-api` PR #422 / `ne-api-gateway` PR #3355 are now MERGED into `develop`, but FE has NOT been updated yet | FE's `ContainerPlusCard.tsx` still reads `iotContainer.status`/`requestedInfo`/`addedInfo` and `booking.contractType` — none of which exist in the new upstream shape once this reaches an environment FE points at. Card will render broken/blank in that case. | FE migration to `containerList[]`/`priceSeeable`/`addedType` is now the priority follow-up; see confirmed field-mapping logic and mock payloads in `ne-shipment-api/find-data/mock-container-plus/README.md` for pre-migration QA testing via response interception (Mokku etc.) |
| Upstream Apigee API is down/errors | Whole `getShipmentDetail` call fails (not just `iotContainer`) | No Container+-specific error handling found; follows whatever generic error handling `getShipmentDetail` has |

## API Surface Summary

| Method | Path | Service | Auth | Notes |
|---|---|---|---|---|
| GET | `/v2/shipments/{bookingNo}` | `ne-api-gateway` | Auth0 JWT (`AuthGuard`, standard user-facing) | FE-facing endpoint, whole Shipment Detail payload |
| gRPC | `getShipmentDetail` | `ne-shipment-api` | Internal gRPC (gateway↔service) | `bookingNo`, `userId`, `customerCode` params |
| GET | `/v1/ecommerce/shipments/{bookingNo}/{userId}` | Upstream Apigee-fronted API (external) | Apigee API key / OAuth token (see `ne-shipment-api/src/modules/apigee/`) | True source of `iotContainer`; not owned by any of the 3 repos in this KB |

## References

- `ne-manage-shipment-frontend/src/modules/shipment-overview/hooks/api/export-shipment/useGetShipmentDetailQuery.ts`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/api/exportShipment/getShipmentDetail.ts`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/hooks/api/export-shipment/useVASVisibleCondition.ts`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/components/Export/TabDetailV2/VAS/VASTab.tsx`
- `ne-manage-shipment-frontend/src/modules/shipment-overview/components/Export/TabDetailV2/VAS/ContainerPlus/ContainerPlusCard.tsx`
- `ne-api-gateway/src/modules/shipment/controllers/shipment.controller.ts:90-98`
- `ne-api-gateway/src/modules/shipment/protos/shipment.proto`
- `ne-shipment-api/src/modules/shipment-dashboard/services/shipment.service.ts:111,799-839`
- `ne-shipment-api/src/modules/shipment-dashboard/protos/shipment.proto`
- PR https://github.com/ocean-network-express/ne-api-gateway/pull/3355 (MERGED 2026-09-08, commit `c8ddd47b`)
- PR https://github.com/ocean-network-express/ne-shipment-api/pull/422 (MERGED 2026-09-08, commit `9581f91f`)

## Related

- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [ne-manage-shipment-frontend Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md)
- [ne-shipment-api Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/features/container-plus-vas.md)
- [ne-api-gateway Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-api-gateway/features/container-plus-vas.md)
- [Container+ Test Data Lookup (infra)]({{AGENT_HOME}}/companies/ots/infra/container-plus-test-data-lookup.md)
