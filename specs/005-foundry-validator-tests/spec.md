# Feature Specification: Executable scenarios for the Agent Foundry validator

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Do it all", 2026-10-29)

**Input**: Apply TST-13/TST-14 to `copilot/frameworks/agent-foundry/tools/validate-foundry.mjs`: pin what it does today as Cucumber scenarios and list what looks wrong. The validator itself does not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin what the validator does today (Priority: P1)

A maintainer changing the foundry validator sees every check whose output changed.

**Independent Test**: Switch off any `fail(…)`/`warn(…)` call; at least one scenario fails.

**Acceptance Scenarios**:

1. **Given** the base fixture (one floor, one charter, one tree, one lens with a lesson, a waiver and a zone map), **When** the validator runs, **Then** it prints only `agent-foundry: 0 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded`.
2. **Given** a waiver whose `review-by` is 2000-01-01, **When** the validator runs, **Then** it warns `WARN WAIVER: lens/waivers/WV-1.md: review-by 2000-01-01 has passed; finding returns` and exits 0.

### Edge Cases

- Expiry checks compare with today: the base fixture uses 2999-12-31, and the expiry scenarios use 2000-01-01.
- The validator was not run by `check-docs.sh` or CI before specs/003.

## Requirements *(mandatory)*

- **FR-001**: Every `fail`/`warn` call MUST be covered by at least one scenario.
- **FR-002**: Every printed check code MUST be named by a scenario title.
- **FR-003**: The validator's behavior MUST NOT change in this feature.

## Success Criteria *(mandatory)*

- **SC-001**: 51 scenarios pass; switching off each of the 49 call sites makes one fail.
