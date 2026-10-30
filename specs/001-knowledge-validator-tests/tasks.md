# Tasks: Executable scenarios for the knowledge validator

**Input**: `specs/001-knowledge-validator-tests/` (spec.md, plan.md, research.md)

## Phase 1: Setup

- [x] T001 Set up Spec Kit in the repo (`specify init --here --integration claude --script sh`, v1.2.3) and write `.specify/memory/constitution.md`
- [x] T002 Create the base fixture tree in `tests/validate-knowledge/fixtures/base/` and confirm the validator passes it with no warnings

## Phase 2: Foundational

- [x] T003 Write the Gherkin runner in `tests/lib/gherkin.mjs` (unknown steps and unsupported Gherkin fail the run)

## Phase 3: User Story 1 - Pin what the validator does today (P1) 🎯 MVP

- [x] T004 [US1] Write step definitions in `tests/validate-knowledge/validate-knowledge.test.mjs`
- [x] T005 [US1] Write one scenario per check in `tests/validate-knowledge/validate-knowledge.feature`, with expected output read from the validator's actual output and reviewed
- [x] T006 [US1] Record questionable behavior as findings F-1 and F-2 in `research.md`, without changing the validator
- [x] T007 [US1] Disable each `fail`/`warn` call one at a time and confirm a scenario catches it (SC-002)

## Phase 4: User Story 2 - Read the requirements in plain language (P2)

- [x] T008 [US2] Head the feature file with the change policy and point it at the schema files that define the rules

## Phase 5: User Story 3 - No rule without a scenario (P3)

- [x] T009 [US3] Add the rule-code coverage test to `tests/validate-knowledge/validate-knowledge.test.mjs`

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T010 Run the tests from `scripts/check-docs.sh` and add `tests/**` to the push paths in `.github/workflows/validate-docs.yml`
- [x] T011 [P] Add the brownfield rule to `copilot/frameworks/agentic-sdlc/foundations/delivery/testing-strategy.md` and a pattern in `copilot/patterns/`
- [x] T012 [P] Record the verified findings in `copilot/knowledge/testing/`
- [x] T013 Run `scripts/check-docs.sh` and follow `copilot/procedures/review-docs.procedure.md` before committing
