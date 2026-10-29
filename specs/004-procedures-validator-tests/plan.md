# Implementation Plan: Executable scenarios for the procedures validator

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A base fixture with one plain procedure and one stack procedure (`demo-stack/`), a `tool.mjs` that runs the validator with `GITHUB_API_URL` pointed at the scenario's local server, and 37 scenarios written by Feathers' recipe and reviewed line by line. One code change: `--upstream` reads `GITHUB_API_URL`.

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| III. Verified, cited facts | `GITHUB_API_URL` cited to GitHub's variables reference | Pass |
| IV. Mechanical tools have requirements and tests | 27 of 27 checks guarded; codes are schema rows | Pass |

## Project Structure

```text
tests/validate-procedures/
├── tool.mjs
├── validate-procedures.feature
└── fixtures/base/procedures/{simple.procedure.md, demo-stack/{index.md, add-thing.procedure.md}}
tests/support/steps.mjs                    # + "a local web server that answers:" (path, status, JSON body per line)
copilot/procedures/tools/validate-procedures.mjs   # GITHUB_API_URL
```
