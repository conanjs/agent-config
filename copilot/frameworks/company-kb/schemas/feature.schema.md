# Schema: feature

_Applies to: `repos/{repo}/features/*.md`_

---

## Required Sections (in this order)

```
---
schema: feature
repo: <repo-name>
last-updated: YYYY-MM-DD
---

# Feature: <name>

## Overview
## Business Rules
## Data Model
## Key Code Paths
## API Methods
## Config / Env Vars
## References
## Related
```

---

## Section Definitions

### `## Overview`
**Required. 2–4 sentences.**
What does this feature do for the user/business? What problem does it solve?

### `## Business Rules`
**Required.**
Bullet list of rules enforced by this feature. Be explicit about constraints, limits, and conditions.

Examples:
- Unique index on `(blNo, sortedContainerNos)` — same BL can have multiple requests for different container sets
- Status transitions: `null → SUCCESS | FAILED`

### `## Data Model`
**Required if feature owns or mutates DB entities.**
List each entity with relevant fields and constraints. No need to list all columns — only those relevant to this feature.

```
EntityName
├── field_name   type   ← description / constraint
```

Include: unique indexes, FK constraints, computed fields, jsonb shape.

### `## Key Code Paths`
**Required.**
Annotated list of the important files and methods for this feature.

Format:
```
- `path/to/file.ts` — ClassName.methodName(): what it does
```

Organized by layer: Controller → Service → Repository → Entity

### `## API Methods`
**Required.**
All gRPC methods or REST endpoints this feature exposes or consumes.

| Method | Type | Input | Output | Notes |
|---|---|---|---|---|

### `## Config / Env Vars`
**Required.**
Environment variables this feature depends on.

| Var | Purpose | Required | Default |
|---|---|---|---|

If none: `> _No feature-specific env vars._`

### `## References`
**Required.**
Source file paths and line references cited above.

### `## Related`
**Required.**
Links to other KB docs (flows, domain concepts, other features).
