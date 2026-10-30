# Feature Specification: The tracker — open work that outlasts the chat

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-30

**Status**: Implemented 2026-10-30

**Input**: V: "should we have [a] tracking file … to track whatever left things to do in a structural, systematical way, so it can remind me after many prompts and [I] forget it." Then: "Build the smart intelligent tracker first."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Left work is written down where the next session finds it (Priority: P1)

A turn often ends with something not done: a merge waiting for approval, a stash to decide on, a follow-up. Today that lives only in the chat, and it is lost after a few prompts.

**Acceptance Scenarios**:

1. **Given** a repo, **When** an agent runs `tracker.mjs --add "<title>" --next "<step>"`, **Then** the item is appended to `TRACKER.md` under Open with the next free id and today's date. A new file is created if needed and listed in `.git/info/exclude`, so it stays local until someone adds it with `git add -f`.
2. **Given** an item, **When** it is updated, closed or dropped, **Then**:
   - an update records today's date in `updated`;
   - closing moves the item to the top of Done with `closed: <date>`;
   - dropping also requires a `why`.

   Nothing is deleted.
3. **Given** an edit that would leave the file invalid (a `waiting` item with no `waiting-on`), **Then** the file is not changed and the tool says why.

### User Story 2 - The next session reminds you (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a repo with open items, **When** a Claude Code session starts, **Then** the `SessionStart` hook shows the user a short summary (`systemMessage`) and gives the model the full list plus how to use it (`additionalContext`).
2. **Given** the same, **When** a Copilot CLI session starts, **Then** its `sessionStart` hook gives the model the list (`additionalContext`).
3. **Given** no tracker, or no open item, **Then** the hooks print nothing.
4. **Given** the list, **Then** it is ordered by urgency:
   1. items that look done;
   2. overdue items;
   3. high-priority items;
   4. items in progress;
   5. waiting items;
   6. open items;
   7. low-priority items.

### User Story 3 - The tracker notices what changed (Priority: P2)

**Acceptance Scenarios**:

1. **Given** an open item with `done-when` (a merge, a path, a commit message, a stash), **When** the check holds, **Then** the item is reported as **looks done**, with the evidence. The tool never closes it by itself.
2. **Given** an item past `due`, or unchanged for more than 14 days, **Then** it is reported as overdue or stale.
3. **Given** a `done-when` that cannot run, **Then** the tool says why instead of guessing.

## Requirements *(mandatory)*

- **FR-001**: `tracker/v1` is defined in `copilot/tracker/tracker.schema.md`, with rules TR-1 … TR-10.
- **FR-002**: One tool, `copilot/tracker/tracker.mjs`, with no dependencies, checks, briefs and edits the file. A launcher, `tracker-hook.sh`, finds Node for the hooks.
- **FR-003**: The guide is one bullet in the global instruction (Claude Code, Copilot CLI and Codex all read it). The sensor is a `SessionStart` hook for Claude Code and a `sessionStart` hook for Copilot CLI. Codex has no session-start hook here, so it gets the instruction only.
- **FR-004**: Scenarios first; every rule code is named by a scenario; every rule is caught when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/tracker` scenarios all pass; the whole suite passes.
- **SC-002**: Every `fail`/`warn` call and every brief, hook and edit rule is caught by a scenario when sabotaged.
- **SC-003**: agent-config has its own `TRACKER.md` with the work left from this branch, and a new Claude Code session in it shows the summary.

## Out of scope

- Reading GitHub (PR state, CI) in a check: it needs the network and a token at session start.
- One tracker across all repos: each repo keeps its own, and an item that spans repos lives where the work happens.
