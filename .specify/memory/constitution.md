# Constitution: agent-config

## Core Principles

### I. One source of truth

Each fact, procedure and template lives in exactly one file. Agent-specific files (Claude, Copilot, Codex) are thin wrappers that point at the shared file (`copilot/patterns/shared-procedure-thin-wrapper.pattern.md`). Upstream tools such as Spec Kit are invoked, never vendored or copied in.

### II. Typed and validated documents

Every new document follows a declared schema, and `scripts/check-docs.sh` passes on every commit. The pre-commit hook, the Claude Code hook and the required CI check `validate-docs` run that same script. Existing documents without a `schema:` key are legacy: they are never retrofitted just to comply.

### III. Verified, cited facts

A claim about how a tool, API or standard behaves cites an authoritative source, or says it is unconfirmed. A behavior tested or verified while working is recorded in `copilot/knowledge/` in the same change, with what was tested, how, the version and the date.

### IV. Mechanical tools have requirements and tests (NON-NEGOTIABLE)

Validators, installers, hooks and check scripts are code. Each check a tool makes traces to a written rule id, and each rule id has at least one Given/When/Then scenario with an automated test that runs in `scripts/check-docs.sh`.

- A changed requirement changes its scenario and its test in the same commit as the code.
- A new requirement adds scenarios and tests; the existing tests keep passing unchanged.
- A tool that has no tests yet gets characterization tests that pin what it does today, before its behavior is changed (Feathers, *Working Effectively with Legacy Code*).

### V. Options, not overwrites

When more than one design is valid, the docs keep every option with a default and its trade-offs, so later agents can offer the choice instead of losing the alternative. Revisions fix what is wrong and keep the rest (`copilot/patterns/revise-without-erasing.pattern.md`). Anything automated that replaces a user's file backs it up first (`copilot/patterns/backup-before-overwrite.pattern.md`).

## Workflow

- Changes reach `main` through pull requests; `validate-docs` is a required status check there.
- A change to a tool's behavior, or a new tool, is a Spec Kit feature under `specs/NNN-<name>/` (`copilot/procedures/spec-driven-development.procedure.md`). Doc-only edits that a schema already governs do not need a spec.
- Before committing under `copilot/knowledge/` or `copilot/procedures/`, follow `copilot/procedures/review-docs.procedure.md`.
- `proposals/` holds the design notes written before Spec Kit was adopted. It is kept as it is; new design work goes in `specs/`.

## Governance

This constitution outranks other practices in this repo. An amendment is a pull request that states the change and bumps the version: MAJOR for removing or redefining a principle, MINOR for a new principle or section, PATCH for wording. Reviews check that a change follows the principles above.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29

## Agentic SDLC: defaults

- **Default paradigm:** none
- **Unit size / complexity:** ≤ 50 lines, ≤ 10 complexity (the CS-2 defaults; they apply to new and touched code)

## Agentic SDLC: style deviations

> _Framework defaults apply._

## Agentic SDLC: budgets

| Loop | Budget |
|---|---|
| Re-execute after failed check | 2 |
| Re-execute after review-fail | 2 |
| Automatic rework per feature | 1 |
| Parallel [P] tasks | 4 |
