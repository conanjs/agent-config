# Tasks: A navigation map and coordinator for agent-config

## Phase 1: Registry and tool

- [x] T001 Write `copilot/atlas/schemas/atlas.schema.md` (atlas/v1, rules AT-1 … AT-7)
- [x] T002 Write `copilot/atlas/tools/atlas.mjs`: validate, `--write`, `--explain`, `--repo`
- [x] T003 [P] Cucumber scenarios in `tests/atlas/` for every AT rule, `--write` and `--explain`

## Phase 2: The map of agent-config and the reference repo

- [x] T004 Fill `copilot/atlas/atlas.yaml`: areas and kinds for all 557 agent-config files; the typescript-node reference repo's areas and kinds
- [x] T005 Generate `copilot/atlas/index.md` and `copilot/atlas/map/**`; run against the reference clone (agent-config, feature-first v4.2.0, layer-first v1.5.1: 783 files)

## Phase 3: The coordinator role

- [x] T006 `agents/coordinator.md`, `conventions.md` roles row, `trees/navigation.tree.md` (NAV)
- [x] T007 Wrappers (Copilot, Claude, Codex) and `skills/sdlc-coordinator-preset/`
- [x] T008 Point the Orchestrator's intake and the README's "Where to go" at the coordinator

## Phase 4: Wiring

- [x] T009 Run the atlas check in `scripts/check-docs.sh` and CI; deploy `copilot/atlas` in `mapping.yaml`
