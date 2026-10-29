# Tasks: Run the tool scenarios with Cucumber.js

- [x] T001 Add `package.json` and `pnpm-lock.yaml` (`pnpm install`), ignore `node_modules/`
- [x] T002 Add `cucumber.mjs`
- [x] T003 [US2] Write `tests/support/tools.mjs`, `world.mjs`, `steps.mjs`
- [x] T004 [US1] Register the knowledge validator in `tests/validate-knowledge/tool.mjs`; change only the tool-naming steps in its feature; turn the two coverage tests into scenarios
- [x] T005 [US1] Delete `tests/lib/gherkin.mjs` and `tests/validate-knowledge/validate-knowledge.test.mjs`
- [x] T006 [US1] Confirm an undefined step fails the run
- [x] T007 [US3] Run the foundry validator and Cucumber from `scripts/check-docs.sh`; install with pnpm in CI; extend hook paths
- [x] T008 Update `testing/characterization-tests.md`, `pin-before-you-change.pattern.md` and DR-001's status
