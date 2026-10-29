# Feature Specification: Executable scenarios for the bash installers

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Do it all", 2026-10-29)

**Input**: Apply TST-13/TST-14 to `installers/install.sh`, `uninstall.sh`, `macos/install.sh` and `lib/*.sh`: write the README's Usage promises and the scripts' behavior as scenarios. The scripts do not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and uninstall do what the README says (Priority: P1)

A maintainer changing an installer script sees at once if links, seeds or backups behave differently.

**Acceptance Scenarios**:

1. **Given** an empty HOME, **When** `install.sh` runs on macOS, **Then** every `symlink` entry is a symlink into the repo, every `seed-once` entry is a copy, and no backup folder is created.
2. **Given** a real `~/.claude/CLAUDE.md`, **When** `install.sh` runs, **Then** it moves to `~/.agent-config-backups/<timestamp>/claude/CLAUDE.md` and the link replaces it.
3. **Given** real folders at both targets of `skills`, **When** `install.sh` runs, **Then** the second backup is `skills.2`.
4. **Given** an installed HOME, **When** `uninstall.sh` runs, **Then** the symlinks are gone and seeded files stay.

---

### User Story 2 - Every OS route is tested on any machine (Priority: P2)

A fake `uname` on PATH makes `install.sh` take the macOS, Linux, Git Bash and unknown-OS routes.

**Acceptance Scenarios**:

1. **Given** `uname` prints `Linux`, **When** `install.sh` runs, **Then** it prints that the Linux installer is not implemented and exits 1.

### Edge Cases

- The scenarios copy the current `installers/` into the fixture repo before each run, so they always test the scripts as they are.
- Backup folder names hold the date and time; output compares `<timestamp>`.

## Requirements *(mandatory)*

- **FR-001**: Each README Usage promise MUST have a scenario: links, seed-once, one backup folder per run, mirrored source paths, `.2` suffixes, no folder on a clean run, uninstall removes links only.
- **FR-002**: Each `install.sh` OS route MUST have a scenario.
- **FR-003**: Scenarios MUST run with a private HOME and never touch the real one.
- **FR-004**: The scripts MUST NOT change in this feature.

## Success Criteria *(mandatory)*

- **SC-001**: 13 scenarios pass on macOS and on the Linux CI runner.
