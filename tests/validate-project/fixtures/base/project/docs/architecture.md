---
schema: repo-architecture/v2
last-updated: 2026-10-01
updated-by: architecture
---

# Architecture: demo project

## 1. Overview
One service.

## 2. System context
None.

## 3. Components
```yaml
components:
  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }
```

## 4. Layers & dependency rules
```yaml
modules:
  - { name: orders, path: src/modules/orders/, may-depend-on: [], public: index.ts }
layers:
  - { name: domain, path: domain/, may-depend-on: [] }
  - { name: application, path: application/, may-depend-on: [domain] }
```

## 5. Data
None.

## 6. External dependencies
| Dependency | Kind | Doc |
|---|---|---|
| payments | http | docs/integrations/payments.md |

## 7. Cross-cutting concerns
Follows DEM-1.

## 8. Key decisions
| Id | Decision |
|---|---|
| DR-001 | Use the demo stack |

## 9. Verification status
Checked.

## 10. Known gaps / out of scope
None.
