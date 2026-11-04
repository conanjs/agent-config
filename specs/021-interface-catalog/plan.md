# Implementation Plan: An interface catalog for the workflow-graph tool

**Spec**: `spec.md` · **Research and decisions**: `research.md` (D37–D48) · **Standards**: `copilot/knowledge/documentation/interface-description-standards.md` and its three deep dives

## Summary

Each way to talk to the tool gets **one source** of description. Every other form of it is either generated from that source or checked against it:

| Interface kind | Source | Generated or checked |
|---|---|---|
| Commands, flags, arguments, exit codes | `interfaces/workflow-graph.usage.kdl` (usage spec) | `--help` text is rendered from it; a test compares it with each handler's option table |
| JSON files and hook payloads | `interfaces/schemas/*.schema.json` (JSON Schema 2020-12) | Scenario ledger lines and hook fixtures are validated against them |
| Environment variables | The `ENVIRONMENT` list in `CompositionRoot.ts`, which `readConfig` reads | The table in `INTERFACES.md` is generated between markers |
| The list of all interfaces | `INTERFACES.md` (people) + `catalog-info.yaml` (programs) | A test checks the two list the same entries, and that every description file exists |

`contract-design.md` gains the rules that make every repo do the same.

## Technical Context

- **Tool:** TypeScript on Node.js 24, type stripping, class-modeled paradigm, stack reference v4.2.0 (`bfa17067`).
- **New runtime dependency:** `@bgotink/kdl` 0.4.1 (MIT, no dependencies, KDL 2.0). Loaded with `await import()` only on the help path, so the hooks (0.08–0.10 s) never load it.
- **New dev dependency:** `ajv` 8.20.0 (2026-04-24), for the JSON Schema 2020-12 checks in tests. Both versions pass pnpm's `minimumReleaseAge`.
- **Optional:** the `usage` binary 7.1.5. `check-docs.sh` runs `usage lint` and `usage diff --breaking` when it is on `PATH`, and otherwise prints one "skipped: usage not installed" line.
- **Tests:** vitest 5.0.5 for the drift tests; Cucumber scenarios for `--help`, `--version`, usage errors and the planted faults.

## Constitution Check

| Principle | How this design meets it |
|---|---|
| CON-1 Contract before code | The usage spec and the schemas are the sources; the code is checked against them |
| CON-10 Tolerant reader | Hook *input* schemas list only the fields the tool reads and allow any others (`additionalProperties: true`), because the coding agents own those formats |
| CON-13 Compatibility checked automatically | `usage diff --breaking` against the last tag |
| Pin Before You Change (pattern) | New scenarios pin today's commands and exit codes before `main.ts` changes; each drift check is shown to catch a planted fault |
| No Shorthand In Answers / KB-6 | `INTERFACES.md` defines each term at first use and gives one example per command |
| Class-modeled (PDM) | New behaviour lives in classes with constructor-injected ports (below); `main.ts` stays a thin entry point |

## Architecture

### 1. Files

```text
copilot/frameworks/agentic-sdlc/tools/workflow-graph/
├── INTERFACES.md                     ← people start here
├── catalog-info.yaml                 ← programs start here (Backstage format)
└── interfaces/
    ├── workflow-graph.usage.kdl      ← the CLI
    └── schemas/
        ├── workflow-graph.schema.json        workflow.graph.yaml and .json (shape; rules stay in schemas/workflow-graph.schema.md)
        ├── ledger-line.schema.json           .specify/runs/<run>/ledger.jsonl, one per line
        ├── run-settings.schema.json          .specify/runs/<run>/run.json (internal)
        ├── launch-journal-line.schema.json   .specify/runs/<run>/launches.jsonl (internal)
        └── hooks/
            ├── claude-code.schema.json       $defs: guardInput, guardOutput, approveInput
            ├── copilot-cli.schema.json       $defs: guardInput, guardOutput, approveInput, approveOutput
            ├── codex.schema.json             $defs: guardInput, guardOutput, approveInput
            └── guard-output.schema.json      oneOf the three guardOutput $defs (the usage spec's `output` points here)
agent-config/
├── INTERFACES.md                     ← every tool in the repo; workflow-graph described, the rest "not yet"
└── catalog-info.yaml                 ← kind: Location, pointing at each tool's catalog-info.yaml
```

### 2. The inventory: what the catalog lists

| # | Interface | Kind | Direction | Visibility · lifecycle | Described by |
|---|---|---|---|---|---|
| 1 | The `workflow-graph` CLI: `check-graph`, `compile-graph`, `record`, `check-run`, `status`, `hook guard\|approve`, `verify-approvals`, `run start\|approve\|resume`, plus `--help` and `--version` | CLI | provides | public · experimental | `workflow-graph.usage.kdl` |
| 2 | Exit codes: 0 success; 1 a check failed and nothing was written; 2 usage error; `hook` always 0 (a failure becomes a deny) | CLI | provides | public · experimental | `exit_code` nodes in the usage spec |
| 3 | Hook JSON for Claude Code: `PreToolUse` on `Agent` in, verdict out; `UserPromptSubmit` in | stdin/stdout JSON | consumes the agent's input; provides the output | public · experimental (input format owned by Anthropic) | `hooks/claude-code.schema.json` |
| 4 | Hook JSON for Copilot CLI: `preToolUse` on `task`; `userPromptSubmitted`, answered `{}` | stdin/stdout JSON | same | same (owned by GitHub) | `hooks/copilot-cli.schema.json` |
| 5 | Hook JSON for Codex: `PreToolUse` (matcher `*`, `task_name` convention); `UserPromptSubmit` | stdin/stdout JSON | same | same (owned by OpenAI) | `hooks/codex.schema.json` |
| 6 | The graph: `workflow.graph.yaml` (source) and `workflow.graph.json` (generated) | file | consumes; `compile-graph` provides the JSON | public · production (graph 2.0.0) | `workflow-graph.schema.json` for shape; `schemas/workflow-graph.schema.md` for rules WG-1 … WG-37 |
| 7 | The run ledger: `.specify/runs/<run>/ledger.jsonl` | file, JSON Lines | provides (`record`, hooks, runner); consumes (`check-run`, `status`) | public · experimental | `ledger-line.schema.json` |
| 8 | Run settings: `<run>/run.json` | file | runner only | internal | `run-settings.schema.json` |
| 9 | Launch journal: `<run>/launches.jsonl` | file, JSON Lines | runner only | internal | `launch-journal-line.schema.json` |
| 10 | LangGraph checkpoints: `<run>/checkpoints.db` | SQLite file | runner only | internal; not described (LangGraph owns the format; git-ignored) | — |
| 11 | Launch prompt sent to role agents; role reply read back (`message/v2`) | text protocol | provides the prompt; consumes the reply | public · production (framework) | `schemas/launch-prompt.schema.md`, `schemas/message.schema.md` (framework) |
| 12 | Headless agent calls: `claude -p`, `copilot -p`, `codex exec` | CLI | consumes | vendor-owned | knowledge refs: `claude-code-usage-reference.md`, `copilot-usage-reference.md`, `codex-usage-reference.md` |
| 13 | Session logs read by `verify-approvals` | files | consumes | vendor-owned | the same knowledge refs and `specs/019 contracts/coding-agent.md` |
| 14 | Environment variables (8): `WORKFLOW_GRAPH_FRAMEWORK`, `WORKFLOW_GRAPH_CLAUDE`, `_COPILOT`, `_CODEX`, `COPILOT_HOME` (user); `AGENTIC_SDLC_GUARD` (human only); `WORKFLOW_GRAPH_NOW`, `WORKFLOW_GRAPH_FAKE_REPLIES` (test only) | environment | consumes | public, except *test only* | generated table in `INTERFACES.md` |
| 15 | Installation glue: `workflow-graph-hook.sh` (finds Node.js ≥ 24.12) and `copilot/hooks/workflow-graph.json` (hook registration per agent) | integration | provides | public · experimental | a section in `INTERFACES.md` |

### 3. `catalog-info.yaml` (excerpt)

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: workflow-graph
  description: Checks and records agentic-sdlc runs against the workflow graph; runs roles headless
spec:
  type: tool
  lifecycle: experimental
  owner: user:vinh-doq
  providesApis: [workflow-graph-cli, workflow-graph-ledger, workflow-graph-hooks-claude-code, workflow-graph-hooks-copilot-cli, workflow-graph-hooks-codex]
  consumesApis: [workflow-graph-file]
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: workflow-graph-cli
  description: Every command, flag, argument and exit code
spec:
  type: usage
  lifecycle: experimental
  owner: user:vinh-doq
  definition:
    $text: ./interfaces/workflow-graph.usage.kdl
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: workflow-graph-ledger
  description: One JSON object per line in .specify/runs/<run>/ledger.jsonl, hash-chained
spec:
  type: jsonschema
  lifecycle: experimental
  owner: user:vinh-doq
  definition:
    $text: ./interfaces/schemas/ledger-line.schema.json
```

`spec.type` accepts any value; `usage` and `jsonschema` are this repo's values (Backstage only renders its well-known types specially). Internal files (#8–#10) are not `API` entities; they appear only in `INTERFACES.md`, marked internal.

### 4. `INTERFACES.md` (outline)

1. **What this tool is, in one paragraph**, and how to call it: `node <path>/src/main.ts <command>`, or through the hook launcher.
2. **Interfaces at a glance**: the inventory table above, each row linking to its description file.
3. **Commands**: one short block per command, with synopsis, one example, effect and exit codes. This part is *generated* from the usage spec (D44), so it cannot disagree with `--help`.
4. **Exit codes**: one table.
5. **Environment variables**: the generated table, with name, default, audience and meaning.
6. **Files**: path pattern, who writes and who reads, public or internal, and a schema link with one sample line.
7. **Hooks**: per agent, the event, the matcher, a link to the input and output schema, and one sample.
8. **Stability and versioning**: what *experimental* promises, and that a breaking change to a public interface needs a version bump and a note in the change log (CON-9, CON-12).
9. **How the catalog is kept true**: the drift checks.

### 5. `workflow-graph.usage.kdl` (excerpt)

```kdl
name "Workflow graph"
bin "workflow-graph"
version "0.1.0"
about "Checks and records agentic-sdlc runs against the workflow graph; runs roles headless"

exit_code 0 "success"
exit_code 1 "a check failed; nothing was written"
exit_code 2 "usage error (message on stderr)"

cmd "status" effect="read" help="Show where runs stand: last step, open gate, next allowed, tasks and retries left" {
  arg "[run]" help="Run id, e.g. R-001; every open run when left out"
  flag "--project <dir>" help="Project folder; default the working folder"
}

cmd "hook" subcommand_required=#true help="Called by coding agents, not by people" {
  cmd "guard" effect="write" help="Allow or deny a role launch; reads the agent's hook JSON on stdin" {
    flag "--agent <agent>" required=#true {
      choices "claude-code" "copilot-cli" "codex"
    }
    output "json" media_type="application/json" framing="json" default=#true {
      schema file="schemas/hooks/guard-output.schema.json"
    }
    exit_code 0 "always; any failure becomes a deny in the JSON"
  }
}

cmd "run" subcommand_required=#true help="The headless runner" {
  cmd "approve" effect="write" help="Approve (or, with --changes, send back) an open gate; asks for confirmation on the terminal" {
    arg "<run>"
    arg "<gate>" help="G0 … G5"
    arg "[words]…" help="Your reason, kept in the ledger"
    flag "--changes" help="Request changes instead of approving"
    flag "--project <dir>"
  }
}
```

**Before writing:** confirm `subcommand_required` and the `[words]…` variadic form against the usage arg and cmd reference pages, which were not read in the research (D46).

### 6. Code changes (class-modeled)

**As built:** the catalog classes live in their own module, `src/modules/catalog/`, loaded through `src/CatalogRoot.ts` only by `help`, `--help` and `interfaces`. The drift check is a command, `workflow-graph interfaces [--write] [--root <dir>]`, so `check-docs.sh` and a person run the same check. Usage errors are routed to stderr by exit code 2 in `main.ts`, not by a new `err` field. `hooks/approve-output.schema.json` was added beside `guard-output.schema.json`.

| Unit | Layer | Responsibility |
|---|---|---|
| `CliDescription` (value object) | shared/domain | Commands → flags (name, takes a value, repeatable, required), args, exit codes, effect; built only through its factory, which rejects duplicate commands |
| `CliDescriptionSource` (port) | shared/domain/ports | `load(): Promise<Result<CliDescription, string>>` |
| `UsageSpecFile` (adapter) | shared/infrastructure | Reads the `.usage.kdl` with `@bgotink/kdl` |
| `HelpPresenter` | shared/interface/cli | Renders the help for the tool or for one command from a `CliDescription` |
| `CliEntry` | `main.ts` support, Tier B | Handles `--help`, `-h`, `help <cmd>` and `--version` before dispatch. It turns `ERR_PARSE_ARGS_*` errors into `usage: …` on **stderr** with exit 2, and loads the help path with `await import()` |
| Handlers | interface/cli | Each exposes its `parseArgs` option table as `public static readonly options`. `AgentCliHandler` switches from `indexOf` parsing to `parseArgs`, so every table can be compared |
| `CommandOutput` | shared/domain | Gains `err` (stderr text) beside `out`. `main.ts` writes each to its stream |
| `ENVIRONMENT` | `CompositionRoot.ts` | A frozen list of `{ name, default, audience, meaning }`; `readConfig` reads only names on this list |

### 7. Drift checks

| Check | How | Fails when |
|---|---|---|
| Commands | vitest: the names in `compose()` and each handler's sub-commands equal the usage spec's `cmd` tree | A command exists on one side only |
| Flags | vitest: each handler's `options` equals the spec's flags for that command (name, `<value>` versus boolean, `var`) | A flag is missing, extra, or a different kind |
| Environment | vitest: `ENVIRONMENT` names equal the generated table between `<!-- generated:environment -->` markers, and `readConfig` reads no `env[...]` name outside the list (source scan) | A variable is undocumented |
| Commands section of `INTERFACES.md` | vitest: re-render from the spec and compare (as `check-graph` does for `conventions.md`) | The section was edited by hand or the spec changed |
| Schemas | Cucumber: every ledger line written by a scenario validates against `ledger-line.schema.json`; vitest: hook contract-test fixtures validate against the agent's schema | A field is added in code only |
| Catalog | vitest: `INTERFACES.md` rows equal `catalog-info.yaml` `API` entities plus the internal rows; every `definition.$text` file exists | An entry exists on one side only |
| usage lint / diff | `check-docs.sh`, only when `usage` is installed: `usage lint -W`, then `usage diff <last tag> <now> --breaking` | Lint errors; a breaking change |
| Planted faults | One scenario per check that removes a flag or env name in a temporary copy and expects the failure | A check that catches nothing |

### 8. Framework change (`foundations/design/contract-design.md`)

| Id | Rule (proposed text) |
|---|---|
| CON-15 | Publish an interface catalog. A repo lists every interface other programs or people use: commands, files, payloads, environment variables, APIs, events and libraries. The list goes in `INTERFACES.md` and a Backstage-format `catalog-info.yaml`; each entry gives the kind, direction, lifecycle, visibility and a link to its machine-readable description. |
| CON-16 | Descriptions are checked against the code. Each interface has one source, and its other forms are generated from it or tested against it. A difference fails the build. |

**New format rows:**

| Interaction | Format | Lives in |
|---|---|---|
| Command-line program | usage spec (KDL), or OpenCLI (opencli.org) for .NET/Spectre | `<tool>/interfaces/<tool>.usage.kdl` |
| JSON files, JSON Lines records, stdin/stdout payloads | JSON Schema 2020-12 | `<tool>/interfaces/schemas/*.schema.json` |
| Environment variables | A table in the catalog, generated from the code's declaration | `INTERFACES.md` |
| TypeScript library | API Extractor report | `etc/<package>.api.md` |

Both rules get `Source: knowledge/documentation/interface-description-standards.md`. The architecture role's P4 output "contracts" then includes the catalog, and P7 close-out checks it.

## Not now

- Catalogs for the other tools (validators, tracker, atlas, installers, hook scripts): one spec each, tracked from the root catalog.
- Shell completions, man pages, SDKs and an MCP server from the usage spec (`usage generate …`, `usage mcp`).
- A `--json` output for `status` and `check-run`. The usage spec makes it cheap to add later with `output`/`select`.
