# Feature Specification: The workflow runner (spec 019, phase 2)

**Feature Branch**: `feat/workflow-runner` (stacked on `feat/workflow-graph`, PR conanjs/agent-config#11)

**Created**: 2026-11-03

**Status**: Implemented 2026-11-03 (scripted end-to-end run, scenarios, live check below)

**Input**: V: "continue implementing the next phase" (phase 2 of `specs/019-workflow-graph`). V's choices (2026-11-03): one agent per run with a per-role override; each P6 task in its own git worktree; at a gate the runner stops and V approves later; the full P0–P7 path with tasks one at a time (parallel `[P]` tasks later).

## Why

Phase 1 guards a run that a chat session drives. Phase 2 drives the run itself: a program walks `workflow.graph.json`, starts each role as a headless Claude Code, Copilot CLI or Codex run, stops at every gate, and continues when V approves. The coordinator becomes code (Graph Engineering), while the workers keep their own harness and load the framework's knowledge as in chat.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a run and let it work to the first gate (Priority: P1)

1. **Given** a project and a mission, **When** V runs `workflow-graph run start R-007 --path new-feature --feature specs/023-cart --agent claude-code`, **Then** the runner records P0, creates the run's git worktree (branch `run/R-007`), launches each role of P1 headless with a `launch-prompt/v1` (`run: R-007`), records every step in the run's ledger (`actor: runner`), and stops at G0 with the gate message and the exact approval command.
2. **Given** a role's reply (`message/v2`), **Then** its `type` and `reason` decide the graph result: `artifact`, `decision`, `proposal` → `done`; `review-pass` → `pass`; `review-fail` → `review-fail` or `spec-or-plan-wrong`; `question` or `veto` → the `otherwise` edge (escalate).
3. **Given** `--agent claude-code` and a settings file `.specify/runs/R-007.agents.json` with `{ "qa": "copilot-cli" }`, **Then** qa runs in Copilot CLI and every other role in Claude Code.

### User Story 2 - Approve a gate later and continue (Priority: P1)

1. **Given** a run stopped at G3, **When** V types `workflow-graph run approve R-007 G3 "looks good"` in a terminal, **Then** the approval is recorded (`actor: human`, `source: runner:terminal`) and the runner continues from its checkpoint to the next gate or the end.
2. **Given** the approve command is not run from an interactive terminal (an agent's shell), **Then** it refuses: approvals come from a person.
3. **Given** a crash or a closed terminal mid-phase, **When** V runs `workflow-graph run resume R-007`, **Then** the run continues from the last checkpoint; a launch whose result was never recorded is not repeated blindly: the runner stops and asks (needs-attention).

### User Story 3 - P6 tasks in their own worktrees, one at a time (Priority: P1)

1. **Given** G4 approved, **Then** for each task of `tasks.md` in order (respecting `requires:`), the runner creates a worktree on branch `run/R-007-T001` from `run/R-007` (git cannot hold both `run/R-007` and `run/R-007/T001`), launches the owning role in execute mode there, runs the run's check commands, launches review, and on `pass` merges the task branch into `run/R-007`.
2. **Given** checks or review fail, **Then** the execute step repeats within the graph's budget; on exhaustion the run escalates and stops.
3. **Given** every task passed, **Then** the runner records `P6 done` (the join) and continues to P7.
4. V's own checkout is never written by a worker: P1–P5 and P7 work in the run worktree, P6 in task worktrees.

### User Story 4 - Workers are limited (Priority: P1)

1. **Given** any worker, **Then** it runs without bypass or allow-all permission modes: Claude Code with `--permission-mode acceptEdits` and an allow-list per mode; Copilot CLI with `--allow-tool` per mode; Codex with `--sandbox workspace-write` (read-only for decide/review/propose modes).
2. **Given** a run, **Then** a spend cap per launch (`--max-budget-usd` for Claude Code) and a time limit per launch apply.

## Requirements *(mandatory)*

- **FR-001**: A `runner` module in `tools/workflow-graph` (class-modeled TypeScript): the LangGraph.js `StateGraph` is built from `workflow.graph.json`; checkpoints in `.specify/runs/<run>.checkpoints.db` (git-ignored); `thread_id` = run id. LangGraph loads only for `run` commands (dynamic import), so hooks stay dependency-free.
- **FR-002**: The `HeadlessLauncher` port with one adapter per coding agent, chosen through the existing `CodingAgentRegistry`.
- **FR-003**: Commands `run start | approve | resume | status`; `status` is the phase 1 command.
- **FR-004**: Every runner step goes through the `Run` aggregate (the same rules as phase 1), so a runner run passes `check-run`.
- **FR-005**: Rules WG-31 … WG-37 in `schemas/workflow-graph.schema.md`; scenarios first with fake workers; sabotage; one live run per agent on a tiny fixture project.

## Success Criteria *(mandatory)*

- **SC-001**: Scenarios and unit tests pass; `check-docs.sh` passes.
- **SC-002**: A live run on a fixture project goes P0 → G0 headless in Claude Code, stops, continues after `run approve`, and its ledger passes `check-run`.
- **SC-003**: A live P6 task runs in its own worktree and merges into `run/<run>` after review.

## Out of scope

- Parallel `[P]` tasks (next step).
- OpenTelemetry export.
- Moving the runner to agent-runtime.
