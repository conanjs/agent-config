# Feature Specification: Nested and inherited tsconfig, one-word and shared names

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-30

**Status**: Implemented 2026-10-30

**Input**: V, on what spec 013 left out of scope ("a tsconfig.json that uses extends or sits outside the repo root, and one-word or shared names"): "Cover these."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The tsconfig.json TypeScript would use is the one read (Priority: P1)

Spec 013 read aliases from the repo's root `tsconfig.json` only. In a monorepo each package has its own, often built on a shared base through `extends`. Measured: the reference repo has a second `tsconfig.json` (`scripts/test/fixtures/links/`) with no `paths`, so the root's `@/` aliases did not apply to its files, but the tool applied them.

**Acceptance Scenarios**:

1. **Given** a `tsconfig.json` in a sub-folder, **When** a file at or below that folder imports through an alias, **Then** the nearest `tsconfig.json` at or above the file's folder gives the aliases, and the root's do not apply.
2. **Given** `"extends": "../base/tsconfig.base"` (with or without `.json`), **Then** the base's `paths` apply, read relative to the base file.
3. **Given** `"extends": ["./one.json", "./two.json"]`, **Then** the later entry wins, and `paths` is replaced whole, not merged.
4. **Given** `${configDir}` in an inherited `paths` target, **Then** it is the folder of the `tsconfig.json` in use.
5. **Given** a `baseUrl` set anywhere in the chain, **Then** `paths` is read relative to it, and `baseUrl` itself relative to the file that sets it.
6. **Given** an `extends` that names a package, or a loop of `extends`, **Then** the package is skipped (it is not in the repo) and the loop stops where it closes.

### User Story 2 - One-word and shared names (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a hyphenated or PascalCase name that several files share, **Then** the file nearest the citing file (most leading folders in common) lists the mention. When several are equally near, each lists it, marked `(one of N nearest files with this name)`.
2. **Given** a one-word name, **Then** it counts only when Markdown writes it as code (`` `setup` ``), and only when one file is nearest. Plain words and code in other files do not count.
3. **Given** a file whose text holds its own name, **Then** that is not a mention of another file with the same name.

## Requirements *(mandatory)*

- **FR-001**: Each file's aliases come from the nearest `tsconfig.json` at or above its folder, with what it inherits through relative `extends` entries.
- **FR-002**: Name mentions follow User Story 2; they still make no chain and are still left out when the same file is a direct reference.
- **FR-003**: Scenarios first. Every new rule is caught by a scenario when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/atlas`: 58 scenarios (was 48); the whole suite passes (447).
- **SC-002**: 45 of 46 explain sabotages caught; the survivor has no behaviour of its own (see `research.md`).
- **SC-003**: The rules match `tsc` 6.0.3 on a test project (`research.md`).

## Out of scope

- A base config from a package (`node_modules`), and `tsconfig.*.json` files other than `tsconfig.json` (used only when passed with `-p`).
- Whether the nearest `tsconfig.json` actually includes the file (`include`/`exclude`): editors fall back to another project; the tool does not.
