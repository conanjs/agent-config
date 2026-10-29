# Implementation Plan: Fix the four knowledge-validator findings

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Change the scenarios first so they describe the fixed behavior, see them fail, then change `validate-knowledge.mjs` until they pass. F-3 renames the printed codes to rule ids and writes the missing rules into the schemas; F-1, F-2 and F-4 are small logic fixes. A new test checks that every printed code has a rule row.

## Technical Context

**Language/Version**: JavaScript (ES modules) on Node.js ≥ 18; checked on 24.22.1
**Primary Dependencies**: none
**Testing**: `tests/validate-knowledge/` (specs/001)
**Constraints**: messages keep their text; only codes change (FR-003)

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. One source of truth | Rule text lives only in the schemas; the validator prints the id | Pass |
| II. Typed and validated documents | Schemas keep their structure; topic-index bullets become a rule table | Pass |
| IV. Mechanical tools have requirements and tests | Scenarios change in the same commit as the validator; the code→rule test is added | Pass |
| V. Options, not overwrites | Old codes stay readable in quoted past output, marked as renamed | Pass |

## Code → rule map

| Old | New | Rule (where) |
|---|---|---|
| `VS` | `KD-9` | Verification status line (`knowledge-doc.schema.md`, exists) |
| `FM` | `KB-9` | Front-matter values (`_system.md`, new) |
| `FM-KEYS` | `KB-10` | Only defined front-matter keys (`_system.md`, new) |
| `HEAD` | `KB-11` | `# Title`, Summary TL;DR and Use this when (`_system.md`, new) |
| `REF` | `KB-12` | References, Related, footnotes (`_system.md`, new) |
| `IDX` | `TI-1` | Named `index.md`; `kind`, `topic`, `last-updated` valid (`topic-index.schema.md`, new) |
| `IDX` | `TI-2` | Ends with References, Related |
| `IDX` | `TI-3` | Root Topics lists every topic folder, and only existing ones |
| `IDX` | `TI-4` | Docs section: one row per v1 doc, every row's file exists |
| `IDX` | `TI-5` | Type and Status copy front-matter; legacy rows say `legacy` |
| `IDX` | `TI-6` | Subfolders one level deep, each listed in Subtopics |
| `IDX` | `TI-7` | A folder holding v1 docs has a topic index |

`KD-2` stays for a verified knowledge doc without `last-verified` (its schema row says so); the same check on a deep dive becomes `KB-9`.

## Project Structure

```text
specs/002-knowledge-validator-findings/   spec.md, plan.md, tasks.md
tests/validate-knowledge/                 .feature edited first; .test.mjs gains the code→rule test
copilot/frameworks/knowledge/tools/validate-knowledge.mjs
copilot/frameworks/knowledge/schemas/     _system.md (KB-9..12), topic-index.schema.md (TI-1..7), knowledge-doc.schema.md (Checks row)
copilot/procedures/review-docs.procedure.md, copilot/patterns/layered-guards.pattern.md   old code names
```

## Complexity Tracking

> _No constitution violations._
