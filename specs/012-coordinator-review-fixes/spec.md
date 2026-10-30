# Feature Specification: Fix the coordinator's three review findings

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-29

**Status**: Implemented 2026-10-29

**Input**: A review of `agents/coordinator.md` from another AI chat (ChatGPT), which V forwarded with: "verify carefully, thoroughly before applying anything, check its correctness/clarity first". All three findings were checked against the files and the tool before any change; `research.md` has the evidence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A named file does not skip the classification (Priority: P1)

Review finding P1. NAV-Q1 asked "Does the request name a file or folder?" and sent YES straight to NAV-Q5, so "change validation in atlas.mjs" skipped NAV-Q3, where a tool change goes to a spec with its scenarios first.

**Acceptance Scenarios**:

1. **Given** "change validation in atlas.mjs", **When** the coordinator walks the NAV tree, **Then** NAV-Q1 is NO (a change is asked), it explains `atlas.mjs` as input, and NAV-Q3 sends the change to a spec with its scenarios first.
2. **Given** "where is module-boundaries.md and what depends on it?", **When** the coordinator walks the tree, **Then** NAV-Q1 is YES: it answers from `atlas.mjs --explain` and stops.

### User Story 2 - A folder can be explained (Priority: P2)

Review finding P2, first part. `--explain` on a folder whose files are all mapped said "not on the map" and exited 1, and NAV-Q1 then told the coordinator to escalate a map gap that did not exist.

**Acceptance Scenarios**:

1. **Given** a folder with mapped files, **When** `atlas.mjs --explain <folder>` runs, **Then** it prints the folder, its file count and one line per kind: the kind, its file count there, its place in the tree and its area page with the kind's anchor. It exits 0.
2. **Given** a folder with no mapped files, **When** it runs, **Then** it prints `<dir>/: no mapped files under this folder` and exits 1. The NAV tree says this is not a map gap.

### User Story 3 - "What depends on it" lists every reference and follows the declared chains (Priority: P2)

Review finding P2, second part. The finding understated the gap: "linked from" found 6 of the 19 files that name `module-boundaries.md`. It missed paths written relative to a folder above the citing file (`foundations/design/module-boundaries.md`), `../design/…` paths and the installed form `{{AGENT_HOME}}/…`. It did not follow any chain onward either. Spec 009's User Story 3 had been marked done.

**Acceptance Scenarios**:

1. **Given** a file named by other files of the same repo, written relative to the citing file, repo-relative, in the installed form, or relative to a folder above the citing file, **When** `--explain` runs, **Then** "linked from (direct)" lists every one of them, and never the file itself or a generated atlas page.
2. **Given** declared edges between kinds, **When** `--explain` runs, **Then** "depends on it (declared chains)" lists the files that depend on it through those edges, up to 4 levels. Each line names the edge (`from-kind: via`), and each file sits under the nearest file it depends on.
3. **Given** a path that several files end with, **Then** it resolves to the file whose folder is nearest the citing file.
4. **Given** the real registry, **When** `--explain foundations/design/module-boundaries.md` runs, **Then** the direct list matches a `grep` of the repo and the chains reach the role, its three wrappers, the preset skill, the four stacks and the four stack skills.

## Requirements *(mandatory)*

- **FR-001**: NAV-Q1 MUST test for a lookup (no change asked), not for a named path. A named path is explained as input, and the request is then classified through NAV-Q2 to NAV-Q5.
- **FR-002**: `--explain` MUST accept a folder (US2).
- **FR-003**: `--explain` MUST print `listed on`, `linked from (direct)` and `depends on it (declared chains)` as separate lines. The coordinator's reply MUST keep the direct references and the chains apart.
- **FR-004**: Only edges declared in `atlas.yaml` make a chain. A reference with no edge for its kinds shows only as direct.
- **FR-005**: `atlas.yaml` MUST declare the real dependencies its chains were missing: skill → foundation, stack and paradigm; stack → knowledge doc; paradigm → knowledge doc. Each MUST name the check that guards it.
- **FR-006**: Scenarios change first. Every rule of reference finding and every branch of the walk MUST be caught by a scenario when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/atlas` passes: 34 scenarios, up from 26.
- **SC-002**: Sabotaging any of the 11 explain rules and branches fails a scenario (11 of 11). Switching off any of the 15 `fail`/`warn` calls fails a scenario (15 of 15).
- **SC-003**: For `module-boundaries.md`, the direct list has 18 files, up from 6. That matches `grep`: 20 hits, less the generated map page and the file itself.

## Out of scope

- References across repos (agent-config ↔ a reference repo): the walk stays within one repo.
- Mentions without a file extension ("the module-boundaries foundation") are not found.
