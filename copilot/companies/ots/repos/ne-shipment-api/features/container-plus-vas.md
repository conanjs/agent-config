---
schema: feature
repo: ne-shipment-api
last-updated: 2026-09-08
---

# Feature: Container+ VAS (IoT Container Detail)

## Overview

`ne-shipment-api` exposes `iotContainer` as part of `ShipmentDetailResponse` (`getShipmentDetail`
gRPC method). It performs **no business logic or transformation** on this field — it is a
pure pass-through of whatever the upstream Apigee-fronted e-commerce shipment API returns for
`iotContainer` on `GET {APIGEE_SHIPMENT_API_URL}/{bookingNo}/{userId}`. This repo's job (for
Container+) is limited to keeping the gRPC proto / response DTO contract in sync with what the
upstream system sends.

## Business Rules

- No Container+ business rules are enforced or computed here — see
  [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md) for the actual rules, which are
  either enforced upstream (data shape) or in the FE (display/visibility logic).
- The only "rule" this repo owns is the wire-contract shape (proto message definitions) — see
  Data Model below, currently mid-migration (NE-66300, PR #422, **MERGED into develop 2026-09-08**, FE not yet migrated).

## Data Model

`ShipmentDetailResponse.iotContainer` — **old shape** (current `main`, pre-#422):
```
IOTContainerDetail
├── status               string
├── requestedChannel     string
├── requestedInfo: { iotContainerQuantity.reefer, requestedDate }
└── addedInfo?: { iotContainerQuantity.reefer, totalPrice?, requestedDate, addedDate }
```

**New shape** (PR #422, MERGED):
```
IOTContainerDetail
├── containerList: IOTContainerListItem[]
│   ├── containerNo        string
│   ├── status              string
│   ├── requestedChannel    string
│   ├── requestedDate       string
│   ├── reefer               Flag ('Y'|'N')
│   ├── priceSeeable         Flag ('Y'|'N')
│   └── addedType?           int32   ← meaning unconfirmed
├── totalPrice?              int32
└── iotContainerQuantity: { reefer: number }
```

Same PR also **removes** `BookingDetail.contractType` (`optional string`, field 56) from the
proto — this field is currently consumed by FE for total-price visibility and has no other
producer/consumer found in this repo.

## Key Code Paths

- `src/modules/shipment-dashboard/services/shipment.service.ts:799-839` — `getShipmentDetail()`:
  calls `this.apigeeClient.get<ShipmentDetailResponse>('${APIGEE_SHIPMENT_API_URL}/${bookingNo}/${userId}')`
  then spreads `...data` (which includes `iotContainer` untouched) into the final response,
  only re-mapping `containers`, `referenceNo`, `booking`, `osl` explicitly.
- `src/modules/shipment-dashboard/dtos/responses/shipmentDetail.response.ts` — TS DTO types
  for `IOTContainerDetail`/`IOTContainerListItem` (PR #422 changes these).
- `src/modules/shipment-dashboard/protos/shipment.proto` — gRPC contract, message
  `IOTContainerDetail` / `IOTContainerListItem` / `IOTContainerRequestedQuantity` (PR #422
  changes these; identical diff mirrored in `ne-api-gateway` PR #3355).
- `src/modules/apigee/` — HTTP client used to call the upstream shipment API
  (`APIGEE_SHIPMENT_API_URL = '/v1/ecommerce/shipments'`, `shipment.service.ts:111`).

## API Methods

| Method | Type | Input | Output | Notes |
|---|---|---|---|---|
| `getShipmentDetail` | gRPC | `bookingNo`, `userId`, `customerCode` | `ShipmentDetailResponse` (incl. `iotContainer`) | Pass-through of upstream `iotContainer`; no local computation |
| `GET {APIGEE_SHIPMENT_API_URL}/{bookingNo}/{userId}` | HTTP (outbound, upstream) | path params | Full shipment detail incl. `iotContainer` | Actual source of Container+ data — owned by an external/upstream system, not this repo |

## Config / Env Vars

| Var | Purpose | Required | Default |
|---|---|---|---|
| `APIGEE_SHIPMENT_API_URL` (constant, not env) | Upstream path prefix `/v1/ecommerce/shipments` | — | hardcoded in `shipment.service.ts:111` |
| Apigee auth (base URL/key/token) | Auth for `apigeeClient` HTTP calls | Yes | configured in `src/modules/apigee/` — see repo overview, do not commit real values |

## References

- `src/modules/shipment-dashboard/services/shipment.service.ts:799-839`
- `src/modules/shipment-dashboard/dtos/responses/shipmentDetail.response.ts`
- `src/modules/shipment-dashboard/protos/shipment.proto`
- PR: https://github.com/ocean-network-express/ne-shipment-api/pull/422 (MERGED 2026-09-08, commit `9581f91f`)

## Related

- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [ne-manage-shipment-frontend Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md)
- [ne-api-gateway Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-api-gateway/features/container-plus-vas.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
