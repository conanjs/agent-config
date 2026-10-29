# Feature Specification: Fix the two project-validator bugs

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Fix the two confirmed validator bugs, then push", 2026-10-29)

**Input**: Findings 007/F-2, F-3 and F-4 in `specs/007-project-validator-tests/research.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An unknown "Decided by" fails (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a decision record with `- **Decided by:** boss`, **When** the validator runs, **Then** it fails with `DR  specs/001-demo/research.md DR-001: Decided by boss is not a role id or human`.
2. **Given** `- **Decided by:** engineering` (a role id), **When** the validator runs, **Then** it passes.

### User Story 2 - Each continuation field is read as itself (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `refs:  · procedure: demo/add-entity`, **When** the validator runs, **Then** it fails only with `refs must be explicit (none or paths)`, and the procedure and its inputs are still checked.
2. **Given** `hot-path: maybe`, **When** the validator runs, **Then** it fails with `hot-path must be yes or no`.
3. **Given** the fields in another order (`refs … · procedure … · touches …`), **When** the validator runs, **Then** it passes.

## Requirements *(mandatory)*

- **FR-001**: The `Decided by` check MUST match its line anywhere in the record (multiline).
- **FR-002**: The task continuation line MUST be read as `key: value` fields separated by `·`; `touches` and `refs` are required, `procedure` and `hot-path` optional.
- **FR-003**: Every other scenario MUST keep passing unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: Switching off each of the 83 `fail`/`warn` calls makes a scenario fail (was 81).
