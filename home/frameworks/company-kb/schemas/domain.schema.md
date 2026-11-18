# Schema: domain

_Applies to: `domain/*.md`_

---

## Required Sections (in this order)

```
---
schema: domain
last-updated: YYYY-MM-DD
---

# Domain: <concept-name>

## Definition
## Business Rules
## Status Lifecycle
## Naming / Gotchas
## References
## Related
```

---

## Section Definitions

### `## Definition`
**Required.**
Plain English definition of the concept. Include a one-sentence analogy if the concept is technical or abstract.

Also: which real-world document or process does this map to in shipping/logistics?

### `## Business Rules`
**Required.**
Enumerated rules. Be precise: who can do what, under what conditions, with what effect.

### `## Status Lifecycle`
**Required if concept has a status/state machine.**
State diagram (ASCII) + transition table.

```
null ──submit──→ SUCCESS
              └──→ FAILED
```

| From | Event | To | Notes |
|---|---|---|---|

If no lifecycle: `> _This concept has no status lifecycle._`

### `## Naming / Gotchas`
**Required.**
Known naming inconsistencies, confusing terminology, or pitfalls. This is where gotchas that burned time are documented permanently.

Format:
```
- **<term>**: <clarification or gotcha>
```

If none: `> _No known naming issues._`

### `## References`
**Required.**
Source files where this concept is implemented (entities, schemas, enums).

### `## Related`
**Required.**
Other domain concepts, flows, or features that use this concept.
