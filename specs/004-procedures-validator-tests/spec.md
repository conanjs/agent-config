# Feature Specification: Executable scenarios for the procedures validator

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Do it all", 2026-10-29)

**Input**: Apply TST-13/TST-14 to `copilot/procedures/tools/validate-procedures.mjs`: pin what it does today as Cucumber scenarios, list what looks wrong, and make `--upstream` testable offline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin what the validator does today (Priority: P1)

A maintainer changing the procedures validator sees every check whose output changed, by rule and with the exact line.

**Independent Test**: Switch off any `fail(…)`/`warn(…)` call; at least one scenario fails.

**Acceptance Scenarios**:

1. **Given** the base fixture (one plain procedure, one stack procedure), **When** the validator runs, **Then** it prints `PASS (0 warning(s))`.
2. **Given** a dependency verified against `v1.0.0` and last verified on 2000-01-01, **When** the validator runs, **Then** it warns `PR-4  simple.procedure.md: last verified 2000-01-01 (N days ago, > 90); re-check every depends-on source`.

---

### User Story 2 - Check upstream drift without the internet (Priority: P2)

`--upstream` reads the GitHub API address from `GITHUB_API_URL` when set (as GitHub Actions and GitHub Enterprise Server set it), so scenarios point it at a local server.

**Acceptance Scenarios**:

1. **Given** `GITHUB_API_URL` points at a server whose latest release of `demo/cli` is `v1.1.0`, **When** the validator runs with `--upstream`, **Then** it warns `PR-5  simple.procedure.md: Demo CLI verified against v1.0.0, upstream latest is v1.1.0; re-verify the procedure`.
2. **Given** `GITHUB_API_URL` is not set, **When** the validator runs with `--upstream`, **Then** it asks `https://api.github.com`, as before.

### Edge Cases

- The day count in PR-4 changes daily: scenarios compare `(N days ago`.
- Scenarios not about age use `last-verified: 2999-12-31`, so the age check never fires in them.

## Requirements *(mandatory)*

- **FR-001**: Every `fail`/`warn` call in the validator MUST be covered by at least one scenario.
- **FR-002**: Every printed code MUST be named by a scenario title and be a `| PR-n |` row in `procedure.schema.md`.
- **FR-003**: `--upstream` MUST use `GITHUB_API_URL` when set, else `https://api.github.com`.
- **FR-004**: No other behavior changes.

## Success Criteria *(mandatory)*

- **SC-001**: 37 scenarios pass; switching off each of the 27 call sites makes one fail.

## Assumptions

- `GITHUB_API_URL` is the variable GitHub Actions sets for the REST API base URL.
