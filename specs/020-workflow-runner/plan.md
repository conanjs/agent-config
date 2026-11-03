# Implementation Plan: The workflow runner

**Branch**: `feat/workflow-runner` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md) | **Builds on**: `specs/019-workflow-graph` (graph, ledger, `Run` aggregate, coding-agent registry)

## Summary

A `runner` module inside `tools/workflow-graph` drives a run headless. LangGraph.js walks the nodes of `workflow.graph.json`. Each phase node launches its roles through a `HeadlessLauncher` adapter of the chosen coding agent, in the run's git worktree. Each gate pauses the run with `interrupt()`; the runner process exits. P6 runs tasks one at a time, each in its own worktree. **The ledger stays the truth**: every step is recorded through the phase 1 `Run` aggregate, routing reads the run's open nodes from it, and the SQLite checkpoint is a resume aid.

## Technical Context

**Language**: TypeScript under Node 24 type stripping, class-modeled, same tool package and lint as phase 1.

**New runtime dependencies** (tool package `dependencies`, imported only with `await import()` by the `run` commands, so hooks still load none): `@langchain/langgraph` 1.6.0, `@langchain/core` 1.3.2, `@langchain/langgraph-checkpoint-sqlite` 1.1.0 (native `better-sqlite3`, prebuilt for macOS arm64 and Linux x64), `zod` 4 (peer). All four were run together in the phase 1 spike (`specs/019-workflow-graph/research.md`).

**Storage** (project main checkout): `.specify/runs/<run>.jsonl` (ledger, unchanged); `<run>.run.json` (the run's settings: agent, per-role overrides, check commands, per-launch spend and time caps); `<run>.launches.jsonl` (launch started/finished, so a crash never repeats a launch blindly); `<run>.checkpoints.db` (LangGraph, git-ignored through a `.specify/runs/.gitignore` the runner writes).

**Worktrees**: run worktree `<repo-parent>/<repo>.runs/<run>` on branch `run/<run>`; task worktrees `<repo>.runs/<run>-<task>` on `run/<run>-<task>`, merged into `run/<run>` with `--no-ff` after review passes, then removed. The worker's changes are committed by the runner (`git add -A; git commit`) after each execute step.

## Constitution Check

| Principle | Answer |
|---|---|
| I. One source of truth | The graph (phases, gates, budgets) and the new per-phase `launches` (role and mode) live in `workflow.graph.yaml`; the runner reads the compiled JSON. No second copy of the workflow |
| II. Typed and validated | New RN rules in `schemas/workflow-graph.schema.md`; `check-graph` checks `launches` (roles exist, modes valid) |
| III. Verified facts | Worker flags verified live 2026-11-03 (spike below); LangGraph behaviour from the phase 1 spike and `langgraph-js-reference.md` |
| IV. Requirements and tests | Scenarios first with a scripted fake launcher; unit tests per class; sabotage |
| V. Options | Rejected options listed in research.md (D21–D26) |
| Risk tier HIGH | Workers edit code unattended: worktrees, no bypass modes, per-mode allow-lists, spend and time caps; approvals only from a person (chat prompt hook, or a terminal command reading `/dev/tty`) |

## Architecture

```text
src/modules/runner/                      (new module; may use workflow and coding-agents application APIs)
  domain/   RoleReply (message/v2 → graph result) · AgentAssignment (default + per-role overrides)
            RunSettings · PhaseLaunch (role, mode) · LaunchPrompt (launch-prompt/v1 text)
            ports/ RunEngine · Worktrees · CheckCommands · LaunchJournal · HumanConsole
  application/ start-run/StartRun · resume-run/ResumeRun · approve-gate/ApproveGate · advance/RunAdvancer
  infrastructure/ LangGraphRunEngine (StateGraph from the graph, SqliteSaver, interrupt at gates)
                  GitWorktrees · ShellCheckCommands · JsonlLaunchJournal · TtyHumanConsole
                  FakeHeadlessLauncher (scripted replies; tests only, wired when WORKFLOW_GRAPH_FAKE_REPLIES is set)
                  (CommandRunner moved to shared/infrastructure: used by coding-agents and runner, MOD-4)
  interface/cli/ RunCliHandler (run start | approve | resume)
src/modules/coding-agents/
  domain/ports/HeadlessLauncher          (new port)
  infrastructure/<agent>/<Agent>HeadlessLauncher (claude -p --agent … · copilot -p --agent … · codex exec)
```

**How one step runs** (the `RunAdvancer`, called by every LangGraph node):
1. Load the run (ledger) through the phase 1 `RunLoader`; the run's open node is where the graph is.
2. Phase node: for each `launches` entry not yet recorded, journal "started", build the launch prompt (`run:`, `phase:`, `role:`, `mode:`, `state:` paths), call the role's agent through its `HeadlessLauncher` in the run worktree, journal "finished", read the reply's `message/v2` `type`/`reason`. All replies `done` → record `<phase> done`; any `question`/`veto` → record `<phase> blocked` (the `otherwise` edge: escalate) and stop with the open questions.
3. Gate node: if the ledger shows it approved or sent back, continue; otherwise `interrupt()` with the gate message: the process prints it and exits.
4. P6: the next task of `tasks.md` (in order, `requires:` satisfied) gets a worktree; execute → commit → `P6.checks` (the run's check commands) → review → merge on `pass`; each recorded as a P6 step line. No task left → `P6 done` (the join).
5. End nodes stop the run (`done`, `escalate`).

**Agents**: `run start --agent claude-code` plus `--role-agent qa=copilot-cli` (stored in `<run>.run.json`); `AgentAssignment.agentFor(role)` picks the adapter through the registry.

**Worker limits (verified live 2026-11-03)**:

| Agent | execute mode | propose / decide / review modes |
|---|---|---|
| Claude Code | `claude -p --agent sdlc-<role> --permission-mode acceptEdits --allowedTools "Read Write Edit Glob Grep Bash" --max-budget-usd <cap> --output-format json` | same without `Write Edit Bash` (`--allowedTools "Read Glob Grep"`) |
| Copilot CLI | `copilot -p … --agent sdlc-<role> --allow-tool=write --allow-tool=shell --no-ask-user --silent` (worktree under a trusted folder) | without `--allow-tool` |
| Codex | `codex exec --json --sandbox workspace-write -C <worktree> -o <reply file>`, prompt names the role file | `--sandbox read-only` |

Spike: in a fresh repo, each agent with only these limits wrote its file in the worktree and not in the main checkout.

## Not now

Parallel `[P]` tasks (LangGraph `Send`, budget 4); OpenTelemetry export; a page for gates.
