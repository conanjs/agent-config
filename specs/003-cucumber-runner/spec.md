# Feature Specification: Run the tool scenarios with Cucumber.js

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "use package.json and use pnpm to install libs … something official, standard instead of your own small test runner", 2026-10-29)

**Input**: Replace the home-made Gherkin runner (`tests/lib/gherkin.mjs`, specs/001 DR-001) with the official Cucumber.js runner, and make the step library shared so every tool under test (validators, installers, scripts) reuses it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The same scenarios, run by the standard tool (Priority: P1)

A maintainer runs `pnpm install` once, then `pnpm test`, and Cucumber.js runs every feature file under `tests/`. The scenarios from specs/001 and 002 pass without any change to what they require.

**Independent Test**: `pnpm test` reports 71 scenarios passed; the feature file differs from before only in the step wording that names the tool (`Given the base fixture tree of "validate-knowledge"`, `When the tool runs`).

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** `pnpm install --frozen-lockfile` and `pnpm test` run, **Then** every scenario passes.
2. **Given** a scenario with a step nobody defined, **When** Cucumber runs it, **Then** the run fails with exit code 1.

---

### User Story 2 - One step library for every tool (Priority: P1)

A maintainer adding tests for another tool writes only a feature file, a fixture and a `tool.mjs` that says how to run the tool; the file-change, run and output steps already exist.

**Acceptance Scenarios**:

1. **Given** a `tests/<tool>/tool.mjs` that registers the tool, **When** a feature says `Given the base fixture tree of "<tool>"` and `When the tool runs`, **Then** that tool runs on a fresh copy of its fixture.
2. **Given** two tools registered under one name, **When** Cucumber loads the support code, **Then** it fails with "registered twice".

---

### User Story 3 - The same guard everywhere (Priority: P2)

The tests run wherever the validators already run: `scripts/check-docs.sh`, so the pre-commit hook, the Claude Code hook and the required CI check `validate-docs`.

**Acceptance Scenarios**:

1. **Given** dependencies are not installed, **When** `scripts/check-docs.sh` runs, **Then** it stops with exit 4 and says `run: pnpm install`.
2. **Given** CI on a pull request, **When** `validate-docs` runs, **Then** it installs with `pnpm install --frozen-lockfile` and runs the scenarios.

### Edge Cases

- Node 18 or 20 on a machine: `check-docs.sh` now needs Node 22+, because Cucumber.js 13 declares `22 || 24 || >=26`; the validators alone still run on 18.
- The agent-foundry validator was never run by `check-docs.sh` or CI; it now is (found while wiring this feature).

## Requirements *(mandatory)*

- **FR-001**: `package.json` MUST declare `@cucumber/cucumber` as a dev dependency and `packageManager: pnpm@…`; `pnpm-lock.yaml` MUST be committed.
- **FR-002**: `cucumber.mjs` MUST point at `tests/**/*.feature` and load `tests/support/*.mjs` and `tests/*/tool.mjs`.
- **FR-003**: Shared steps MUST compare exit code and every output line after an optional header, exactly, with `{root}` and `{server}` placeholders.
- **FR-004**: The traceability checks (every printed code has a scenario; every printed code is a schema rule row) MUST be scenarios that any tool can reuse.
- **FR-005**: `scripts/check-docs.sh` MUST run Cucumber after the validators and fail when a scenario fails.
- **FR-006**: CI MUST install with `pnpm install --frozen-lockfile`, following the typescript-node stack template (`corepack enable`).

## Success Criteria *(mandatory)*

- **SC-001**: 71 of 71 scenarios pass under Cucumber.js.
- **SC-002**: No scenario's Given/Then content changed (only the tool-naming step wording).
- **SC-003**: The full run takes under 10 s.

## Assumptions

- Developers already use pnpm through corepack (the reference repo does).
