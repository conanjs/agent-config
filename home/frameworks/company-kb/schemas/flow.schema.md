# Schema: flow

_Applies to: `flows/*.md`_

---

## Required Sections (in this order)

```
---
schema: flow
last-updated: YYYY-MM-DD
---

# Flow: <name>

## Overview
## Repos Involved
## Diagram
## Step-by-Step Breakdown
## Error / Edge Cases
## API Surface Summary
## References
## Related
```

---

## Section Definitions

### `## Overview`
**Required. 2–4 sentences.**
Answers:
- What does this flow accomplish?
- Who/what triggers it?
- What is the terminal outcome?

### `## Repos Involved`
**Required.**
Table format:

| Repo | Role | API version used |
|---|---|---|

### `## Diagram`
**Required.**
Mermaid sequence diagram OR ASCII diagram. Shows all actors, messages, and order.
Every arrow in the diagram must have a corresponding step in the Step-by-Step section.

### `## Step-by-Step Breakdown`
**Required. This is the most important section.**

Numbered, hierarchical steps. Each top-level step maps to one arrow in the diagram.

Format for each step:

```
### N. [Actor] → [Action] → [Target]
- **What**: Plain English: what physically happens at this step.
- **Why**: Domain/business reason this step exists. Why not skip it?
- **How**: Technical wiring — file path, method name, key call. Use `file.ts:method()` format.
- **Notes**: ⚠️ Gotchas, naming inconsistencies, edge cases. Omit this line if nothing notable.
```

For compound steps with sub-actions, use numbered sub-steps:

```
### N. [Actor] → [Complex Action]
- **What**: ...
- **Why**: ...
- **How**: ...

  **N.1** Sub-step name
  - ...

  **N.2** Sub-step name
  - ...
```

### `## Error / Edge Cases`
**Optional but recommended.**
Table or bullet list. What can go wrong and what happens.

| Scenario | Behaviour | Notes |
|---|---|---|

If no known error cases: `> _No error cases documented._`

### `## API Surface Summary`
**Required.**
All endpoints involved in this flow.

| Method | Path | Service | Auth | Notes |
|---|---|---|---|---|

### `## References`
**Required.**
Specific source file paths and line numbers cited above.
Format: `path/to/file.ts` or `path/to/file.ts:MethodName`

### `## Related`
**Required.**
Links to other KB docs relevant to this flow.
Format: `- [Doc Title]({{AGENT_HOME}}/companies/<company>/path/to/doc.md)` — see `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`'s "Structure Options" for why, not a relative `../` path.
