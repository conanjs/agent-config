# Implementation Plan: Executable scenarios for the Agent Foundry validator

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A base fixture (`foundry/` with floors, a charter, a tree and a lens; `rules/` with three rule ids passed as `--rules`), a `tool.mjs` that drops the blank line before the summary, and 51 scenarios written by Feathers' recipe and reviewed. No code change.

## Project Structure

```text
tests/validate-foundry/
├── tool.mjs
├── validate-foundry.feature
└── fixtures/base/{foundry/{floors.md, charters/, trees/, lens/{lessons/, waivers/, zones.md}}, rules/demo.md}
```
