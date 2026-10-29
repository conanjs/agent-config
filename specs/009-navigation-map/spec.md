# Feature Specification: A navigation map and coordinator for agent-config

**Feature Branch**: (not started)

**Created**: 2026-10-29

**Status**: Draft — a proposal; needs V's choices (Open questions) before planning

**Input**: V: "later I will also need a coordinator/controller/orchestrator to know the navigation table, what to do, and so on for hierarchical trees, branches, chains for every thing, so they can link and know. One person onboarding this cannot know everything."

## Problem, measured on 2026-10-29

- 407 Markdown/TOML files under `copilot/`, `skills/`, `claude/`, `codex/`, `proposals/`, `specs/`, `templates/` and the root docs.
- 32 separate `index.md` files and four framework indexes (knowledge, company-kb, agentic-sdlc, agent-foundry), but no single map that says which kinds of artifact exist, where each lives, what checks it and what it connects to.
- 63 files are not linked or named by path from any other file. Most are role wrappers and skills found only by a naming convention (`sdlc-<role>`), so a reader cannot reach them by browsing.
- The connections that exist are checked one pair at a time (a rule's `Source` ↔ the knowledge doc's `Used by`, a role's Preset ↔ its preset skill, a wrapper ↔ its role), but nothing shows the whole chain, or answers "what depends on this file?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find where to start (Priority: P1)

A newcomer or an agent with a task ("add a stack", "change a validator", "write a knowledge doc") opens one map and is sent to the right entry point, the procedure to follow, and the checks that will run.

**Acceptance Scenarios**:

1. **Given** the map, **When** a reader looks up "role wrapper", **Then** they find its home (`copilot/agents/`, `claude/agents/`, `codex/agents/`), its schema (`role-wrapper/v1`), the validator check that guards it (`WRAP` in `validate.mjs`), its scenarios (`tests/validate-sdlc/`), how it is deployed (`mapping.yaml`), and what it links to (the role in `agents/<role>.md`).

### User Story 2 - No file is unreachable (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a new file in a folder the map does not register, **When** `scripts/check-docs.sh` runs, **Then** it fails and names the file and the nearest registered kind.

### User Story 3 - Follow a chain both ways (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a knowledge doc, **When** a reader or agent asks what depends on it, **Then** the map lists the rules that cite it, the roles that preset those rules, the wrappers and skills of those roles, and the stacks that reference it.

## Options (for decision)

| Option | What | Pros | Cons |
|---|---|---|---|
| A. Hand-written map | One `MAP.md` table: kind → home, schema, index, validator, tests, deployment, links | Quick; readable | Drifts like any second copy (principle I); nothing checks it |
| **B. Registry + validator + generated views** (recommended) | One `atlas.yaml` registry of artifact kinds and edge types; a validator (with Cucumber scenarios) fails on unregistered files, kinds without schema/validator/tests, and broken edges; the readable map and "Where to go" tables are generated from it | One source of truth; every file reachable; the map cannot drift; agents can read the YAML directly | A new tool to build and keep (with its own spec and scenarios) |
| C. B plus a graph query tool | B, plus an index of every edge so "what depends on X" is one command (like the code-review-graph tool for code) | Impact analysis before a change | Most work; worth it only once B shows the edge types hold |

A coordinator then reads the registry: the agentic-sdlc Orchestrator already routes project missions; for this repo it would route maintenance tasks ("add a stack", "change a validator") to the procedure, the spec workflow and the checks the registry names.

## Open questions

1. Option A, B or C? (Recommended: B now, C later.)
2. Should the coordinator be a new agent role, or an extension of the existing Orchestrator with a "repo maintenance" mission type?
3. Does the map cover the reference repos too (stack → reference repo → its specs and tests), or only agent-config?

## Requirements (draft, for option B)

- **FR-001**: One registry MUST list every artifact kind with: home globs, schema, index, validator check codes, scenario feature, deployment (`mapping.yaml` entry or "not deployed"), and outgoing edge types.
- **FR-002**: The validator MUST fail on a file that matches no registered kind, and on a kind that names a schema, index, validator or feature that does not exist.
- **FR-003**: Edges already checked pairwise (Source ↔ Used by, Preset ↔ preset skill, wrapper ↔ role) MUST be declared in the registry so the map can show whole chains.
- **FR-004**: The readable map MUST be generated from the registry, never edited by hand.

## Success Criteria

- **SC-001**: 0 unreachable files (today: 63).
- **SC-002**: Every artifact kind has a schema, a validator check and scenarios, or is listed as exempt with a reason.
