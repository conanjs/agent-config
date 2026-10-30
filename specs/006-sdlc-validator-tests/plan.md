# Implementation Plan: Executable scenarios for the agentic-sdlc framework validator

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A miniature agent-config repo as the fixture, a `tool.mjs` that passes `--repo` (or not, with the test-only `--no-repo`), and 124 scenarios by Feathers' recipe, reviewed line by line. Code change: `--upstream` reads `GITHUB_API_URL`. Shared support change: the World resolves the temp folder's real path, and a tool that stops before its header is compared in full.

## Project Structure

```text
tests/validate-sdlc/
├── tool.mjs
├── validate-sdlc.feature
└── fixtures/base/repo/
    ├── copilot/frameworks/agentic-sdlc/{conventions.md, index.md, agents/, trees/, foundations/code/, stacks/demo/, paradigms/, schemas/}
    ├── copilot/knowledge/demo/doc.md
    ├── copilot/agents/, claude/agents/, codex/agents/   # sdlc-engineering wrappers
    └── skills/{sdlc-engineering-preset, sdlc-stack-demo, sdlc-paradigm-demo-paradigm}/
```
