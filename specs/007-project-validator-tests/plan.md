# Implementation Plan: Executable scenarios for the project validator

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A tiny project plus a small framework and procedures folder as the fixture; a `tool.mjs` that passes `--framework`, `--procedures` and sets `AGENT_HOME`; a shared git step for the `--task` scope scenarios; 90 scenarios by Feathers' recipe, reviewed line by line. No code change.

## Project Structure

```text
tests/validate-project/
├── tool.mjs
├── validate-project.feature
└── fixtures/base/
    ├── project/{docs/architecture.md, docs/integrations/payments.md, .specify/memory/constitution.md,
    │            specs/001-demo/{research,tasks,blueprint}.md, src/{demo.lint.json, modules/orders/{domain,application}/}}
    ├── framework/{conventions.md, trees/, stacks/demo/{index,idioms}.md, paradigms/, foundations/code/}
    ├── procedures/demo/{index.md, add-entity.procedure.md}
    └── agent-home/knowledge/shared.md
tests/support/steps.mjs   # + "<dir>" is a git repository with everything committed
```
