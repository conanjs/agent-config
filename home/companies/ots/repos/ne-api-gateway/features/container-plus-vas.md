---
schema: feature
repo: ne-api-gateway
last-updated: 2026-09-08
---

# Feature: Container+ VAS (IoT Container Detail passthrough)

## Overview

`ne-api-gateway` exposes the REST endpoint the frontend calls for shipment detail
(`GET /v2/shipments/{bookingNo}`) and simply forwards the call over gRPC to `ne-shipment-api`'s
`getShipmentDetail`. It performs **no transformation** of `iotContainer` — its only
responsibility for Container+ is keeping its copy of the `shipment.proto` contract in sync with
`ne-shipment-api`'s.

## Business Rules

- None owned here. See [domain/container-plus.md]({{AGENT_HOME}}/companies/ots/domain/container-plus.md).

## Data Model

Same `IOTContainerDetail` / `IOTContainerListItem` proto messages as `ne-shipment-api` — see
that repo's [Container+ VAS feature doc]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/features/container-plus-vas.md#data-model)
for the full before/after shape. `ne-api-gateway` PR #3355 makes the **identical** proto diff
(same message renames/fields), confirming this is a pure contract-sync change with no gateway-side
logic added.

## Key Code Paths

- `src/modules/shipment/controllers/shipment.controller.ts:90-98` — `getShipmentDetail()`
  controller method: calls `this.shipmentService.getShipmentDetail({ bookingNo }, metadata)` and
  returns the result as-is (thin REST↔gRPC passthrough).
- `src/modules/shipment/protos/shipment.proto` — gRPC contract mirrored from `ne-shipment-api`
  (message `IOTContainerDetail` / `IOTContainerListItem`, PR #3355 changes these).
- `src/modules/shipment/interfaces/shipment.service.interface.ts` — gRPC client interface.

## API Methods

| Method | Type | Input | Output | Notes |
|---|---|---|---|---|
| `GET /v2/shipments/{bookingNo}` | REST | `bookingNo` path param | `ShipmentDetail` (incl. `iotContainer`) | Consumed by `ne-manage-shipment-frontend`'s `getShipmentDetail.ts`; thin passthrough to gRPC |

## Config / Env Vars

> _No feature-specific env vars — uses the shared gRPC client config for `ne-shipment-api`._

## References

- `src/modules/shipment/controllers/shipment.controller.ts:90-98`
- `src/modules/shipment/protos/shipment.proto`
- PR: https://github.com/ocean-network-express/ne-api-gateway/pull/3355 (MERGED 2026-09-08, commit `c8ddd47b`)

## Related

- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [ne-shipment-api Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/features/container-plus-vas.md)
- [ne-manage-shipment-frontend Container+ VAS Feature]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md)
- [Container+ Shipment Detail Flow]({{AGENT_HOME}}/companies/ots/flows/container-plus-shipment-detail.md)
