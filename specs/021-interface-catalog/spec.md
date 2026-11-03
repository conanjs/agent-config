# Feature Specification: An interface catalog for the workflow-graph tool

**Feature Branch**: `feat/interface-catalog`, cut from `feat/workflow-runner` (spec 020, committed locally as `4a9eb9f`)

**Created**: 2026-11-03

**Status**: Implemented 2026-11-03. V approved the design with usage as the CLI format, and one folder per run (D49). Not yet run: the `usage` CLI's own lint (not installed, D45)

**Input**: V, 2026-11-03: "You don't provide the interface of this program for me or others to read and understand, like openapi to doc every API endpoint or catalog of supported API … each repo should have its own exposed interface so the outer/external programs/persons can read and understand, how to communicate." Then: "Design the interface catalog design for the workflow-graph tool."

## Why

The workflow-graph tool is called by people (`run start`, `status`), by three coding agents through hooks (`hook guard`, `hook approve`), by the repo's checks (`check-graph`) and by other tools that read its files (the run ledger). None of these callers can learn the interface without reading the TypeScript.

The only description is `specs/019-workflow-graph/contracts/`. It is prose, written before the code, and already wrong:
- it has no `run` command;
- three of the eight environment variables are missing (`WORKFLOW_GRAPH_FRAMEWORK`, `_FAKE_REPLIES`, and the `_CLAUDE`/`_COPILOT`/`_CODEX` program overrides);
- it is not next to the tool, and nothing checks it.

Taking the inventory also turned up behaviour that breaks common CLI rules (clig.dev). Each was checked on 2026-11-03:

| Command typed | What happens | Why it is wrong |
|---|---|---|
| `workflow-graph status --help` | Node prints a `TypeError [ERR_PARSE_ARGS_UNKNOWN_OPTION]` stack trace; exit 1 | `--help` must always work; exit 1 means "a check failed" in this tool |
| `workflow-graph record R-1 --bogus x` | The same stack trace; exit 1 | A usage error must exit 2 with a usage line |
| `workflow-graph --version` | The one-line usage; exit 2 | No way to ask which version is installed |
| any usage error | Printed on stdout | Messages belong on stderr; stdout is data |

The standards were researched first. They are recorded in `copilot/knowledge/documentation/interface-description-standards.md` and in three deep dives (OpenCLI, usage, the other CLI formats).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A person learns the tool without the code (Priority: P1)

V or a teammate opens `INTERFACES.md` next to the tool. From it they can find:
- every command with its flags, arguments and exit codes;
- every environment variable;
- every file the tool reads or writes;
- the JSON each hook takes and returns;
- which of these are stable and which are internal.

**Acceptance:**
1. **Given** the catalog, **when** V wants to approve a gate from the terminal, **then** the `run approve` entry shows its synopsis, an example and its exit codes, with no need to open `RunCliHandler.ts`.
2. **Given** any command, **when** V types `<command> --help`, **then** help prints, the exit code is 0 and there is no stack trace.
3. **Given** `workflow-graph --version`, **then** the tool's version prints with exit 0.

### User Story 2 - A program learns the tool from machine-readable files (Priority: P1)

Another tool, CI job or AI agent reads `catalog-info.yaml`. It follows each entry to that interface's description:
- the CLI's usage spec;
- a JSON Schema for each file and hook payload.

**Acceptance:**
1. **Given** `catalog-info.yaml`, **then** every interface listed in `INTERFACES.md` has an entry with a kind, a lifecycle, an owner and a description file, and no entry is missing from either file.
2. **Given** a ledger line written by any scenario, **then** it validates against `ledger-line.schema.json`.
3. **Given** the CLI description, **then** each command says whether it reads, writes or destroys state (`effect`). An agent can then tell `status` (read) from `record` (write).

### User Story 3 - The description cannot drift (Priority: P1)

A developer adds a flag in code but not in the description, or the other way round. The repo's checks fail with a message that names the command and the flag.

**Acceptance:**
1. **Given** a flag present only in a handler's option table, **when** `scripts/check-docs.sh` runs, **then** it fails and names the command and flag.
2. **Given** a new environment variable read in `readConfig` but missing from the catalog's table, **then** the check fails.
3. **Given** a change that breaks an old command line (a flag removed, an argument made required), **when** the `usage` tool is installed, **then** the breaking-change check fails against the last released description.

### User Story 4 - Every repo is asked for a catalog (Priority: P2)

The agentic-sdlc framework requires each repo to publish an interface catalog and to check it against the code. Role agents then build one into every project, not just this one.

**Acceptance:**
1. **Given** `contract-design.md`, **then** it has a rule for the catalog, a rule for the drift check, and format rows for CLIs, JSON files and payloads, environment variables and libraries.
2. **Given** agent-config's root, **then** `INTERFACES.md` lists every tool in the repo. Tools not yet described are marked so, which keeps the gap visible.

## Requirements *(mandatory)*

- **FR-001** The tool folder holds `INTERFACES.md` (for people) and `catalog-info.yaml` (Backstage descriptor format, for programs), listing the same interfaces.
- **FR-002** The CLI is described in one `usage` spec, `interfaces/workflow-graph.usage.kdl`. It covers every command, subcommand, flag, argument and exit code, and gives each command an `effect`.
- **FR-003** Each JSON the tool reads or writes has a JSON Schema 2020-12 under `interfaces/schemas/`:
  - the graph file;
  - the ledger line;
  - the run settings;
  - the launch journal line;
  - each agent's hook input and output.
- **FR-004** Environment variables are listed in one table, marked *user* or *test only*, and generated from the code's declaration list.
- **FR-005** Each interface has a lifecycle (`experimental`, `production`, `deprecated`). Each file is marked *public* (other tools may read it) or *internal* (it may change without notice).
- **FR-006** `--help`, `-h` and `help <command>` print help rendered from the usage spec, with exit 0. `--version` prints the package version. Usage errors go to stderr with exit 2 and never print a stack trace.
- **FR-007** Drift checks run in `scripts/check-docs.sh`:
  - the commands and option tables equal the usage spec;
  - the environment table matches the code;
  - scenario ledger lines and hook fixtures validate against their schemas;
  - when `usage` is installed, `usage lint` passes and `usage diff --breaking` passes against the last tag.
- **FR-008** `contract-design.md` gains CON-15 (interface catalog), CON-16 (descriptions checked against the code) and format rows. Each new rule cites `interface-description-standards.md`.
- **FR-009** agent-config's root `INTERFACES.md` and `catalog-info.yaml` list all of the repo's tools. Only workflow-graph is described in this feature.
- **FR-010** `specs/019-workflow-graph/contracts/` gets a header saying that the catalog has replaced it.

## Success Criteria *(mandatory)*

- **SC-001** A reader can answer the questions below from `INTERFACES.md` and its links alone (V's review):
  - how to start a run;
  - how to approve a gate;
  - what exit 1 means;
  - what a ledger line contains;
  - which environment variable turns the guard off.
- **SC-002** Every command answers `--help` with exit 0. No input produces a stack trace (scenarios).
- **SC-003** Removing one flag from the usage spec, or adding one only to the code, fails the checks (a planted-fault scenario, as the framework's "Pin Before You Change" pattern requires).
- **SC-004** The doc validators, lint, typecheck, unit tests and every Cucumber scenario still pass.

## Out of scope

- Describing the repo's other tools (the four validators, `tracker.mjs`, `atlas.mjs`, the installers, the hook scripts). They are listed in the root catalog as *not yet described*; each one is a later spec.
- Generating shell completions, man pages or SDKs, although usage can do all three.
- A Backstage server. The YAML follows Backstage's format so one could read it, but nothing here runs Backstage.
- Changing what any command does, beyond `--help`, `--version` and how usage errors are reported.
