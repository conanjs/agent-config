# Feature Specification: Install skills one link per skill (`link-each`)

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-29

**Status**: Withdrawn 2026-10-29 — built and tested, then reverted at V's request: the installer keeps the whole-folder link (option B). Kept here as the record of option A (`git show f853077` has the implementation and scenarios)

**Input**: V chose option A ("link each repo skill into the existing folder") and asked to test option B (the whole-folder link) to confirm whether the claude.ai skills in `~/.claude/skills/synced` come back.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Installing skills keeps what other tools put in the folder (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `~/.claude/skills/synced/…` exists, **When** `install.sh` runs, **Then** each repo skill is a link inside `~/.claude/skills`, `synced/` is unchanged, and no backup folder is made.
2. **Given** an older install linked the whole `~/.claude/skills` to the repo, **When** `install.sh` runs, **Then** that link is replaced by a real folder of per-skill links, with no backup.
3. **Given** `~/.claude/skills` links somewhere else, **When** `install.sh` runs, **Then** that link is backed up as `skills.link` and the folder is made.
4. **Given** a real `demo` skill folder in both targets, **When** `install.sh` runs, **Then** the backups are `skills/demo` and `skills/demo.2`.
5. **Given** an installed home with `synced/`, **When** `uninstall.sh` runs, **Then** only the per-skill links are removed.

## Requirements *(mandatory)*

- **FR-001**: A `link-each` strategy MUST make the target a real folder and link each entry of the source folder into it, with `symlink`'s per-path rules (backup, `.2`, already-linked skip).
- **FR-002**: An old whole-folder link to the source MUST be removed, not backed up (backing up entries through it would write into the repo); a link elsewhere is backed up as `<source>.link`.
- **FR-003**: `uninstall` MUST remove only the entry links that point into the repo.
- **FR-004**: `mapping.yaml` MUST use `link-each` for `skills/` (both targets); bash and PowerShell MUST both support it.
