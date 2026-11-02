# Feature Specification: The turn token report for GitHub Copilot

**Feature Branch**: `feat/turn-tokens-copilot`

**Created**: 2026-11-02

**Status**: Implemented 2026-11-02

**Input**: V: "As I noticed, Github Copilot doesn't have this feature (report credit) yet, check, verify and implement if not yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - After every Copilot turn, see what it cost and the running total (Priority: P1)

The turn token report (specs/017) covers Claude Code and Codex. GitHub Copilot (the CLI, and the Copilot agent in VS Code, which share one agent runtime and one hook format) has neither the report nor its history.

**Acceptance Scenarios**:

1. **Given** a Copilot session, **When** a turn ends, **Then** the `agentStop` hook reports the turn's model calls, largest request (with the model's prompt limit), new input, cache writes and reads, output and AI credits with their dollar value, the turn's tool names, the session total, and the monthly allowance.
2. **Given** Copilot's own per-call cost (`copilotUsage.totalNanoAiu`), **Then** the report uses it, so no price table is needed and the credits match Copilot's own session total.
3. **Given** the report, **Then** it is appended to `turn-tokens/<session id>.jsonl` in Copilot's own folder (`~/.copilot`, or `COPILOT_HOME`).

### User Story 2 - The report is right when the log is still being written (Priority: P2)

1. **Given** the turn's last assistant message still asks for tools, or none is written yet, **When** the hook reads the log, **Then** it reads again every 250 ms for up to 3 s, then notes the gap.

## Requirements *(mandatory)*

- **FR-001**: `turn-tokens/v1` gains rules TT-13 … TT-16 for Copilot (`copilot/hooks/turn-tokens/turn-tokens.schema.md`); TT-1, TT-4 and TT-11 name Copilot too.
- **FR-002**: `turn-tokens.mjs --hook copilot` reads the hook input in either payload format (`sessionId`/`transcriptPath` or `session_id`/`transcript_path`).
- **FR-003**: Wired as an `agentStop` hook in `copilot/hooks/turn-tokens.json` (installed through the existing `~/.copilot/hooks` link).
- **FR-004**: Scenarios first; every new rule named by a scenario and caught when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/turn-tokens` scenarios all pass; the whole suite passes.
- **SC-002**: On a real Copilot log, the session's credits equal Copilot's own `session.usage_checkpoint` total.
- **SC-003**: A live Copilot CLI turn writes a report to `~/.copilot/turn-tokens/`.

## Out of scope

- Splitting Copilot subagent calls from the main agent: the usage records carry no agent field that was confirmed to separate them.
- Copilot code review and cloud agent jobs: they run in GitHub's sandbox, whose files are discarded.
