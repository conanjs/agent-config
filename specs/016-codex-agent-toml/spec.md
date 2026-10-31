# Feature Specification: Codex agent wrappers that Codex can read

**Feature Branch**: `fix/codex-agent-toml`

**Created**: 2026-10-31

**Status**: Implemented 2026-10-31

**Input**: Found while turning on the tracker hook in Codex (`TRACKER.md` T-6). `codex exec` warned that it ignores every `codex/agents/*.toml` as malformed. V: "finish T-5, T-6 now."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Codex loads every agent role (Priority: P1)

**Cause.** Each wrapper wrote `(on Windows ~/.copilot is %USERPROFILE%\.copilot)` inside a `"""` basic string. There `\.` is a reserved escape, so the TOML is invalid ("missing escaped value"), and Codex skipped all 12 roles (9 sdlc, 3 Foundry) with only a warning.

**Why it was not caught.** The agentic-sdlc validator checked the wrappers' names and text but never whether they parse. No check covered the Foundry wrappers at all.

**Acceptance Scenarios**:

1. **Given** a Codex wrapper with an invalid escape in a basic string, **Then** WRAP fails and names the file, the line and the escape.
2. **Given** any `.toml` in `codex/agents/`, sdlc or not, **Then** it is checked.
3. **Given** a Windows path in a `'''` literal string, and valid escapes in a basic string (`\t`, `\"`, `\\`, `\uXXXX`, `\UXXXXXXXX`, `\xHH`, `\e`, a line-ending backslash), **Then** WRAP passes.

## Requirements *(mandatory)*

- **FR-001**: The 12 wrappers write `developer_instructions` as a `'''` literal string, with the text unchanged.
- **FR-002**: WRAP checks the escapes in every `codex/agents/*.toml`; the role-wrapper schema states the rule.

## Success Criteria *(mandatory)*

- **SC-001**: 3 scenarios first (2 red against the old validator); the whole suite passes.
- **SC-002**: Every part of the new check is caught when sabotaged.
- **SC-003**: The real repo: the validator reported all 12 files before the fix and none after. Python's `tomllib` parses all 12. `codex exec` prints no "malformed agent role" warning (it printed 12 before).
