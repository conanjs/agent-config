---
schema: tree/v2
last-updated: 2026-10-24
prefix: ZN
owner: pr-reviewer
phases: [setup]
feeds: one row of the zone map (`zones.md`)
---

# Zone Classification (ZN)

Decides whether a path is `owned`, `adopted` or `foreign`. It does NOT decide whether to fix anything. **Default is owned**, because owned means the strictest review.

## Overview

```
ZN-Q1 Can this team change the code and release it on its own?
├─ NO  → ZN-Q2
└─ YES → ZN-Q3
ZN-Q2 Is another named team or a vendor the owner?
├─ YES → foreign (record owner)
└─ NO  → ask a human; default owned
ZN-Q3 Is there known debt with a ticket or reason that the team accepts for now?
├─ YES → adopted (record ticket)
└─ NO  → owned
```

## Nodes

### ZN-Q1 — Can this team change and release the code without another team's approval?
- **Criteria:** CODEOWNERS, repo permissions, vendored or generated directories, submodules, `facts` in the Company KB.
- **Branches:**
  - NO → ZN-Q2
  - YES → ZN-Q3
- **Default:** YES (owned).
- **Escalate when:** CODEOWNERS and the Company KB name different owners.

### ZN-Q2 — Is a specific other team or a vendor the owner?
- **Criteria:** owner in CODEOWNERS, `service-catalog`, package registry, license headers.
- **Branches:**
  - YES → foreign, with the owner recorded
  - NO → ask a human
- **Default:** owned, plus a question (never silently foreign: foreign relaxes review).
- **Escalate when:** the owner cannot be named.

### ZN-Q3 — Is this code known debt that the team has accepted for now?
- **Criteria:** a ticket, an ADR or a comment in the zone map `Reason`; age of the code; open waivers.
- **Branches:**
  - YES → adopted, with the ticket
  - NO → owned
- **Default:** owned.
- **Escalate when:** the debt has no ticket and no owner.

## Trade-off tables

| Zone | Review behaviour |
|---|---|
| owned | Full rules + Lens |
| adopted | Full rules; debt findings may be lowered one step by a lesson or covered by a waiver |
| foreign | Border checks only (PRV-Q4); no comments on the inside |

## Recording

One row in `<lens>/zones.md`. Changing a path from `owned` to `foreign` is a reviewed PR, since it relaxes review.

## References

**Local artifacts:**
- `../schemas/zone-map.schema.md`, `pr-review.tree.md` PRV-Q3.

**External authoritative sources:**
> _None._

## Related

- `lesson-promotion.tree.md`.
