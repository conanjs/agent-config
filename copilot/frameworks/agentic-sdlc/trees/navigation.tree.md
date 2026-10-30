---
schema: tree/v2
last-updated: 2026-10-30
prefix: NAV
owner: coordinator
phases: [P0]
feeds: the entry point for one request (area, kind, procedure or spec workflow, checks, owning role), answered by the coordinator
---

# Navigation (NAV)

Decides where a request starts: which area and kind of file it touches, which procedure or spec workflow to follow, which checks will run and which role owns it. It does NOT decide how to do the work: that is the owning role's tree.

## Overview
```
NAV-Q1 Is it only a lookup (where, what, what checks it, what depends on it), with no change asked?
  YES → answer from the atlas (--explain for a file or folder, the area page otherwise); stop
  NO  → NAV-Q2 (a named file or folder is explained first, as input only)
NAV-Q2 Is it a project mission (a feature or a fix in a project repo)?
  YES → orchestrator (P0 intake)
  NO  → NAV-Q3
NAV-Q3 Does it change a tool (validator, installer, script)?
  YES → spec first, scenarios first (TST-13, TST-14) → NAV-Q5
  NO  → NAV-Q4
NAV-Q4 Is it a document, rule or pattern?
  YES → the area and kind in the atlas → NAV-Q5
  NO  → escalate: the map has no branch for it
NAV-Q5 Which checks and which role own it?
```

## Nodes
### NAV-Q1 — Is it only a lookup?
- **Criteria:** The request asks where something is, what it is, what checks it, who owns it or what depends on it, and asks for no change. A named path alone does not make it a lookup: "change validation in atlas.mjs" names a file and asks for a change.
- **Branches:**
  - YES → answer from the atlas: `atlas.mjs --explain <path>` for a file or a folder, the area page otherwise; quote "linked from (direct)", "mentioned by name" and "depends on it (declared chains)" as separate lists. For "who owns it", also walk NAV-Q5. Then stop.
  - NO → run `atlas.mjs --explain` on any named file or folder, to know its kind and checks, then classify the request → NAV-Q2
- **Default:** NO: a request that may change something is classified, never only answered.
- **Escalate when:** `--explain` says a file is "not on the map" (AT-1): the file needs a kind first. "no mapped files under this folder" is not a gap in the map: the folder is empty or outside every repo root, so check the path first.

### NAV-Q2 — Is it a project mission?
- **Criteria:** A feature, a fix or a change of behaviour in a project repo that has, or should have, `.specify/` and `docs/architecture.md`.
- **Branches:**
  - YES → hand it to the `orchestrator`, which runs P0 intake
  - NO → NAV-Q3
- **Default:** NO.
- **Escalate when:** it touches more than one service; the Company KB system catalog decides the scope first.

### NAV-Q3 — Does it change a tool?
- **Criteria:** A validator, installer, hook or script, in agent-config or a reference repo.
- **Branches:**
  - YES → a spec under `specs/`, its scenarios changed first; characterize first if the tool has no tests (TST-13, TST-14) → NAV-Q5
  - NO → NAV-Q4
- **Default:** YES when the request mentions a check, a rule code or a script.
- **Escalate when:** the tool lives in a repo the user did not name.

### NAV-Q4 — Is it a document, rule or pattern?
- **Criteria:** Knowledge, a framework rule, a procedure, a pattern, a company KB doc, a wrapper or a skill.
- **Branches:**
  - YES → the atlas area and kind; follow the kind's schema and index → NAV-Q5
  - NO → escalate
- **Default:** YES.
- **Escalate when:** no area fits: the map is missing a branch.

### NAV-Q5 — Which checks and which role own it?
- **Criteria:** The kind's `checked-by` and `tests` in the atlas, and the role whose rubric or trees cover that kind.
- **Branches:**
  - one role → name it, with the checks that will run
  - several roles → name the one whose tree decides the change, and the others as reviewers
- **Default:** the role that owns the area's framework.
- **Tie-breaker:** the role whose rule a check would print.
- **Escalate when:** no role owns the kind.

## Trade-off tables
| Option | Strengths | Costs | Choose when |
|---|---|---|---|
| Answer from the atlas | Paths, checks and owner come from one registry | Only as good as the registry | Always first |
| Search the repo | Finds what the atlas misses | No owner, no checks, slow | The atlas has no kind for it; then fix the atlas |

## Recording
The coordinator records nothing for a question. A new area, kind or chain is a change to `atlas.yaml`, checked by `atlas.mjs`.

## References
- `{{AGENT_HOME}}/atlas/schemas/atlas.schema.md` — the registry this tree reads.
- `foundations/delivery/testing-strategy.md` — TST-13, TST-14 (NAV-Q3).
- `specs/012-coordinator-review-fixes/` in agent-config — why NAV-Q1 is a lookup test and not a path test.

## Related
- `agents/coordinator.md` — the role that owns this tree.
- `agents/orchestrator.md` — where project missions go (NAV-Q2).
