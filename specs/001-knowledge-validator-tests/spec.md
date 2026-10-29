# Feature Specification: Executable scenarios for the knowledge validator

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (scope approved by V on 2026-10-29)

**Input**: User description: "Requirements are written as scenarios and test cases. Tests change only when a requirement changes; new features add tests while the old ones still pass. That applies to validators and every mechanical tool. The validators so far have no explicit requirements, so changes can't be tracked." Scope: pilot on `validate-knowledge.mjs`, migrating what exists rather than rebuilding it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin what the validator does today (Priority: P1)

A maintainer changes `copilot/frameworks/knowledge/tools/validate-knowledge.mjs`. Before the change reaches `main`, a test run shows every check whose output changed, by rule code and with the exact line, so no check changes by accident.

**Why this priority**: The validator guards every knowledge doc. Today a broken check passes CI silently, because nothing runs it against a known bad doc.

**Independent Test**: Edit one message or condition in the validator, run the scenarios, and see exactly the scenarios for that rule code fail.

**Acceptance Scenarios**:

1. **Given** the base fixture tree with one valid doc of each kind, **When** the scenarios run against the current validator, **Then** every scenario passes.
2. **Given** a doc whose Verification status says `Verified: 2 claims` while its body has 1 ✅, **When** the validator runs, **Then** it passes with exactly the warning `warn  VS  demo/concept.md: Verification status says 2 ✅ / 0 ⚠️ but body has 1 / 0`.
3. **Given** the validator's VS count check is removed, **When** the scenarios run, **Then** the scenario for that warning fails and names the missing line.

---

### User Story 2 - Read the requirements in plain language (Priority: P2)

A reviewer, human or agent, reads one file to learn what the validator promises for each rule code, in Given/When/Then form, without reading the validator's code.

**Why this priority**: The scenarios are the requirements. If they are only readable as code, the gap V described stays open.

**Independent Test**: Open the feature file and find, for any rule code the validator prints, at least one scenario that names it.

**Acceptance Scenarios**:

1. **Given** the feature file, **When** a reader looks up rule code `KD-7`, **Then** they find a scenario whose title names `KD-7` and whose steps say which file change triggers it and the exact output.
2. **Given** a scenario step the runner does not know, **When** the scenarios run, **Then** the run fails with the scenario name and the unknown step, instead of skipping it.

---

### User Story 3 - No rule without a scenario (Priority: P3)

When someone adds a new rule code to the validator, the test run fails until a scenario for that code exists.

**Why this priority**: It keeps the requirements and the code from drifting apart after the pilot.

**Independent Test**: Add `fail('XX-9', …)` to the validator and run the tests: the coverage check fails and names `XX-9`.

**Acceptance Scenarios**:

1. **Given** every rule code the validator can print has a scenario, **When** the coverage check runs, **Then** it passes.
2. **Given** a rule code in the validator with no scenario, **When** the coverage check runs, **Then** it fails and names the code.

### Edge Cases

- Output that depends on the date: the header line prints today's date, so scenarios compare everything after the header.
- Network checks (`--urls`, KB-3): scenarios use a local HTTP server, so they need no internet.
- Behavior that looks wrong today: the scenario records it as it is and is listed in `research.md` for a decision. The scenarios never fix behavior silently.
- Fixture trees must never be picked up by the real validators, so they live outside `copilot/knowledge/`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repo MUST hold the validator's requirements as Given/When/Then scenarios in one Gherkin feature file.
- **FR-002**: Every scenario MUST run against a copy of a small valid fixture tree, changed only by the scenario's own steps.
- **FR-003**: A scenario MUST compare the validator's exit code and every output line after the header, exactly.
- **FR-004**: Every rule code the validator can print MUST appear in the title of at least one scenario, and the test run MUST fail when one does not.
- **FR-005**: An unknown step MUST fail the run.
- **FR-006**: The scenarios MUST run in `scripts/check-docs.sh`, so the pre-commit hook and the required CI check run them.
- **FR-007**: The tests MUST need only Node.js 18 or later, with no installed packages, the same as the validators.
- **FR-008**: The validator's behavior MUST NOT change in this feature.

### Key Entities

- **Scenario**: a named case with Given steps (fixture changes), one When step (run the validator), and Then steps (exit code and exact output).
- **Base fixture**: the smallest tree that passes with no warnings: a root index, one topic index, one concept doc, one deep dive, one agentic-sdlc rule that cites the concept, and one Company KB entry.
- **Rule code**: the code the validator prints first on a line (`KD-1`, `VS`, `IDX`, …).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every rule code the validator prints has at least one scenario (checked by FR-004).
- **SC-002**: Removing any single `fail(…)` or `warn(…)` call from the validator makes at least one scenario fail.
- **SC-003**: The whole scenario run takes under 10 seconds on a laptop.
- **SC-004**: `scripts/check-docs.sh` runs the scenarios and still passes on `main`.

## Assumptions

- The validator already takes its roots as arguments (`[knowledge-root] --sdlc --companies`), so no change to it is needed for testing.
- A small runner of our own reads the Gherkin file. Cucumber.js would need `npm install` in a repo that has no `package.json`; `research.md` records this choice.
- Other validators and the installers follow the same pattern in later features; they are out of scope here.
