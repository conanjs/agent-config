# Feature Specification: The turn token report — what each turn cost, and the running total

**Feature Branch**: `docs/agent-token-accounting`

**Created**: 2026-10-31

**Status**: Implemented 2026-10-31 (the live hook on this machine waits on V: T-8)

**Input**: V: "if I ask to build a tool to measure and output the measurements and the accumulated total at the end of each turn. Can you do it?" Then: "can we also add to show one more thing, the distinct names of every tool call. And also the 5-hour limit % used, and week-limit % used? … about the dollar figures, if possible, show them too … Report every turn now. Build the per-turn token tool now." Waiting for a late log line: "waiting for 3 seconds is ok".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - After every turn, see what it cost and the running total (Priority: P1)

A long session uses up a plan's limits faster than its visible activity suggests, because every model call re-sends the whole conversation (`copilot/knowledge/ai-agents/agent-token-accounting.md`). Today the numbers are only in log files that need a script and the right counting rules.

**Acceptance Scenarios**:

1. **Given** a Claude Code session, **When** a turn ends, **Then** the `Stop` hook shows one report: this turn (model calls, peak context, new input, cache writes, cache reads, output, cost), its tool names, its subagents, the session total, and the 5-hour and weekly limits.
2. **Given** a Codex thread, **When** a turn ends, **Then** its `Stop` hook shows the same report, with credits instead of dollars and no cache-write column (Codex has none).
3. **Given** the counting traps found on 2026-10-30, **Then** the report never counts a split reply twice, never adds Codex's cached tokens on top of its input, and never shows a placeholder output as a real count.

### User Story 2 - The report is right even when the log is still being written (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the turn's final reply is not yet in the log when the hook starts, **When** the hook reads it, **Then** it reads again every 250 ms for up to 3 seconds.
2. **Given** the reply is still missing after 3 seconds, **Then** the report says so; the session total picks the call up at the next turn.

### User Story 3 - The history stays on this machine (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a report, **Then** it is also appended as one JSON line to `turn-tokens/<session id>.jsonl` inside the tool's own folder (`~/.claude` or `~/.codex`, or `CLAUDE_CONFIG_DIR` / `CODEX_HOME`).
2. **Given** Claude Code shares its plan limits only with a status line, **When** the `--statusline` mode runs as Claude Code's status line, **Then** it saves the latest limits and context window size for the hook, and prints a one-line status.

## Requirements *(mandatory)*

- **FR-001**: The report and its history record are defined in `copilot/hooks/turn-tokens/turn-tokens.schema.md` (`turn-tokens/v1`), rules TT-1 … TT-12.
- **FR-002**: One tool, `copilot/hooks/turn-tokens/turn-tokens.mjs`, with no dependencies; a price table, `prices.mjs`; a launcher, `turn-tokens-hook.sh`, that finds Node for the hooks (as the tracker's does).
- **FR-003**: Wired as a `Stop` hook in `codex/hooks.json` and in the seed `claude/settings.json`, plus Claude Code's `statusLine`.
- **FR-004**: Scenarios first; every TT rule is named by a scenario; every rule is caught when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/turn-tokens` scenarios all pass; the whole suite passes.
- **SC-002**: Breaking each TT rule in the code makes at least one scenario fail.
- **SC-003**: Run on real logs of this machine, the per-turn sums agree with each tool's own counter (Codex thread total; Claude Code `cost-state` for input and cache).

## Out of scope

- Dollars for Codex: credits have no fixed dollar price ("depend on your plan or agreement"), so the report shows credits.
- Calls that never reach a log (Claude Code's compaction summaries, session titles, prompt suggestions): the report is a lower bound for them, and says so in the schema.
- A team dashboard: that is OpenTelemetry's job (`claude-code-usage-reference.md`, `codex-usage-reference.md`).
- GitHub Copilot CLI: its usage lives in a different store (`copilot/knowledge/github-copilot/copilot-cli-internals.md`).
