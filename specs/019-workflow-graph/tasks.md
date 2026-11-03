# Tasks: The agentic-sdlc workflow as an enforced graph (phase 1)

**Input**: `spec.md`, `plan.md`, `research.md` (D1–D19), `data-model.md`, `contracts/` (cli, hooks, coding-agent), `quickstart.md`
**Tests**: required. Constitution principle IV: every WG rule has a Cucumber scenario written **before** its code; the class-modeled overlay adds vitest unit tests with fakes (TD-Q2, risk tier HIGH).

`TOOL` = `copilot/frameworks/agentic-sdlc/tools/workflow-graph`. `WF` = `TOOL/src/modules/workflow`. `CA` = `TOOL/src/modules/coding-agents`.

## Earlier (design)

- [x] T001 Research, decisions D1–D19, P4 tree records, capability spikes in `specs/019-workflow-graph/research.md`
- [x] T002 Plan, data model, contracts, quickstart in `specs/019-workflow-graph/`; V approved building in agent-config (2026-11-03: "ok start building")

## Phase 1: Setup

- [x] T003 Create `TOOL/package.json` (private, `"type": "module"`, devDependencies `typescript` 7.0.2, `eslint` 10.14.0, `typescript-eslint` 8.72.1, `eslint-plugin-import-x` 4.17.1, `vitest` 5.1.0, `prettier` 3.9.10, `yaml` 2.9.1; scripts `typecheck`, `lint`, `test`, `format:check`), `TOOL/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `module: nodenext`), `TOOL/vitest.config.ts` (include `src/**/*.test.ts`) and add `TOOL` to a root `pnpm-workspace.yaml`
- [x] T004 [P] Create `TOOL/eslint.config.mjs` with the class-modeled overlay selectors (R1, R3, R4, R7, R9), Tier B allow-list `src/main.ts` and `src/CompositionRoot.ts`, and `import-x/no-restricted-paths` zones (domain imports no other layer; `workflow` never imports `coding-agents/infrastructure`)
- [x] T005 [P] Create the schema `copilot/frameworks/agentic-sdlc/schemas/workflow-graph.schema.md` (`workflow-graph/v1`): WG rules for the graph file, the ledger line, the run, the hooks and the task dependencies, one row per rule (`| WG-n | rule | holds when | enforced by |`)

## Phase 2: Foundational (blocks every story)

- [x] T006 [P] `Result` type in `TOOL/src/modules/shared/domain/Result.ts`
- [x] T007 [P] Value objects `RunId`, `NodeId` with `static parse(): Result` in `WF/domain/graph/` and `WF/domain/run/`
- [x] T008 Register the tool for scenarios in `tests/workflow-graph/tool.mjs` (runs `node TOOL/src/main.ts`; `codes` read from the WG rows of the schema; pinned clock `WORKFLOW_GRAPH_NOW=2026-11-03T09:00:00.000Z`) and fixture root `tests/workflow-graph/fixtures/base/`
- [x] T009 Thin entry `TOOL/src/main.ts` and `TOOL/src/CompositionRoot.ts` (Tier B, one-line why-comments) with command dispatch to handlers; unknown command prints usage and exits 2

## Phase 3: User Story 1 — the workflow is one machine-readable graph file (P1) 🎯

**Goal**: `workflow.graph.yaml` holds the workflow; `check-graph` rejects a broken graph; `compile-graph` writes the JSON and the `conventions.md` tables.
**Independent test**: `node TOOL/src/main.ts check-graph` passes on the real graph and fails with WG codes on each broken fixture graph.

- [x] T010 [P] [US1] Scenarios first in `tests/workflow-graph/workflow-graph.feature` (graph section): unknown edge endpoint; unreachable node; node with no path to an end; loop without budget; gate without exactly one `approved` edge; conditional node without `otherwise`; owner not a role in `conventions.md` §1; node id equal to a reserved runner state key; budget name not in `budgets`; JSON out of date; conventions tables out of date; the real graph passes. Fixtures in `tests/workflow-graph/fixtures/base/graphs/`. Run them and see them fail
- [x] T011 [P] [US1] Unit tests first in `WF/domain/graph/WorkflowGraph.test.ts` (load, `allows`, `nextAfter`, `budgetOf`, each invariant through `load`)
- [x] T012 [US1] `WF/domain/graph/WorkflowGraph.ts` aggregate: `static load(json): Result<WorkflowGraph, GraphInvalid[]>`, `allows(from, result, to)`, `nextAfter(position)`, `budgetOf(edge)`; state in `readonly #` fields
- [x] T013 [US1] Ports `GraphSource`, `ConventionsTables` in `WF/domain/ports/`; adapters `JsonGraphSource.ts`, `YamlGraphCompiler.ts` (the only file importing `yaml`), `MarkdownConventionsTables.ts` in `WF/infrastructure/`
- [x] T014 [US1] Use cases `WF/application/check-graph/CheckGraph.ts`, `WF/application/compile-graph/CompileGraph.ts`; CLI handler `WF/interface/cli/WorkflowCliHandler.ts` for `check-graph` and `compile-graph` (output `WG-n  <file>: <message>` per finding, then `PASS (<w> warning(s))` / `FAIL (<n>)`)
- [x] T015 [US1] Write `copilot/frameworks/agentic-sdlc/workflow.graph.yaml` from `conventions.md` §5, §8, §9 (`version: 2.0.0`); add `<!-- workflow-graph:begin … end -->` markers around the §5 and §9 tables; run `compile-graph`; confirm the regenerated tables say what they said before (SC-002; list any wording change in `research.md`)

## Phase 4: User Story 2 — every run leaves a ledger (P1)

**Goal**: `record`, `check-run`, `status` over `.specify/runs/<run>.jsonl`; hash chain; resume by `status`.
**Independent test**: fixture ledgers for a clean run, an edited line, a skipped gate, an attempt over budget, a missing approval quote, and P7 before all tasks are done each give the expected result.

- [x] T016 [P] [US2] Scenarios first (ledger section of the feature): `record` appends an allowed move; refuses an illegal move, an attempt over budget, a gate result and `--actor human` (nothing written); `check-run` catches a broken chain (names the line), a skipped gate, a budget overrun, a missing quote, P7 before every task is `done`; `status` prints last step, next allowed steps, attempts left, open gates; `status` with no run id lists open runs. Ledger fixtures in `tests/workflow-graph/fixtures/base/project/.specify/runs/`
- [x] T017 [P] [US2] Unit tests first: `LedgerEntry.test.ts` (hash = SHA-256 of previous hash + content; `verifiesAfter`), `Run.test.ts` (invalid sequences: skip a gate, exceed a budget, approve twice, append after `done`)
- [x] T018 [US2] `WF/domain/run/LedgerEntry.ts` value object (fields per `data-model.md` §2: `seq`, `prev`, `hash`, `at`, `run`, `node`, `result`, `task`, `attempt`, `actor` ∈ orchestrator · script · human · runner, `evidence` "paths only", `gen_ai.*`, `usage` optional)
- [x] T019 [US2] `WF/domain/run/Approval.ts`, `WF/domain/run/Run.ts` aggregate: `static replay(entries, graph)`, `recordStep`, `approveGate`, `permitLaunch`, `status`; every run invariant lives here (PDM-class-modeled-R2)
- [x] T020 [US2] Ports `RunRepository`, `Clock` in `WF/domain/ports/`; adapters `WF/infrastructure/JsonlRunRepository.ts` (append-only; lists open runs) and `WF/infrastructure/SystemClock.ts` (honours `WORKFLOW_GRAPH_NOW`)
- [x] T021 [US2] Use cases `RecordStep`, `CheckRun`, `ReportRunStatus` in `WF/application/<use-case>/`; CLI commands `record`, `check-run`, `status` in `WorkflowCliHandler.ts`

## Phase 5: User Story 3 — a skipped gate is blocked, not only reported (P1)

**Goal**: guard and approval hooks for Claude Code, Copilot CLI and Codex through one port and three adapters.
**Independent test**: recorded real payloads (2026-11-03 spikes) piped into `hook guard --agent <id>` give each agent's exact deny JSON; a typed approval appends a `human` line.

- [x] T022 [P] [US3] Fixtures: recorded Claude Code and Copilot payloads (launch, other tool, ledger edit, prompt submit) in `tests/workflow-graph/fixtures/base/payloads/<agent>/`; Codex payloads from its docs, marked unverified
- [x] T023 [P] [US3] Scenarios first (hook section): deny past an open gate (each agent's output byte for byte); allow after approval; deny over budget; no `run:` → no decision; unreadable input → deny (fail closed); ledger edit → deny; approval prompt → `human` line with the quote; non-approval prompt → nothing; `AGENTIC_SDLC_GUARD=off` → allow and a `guard-off` line
- [x] T024 [P] [US3] Shared adapter contract suite first in `CA/infrastructure/HookDialect.contract.test.ts` (the cases in `contracts/coding-agent.md`), run against every registered dialect
- [x] T025 [US3] `CA/domain/AgentId.ts`, `CA/domain/AgentCapabilities.ts` (values from the capability table; unverified = `unknown`), ports `HookDialect`, `SessionLog` in `CA/domain/ports/`
- [x] T026 [P] [US3] `CA/infrastructure/claude-code/ClaudeCodeHookDialect.ts`, `ClaudeCodeSessionLog.ts`
- [x] T027 [P] [US3] `CA/infrastructure/copilot-cli/CopilotCliHookDialect.ts`, `CopilotCliSessionLog.ts`
- [x] T028 [P] [US3] `CA/infrastructure/codex/CodexHookDialect.ts`, `CodexSessionLog.ts`
- [x] T029 [US3] `CA/application/CodingAgentRegistry.ts`; registry entries built only in `CompositionRoot.ts`
- [x] T030 [US3] `WF/domain/launch/LaunchRequest.ts` (parses the launch prompt's YAML head: `run`, `phase`, `role`, `mode`, `task`, `context.attempt`); use cases `WF/application/guard-role-launch/GuardRoleLaunch.ts`, `WF/application/record-approval/RecordApproval.ts`; handler `CA/interface/hooks/HookHandler.ts` (stdin → dialect → use case → stdout; unexpected error → deny)
- [x] T031 [US3] `launch-prompt/v1` gains `run:` in `copilot/frameworks/agentic-sdlc/schemas/launch-prompt.schema.md` (required for P0–P7, additive)
- [x] T032 [US3] Hook wiring: `copilot/hooks/workflow-graph.json` (user level: `preToolUse`, `userPromptSubmitted`), the `claude/settings.json` seed (`PreToolUse` matcher `Agent|Edit|Write`, `UserPromptSubmit`), `codex/hooks.json` (`PreToolUse`, `UserPromptSubmit`); each runs `node …/src/main.ts hook guard|approve --agent <id>`

## Phase 6: User Story 4 — tasks say what they need first (P2)

**Goal**: `requires:` on task lines, checked by the project validator.
**Independent test**: `validate-project.mjs` fails each bad `tasks.md` fixture with its code and passes the good one.

- [x] T033 [P] [US4] Scenarios first in `tests/validate-project/validate-project.feature`: unknown `requires:` id; dependency cycle; two `[P]` tasks writing the same path; a `[P]` task requiring another task of its batch; good file passes
- [x] T034 [US4] `requires:` in `copilot/frameworks/agentic-sdlc/schemas/task-line.schema.md` (optional, additive) and the checks in `copilot/frameworks/agentic-sdlc/tools/validate-project.mjs` (its existing style; this tool is legacy under PDM-Q1)
- [x] T035 [US4] `check-run` join rule uses `tasks.md`: P7 only after every task has `done`

## Phase 7: Polish & cross-cutting

- [x] T036 `scripts/check-docs.sh` runs `check-graph`, `pnpm -C TOOL typecheck`, `lint`, `test`; CI installs the workspace
- [x] T037 [P] `copilot/frameworks/agentic-sdlc/agents/orchestrator.md`: ORC-R3 and ORC-R5 point at the graph and ledger and become `script`; P0 runs `status` when a run is open (spec US2.5–2.6); `conventions.md` §5 gate format names the approval reply `approve G<n> <run>`
- [x] T038 [P] Atlas area and kinds for the tool, schema and graph (`copilot/atlas/atlas.yaml`, `atlas.mjs --write`); framework index decision D13 (`copilot/frameworks/agentic-sdlc/index.md`); README and SETUP rows; `.gitignore` keeps `tests/*/fixtures/**/.specify/runs/*.jsonl`
- [x] T039 Sabotage: break each WG rule in the code and see a scenario fail; record the count in this file — **37 of 37 caught** (WG-1 … WG-30, WG-7, WG-10 and WG-17 twice, the four `requires:` checks)
- [x] T040 Live checks per `quickstart.md` §3–§6 in Claude Code and the Copilot CLI (SC-003, SC-004), 2026-11-03: in each, a P4 launch at an unapproved G2 was refused with the reason, the typed `approve G2 …` was recorded through the prompt hook (also in `-p` mode), and the same launch then ran; `status` reported the run from a new process
- [x] T042 Claude Code: hooks merged into `~/.claude/settings.json` on V's word (backup in `~/.agent-config-backups/`). Codex (V trusted the hooks), live 2026-11-03: the ledger-edit guard and approval recording work and `verify-approvals` confirms a Codex approval (the rollout reader was fixed to the real line shape, with a test); **the launch guard does not work in Codex 0.164.0-alpha**: `PreToolUse` never ran for `spawn_agent`
- [x] T043 Codex launch guard: cause found in Codex's source (D20); `codex/hooks.json` matcher `*`; the Codex adapter reads `collaborationspawn_agent` and the `task_name` convention (3 scenarios, 4 unit tests, 2 of 2 sabotage runs caught)
- [x] T044 V re-trusted the Codex hooks; live check 2026-11-03 (codex-cli 0.164.0-alpha.11.1): a spawn with `task_name: r004_p4_architecture` at an unapproved G2 was refused (the hook saw `collaborationspawn_agent` and an encrypted message), the typed `approve G2 R-004` was recorded, the same spawn was then allowed, and `verify-approvals` confirmed the Codex approval. The rule is unchanged in Codex 0.166.0, so updating Codex does not change this
- [x] T041 Record tested behaviour in `copilot/knowledge/ai-agents/` (usage references) in the same change; specs index row; tracker

## Dependencies

- Setup (T003–T005) → Foundational (T006–T009) → US1 → US2 → US3. US3 needs the `Run` aggregate from US2; US2 needs the graph from US1.
- US4 needs only Setup; it can run beside US1–US3 (different files: `validate-project.mjs`, its feature).
- Polish after US3.

## Parallel examples

- US1: T010 (scenarios) ∥ T011 (unit tests), then T012.
- US3: T026 ∥ T027 ∥ T028 (three adapter folders), after T025.

## Implementation strategy

MVP = US1 + US2 + US3: the graph, the ledger and the guard. That is the first point where a skipped gate is actually blocked. US4 follows in the same PR if it stays small, otherwise its own.
