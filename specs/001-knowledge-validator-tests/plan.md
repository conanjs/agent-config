# Implementation Plan: Executable scenarios for the knowledge validator

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Pin what `validate-knowledge.mjs` does today as Gherkin scenarios that run on `node:test`. A small runner reads the feature file; each scenario copies a valid fixture tree, changes it, runs the validator and compares the exit code and every output line. A coverage test fails when a rule code has no scenario. `scripts/check-docs.sh` runs the tests, so the pre-commit hook and CI do too. The validator itself does not change.

## Technical Context

**Language/Version**: JavaScript (ES modules) on Node.js ≥ 18; checked on 24.22.1
**Primary Dependencies**: none (`node:test`, `node:assert`, `node:http`)
**Storage**: files; each scenario works in its own temp folder
**Testing**: `node --test 'tests/**/*.test.mjs'` locally; `check-docs.sh` passes the files found by `find`
**Target Platform**: macOS and Linux (CI: `ubuntu-latest`)
**Project Type**: repository tooling
**Performance Goals**: the whole run under 10 s (SC-003)
**Constraints**: no network except `127.0.0.1`; no `package.json`
**Scale/Scope**: one validator, 61 `fail`/`warn` call sites, 18 rule codes

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. One source of truth | The rule text stays in the knowledge schemas; the feature file holds scenarios and points at them | Pass |
| II. Typed and validated documents | No new knowledge doc type; `check-docs.sh` still passes | Pass |
| III. Verified, cited facts | `node --test` glob behavior is cited and recorded in `copilot/knowledge/testing/` | Pass |
| IV. Mechanical tools have requirements and tests | This feature is the first application | Pass |
| V. Options, not overwrites | DR-001 and DR-002 keep the rejected options and their reasons | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/001-knowledge-validator-tests/
├── spec.md
├── plan.md
├── research.md
└── tasks.md
```

### Source Code (repository root)

```text
tests/
├── lib/
│   └── gherkin.mjs                      # reads the Gherkin subset, one node:test test per scenario
└── validate-knowledge/
    ├── validate-knowledge.feature       # the requirements, Given/When/Then
    ├── validate-knowledge.test.mjs      # step definitions + rule-code coverage check
    └── fixtures/base/                   # smallest tree that passes with no warnings
        ├── knowledge/                   # root index, demo/ topic index, concept, deep dive
        ├── agentic-sdlc/foundations/    # one rule citing the concept (KD-4)
        └── companies/acme/repos/widget-api/   # KB-2 deny-list

scripts/check-docs.sh                    # gains a step: node --test <every tests/**/*.test.mjs>
.githooks/pre-commit, scripts/claude-doc-hook.sh   # also fire on tests/
.github/workflows/validate-docs.yml      # push paths gain tests/**
```

**Structure Decision**: tests at the repo root (DR-002); one folder per tool, so later tools add `tests/<tool>/` and reuse `tests/lib/gherkin.mjs`.

## Complexity Tracking

> _No constitution violations._
