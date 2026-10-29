---
schema: procedure/v1
last-updated: 2026-10-01
depends-on: []
stack: demo-stack
inputs: [name, module?]
allowed-paths: [src/{module}/{name}.ts]
---

# Procedure: Add a thing

**Inputs needed:**
- **name** — the thing's name.
- **module** — the module folder; optional.

## Steps
1. Create the file.

## References
- `copilot/procedures/procedure.schema.md` — the shape this procedure follows.

## Related
- `simple.procedure.md`
