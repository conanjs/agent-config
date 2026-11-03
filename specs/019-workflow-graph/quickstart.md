# Quickstart: prove each capability end to end

For after the build. Commands and expected results only: shapes are in [data-model.md](data-model.md), arguments in [contracts/cli.md](contracts/cli.md), hook payloads in [contracts/hooks.md](contracts/hooks.md).

## Prerequisites

- Node.js 24, `pnpm install` in agent-config (for `--write` and the tests).
- The installers re-run, so the hook files are linked (`installers/install.sh`).
- Codex: trust the two new hooks once in `/hooks`.

## 1. The graph is valid and is the source of the tables

```bash
node copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts --check-graph
```
Expected: `PASS (0 warning(s))`. Change one budget in the YAML without `--write`, run again: `WG-<n> … workflow.graph.json is out of date; run --write`, exit 1.

## 2. A run that breaks the graph is caught

```bash
node copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts --check-run tests/workflow-graph/fixtures/runs/skipped-gate.jsonl
```
Expected: a finding naming G2 and the line where P4 started, exit 1. The fixture set also covers an edited line, an attempt over budget, a missing approval quote, and P7 before every task is done.

## 3. Claude Code refuses a launch past an open gate

In a test project with a ledger whose last line is `P3 done` (G2 open), ask the session to launch `sdlc-architecture` with a launch prompt for `phase: P4`, `run: R-001`.
Expected: the launch is refused with "G2 not approved in run R-001". Type `approve G2 R-001`, ask again: the launch goes through, and the ledger has a `human` line with your words.

## 4. The same in the Copilot CLI and in Codex

Same steps with `copilot` and Codex. Copilot shows "Denied by preToolUse hook: …". Do the Copilot check in a folder outside your trusted folders too: the user-level guard must still refuse.

## 5. Resume after closing the session

You never read the ledger or a checkpoint yourself. What you do and what you see:

```text
You:    continue R-007
Agent:  (runs `status R-007` at P0)
        Run R-007, feature 023-cart. Finished: P5 tasks (G4 approved by you on 3 Nov).
        In progress: P6, task T004, attempt 2 of 3 failed its checks.
        Next allowed: re-execute T004 (1 attempt left), then review.
        Open gates: none.
You:    go on
```

At a gate the agent stops and shows the exact reply, for example `approve G5 R-007`. Typing it (plus any comment) is the approval: the prompt-submit hook records your words, and the next launch is allowed.

The command behind it, for checking by hand:

Close the session in the middle of P6, open a new one, run:
```bash
node ~/.copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts --status R-001
```
Expected: the last node, the next allowed nodes and the attempts left per task (SC-004).

## 6. The agent cannot approve its own gate

Ask the session to run `--record R-001 --node G3 --result approved`. Expected: refused ("gate results are recorded only from your own message"), nothing appended. Hand-edit a line in the ledger: `--check-run` reports the broken chain at that line.

## 7. Phase 2 feasibility (already shown by the spike; repeated in the phase 2 spec)

The runner stops at a gate, exits, and a second process resumes it from the SQLite checkpoint (`research.md` §Capability spikes).
