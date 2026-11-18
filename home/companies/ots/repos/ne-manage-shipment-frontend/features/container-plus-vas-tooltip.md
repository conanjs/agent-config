---
schema: feature
repo: ne-manage-shipment-frontend
last-updated: 2026-10-30
---

# Feature: Container+ VAS Tooltip (Product Fruits tour)

## Overview

Shows a one-time Product Fruits tooltip ("Discover CONTAINER+ Summary") next to the Container+ card when a user opens the **Value Added Services** tab of an export shipment detail. It introduces what the card shows. Parent ticket NE-81312. Status on 2026-10-30: code is a draft on branch `feature/NE-81312-container-plus-vas-tour-guide` (not committed, with a local-only flag bypass in `TabDetail.tsx`); Non-Prod tour published; Prod tour and LaunchDarkly flag not created yet.

## Business Rules

- Shows only when **all** are true: LD flag `CONTAINER_PLUS_VAS_TOUR_GUIDE` on, VAS tab active, `containerPlusVisible` (see [Container+ VAS Card]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md)), user id loaded.
- Once per user ID: Product Fruits stores `finished` per `username` (= our `userId`). No local storage.
- Never calls `tryStartTour` unless `userState === 'not_finished'` (it would reset the state), no other tour `isRunning`, and `isTourEligible` is `eligible`; state is re-checked after the eligibility await.
- Waits for `[data-tourguide="container-plus-card"]`, scrolls it to the centre, then starts. Stops waiting on unmount or when disabled.
- The user cannot interact with the page while the card shows: Product Fruits backdrop `boxed_bg` + block clickthrough, plus card CSS `pointer-events: none` on the Container+ card.
- OK is the only button. It calls `advanceToNextStep(<running tour id>)`, which finishes the one-card tour. It does not hard-code the tour ID, so the same card HTML works in Prod.
- Not shown for eCom Admin logins (Product Fruits is not loaded for them) or when `ne-35274-products-fruits-poc` is off.

## Data Model

> _No DB entities. The only state is Product Fruits' per-user tour state (`not_finished` / `finished` / `skipped`), held by Product Fruits._

Tour (Product Fruits Non-Prod workspace `9KdtwLonu5AUfE6j`):

```
Tour 150358  "[Export Shipment] Container+ VAS Tooltip"   tag Container+   trigger manually   published 2026-10-30
└── card "Discover CONTAINER+ Summary"
    ├── elements[0].query        [data-tourguide="container-plus-card"]
    ├── url.parametrized         /one-ecom/manage-shipment/shipments?tab=export[dynamic]
    ├── displayType              element
    ├── cardPosition             { position: "or", width: "360px", arrowToTarget: true }
    ├── backdrop.type            boxed_bg
    ├── blockedKeys              ["_pointer-events"]
    └── content.body.en[0].html  style + title + text + OK button (footer and title hidden)
```

## Key Code Paths

- `src/modules/shipment-overview/hooks/common/useContainerPlusTourGuide.ts` — `useContainerPlusTourGuide(isEnabled, userId)`: find tour by `CONTAINER_PLUS_TOUR_NAME`, state/running/eligibility checks, wait for `CONTAINER_PLUS_TOUR_TARGET`, scroll, `tryStartTour`; waits for `productfruits_ready`.
- `src/modules/shipment-overview/components/Export/TabDetailV2/TabDetail.tsx` — calls the hook with `flag && isVASTabActive && containerPlusVisible`.
- `src/modules/shipment-overview/components/Export/TabDetailV2/VAS/ContainerPlus/ContainerPlusCard.tsx` — root `div` has `data-tourguide="container-plus-card"`.
- `src/shared/constants/featureFlagConstants.ts` — `CONTAINER_PLUS_VAS_TOUR_GUIDE: 'ne-81312-container-plus-vas-tour-guide'`.
- `src/shared-frontend/shared/layouts/ProductFruits/ProductFruits.tsx` — loads Product Fruits, `username: userInfo.userId`.
- Tests: `hooks/common/__tests__/useContainerPlusTourGuide.test.ts` (16), `components/Export/TabDetailV2/TabDetail.test.tsx` (4).

## API Methods

| Method | Type | Input | Output | Notes |
|---|---|---|---|---|
| `window.productFruits.api.tours.getTours()` | Product Fruits JS API | — | tours with `id`, `name`, `isRunning`, `userState` | Find by name |
| `…tours.isTourEligible(id)` | Product Fruits JS API | tour id | `eligible` / `not_eligible` | Rules check |
| `…tours.tryStartTour(id)` | Product Fruits JS API | tour id | — | Resets state to `not_finished`, then starts |
| `…tours.advanceToNextStep(id)` | Product Fruits JS API | tour id | — | Called by the OK button; finishes the tour |
| `productfruits_ready` | window event | — | — | Product Fruits loaded |

## Config / Env Vars

| Var | Purpose | Required | Default |
|---|---|---|---|
| LD flag `ne-81312-container-plus-vas-tour-guide` | Turns the tooltip on (not created in LD yet) | Yes | off |
| LD flag `ne-35274-products-fruits-poc` | Loads Product Fruits at all | Yes | off |
| LD flag `ne-66287-integrate-container-plus-card-into-shipment-detail` + pilot flag | Shows the Container+ card (the target) | Yes | off |
| `NEXT_PUBLIC_PRODUCT_FRUITS_WORKSPACE_CODE` | Non-Prod `9KdtwLonu5AUfE6j`, Prod `21CLN8lR9aaGw3JY` | Yes | — |

## References

- All file paths under "Key Code Paths".
- Product Fruits tour (Non-Prod): `https://my.productfruits.com/portal/workspace/9KdtwLonu5AUfE6j/guide/tours/detail/150358`.
- Team docs in `ne-copilot/docs/tour-guides/`: `productfruits-tooltip-guide.md` (developer setup guide with screenshots), `container-plus-vas-tour-guide.md` (plan and saved settings), `productfruits-fundamentals.md` (basics).
- Portal API calls used to create the tour (checked 2026-10-30, internal, may change): `POST /api/v3/tours/{ws}`; `PUT /api/v3/tours/{ws}/{id}` (name, tag, trigger); `PUT /api/v1/tours/{ws}/{id}?backup=true&versionCheck=true&scope=content` (cards); `POST /api/v1/tours/{ws}/{id}/publish`.

## Related

- [Container+ VAS Card]({{AGENT_HOME}}/companies/ots/repos/ne-manage-shipment-frontend/features/container-plus-vas.md) — the card this tooltip points at.
- [Container Plus Domain]({{AGENT_HOME}}/companies/ots/domain/container-plus.md)
- [Product Fruits tours (general)]({{AGENT_HOME}}/knowledge/product-tours/product-fruits-tours.md) and [settings and API]({{AGENT_HOME}}/knowledge/product-tours/product-fruits-settings-and-api.md)
