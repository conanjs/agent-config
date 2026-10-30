# Feature Specification: A navigation map and coordinator for agent-config

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-29

**Status**: Implemented 2026-10-29, except User Story 3, which was only partly met; completed by `specs/012-coordinator-review-fixes/`

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

*Correction, 2026-10-29: this story was marked done, but the first `--explain` listed only 6 of the 19 files that name `module-boundaries.md` and did not follow any chain onward. A review found the gap; spec 012 closes it.*

**Acceptance Scenarios**:

1. **Given** a knowledge doc, **When** a reader or agent asks what depends on it, **Then** the map lists the rules that cite it, the roles that preset those rules, the wrappers and skills of those roles, and the stacks that reference it.

## Options (for decision)

| Option | What | Pros | Cons |
|---|---|---|---|
| A. Hand-written map | One `MAP.md` table: kind → home, schema, index, validator, tests, deployment, links | Quick; readable | Drifts like any second copy (principle I); nothing checks it |
| **B. Registry + validator + generated views** (recommended) | One `atlas.yaml` registry of artifact kinds and edge types; a validator (with Cucumber scenarios) fails on unregistered files, kinds without schema/validator/tests, and broken edges; the readable map and "Where to go" tables are generated from it | One source of truth; every file reachable; the map cannot drift; agents can read the YAML directly | A new tool to build and keep (with its own spec and scenarios) |
| C. B plus a graph query tool | B, plus an index of every edge so "what depends on X" is one command (like the code-review-graph tool for code) | Impact analysis before a change | Most work; worth it only once B shows the edge types hold |

A coordinator then reads the registry: the agentic-sdlc Orchestrator already routes project missions; for this repo it would route maintenance tasks ("add a stack", "change a validator") to the procedure, the spec workflow and the checks the registry names.

## Clarifications

### Session 2026-10-29

- Q: Option A, B or C? → A: **B** — one registry, a validator, generated views (V).
- Q: A new coordinator role, or the Orchestrator with a "repo maintenance" mission type? → A: **a new coordinator agent role** (V), compared below.
- Q: Does the map cover the reference repos too? → A: **Yes, everything**, however deeply nested: agent-config, the reference repos and their maintained variants. Every node is linked from another node above it in the tree, so nothing is reachable only by knowing its name (V).

### Coordinator: the options compared

| | A. New coordinator role (chosen) | B. Orchestrator + "repo maintenance" mission | C. A navigator skill only |
|---|---|---|---|
| Job | Knows the map: answers "where is X, what checks it, what depends on it, where do I start", and keeps the registry true (proposes entries for new files) | The Orchestrator would also route maintenance work, next to project missions | Any agent loads the map as a skill and finds its own way |
| Entry point | Invoked directly by a person onboarding or by any agent; the Orchestrator asks it at P0 when a mission touches framework or repo files | Only through the Orchestrator's intake | Whichever agent is running |
| Fits the framework | A new row in `conventions.md` §1 with its own `agents/coordinator.md`, wrappers (Copilot, Claude, Codex) and preset skill, all checked by `validate.mjs` | Changes the Orchestrator's P0 table and grows its role file | Skill wrapper only; no role, no rubric |
| Context per call | Small: the registry and the asked-for chain | Large: the Orchestrator's whole workflow plus the map | Small, but every agent pays it |
| Ownership of the map | Clear: the coordinator owns `atlas.yaml` and its review | Shared with mission routing | Nobody |
| Risk | Two top-level agents: must say who decides what (the coordinator routes and explains; it never launches roles or runs gates) | One agent doing two jobs; project and repo work mix in one intake | The map drifts, because nobody maintains it |

Why A: it gives the map one owner, keeps the Orchestrator focused on missions, and is the one entry point a newcomer can ask without knowing the framework first. It reuses everything a role already has (wrappers, preset skill, rubric, validator checks). A thin "navigator" skill can still expose the registry to other agents later; it would read the coordinator's registry, not keep a second one.

## Requirements

- **FR-001**: One registry MUST list every artifact kind with: home globs, schema, index, validator check codes, scenario feature, deployment (`mapping.yaml` entry or "not deployed"), and outgoing edge types.
- **FR-002**: The validator MUST fail on a file that matches no registered kind, and on a kind that names a schema, index, validator or feature that does not exist.
- **FR-003**: Edges already checked pairwise (Source ↔ Used by, Preset ↔ preset skill, wrapper ↔ role) MUST be declared in the registry so the map can show whole chains.
- **FR-004**: The readable map MUST be generated from the registry, never edited by hand.
- **FR-005**: The registry MUST cover agent-config, each stack reference repo and each maintained variant branch, down to every file.
- **FR-006**: Every node except the root MUST have a parent edge (the tree: root → area → kind → folder → file), so every node is reachable by browsing; cross-links (chains) come on top of the tree, not instead of it.
- **FR-007**: A new `coordinator` role MUST own the registry: its role file, wrappers and preset skill follow the role schemas, and it routes and explains without launching other roles or running gates.

## Success Criteria

- **SC-001**: 0 unreachable files (today: 63 in agent-config alone), in agent-config and in every reference repo and variant.
- **SC-002**: Every artifact kind has a schema, a validator check and scenarios, or is listed as exempt with a reason.
