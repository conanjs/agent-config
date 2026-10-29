# Tasks: Fix the four knowledge-validator findings

**Input**: `specs/002-knowledge-validator-findings/` (spec.md, plan.md); findings in `specs/001-knowledge-validator-tests/research.md`

## Phase 1: Scenarios first (red)

- [x] T001 In `tests/validate-knowledge/validate-knowledge.feature`, rename every old code to its rule id (plan.md, Code → rule map) in titles and expected output; message text unchanged
- [x] T002 [US2] Change the subtopic scenario to expect the nesting line only (F-1)
- [x] T003 [US3] Change the "directly under its heading" scenario to expect the KB-8 warning (F-2)
- [x] T004 [US4] Change the fenced ✅ scenario to pass with no warnings, and add one for a fenced `⚠️ unverified` (F-4)
- [x] T005 [US1] Add the test that every printed code is a rule row in the knowledge schemas (FR-007)
- [x] T006 Run the tests against the unchanged validator: 44 of 71 fail, all for the expected reasons

## Phase 2: Validator and schemas (green)

- [x] T007 [US1] Print the rule ids in `copilot/frameworks/knowledge/tools/validate-knowledge.mjs` (F-3)
- [x] T008 [US2] Skip the Subtopics listing check for a subtopic (F-1)
- [x] T009 [US3] Drop heading lines before splitting paragraphs (F-2)
- [x] T010 [US4] Count claim markers outside fenced blocks only (F-4)
- [x] T011 [US1] Add KB-9 … KB-12 to `schemas/_system.md`, TI-1 … TI-7 to `schemas/topic-index.schema.md`, and update the knowledge-doc Checks row

## Phase 3: Polish

- [x] T012 Update text that names the old codes: `review-docs.procedure.md`, `layered-guards.pattern.md`, `pin-before-you-change.pattern.md`, `testing/characterization-tests.md`, the 001 research outcome
- [x] T013 Run `scripts/check-docs.sh` (71 of 71 tests; knowledge base 0 warnings) and the sabotage check (61 of 61 caught)
