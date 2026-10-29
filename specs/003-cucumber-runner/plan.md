# Implementation Plan: Run the tool scenarios with Cucumber.js

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Add `package.json` (pnpm, `@cucumber/cucumber ~13.3.0`) and `cucumber.mjs`. Move the steps out of the knowledge test file into a shared library under `tests/support/`, with a registry where each `tests/<tool>/tool.mjs` says how its tool runs. Delete `tests/lib/gherkin.mjs` and the `node:test` file. Run Cucumber from `check-docs.sh`, the hooks and CI.

## Technical Context

**Language/Version**: JavaScript (ES modules); Node 22+ for tests (Cucumber.js 13), 18+ for the validators alone
**Primary Dependencies**: `@cucumber/cucumber` 13.3.0 (dev only)
**Testing**: `pnpm test` (= `cucumber-js`), also run by `scripts/check-docs.sh`
**Constraints**: the feature files keep their scenarios; only the tool-naming steps change

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. One source of truth | One step library for all tools; one install path (corepack) in both repos | Pass |
| IV. Mechanical tools have requirements and tests | Same scenarios, now run by the standard runner | Pass |
| V. Options, not overwrites | DR-001 is marked superseded, not deleted | Pass |

## Project Structure

```text
package.json, pnpm-lock.yaml, cucumber.mjs     # new
tests/support/tools.mjs     # registry: registerTool(name, { fixture, run, header, normalize, quietPass, codes, rules })
tests/support/world.mjs     # per-scenario temp folder, scenario names, cleanup
tests/support/steps.mjs     # shared Given/When/Then, incl. traceability steps
tests/<tool>/tool.mjs       # one per tool
tests/<tool>/<tool>.feature
tests/<tool>/fixtures/base/
scripts/check-docs.sh       # + agent-foundry validator, + Cucumber; Node 22+
.github/workflows/validate-docs.yml, .githooks/pre-commit, scripts/claude-doc-hook.sh
```

## Complexity Tracking

> _No constitution violations._
