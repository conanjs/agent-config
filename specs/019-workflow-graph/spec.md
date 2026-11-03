# Feature Specification: The agentic-sdlc workflow as an enforced graph (phase 1)

**Feature Branch**: `feat/workflow-graph`

**Created**: 2026-11-02

**Status**: Implemented 2026-11-03 (phase 1); Codex live check and the Claude Code settings merge wait on V (tasks T042)

**Input**: V: "I want to build that properly according to the standard, best practices, definitions, can use many other external tools if necessary according to the definition." V chose "Both, in phases": phase 1 (this spec) makes chat-driven runs follow an explicit graph; phase 2 (a later spec, outlined in `research.md` §Phase 2) runs the same graph with a LangGraph.js runtime.

## Why

The agentic-sdlc framework is already shaped like a graph (roles as nodes, phases P0–P7, gates G0–G5, retry budgets), but the graph exists only as prose tables in `conventions.md` §5 and §9. The Orchestrator, an AI agent, reads them and is trusted to follow them. Phase order (ORC-R3) and budgets (ORC-R5) are checked by an AI reviewer, not by a script. Nothing records where a run stands, so a compaction or a new session loses the attempt count. Task lines can say a task may run in parallel (`[P]`) but cannot say what it needs first.

Graph Engineering, as defined in `copilot/knowledge/ai-agents/graph-engineering-study-guide.md`, needs five things written down and enforced: nodes, edges with conditions, state, failure handling, and tracing. This spec adds them without a new runtime.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The workflow is one machine-readable graph file (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `copilot/frameworks/agentic-sdlc/workflow.graph.yaml`, **Then** it lists every node (phases P0–P7, gates G0–G5, and the P6 per-task steps: execute, checks, review), every edge with its condition, the P0 paths (which phases each mission type runs), and the loop budgets.
2. **Given** the graph file, **When** `workflow-graph --check-graph` runs, **Then** it fails on: an edge to an unknown node; a node that P0 cannot reach; a node with no way to an end node; an edge back to an earlier node (a cycle) without a budget; a gate with no approval edge; a node whose outgoing conditions have no "otherwise" (unknown result) edge.
3. **Given** the graph file, **When** `workflow-graph --write` runs, **Then** the phase table (§5) and the budget table (§9) in `conventions.md` are regenerated between marker comments, and `--check-graph` fails when they differ from the file (one source of truth, constitution principle I).

### User Story 2 - Every run leaves a ledger (Priority: P1)

A ledger is an append-only file, one JSON line per step of one run. Lines are added, never edited.

1. **Given** a project using agentic-sdlc, **When** the Orchestrator finishes a step, **Then** it runs `workflow-graph --record <run> --node <id> --result <value> [--attempt n] [--evidence <paths>]` and a line is appended to `.specify/runs/<run>.jsonl`. The Orchestrator never writes the file itself.
1a. **Given** an open gate, **When** V types the gate's approval reply (for example `approve G2 R-007`), **Then** a prompt-submit hook appends the approval with V's exact words and the session id. `--record` refuses gate results, so the agent cannot approve its own gate (plan D10).
2. **Given** a ledger, **When** `workflow-graph --check-run <file>` runs, **Then** it fails on: a step reached by no edge from the step before; a phase after a gate that has no `approved` line; an attempt above the loop's budget; a gate approval without the person's quoted words; lines out of order or edited (each line carries the hash of the line before it).
3. **Given** a ledger line, **Then** its field names follow the OpenTelemetry GenAI conventions where one exists (`gen_ai.workflow.name`, `gen_ai.agent.name`, `gen_ai.operation.name`), so phase 2 can export the same records as traces.
4. **Given** a turn token report for the session (specs 017/018), **Then** `--record` may add the turn's tokens and cost to the line; without one, the field is left out.
5. **Given** a run left open in an earlier session, **When** V opens a new session and says "continue R-007" (or just "continue"), **Then** the Orchestrator's P0 runs `status` itself and reports, in plain words, the last finished step, the open gate with its exact approval reply, the next allowed steps and the attempts left. V never reads the ledger or a checkpoint file.
6. **Given** more than one open run in the project, **When** `status` runs without a run id, **Then** it lists each open run with its feature and where it stands, and the Orchestrator asks V which one to continue.

### User Story 3 - A skipped gate is blocked, not only reported (Priority: P1)

1. **Given** a run whose ledger has no `approved` line for gate G2, **When** the Orchestrator tries to launch a role for P4 (Claude Code tool `Agent`, Copilot tool `task`, Codex tool `spawn_agent`), **Then** a pre-tool-use hook denies the launch and gives the reason ("G2 not approved in run R-007").
2. **Given** a launch whose attempt is above the budget, **Then** the hook denies it and names the escalation the graph prescribes.
3. **Given** a launch prompt without `run:` or for a role outside agentic-sdlc, **Then** the hook allows it unchanged (it only guards agentic-sdlc runs).
4. **Given** a hook error (unreadable ledger, bad YAML), **Then** the hook denies the launch and says why (fail closed), because a silent allow would defeat the check.

### User Story 4 - Tasks say what they need first (Priority: P2)

1. **Given** a task line, **Then** its continuation line may carry `requires: <Tnnn>[, <Tnnn>…] | none`.
2. **When** `validate-project.mjs` checks `tasks.md`, **Then** it fails on: a `requires:` id that does not exist; a dependency cycle; two `[P]` tasks that write the same path; a `[P]` task that requires another task in the same parallel batch.
3. **Given** a feature's tasks, **When** the run reaches P7, **Then** `--check-run` fails unless every task has a `done` line in the ledger (the join: all required results, not just the last one).

## Requirements *(mandatory)*

- **FR-001**: New schema `workflow-graph/v1` (`copilot/frameworks/agentic-sdlc/schemas/workflow-graph.schema.md`) with rule ids WG-n for the graph file, the ledger line and the hook; each rule has at least one scenario (constitution principle IV).
- **FR-002**: `copilot/frameworks/agentic-sdlc/tools/workflow-graph` with `--check-graph`, `--write`, `--record`, `--check-run`, `--hook claude|copilot|codex`. Node.js ≥ 18, no runtime dependencies beyond what the framework tools already use.
- **FR-003**: `launch-prompt/v1` gains `run: <id>` (required when `phase` is P0–P7); `task-line` gains `requires:`. Both changes are additive: older prompts and task lines still parse, with a warning.
- **FR-004**: The Orchestrator's runbook (`agents/orchestrator.md`, ORC-R3 and ORC-R5) points at the graph file and the ledger; ORC-R3 and ORC-R5 become `script` checks.
- **FR-005**: Hook wiring for all three tools, installed by the existing installers: Claude Code `PreToolUse` with matcher `Agent`; Copilot `preToolUse` (tool `task`) at user level, because Copilot loads repository hooks only in trusted folders; Codex `PreToolUse` (tool `spawn_agent`, matched as `Agent`). Each tool also gets the prompt-submit approval hook (`UserPromptSubmit` / `userPromptSubmitted`).
- **FR-006**: `scripts/check-docs.sh` runs `--check-graph`; the tests run in `tests/workflow-graph/`.
- **FR-007**: Scenarios are written first and fail before the code exists; sabotage of each WG rule makes a scenario fail.

## Success Criteria *(mandatory)*

- **SC-001**: All `tests/workflow-graph` scenarios pass; the whole suite passes.
- **SC-002**: The regenerated §5 and §9 tables in `conventions.md` say the same as today (the move changes form, not behaviour); any wording difference is listed in `research.md`.
- **SC-003**: In a live Claude Code session and a live Copilot CLI session, launching a P4 role with G2 unapproved is denied, and approving G2 lets the next launch through.
- **SC-004**: A run interrupted mid-P6 (session closed) resumes from the ledger: a new session reads `--status <run>` and gets the next allowed nodes and the attempts left.

## Out of scope (phase 2, its own spec)

- The LangGraph.js runner that executes `workflow.graph.yaml` headless, with SQLite checkpoints, `interrupt()` gates and nodes that call `claude -p`, `copilot -p` and `codex exec` (`research.md` §Phase 2).
- Exporting the ledger as OpenTelemetry spans to a collector.
- Changing the workflow itself: phases, gates and budgets stay as they are; this spec only moves them into data and enforces them.
