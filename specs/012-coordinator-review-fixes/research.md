# Research: Fix the coordinator's three review findings

## Verifying the review, before any change

| Finding | What it claimed | How it was checked | Verdict |
|---|---|---|---|
| P1 | A named path bypasses the workflow classification | Read `trees/navigation.tree.md`: NAV-Q1 YES → NAV-Q5, so NAV-Q2 (mission), NAV-Q3 (tool → spec, scenarios first) and NAV-Q4 were never asked | Correct |
| P2, folders | A folder is reported as missing coverage | `atlas.mjs --explain copilot/frameworks/agentic-sdlc/agents` → "not on the map", exit 1, although every file under it has a kind; NAV-Q1's escalate rule then called it a map gap | Correct |
| P2, chains | Only direct references, no onward chain | `--explain …/foundations/design/module-boundaries.md` listed 6 files; `grep -rl module-boundaries.md` found 19 outside the generated pages. The misses: `foundations/design/…` (relative to the framework root), `../design/…`, `{{AGENT_HOME}}/…`, `~/.copilot/…`. Nothing followed the references onward | Correct, and understated: even the direct list was two-thirds short |

Found while fixing:
- **Missing edges.** The preset skills name the foundations directly, the stack and paradigm skills name their profiles, and stacks and paradigms cite knowledge docs. `atlas.yaml` declared none of these, so their chains could not appear.
- **Depth-first placement.** The first walk put a dependant under whichever path it met first (alphabetically). For `module-boundaries.md`, the architecture preset skill sat under the role, although it names the foundation itself. The walk is now breadth first: each file sits under the nearest file it depends on.

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | How are references found? | (a) a declared link list per file; (b) read path-like tokens from the files' text | (b): the files already name what they depend on, and a second list would drift (principle I). Edges between kinds then decide which references are chains |
| D-2 | How is a token resolved? | Rules in order: relative to the citing file; repo-relative; installed form (`{{AGENT_HOME}}/`, `~/.copilot/`, `%USERPROFILE%/.copilot/` → `copilot/`); then by ending, needing at least one folder, the nearest candidate winning | Matches how the repo writes paths, measured on `module-boundaries.md` (18 of 18) |
| D-3 | How deep is a chain? | Unbounded; 4 levels | 4: rule → role → wrapper or skill is 3 levels, and stops a cycle from printing forever |
| D-4 | What does a folder print? | Every file; the kinds of its files | The kinds, with their area pages: a folder can hold hundreds of files, and the area page already lists them |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | Explain scenarios rewritten to the new output, 8 added; the fixture gained a README and directed edges | Red against the old tool (`references is not defined`, old format), then green |
| Each explain rule is guarded | 11 targeted sabotages: each resolution rule, the generated-page and self exclusions, the edge filter, breadth first, both folder branches | 11 of 11 caught. The first run caught 7: four scenarios were added for the 4 that survived |
| Each check is guarded | Each of the 15 `fail(`/`warn(` calls replaced by a no-op | 15 of 15 caught |
| The real repo | `--explain …/module-boundaries.md` against `grep` | 18 direct, matching `grep`'s 20 hits less the generated page and the file itself; chains reach role → 3 wrappers, the preset skill, 4 stacks → 4 stack skills |
| The whole check | `scripts/check-docs.sh` on Node 24.22.2 | All validators pass; the atlas reports 0 warnings |
