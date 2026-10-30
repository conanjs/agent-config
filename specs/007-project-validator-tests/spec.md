# Feature Specification: Executable scenarios for the project validator

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Do it all", 2026-10-29)

**Input**: Apply TST-13/TST-14 to `copilot/frameworks/agentic-sdlc/tools/validate-project.mjs`: pin what it does today as Cucumber scenarios and list what looks wrong. The validator itself does not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin what the validator does today (Priority: P1)

A maintainer changing the project validator sees every check whose output changed, including the `--task` scope check that uses git.

**Independent Test**: Switch off any `fail(…)`/`warn(…)` call; a scenario fails, except for the checks that can never fire today (findings F-2, F-4).

**Acceptance Scenarios**:

1. **Given** a tiny project (architecture doc, integration doc, constitution, one spec with research, tasks and blueprint) with a small framework and one stack procedure, **When** the validator runs, **Then** it prints `PASS (0 warning(s))`.
2. **Given** that project as a git repository and a new file `src/modules/orders/application/PlaceOrder.ts`, **When** the validator runs with `--task T001`, **Then** it fails with `SCOPE  T001 (demo/add-entity): src/modules/orders/application/PlaceOrder.ts is outside the procedure's allowed-paths (modules/orders/domain/Order.ts)`.

### Edge Cases

- `{{AGENT_HOME}}` refs resolve under the fixture's `agent-home/`, never the real home folder (`AGENT_HOME` is set per scenario).
- A new shared step makes a fixture folder a git repository with everything committed.

## Requirements *(mandatory)*

- **FR-001**: Every reachable `fail`/`warn` call MUST be covered by at least one scenario.
- **FR-002**: Every printed check code MUST be named by a scenario title.
- **FR-003**: The validator's behavior MUST NOT change in this feature.

## Success Criteria *(mandatory)*

- **SC-001**: 90 scenarios pass; switching off each of the 83 call sites makes one fail, except the two unreachable ones.
