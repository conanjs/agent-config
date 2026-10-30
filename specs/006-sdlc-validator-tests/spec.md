# Feature Specification: Executable scenarios for the agentic-sdlc framework validator

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Do it all", 2026-10-29)

**Input**: Apply TST-13/TST-14 to `copilot/frameworks/agentic-sdlc/tools/validate.mjs`: pin what it does today as Cucumber scenarios, list what looks wrong, and make `--upstream` testable offline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin what the validator does today (Priority: P1)

A maintainer changing the framework validator sees every check whose output changed.

**Independent Test**: Switch off any `fail(…)`/`warn(…)` call; at least one scenario fails.

**Acceptance Scenarios**:

1. **Given** a miniature framework (two roles, one tree, one foundation, one stack with a framework, a paradigm overlay and a reference pin, one paradigm, the index and schema registry) and the agent-config wrappers and skills around it, **When** the validator runs, **Then** it prints `PASS`.
2. **Given** a foundation that mentions `demotool`, a tool name the demo stack owns, **When** the validator runs, **Then** it fails with `V6  foundations/code/demo.md:18 names stack-specific tool(s): demotool`.

---

### User Story 2 - Check reference pins without the internet (Priority: P2)

`--upstream` reads the GitHub API address from `GITHUB_API_URL` when set, like the procedures validator (specs/004, DR-005).

**Acceptance Scenarios**:

1. **Given** a local API whose tags for `demo-org/demo-reference` include `v1.10.0` and `v1.2.0`, **When** the validator runs with `--upstream`, **Then** it warns that the latest tag is `v1.10.0` (numeric, not text, order).

### Edge Cases

- The temp folder is resolved to its real path, because this validator prints real paths and macOS keeps temp folders behind a symlink.
- The repo-not-found warning needs a run without `--repo`; the tool entry offers a test-only `--no-repo` switch.

## Requirements *(mandatory)*

- **FR-001**: Every `fail`/`warn` call MUST be covered by at least one scenario.
- **FR-002**: Every printed check code MUST be named by a scenario title.
- **FR-003**: `--upstream` MUST use `GITHUB_API_URL` when set, else `https://api.github.com`.
- **FR-004**: No other behavior changes.

## Success Criteria *(mandatory)*

- **SC-001**: 124 scenarios pass; switching off each of the 120 call sites makes one fail.
