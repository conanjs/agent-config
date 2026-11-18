---
schema: resolver/v1
last-updated: 2026-10-24
---

# Resolver

The Resolver decides **what the agent knows for this task** and **what wins when two sources disagree**. It outputs one Context Pack (`schemas/context-pack.schema.md`).

## 1. Sources, strongest first

| # | Source | Holds | Where |
|---|---|---|---|
| 1 | **Rules** (floors are rules tagged in `floors.md`) | Best practice as numbered rules | `agentic-sdlc/foundations/`, stack and paradigm profiles |
| 2 | **Facts** | Owners, services, zones, contracts | `companies/<co>/`, repo `docs/`, the zone map |
| 3 | **Lens** | Team lessons and waivers | `lens/` of a team or repo (see `examples/orders-team/`) |
| 4 | **Task state** | The PR, spec, comments already made | The PR |

References (`knowledge/`) are not ordered sources; the Resolver adds them only when a selected rule or finding cites them.

## 2. The four steps

```text
1 SELECT   pick items that apply (by path, topic, scope, Charter bindings)
2 ORDER    strongest source first; narrower scope before wider within a source
3 RESOLVE  apply R1..R7 below where items disagree
4 BOUND    cut to the size budget; never cut a floor
```

## 3. Conflict rules

| Id | Rule | Effect |
|---|---|---|
| R1 | Floors always apply and cannot be overridden | A floor violation stays at the severity the reviewer's rubric gives it |
| R2 | Within a source, narrower scope beats wider scope | A path lesson beats a team lesson |
| R3 | A Lens may lower a rubric severity by one step, add a check, or add a waiver, on a non-floor rule only | `major` becomes `minor`; never `major` to `nit`; never on a floor |
| R4 | Facts beat opinions | A recorded owner or contract overrides a lesson that disagrees |
| R5 | Conflicting lessons of equal scope are `contested` | Neither applies; the agent asks |
| R6 | Lessons past `expires` or waivers past `review-by` are dropped | The original rule applies again |
| R7 | Size budget drops Lens items first, then rule detail, never floors or task state | Keeps context small |

This is the SDLC precedence (State > Paradigm > Stack > Preset on form; Preset wins on intent, `agentic-sdlc/conventions.md` §3) made explicit, with the Lens added. Where the two disagree on a Foundry agent, this file wins.

## 4. Provenance

Every Context Pack item and every finding carries `provenance`: a list of `<source>:<id>` entries. If a finding was softened, the entry that softened it is listed. A finding without provenance is invalid.

## 5. Severity

Severities come from the **Charter's review rubric**, not from the rule tables. Scale: `blocker > major > minor > nit` (`agentic-sdlc/foundations/review/review-rubrics.md`). R3 moves a finding exactly one step toward `nit`.

## Checks

| Check | Tool |
|---|---|
| Every Charter rubric row naming a floor has severity `blocker` | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `proposals/agent-foundry-worked-example.md` §2 and §3: the same rules on a concrete PR.

## Related

- `floors.md`, `principles.md`, `schemas/context-pack.schema.md`.
