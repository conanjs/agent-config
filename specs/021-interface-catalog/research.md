# Research: An interface catalog for the workflow-graph tool

The standards were researched first, on 2026-11-03, and are recorded in the knowledge base:
- `copilot/knowledge/documentation/interface-description-standards.md` (reference);
- `opencli-deep-dive.md`, `usage-spec-deep-dive.md` and `cli-description-formats-deep-dive.md` (deep dives).

Decision numbers continue from spec 020 (D21–D36): D37–D49 are the design, D50–D54 were found while building.

## Decisions

| # | Question | Options | Proposed | Why |
|---|---|---|---|---|
| D37 | Which format describes the CLI | usage spec (KDL 2.0) · OpenCLI opencli.org (JSON, draft 0.1) · OpenCLI opencli.dev (YAML, 1.0.0-alpha.16) · prose only | **usage**, **for V to confirm** | Only usage can say all of: exit codes per command, stdout outputs with a JSON Schema (the hook verdicts), `effect` (read/write/destructive, so an agent can tell `status` from `run start`), and a breaking-change check (`usage diff`). opencli.org has no types, defaults or env vars; opencli.dev has no output formats, and its fixed exit statuses cannot say "a check failed". Cost: KDL is a new syntax, and the `usage` binary is Rust (optional, D45) |
| D38 | Which side is the source | The description file (contract-first) · the code, exporting the description (code-first) | **The description file** | CON-1. Node's `util.parseArgs` has no usage or OpenCLI exporter, so code-first would mean writing our own exporter. Instead, a test compares each handler's option table with the file |
| D39 | How payloads and files are described | JSON Schema 2020-12 · TypeScript types exported · prose tables | **JSON Schema 2020-12** | Language-neutral; what OpenAPI, AsyncAPI and usage's `output` embed; editors can validate `workflow.graph.yaml` with it |
| D40 | How hook inputs, which the agents' vendors own, are described | The full vendor format · only the fields the tool reads | **Only the fields read**, `additionalProperties: true`, each field citing the knowledge reference it was verified in | CON-10 tolerant reader; we cannot promise a vendor's whole format, and we must not break when they add fields |
| D41 | Where environment variables are listed | In the usage spec · a hand-written table · a table generated from a code list | **Generated from `ENVIRONMENT` in `CompositionRoot.ts`** | Six of the eight back no flag, and usage only describes variables that back a flag or a config key; the code must read the list anyway, so it is the one source |
| D42 | Catalog format | `INTERFACES.md` only · Backstage `catalog-info.yaml` only · both | **Both**, checked to list the same entries | People read Markdown; programs read the Backstage format, the most widely used repo-catalog convention (`kind: API`, `spec.definition`, `providesApis`/`consumesApis`) |
| D43 | What counts as an interface | Everything the tool touches · only what others may rely on | **Everything, marked public or internal** | Internal files (run settings, launch journal, checkpoints) are still in the user's project; listing them as internal says "don't build on this" instead of leaving people to guess |
| D44 | `--help` text | Hand-written strings in each handler · rendered from the usage spec | **Rendered from the spec** | One source, so help cannot disagree with the description. Loaded with `await import()` so hook latency is unchanged |
| D45 | `usage` binary in the checks | Required · optional · not used | **Optional**: `check-docs.sh` runs `usage lint` and `usage diff --breaking` when installed | Keeps the repo installable with Node only; the parser-level drift tests (vitest) always run |
| D46 | usage syntax this design uses but the research did not read | — | Check `subcommand_required` and the variadic `[words]…` arg form on usage's arg and cmd reference pages before writing the spec file | The deep dive lists both as "not documented on the pages read" |
| D47 | Behaviour fixes found by the inventory | Leave · fix now | **Fix in this feature**: `--help`, `-h` and `help <cmd>` exit 0; `--version`; usage errors on stderr with exit 2; no stack traces | Without them the catalog would describe exit codes the tool does not keep: an unknown flag exits 1, which the catalog defines as "a check failed" |
| D48 | Framework rule | Advice in a knowledge doc · CON rules in `contract-design.md` | **CON-15 and CON-16, plus format rows** | So every project built with the framework gets a catalog, not just this repo |

| D49 | Where a run's files live | flat, `.specify/runs/<run>.<kind>` (specs 019 D3, 020) · one folder per run | **One folder per run**: `.specify/runs/<run>/{ledger.jsonl, run.json, launches.jsonl, checkpoints.db}`; `.specify/runs/.gitignore` holds `*/checkpoints.db*` | V, 2026-11-03: "it's many R-007 files located … right at the top of the folder runs, no sub-folder". The flat layout came from 019 D3, when the ledger was the only file; 020 added three files per run beside it. Changed before the catalog published the paths and before any real run depended on them. One class, `RunFolderLayout`, now names every path |

## Found while building (2026-11-03)

| # | Finding | Change |
|---|---|---|
| D50 | Only `system-architecture`, which runs for multi-service missions, loaded `contract-design.md`; in a single-repo run no role read CON-1 (contract before code) | The architecture role loads it in every mode (`agents/architecture.md`, `skills/sdlc-architecture-preset`) |
| D51 | The usage syntax the plan used but had not verified (D46) exists: `subcommand_required=#true` on `cmd`; a variadic arg as `[words]...` or `var=#true`; `example` child nodes | Used as planned; recorded in `usage-spec-deep-dive.md` |
| D52 | `workflow.graph.schema.md` listed the ledger's optional fields without `log`, which the approval hook writes | Added; the ledger-line JSON Schema (`additionalProperties: false`) now fails a test when code writes a field the schema lacks |
| D53 | All `record`, `check-run` and `status` shared one option table, so `status --node P3` was accepted silently; `verify-approvals --project X R-001` took `X` as the run id (hand parsing) | One option table per command, exposed as `static options`; `AgentCliHandler` uses `parseArgs`; both pinned by scenarios |
| D54 | `--help` routing: a usage error is now printed on stderr (exit 2), and parse errors from `node:util` become one line without a stack trace | `main.ts`; scenarios check stdout and stderr apart |

## Evidence: the inventory, 2026-11-03

| Probe | Result |
|---|---|
| `workflow-graph status --help` | `TypeError [ERR_PARSE_ARGS_UNKNOWN_OPTION]` with a stack trace on stderr, exit 1 |
| `workflow-graph record R-1 --bogus x` | The same, exit 1 |
| `workflow-graph --version` | One-line usage on stdout, exit 2 |
| `workflow-graph run` | `run start` usage on stdout, exit 2 |
| Environment variables read by `readConfig` | 8: `WORKFLOW_GRAPH_FRAMEWORK`, `WORKFLOW_GRAPH_NOW`, `AGENTIC_SDLC_GUARD`, `COPILOT_HOME`, `WORKFLOW_GRAPH_CLAUDE`, `WORKFLOW_GRAPH_COPILOT`, `WORKFLOW_GRAPH_CODEX`, `WORKFLOW_GRAPH_FAKE_REPLIES` |
| Argument parsing | `WorkflowCliHandler` and `RunCliHandler` use `parseArgs`; `AgentCliHandler` uses `indexOf`, so an unknown flag is silently ignored there |
| Existing description | `specs/019-workflow-graph/contracts/cli.md`: no `run` command; lists only 3 of the 8 environment variables |

## Packages checked (npm registry, 2026-11-03)

| Package | Version, date | Use |
|---|---|---|
| `@bgotink/kdl` | 0.4.1, 2026-10-13; MIT; no dependencies; KDL 2.0 (KDL 1 through `v1-compat`) | Read the usage spec |
| `kdljs` | 0.3.0, 2025-01-08 | Not chosen: older, and its KDL 2.0 support was not checked |
| `ajv` | 8.20.0, 2026-04-24 | JSON Schema 2020-12 validation in tests |
