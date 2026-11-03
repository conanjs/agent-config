---
schema: deep-dive/v1
topic: documentation
status: verified
applies-to: ["OpenCLI draft 0.1 (opencli.org, spectreconsole/open-cli, change log to 2026-04-19)", "OpenCLI 1.0.0-alpha.16 (opencli.dev, bcdxn/opencli, ocli v1.3.0)", "sources read 2026-11-03"]
last-verified: 2026-11-03
last-updated: 2026-11-03
synthesized-into:
  - { path: documentation/interface-description-standards.md, on: 2026-11-03 }
tags: [opencli, cli, interface-description, contract-first, json-schema, spectre-console, dotnet, code-generation]
---

# OpenCLI: the two specifications that share one name

## Summary
**TL;DR:** "OpenCLI" is the name of **two unrelated specifications**. Both describe a command-line program in a machine-readable file, "like OpenAPI, but for CLIs".
- **OpenCLI at opencli.org** comes from the Spectre.Console authors. It is a JSON draft, version 0.1. It describes what a program accepts: commands, options, arguments and exit codes. Spectre.Console.Cli can export it, and the .NET SDK has said it intends to align with it.
- **OpenCLI at opencli.dev** comes from bcdxn and is a YAML/JSON spec, version `1.0.0-alpha.16`. It is contract-first: you write the file, then the Go tool `ocli` validates it and generates Markdown, man pages, HTML and Cobra code. It also covers environment variables, config files, value types and default values.

Neither spec is ratified, and neither describes stdin payloads or the data formats a program writes to stdout.
**Use this when:**
- you choose a machine-readable format for a CLI's interface;
- you meet the word "OpenCLI" and need to know which spec is meant;
- you write or check an OpenCLI file;
- you compare OpenCLI with usage (`usage-spec-deep-dive.md`) or other formats (`cli-description-formats-deep-dive.md`).

**Depth:**
- both specs object by object, with fields, defaults and required keys;
- the governance, versioning and tooling of each;
- one real command (`workflow-graph record`) written in both;
- the flow from file to documentation and drift check;
- what each cannot express, as an edge-case matrix;
- which claims are verified.

---

## 1. Words first

| Term | Plain English | Analogy | Concrete artifact |
|---|---|---|---|
| CLI (command-line interface) | A program you drive by typing a command, options and arguments in a terminal | A vending machine's button panel | `git commit -m "fix"` |
| Interface description | A file that says how to call a program, so a person or a tool can use it without the source code | A restaurant menu: what you can order and how, without entering the kitchen | `openapi.yaml` for an HTTP API; an OpenCLI file for a CLI |
| Command / subcommand | A verb the program understands; a subcommand is a verb under another verb | Menu sections and dishes | `git` → `remote` → `add` |
| Option (flag) | A named input that starts with `-` or `--` | A side order you can add | `--message "fix"`, `-m "fix"` |
| Argument (positional) | An unnamed input recognised by its position | The dish number you point at | `R-001` in `workflow-graph status R-001` |
| Arity | How many values an argument takes: a minimum and a maximum | "Pick 1 to 3 toppings" | `{ "minimum": 1, "maximum": 1 }` |
| Exit code | The number a program returns when it ends: 0 means success, anything else means a failure kind | A traffic light at the exit | `exit 2` for a usage error |
| Contract-first | Write the description, then write or generate the code from it | An architect's drawing before the builders | OpenAPI file → generated server stub |
| Code-first | Write the code, then export the description from it | A survey drawn of a house already built | `myapp --help-dump-opencli` |
| Drift | The description and the program no longer agree | A menu listing a dish the kitchen stopped making | Docs list `--force`; the program rejects it |

---

## 2. Why there are two

| | **OpenCLI (opencli.org)** | **OpenCLI (opencli.dev)** |
|---|---|---|
| Repository | `spectreconsole/open-cli`, MIT, created 2025-06-27, 293 stars, last push 2026-09-24 ✅[^ocs_repo] | `bcdxn/opencli`, MIT, created 2025-03-11, 45 stars, last push 2026-09-29 ✅[^ocd_repo] |
| Authors | Patrik Svensson, Bob Lail (change log) ✅[^ocs_draft] | bcdxn ("OpenCLI Team") ✅[^ocd_repo] |
| Status, in its own words | "currently a draft"; the site calls version 0.1 "just a proposal" ✅[^ocs_repo][^ocs_site] | Document version `1.0.0-alpha.16`, the only value the schema accepts; tool `ocli` latest release v1.3.0 (2026-08-30) ✅[^ocd_schema][^ocd_repo] |
| File format | JSON (YAML also allowed by the site) ✅[^ocs_site] | YAML or JSON ✅[^ocd_repo] |
| Direction | Mostly **code-first**: frameworks export the file (Spectre.Console.Cli) ✅[^spectre] | Mostly **contract-first**: write the file, generate docs and code; adapters can also export from urfave/cli ✅[^ocd_repo] |
| Machine-checkable schema | `schema.json`, JSON Schema 2020-12 ✅[^ocs_schema] | `spec.schema.json`, JSON Schema 2020-12 ✅[^ocd_schema] |
| Who uses it | Spectre.Console.Cli (`--help-dump-opencli`, `cli opencli`) ✅[^spectre]; the .NET SDK team said "the dotnet CLI intends to align with OpenCLI", and its `--cli-schema` stays a preview until then (July 2025) ✅[^dotnet_issue] | `ocli` itself; clidoc (TypeScript: exports from Yargs, Commander and oclif, publishes Markdown, ships a GitHub Action and an MCP server) ✅[^ocd_repo][^clidoc] |

**The name collision is a real hazard.** A file that says `"opencli": "0.1"` belongs to the first spec. A file that says `opencliVersion: 1.0.0-alpha.16` belongs to the second. A tool for one rejects the other. Searching "opencli" on GitHub also returns many projects that have nothing to do with either spec, such as browser-automation tools and agent skills ✅[^gh_topic]. Always name the spec by its site: **opencli.org** or **opencli.dev**.

---

## 3. OpenCLI at opencli.org, object by object

The text of `draft.md` is the only normative description; `schema.json` is its machine form ✅[^ocs_draft]. Array order is normative, and field names are case-sensitive ✅[^ocs_draft].

### 3.1 Document (the root)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `opencli` | string | yes | Spec version, e.g. `"0.1"` |
| `info` | CliInfo | yes | Title, version, licence |
| `command` | Command | yes | The root command. Since 2026-04-19 it is an ordinary Command object ✅[^ocs_draft] |
| `conventions` | Conventions | no | Parsing conventions |

### 3.2 CliInfo, Contact, License

| Object | Fields (required in bold) |
|---|---|
| CliInfo | **`title`**, `summary` (added 2025-08-06), `description`, `contact`, `license`, **`version`** |
| Contact | `name`, `url` (a URI), `email` |
| License | `name` (no longer required since 2025-07-18), `identifier` (an SPDX id such as `MIT`), `url` |

✅[^ocs_site][^ocs_draft]

### 3.3 Conventions

| Field | Default | When unset |
|---|---|---|
| `groupOptions` | `true` | Short options may be grouped: `-abc` = `-a -b -c` |
| `optionArgumentSeparator` | a space | `--node P6`, not `--node=P6` |

✅[^ocs_site]

### 3.4 Command

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | The command word |
| `aliases` | string[] | — | Other names |
| `options` | Option[] | — | Its options |
| `arguments` | Argument[] | — | Its positional arguments |
| `commands` | Command[] | — | Subcommands (maps became arrays on 2025-07-16) |
| `exitCodes` | ExitCode[] | — | `{ code, description }` per exit status |
| `description` | string | — | What it does |
| `hidden` | bool | `false` | Left out of help |
| `examples` | string[] | — | Example invocations |
| `interactive` | bool | `false` | Needs a human at a terminal (added 2025-07-15) |
| `metadata` | Metadata[] | — | `{ name, value }` pairs for anything else (added 2025-07-16) |

✅[^ocs_site][^ocs_draft]

### 3.5 Option and Argument

| Field | Option | Argument | Default |
|---|---|---|---|
| `name` | required | required | — |
| `required` | yes | yes | `false` |
| `aliases` | yes | — | — |
| `arguments` (the option's values) | yes | — | — |
| `arity` `{ minimum, maximum }` | — | yes | `{1, 1}` (added 2026-03-24); a missing `maximum` means unlimited |
| `acceptedValues` | — | yes | — |
| `group`, `description`, `hidden`, `metadata` | yes | yes | `hidden: false` |
| `recursive` (inherited by subcommands) | yes (added 2025-08-06) | — | `false` |

✅[^ocs_site][^ocs_draft]

**What it does not have:** value types (all values are strings), default values, environment variables, config files, stdin, and the format of stdout. The `metadata` array is the only escape hatch ✅[^ocs_site].

### 3.6 Versioning rule

`major.minor` names the feature set; tools ignore `.patch`, so a tool for 1.1 reads every 1.1.x file ✅[^ocs_draft].

---

## 4. OpenCLI at opencli.dev, object by object

Source: `spec.schema.json`, JSON Schema 2020-12; every object allows `x-` extension keys ✅[^ocd_schema].

### 4.1 Document

| Field | Required | Meaning |
|---|---|---|
| `opencliVersion` | yes | Must be exactly `1.0.0-alpha.16` today |
| `info` | yes | **`title`**, **`binary`**, **`version`**, `summary`, `description`, `license` (**`name`**, `spdxId`, `url`), `contact` |
| `install` | no | Install methods: `name`, `command`, `url`, `description` |
| `global` | no | `exitCodes`, `flags` and `config` that apply to every command |
| `commands` | no | A **map** whose key is the full command line, e.g. `"pleasantries greet <name> [flags]"` |

✅[^ocd_schema][^ocd_repo]

### 4.2 Command, argument, flag

| Object | Fields (required in bold) |
|---|---|
| Command | `summary`, `description`, `aliases`, `args`, `flags`, `hidden`, `kind` (`action` default, or `group` = not runnable), `exitCodes`, `examples` (`title`, **`content`**) |
| Argument | **`name`**, `type`, `variadic`, `minItems`, `maxItems`, `choices` (`value`, `description`), `summary`, `description`, `required`, `passthrough` |
| Flag | **`name`**, **`type`**, `aliases`, `variadic`, `minItems`, `maxItems`, `choices`, `hint`, `summary`, `description`, `required`, `default`, `alternativeSources`, `hidden` |
| Type | `string` (default), `number`, `integer`, `boolean`; generated code uses it to convert values |

✅[^ocd_schema]

### 4.3 Exit codes: a fixed status vocabulary

Each exit code needs **`code`**, **`status`** and **`summary`**. `status` must be one of `OK`, `BAD_USER_INPUT_ERROR`, `UNAUTHENTICATED_ERROR`, `UNAUTHORIZED_ERROR`, `CANCELED_ERROR`, `INTERNAL_CLI_ERROR` or `NOT_IMPLEMENTED_ERROR` ✅[^ocd_schema]. A validator that exits 1 because **the checked thing failed**, rather than the CLI, has no exact status. The closest is `INTERNAL_CLI_ERROR`, which says the opposite. See §7.

### 4.4 Environment variables and config files

A flag's `alternativeSources` lists other places its value can come from:
- `{ type: "$ENV", property: "MY_VAR" }` reads an environment variable;
- `{ type: "$FILE", property: "<JSON path>" }` reads a config file declared in `global.config` (`json`, `toml` or `yaml` → a path).

✅[^ocd_schema]

An environment variable that backs **no flag**, such as `WORKFLOW_GRAPH_NOW`, has no place to go: `$ENV` appears only inside `alternativeSources`, and the schema has no other environment field ✅[^ocd_schema]. An `x-` key can hold it, but no tool reads `x-` keys.

### 4.5 The `ocli` tool

| Command | Does | Verified |
|---|---|---|
| `ocli gen docs --format markdown\|html-embed …` | Markdown, man pages (groff) and HTML docs from the file | ✅[^ocd_repo] |
| `ocli gen cli --framework cobra …` | Boilerplate Go code for Cobra | ✅[^ocd_repo] |
| validate | Validates a document; also Go packages `codec` and `validate` | ✅[^ocd_repo] |
| `__opencli` hidden command (adapter `adapters/ourfave`) | An existing urfave/cli program prints its own document | ✅[^ocd_repo] |

---

## 5. Worked example: one command in both specs

The command, from the workflow-graph tool in this repo:

```text
workflow-graph record <run> --node <id> --result <result> [--task T…] [--project <dir>]
exit 0 = recorded · 1 = the step breaks a graph rule, nothing written · 2 = usage error
```

**opencli.org (JSON):**

```json
{
  "opencli": "0.1",
  "info": { "title": "workflow-graph", "version": "0.1.0" },
  "command": {
    "name": "workflow-graph",
    "commands": [
      {
        "name": "record",
        "description": "Append one step to a run's ledger after checking it against the graph.",
        "arguments": [{ "name": "run", "required": true, "description": "Run id, e.g. R-001" }],
        "options": [
          { "name": "--node", "required": true, "arguments": [{ "name": "id", "required": true }] },
          { "name": "--result", "required": true, "arguments": [{ "name": "result", "required": true }] },
          { "name": "--task", "arguments": [{ "name": "task", "required": true }] },
          { "name": "--project", "arguments": [{ "name": "dir", "required": true }] }
        ],
        "exitCodes": [
          { "code": 0, "description": "Recorded" },
          { "code": 1, "description": "The step breaks a graph rule; nothing written" },
          { "code": 2, "description": "Usage error" }
        ]
      }
    ]
  }
}
```

**opencli.dev (YAML):**

```yaml
opencliVersion: 1.0.0-alpha.16
info: { title: workflow-graph, binary: workflow-graph, version: 0.1.0 }
global:
  exitCodes:
    - { code: 0, status: OK, summary: Recorded }
    - { code: 1, status: INTERNAL_CLI_ERROR, summary: The step breaks a graph rule; nothing written }  # no better status exists
    - { code: 2, status: BAD_USER_INPUT_ERROR, summary: Usage error }
commands:
  workflow-graph record <run> [flags]:
    summary: Append one step to a run's ledger after checking it against the graph.
    args:
      - { name: run, type: string, required: true, summary: "Run id, e.g. R-001" }
    flags:
      - { name: node, type: string, required: true, summary: Graph node id }
      - { name: result, type: string, required: true, summary: The node's result }
      - { name: task, type: string, summary: Task id for P6 steps }
      - { name: project, type: string, summary: Project folder; default the working folder }
```

Both files describe what the parser accepts. Neither can say that `record` appends one JSON line to `.specify/runs/<run>/ledger.jsonl`, or what that line contains. That needs a JSON Schema (`interface-description-standards.md`).

---

## 6. Flow: from description to checked documentation

```text
 contract-first (opencli.dev style)          code-first (opencli.org / Spectre style)
 ─────────────────────────────────          ─────────────────────────────────────────
 1. write cli.ocs.yaml                       1. write the CLI with a framework
 2. validate it against the JSON Schema      2. run  myapp --help-dump-opencli > cli.json
 3. ocli gen docs → Markdown / man / HTML    3. commit cli.json
 4. ocli gen cli → Cobra skeleton            4. in CI: export again, diff with the committed file
 5. in CI: a test compares the program's     5. a change in the diff = an interface change;
    real parser with the file (drift)           review it like an API change
```

The diff in code-first step 4 is how API Extractor treats a TypeScript library: the committed report changes whenever the public API changes ✅[^api_extractor]. Neither OpenCLI project lists a breaking-change classifier in its README, site or draft as read on 2026-11-03 ✅[^ocs_draft][^ocd_repo]; usage ships one (`usage diff`, see `usage-spec-deep-dive.md`).

---

## 7. Edge cases: what each spec can and cannot say

| Need | opencli.org 0.1 | opencli.dev alpha.16 |
|---|---|---|
| Nested subcommands | ✅ `commands` array | ✅ map keyed by full command line |
| Exit codes with meaning | ✅ free text | ✅ but `status` is a fixed list; "the checked thing failed" has no status |
| Value types (`integer`, `boolean`) | ❌ strings only | ✅ |
| Default values | ❌ | ✅ `default` on flags |
| Allowed values | ✅ `acceptedValues` on arguments | ✅ `choices` with descriptions |
| Repeatable flag (`--check a --check b`) | ❌ no field says an option may repeat; `arity` counts the values after one option | ✅ `variadic` |
| Environment variable backing a flag | ❌ (only `metadata`) | ✅ `alternativeSources: $ENV` |
| Environment variable with no flag | ❌ | ❌ (only `x-` keys) |
| Config file locations | ❌ | ✅ `global.config` |
| stdin payload shape | ❌ | ❌ |
| stdout data format (JSON, JSON Lines) | ❌ | ❌ |
| Needs a terminal (interactive) | ✅ `interactive` | ❌ |
| Whether a command changes state | ❌ | ❌ |
| Extension keys | `metadata` array | `x-` keys |
| Breaking-change check | ❌ not shipped | ❌ not shipped |

**Interaction to watch:** opencli.org's `groupOptions` defaults to `true`, so a file that leaves it out claims that `-abc` means `-a -b -c` ✅[^ocs_site]. A program with long options only, such as one built on Node's `util.parseArgs`, should say `false` so that the description stays true.

---

## 8. Verified versus unverified

- Verified (✅) against each project's site, repository, schema file or issue on 2026-11-03: every field table, every version, status, date and star count, the Spectre.Console and .NET facts, and the `ocli` commands.
- Absences ("has no field for …") were checked by reading the whole schema file and draft text, not by searching for a tool that might add them.
- Unverified: none. How third-party tools treat these files beyond the projects' own documentation was not tested.

## References
- [OpenCLI specification (opencli.org)](https://opencli.org/) — Patrik Svensson, Bob Lail, draft 0.1, read 2026-11-03. [^ocs_site]
- [spectreconsole/open-cli](https://github.com/spectreconsole/open-cli) — repository: draft status, licence, metadata. [^ocs_repo]
- [draft.md](https://github.com/spectreconsole/open-cli/blob/main/draft.md) — normative text and change log. [^ocs_draft]
- [schema.json](https://github.com/spectreconsole/open-cli/blob/main/schema.json) — JSON Schema 2020-12 of the opencli.org format. [^ocs_schema]
- [Spectre.Console: built-in command behaviours](https://spectreconsole.net/cli/reference/built-in-command-behaviors/) — `--help-dump-opencli`, `cli opencli`. [^spectre]
- [dotnet/command-line-api issue 2632, "OpenCLI support"](https://github.com/dotnet/command-line-api/issues/2632) — 2025-07-16, .NET CLI to align with OpenCLI. [^dotnet_issue]
- [What's new in the .NET 10 SDK: `--cli-schema`](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/sdk) — Microsoft. [^dotnet10]
- [bcdxn/opencli](https://github.com/bcdxn/opencli) — opencli.dev spec, `ocli`, adapters, ecosystem. [^ocd_repo]
- [spec.schema.json (opencli.dev)](https://github.com/bcdxn/opencli/blob/main/spec.schema.json) — fields, types, exit-code statuses, `alternativeSources`. [^ocd_schema]
- [OpenCLI editor (opencli.dev)](https://opencli.dev) — the second spec's site.
- [bhouston/clidoc](https://github.com/bhouston/clidoc) — TypeScript tooling on opencli.dev. [^clidoc]
- [GitHub topic "opencli"](https://github.com/topics/opencli) — shows unrelated projects using the name. [^gh_topic]
- [API Extractor: the API report](https://api-extractor.com/pages/overview/demo_api_report/) — Microsoft; the committed-report review idea. [^api_extractor]

[^ocs_site]: opencli.org, read 2026-11-03.
[^ocs_repo]: github.com/spectreconsole/open-cli and its GitHub API metadata, read 2026-11-03.
[^ocs_draft]: draft.md, change log entries 2025-07-15 … 2026-04-19.
[^ocs_schema]: schema.json, `$schema` = JSON Schema 2020-12.
[^spectre]: spectreconsole.net, built-in command behaviours.
[^dotnet_issue]: dotnet/command-line-api#2632, maintainer reply 2025-07-16.
[^dotnet10]: learn.microsoft.com, .NET 10 SDK what's new.
[^ocd_repo]: github.com/bcdxn/opencli README and releases, read 2026-11-03.
[^ocd_schema]: bcdxn/opencli spec.schema.json, read 2026-11-03.
[^clidoc]: github.com/bhouston/clidoc.
[^gh_topic]: github.com/topics/opencli, read 2026-11-03.
[^api_extractor]: api-extractor.com, API report page.

## Related
- `documentation/interface-description-standards.md` — which format fits which interface (synthesized from this dive).
- `documentation/usage-spec-deep-dive.md` — usage (jdx), the most complete CLI spec today.
- `documentation/cli-description-formats-deep-dive.md` — docopt, Fig, carapace, `--cli-schema`, man pages and the comparison of all formats.
- `frameworks/agentic-sdlc/foundations/design/contract-design.md` — contract rules CON-1 … CON-14.
