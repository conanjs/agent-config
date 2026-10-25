---
schema: zone-map/v1
repo: shop-orders
team: orders
last-updated: 2026-10-24
---

# Zones: shop-orders

## Zones
| Path | Zone | Owner | Reason |
|---|---|---|---|
| vendor/legacy-tax-client/** | foreign | finance-platform | vendored library owned by another team |
| src/orders/order_repository.ts | adopted | orders | known debt, ticket ORD-88 |
| src/** | owned | orders | default for team code |

## Default
owned

## References

**Local artifacts:**
- `../../schemas/zone-map.schema.md`.

## Related

- `waivers/WV-003.md`.
