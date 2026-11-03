---
schema: deep-dive/v1
topic: documentation
status: verified
applies-to: ["usage spec and usage-cli 7.1.5 (jdx/usage, released 2026-11-01)", "KDL 2.0.0", "sources read 2026-11-03"]
last-verified: 2026-11-03
last-updated: 2026-11-03
synthesized-into:
  - { path: documentation/interface-description-standards.md, on: 2026-11-03 }
tags: [usage, kdl, cli, interface-description, exit-codes, json-schema, breaking-changes, completions, mcp, mise]
---

# usage (jdx): a CLI described once, checked and generated

## Summary
**TL;DR:** usage is a specification for command-line programs, written in KDL 2.0, a small configuration language of nodes, values and properties. It is maintained by jdx, the author of mise, and is at version 7.1.5 (released 2026-11-01). One `.usage.kdl` file describes:
- commands, flags and arguments;
- exit codes;
- the environment variables and config-file keys behind flags;
- what each command prints on stdout, with an optional JSON Schema;
- whether each command reads, writes or destroys state.

The `usage` tool then lints the file, finds breaking changes between two versions, and generates shell completions, Markdown, man pages, TypeScript and Python clients, and an MCP description for AI agents. Of the CLI formats checked on 2026-11-03, it covers the most.
**Use this when:**
- you choose or write a machine-readable description of a CLI;
- you want CI to catch a breaking CLI change;
- you need a description that AI agents can read safely, where `effect` tells them which commands change state;
- you compare usage with OpenCLI (`opencli-deep-dive.md`) or other formats (`cli-description-formats-deep-dive.md`).

**Depth:**
- KDL syntax first;
- every spec node (`flag`, `arg`, `cmd`, `config`, `output`, `exit_code`, `effect`), with defaults and unset behaviour;
- how flags, environment variables and config interact;
- the `usage` commands (lint, diff, generate, mcp, exec);
- framework exporters;
- one real tool written in usage;
- the CI flow;
- an edge-case matrix and the verification status.

---

## 1. Words first

| Term | Plain English | Analogy | Concrete artifact |
|---|---|---|---|
| usage spec | A file that lists everything a CLI accepts and returns | A product's label: ingredients, warnings, how to use | `mycli.usage.kdl` |
| KDL | A config language made of **nodes**. A node has a name, then values, then `key=value` properties, then optional children in `{ }` ✅[^usage_spec] | Like XML elements, but written like shell commands | `flag "-f --force" help="Overwrite"` |
| KDL 2.0 | The current, final KDL version; booleans are `#true`/`#false`, null is `#null` ✅[^kdl] | — | `required=#true` |
| Effect | How much a command changes the world: `read`, `write` or `destructive` ✅[^usage_spec] | The warning colour on a switch | `cmd "uninstall" effect="destructive"` |
| Framing | How a reader splits a command's stdout: `text`, `json` (one document) or `jsonl` (one document per line) ✅[^usage_output] | Whether the delivery is one parcel or a stream of envelopes | `framing="jsonl"` |
| Breaking change | A change after which a command line that worked before fails, binds differently or gets a different value ✅[^usage_diff] | Moving a light switch: the old habit now hits a wall | Removing `--force` |
| Exporter | A library that reads an existing program's parser setup and writes its usage spec ✅[^usage_integrations] | A scanner that turns a built house into a floor plan | `clap_usage` (Rust), `@usage-spec/commander` (Node.js) |

---

## 2. Status and governance

| Fact | Value |
|---|---|
| Repository | `jdx/usage`, MIT, created 2023-08-12, 1,069 stars, pushed 2026-11-03 ✅[^usage_repo] |
| Latest release | v7.1.5, 2026-11-01 ✅[^usage_repo] |
| Known adopter | mise keeps its CLI description in `mise.usage.kdl` at its repository root ✅[^mise_repo]; the usage site measures its parser on a "shadow" spec of mise's 211 commands and 711 flags ✅[^usage_home] |
| Install | `mise use -g usage`, `brew install usage`, `cargo install usage-cli --locked`, `cargo binstall usage-cli`, `pacman -S usage` ✅[^usage_cli] |
| Standard body | None; one maintainer's project, versioned by its releases |

---

## 3. The spec, node by node

### 3.1 Metadata (top level)

`name`, `bin`, `about`, `version`, `author` and `license`, each with one string value ✅[^usage_spec].

```kdl
name "Workflow graph"
bin "workflow-graph"
version "0.1.0"
about "Checks and records agentic-sdlc runs against the workflow graph"
```

### 3.2 `flag`

The first value holds the spellings and, in angle brackets, the value name: `flag "-u --user <user>"`. A flag without `<…>` is a boolean ✅[^usage_spec].

| Property | Example | When unset |
|---|---|---|
| `help` | `help="Short help"` | No help; `usage lint` reports it ✅[^usage_lint] |
| `long_help` | property, or a child node for long text | `help` is used |
| `required` | `required=#true` | Optional |
| `var`, `var_min`, `var_max` | `var=#true var_min=1` | Flag may appear once |
| `global` | `global=#true` | Only its own command sees it |
| `count` | `count=#true` | Boolean; with it, `-vvv` = 3 |
| `default` | `default="file.txt"` | No value |
| `env` | `env="MYCLI_COLOR"` | No environment fallback; help shows the variable's **name**, never its value |
| `negate` | `negate="--no-color"` | No way to force `false` |
| `choices` (child) | `choices "bash" "zsh"`; `strict=#false` makes them suggestions | Any value |
| `deprecated` | `deprecated="use --out"`, plus `deprecated_warn_at`, `deprecated_remove_at` | Not deprecated |
| `hide` | `hide=#true` | Shown in help and completions |
| `arg` (child) | `arg "<port>" validate="int(value) >= 1"` | No validation |
| `effect` | `effect="destructive"` | Does not raise the command's effect |

✅[^usage_flag]

### 3.3 `arg` and `cmd`

- `arg "<dir>"` is required; `arg "[file]"` is optional. Both take `help` and `effect` ✅[^usage_spec].
- A variadic argument: `arg "<file>" var=#true` (one or more), `arg "[file]" var=#true` (zero or more), or the shorthand `arg "<file>..."`; `var_min`/`var_max` bound it. An argument can also take `default`, `env` (an environment variable backs it), `choices`, `validate` and `double_dash` ✅[^usage_arg].
- `cmd "name" { … }` nests flags, args and further `cmd`s. It takes `help` and `effect`. `alias "rm"` adds a name; `alias "delete" hide=#true` hides one ✅[^usage_spec].
- More `cmd` properties: `subcommand_required=#true` (a group that cannot run alone), `hide`, `deprecated`, `long_help`, `before_help`/`after_help`, `unknown_flags="error"`, and repeatable `example` child nodes; `mount run="…"` takes subcommands from another program's output ✅[^usage_cmd].

### 3.4 `config`: flags, environment and files together

```kdl
config {
  file ".mycli.toml" findup=#true
  prop "settings.user" type="string" default="admin" {
    cli "--user"
    env "MYCLI_USER"
  }
}
```

**Precedence:** flag > environment variable > config file > default ✅[^usage_spec]. `usage generate json-schema` writes a JSON Schema for that config file ✅[^usage_cli].

### 3.5 `output` and `exit_code`: what comes back

```kdl
output "json" media_type="application/json" framing="json" default=#true help="Machine-readable report" {
  schema file="report.schema.json"
}
exit_code 0 "all checks passed"
exit_code 1 "a check failed"
```

| Rule | Detail |
|---|---|
| `output` | The first value is the name users type. `media_type` is never guessed. `framing` defaults to `text` |
| Schema | `schema #"""…"""#` inline, or `schema file="…"` relative to the KDL file. Any JSON Schema draft is accepted |
| Defaults | At most one effective output may be `default` |
| Selection | `select "--format"` fills a value flag's choices from the output names; `select="--json"` on an output ties it to a boolean flag |
| Inheritance | Top-level `output`, `select` and `exit_code` apply to every command. A command overrides an output by redeclaring its name, removes one with `hide=#true`, and merges exit codes by number |

✅[^usage_output]

### 3.6 `effect`: may an agent run this without asking?

| Value | Meaning |
|---|---|
| `read` | Only inspects state |
| `write` | Creates or changes state, but removes nothing the user cannot recreate |
| `destructive` | May delete or irreversibly overwrite |
| *(unset)* | **Unknown**; consumers should treat it as needing confirmation |

- `effect` is **not inherited** by subcommands.
- A flag or argument can **raise** an invocation's effect but never lower it. The effective value is the maximum over the command and the flags and arguments actually given.

✅[^usage_spec]

---

## 4. The `usage` tool

| Command | Does |
|---|---|
| `usage lint <FILE>` | Finds mistakes that still parse: a flag or command declared twice, a required arg after an optional one, a variadic arg that is not last, missing help, an example the spec cannot parse; `--sorted` adds declaration order. `-f json`, `-W` (warnings as errors). Exit 1 on an error ✅[^usage_lint] |
| `usage diff <old> <new>` | Classifies each change as **breaking**, **compatible** or **metadata**. Exit 1 on a breaking change; `--breaking` shows only breaking findings, `--exit-zero` reports without failing, `--format json`. Either side can be `-` (stdin) ✅[^usage_diff] |
| `usage generate completion` | bash, zsh, fish, PowerShell, Nushell ✅[^usage_cli] |
| `usage generate markdown` / `manpage` | Reference pages; they include outputs and exit codes ✅[^usage_cli][^usage_output] |
| `usage generate sdk` | Typed TypeScript and Python clients, with parsed-JSON and streaming-JSONL methods for declared outputs ✅[^usage_cli][^usage_output] |
| `usage generate json-schema` | JSON Schema of the config file ✅[^usage_cli] |
| `usage mcp` | Describes the CLI to an AI agent, including each command's effect, outputs and exit codes ✅[^usage_cli][^usage_output] |
| `usage explain` | Shows what a command line binds to, and why ✅[^usage_cli] |
| `usage exec` / `usage bash` | Runs or generates a script whose spec lives in `#USAGE` comments ✅[^usage_cli] |

**What `usage diff` counts as breaking** ✅[^usage_diff]:
- removing a flag, or its short spelling;
- narrowing a strict `choices`;
- making a positional argument required;
- adding `conflicts`;
- changing or removing a `default`.

It counts as **compatible** a new optional flag or a new subcommand. Help text, `display_order` and deprecation notices are **metadata**. Version strings are never reported.

---

## 5. Getting a spec: write it, or export it

| Route | How |
|---|---|
| Write by hand | The `.usage.kdl` file is the contract; the program is checked against it |
| Export from a framework | Cobra (`cobra_usage`), Kong, urfave/cli, clap (`clap_usage`), argparse, Typer, Click, OptionParser (Ruby), Commander.js (`@usage-spec/commander`), oclif, yargs, Effect, JCommander, picocli, Clikt ✅[^usage_integrations] |
| Native framework | usage's own Rust framework; a Go one as "development preview" ✅[^usage_home] |
| Self-report | A program prints its spec with `--usage-spec`, so CI can compare it with the committed file ✅[^usage_diff] |

There is no exporter for Node's built-in `util.parseArgs` or for Spectre.Console. Spectre.Console and System.CommandLine are on the planned list ✅[^usage_integrations]. A Node program that uses `parseArgs` keeps a hand-written spec and checks its own option tables against it. A KDL 2.0 parser for JavaScript exists: `@bgotink/kdl` 0.4.1 (2026-10-13, MIT, no dependencies) ✅[^bgotink]. Tested 2026-11-03 in agent-config (specs/021): it parsed the workflow-graph tool's spec (`interfaces/workflow-graph.usage.kdl`: 15 commands and groups, nested `cmd`, `#true` booleans, `choices` and `output`/`schema` children), and the tool now renders its `--help` and checks its option tables from that parse. The spec was **not** run through `usage lint`, because the `usage` CLI was not installed.

---

## 6. Worked example: part of a real tool in usage

The workflow-graph tool in this repo:
- `record` appends a step to a run ledger;
- `status` reads it;
- `hook guard` reads a coding agent's hook JSON on stdin and prints a JSON verdict.

```kdl
name "Workflow graph"
bin "workflow-graph"
version "0.1.0"
about "Checks and records agentic-sdlc runs against the workflow graph"

exit_code 0 "success"
exit_code 1 "a check failed; nothing was written"
exit_code 2 "usage error"

cmd "record" effect="write" help="Append one step to a run's ledger after checking it against the graph" {
  arg "<run>" help="Run id, e.g. R-001"
  flag "--node <id>" required=#true help="Graph node id"
  flag "--result <result>" required=#true help="The node's result"
  flag "--task <task>" help="Task id, for P6 steps"
  flag "--project <dir>" help="Project folder; default the working folder"
}

cmd "status" effect="read" help="Show where a run stands" {
  arg "[run]" help="Run id; all open runs when left out"
  flag "--project <dir>"
}

cmd "hook" {
  cmd "guard" effect="write" help="Allow or deny a role launch; reads the agent's hook JSON on stdin" {
    flag "--agent <agent>" required=#true {
      choices "claude-code" "copilot-cli" "codex"
    }
    output "json" media_type="application/json" framing="json" default=#true {
      schema file="hooks/guard-output.schema.json"
    }
    exit_code 0 "always; a failure becomes a deny in the JSON"
  }
}
```

What the file still cannot say:
- **stdin.** The hook JSON the tool *reads* has no node, so it needs its own JSON Schema, listed in the repo's catalog.
- **Different output per agent.** The output shape depends on `--agent`. One schema with `oneOf` per agent covers it; usage has no "output depends on flag value" link. Its `select` ties outputs to a *format* flag, not to other flags.
- **Environment variables that back no flag,** such as `WORKFLOW_GRAPH_NOW`, which fixes the clock in tests. The pages read show `env` only on a flag or inside a `config prop`.

---

## 7. Flow: keeping the description true in CI

```text
 1. developer edits the CLI (adds --mission to `run start`)
 2. developer edits workflow-graph.usage.kdl in the same pull request
 3. CI: usage lint workflow-graph.usage.kdl -W           → missing help, duplicates
 4. CI: drift test — the program's parser options = the spec's flags, per command
 5. CI: git show <last tag>:workflow-graph.usage.kdl > released.kdl
        usage diff released.kdl workflow-graph.usage.kdl --breaking
                                                         → exit 1 if an old command line breaks
 6. CI: usage generate markdown → docs/cli.md (or check it is current)
 7. reviewer sees the .kdl diff = the interface change, reads it like an API change
```

Steps 3, 5 and 6 are documented usage commands ✅[^usage_lint][^usage_diff][^usage_cli]. Step 4 is the program's own test. With a framework exporter, step 4 becomes `mycli --usage-spec | usage diff mycli.usage.kdl -` ✅[^usage_diff].

---

## 8. Edge cases and interactions

| Situation | What happens | Source |
|---|---|---|
| Flag has `env=` and the variable is set, and the flag is also given | Flag wins (flag > env > config > default) | ✅[^usage_spec] |
| `effect` set on a group command | Subcommands do **not** inherit it; each needs its own | ✅[^usage_spec] |
| A read command given a destructive flag (`--clear effect="destructive"`) | The invocation becomes destructive | ✅[^usage_spec] |
| No `effect` anywhere | Consumers treat every command as needing confirmation | ✅[^usage_spec] |
| Two outputs both `default=#true` in effect for one command | Not allowed: at most one | ✅[^usage_output] |
| A command redefines `exit_code 1` | Merges by number: inherited `0` and others stay | ✅[^usage_output] |
| Value removed from `choices` | Breaking if strict, metadata if `strict=#false` | ✅[^usage_diff] |
| Help text changed | Metadata, not breaking | ✅[^usage_diff] |
| Version bumped only | Never reported by `diff` | ✅[^usage_diff] |
| `usage lint` finds only warnings | Exit 0 unless `-W` | ✅[^usage_lint] |
| stdin payload | Not describable in the spec | Absent from the spec pages read ✅[^usage_spec][^usage_output] |

---

## 9. Verification status

- Verified (✅): every node, property, rule, command, version and date above, against the usage site, the jdx/usage and jdx/mise repositories, kdl.dev and the `@bgotink/kdl` repository, on 2026-11-03.
- Read later the same day: the `cmd` and `arg` reference pages, which settle `subcommand_required` and variadic arguments (§3.3).
- Not documented on the pages read, and so not claimed:
  - the `complete` node's full syntax;
  - the output of `usage generate json`.

## References
- [usage home](https://usage.jdx.dev/) — jdx; overview, frameworks, benchmarks. [^usage_home]
- [usage spec](https://usage.jdx.dev/spec/) — KDL nodes, `config`, `effect`. [^usage_spec]
- [Flag reference](https://usage.jdx.dev/spec/reference/flag) — every flag property. [^usage_flag]
- [Output and exit codes](https://usage.jdx.dev/spec/reference/output) — `output`, framing, schema, `exit_code`, inheritance. [^usage_output]
- [Framework integrations](https://usage.jdx.dev/spec/integrations) — exporters and planned ones. [^usage_integrations]
- [cmd reference](https://usage.jdx.dev/spec/reference/cmd) — every `cmd` property. [^usage_cmd]
- [arg reference](https://usage.jdx.dev/spec/reference/arg) — every `arg` property, variadic forms. [^usage_arg]
- Local: `copilot/frameworks/agentic-sdlc/tools/workflow-graph/interfaces/workflow-graph.usage.kdl` — a real spec, checked against its code by `workflow-graph interfaces`.
- [usage CLI](https://usage.jdx.dev/cli/) — subcommands and install. [^usage_cli]
- [usage lint](https://usage.jdx.dev/cli/reference/lint) — checks and exit codes. [^usage_lint]
- [Interface checks: usage diff](https://usage.jdx.dev/cli/diff) — breaking-change rules, CI recipe. [^usage_diff]
- [jdx/usage](https://github.com/jdx/usage) — repository, releases. [^usage_repo]
- [jdx/mise](https://github.com/jdx/mise) — `mise.usage.kdl`. [^mise_repo]
- [KDL](https://kdl.dev/) — KDL 2.0.0 syntax. [^kdl]
- [bgotink/kdl](https://github.com/bgotink/kdl) — KDL 2.0 parser for JavaScript (npm `@bgotink/kdl`). [^bgotink]

[^usage_home]: usage.jdx.dev, read 2026-11-03.
[^usage_spec]: usage.jdx.dev/spec, read 2026-11-03.
[^usage_flag]: usage.jdx.dev/spec/reference/flag.
[^usage_output]: usage.jdx.dev/spec/reference/output.
[^usage_integrations]: usage.jdx.dev/spec/integrations.
[^usage_cmd]: usage.jdx.dev/spec/reference/cmd, read 2026-11-03.
[^usage_arg]: usage.jdx.dev/spec/reference/arg, read 2026-11-03.
[^usage_cli]: usage.jdx.dev/cli.
[^usage_lint]: usage.jdx.dev/cli/reference/lint.
[^usage_diff]: usage.jdx.dev/cli/diff.
[^usage_repo]: github.com/jdx/usage and the GitHub API (stars, dates, latest release v7.1.5).
[^mise_repo]: github.com/jdx/mise repository root listing.
[^kdl]: kdl.dev, KDL 2.0.0.
[^bgotink]: github.com/bgotink/kdl README; npm registry metadata for `@bgotink/kdl` 0.4.1.

## Related
- `documentation/interface-description-standards.md` — which format fits which interface (synthesized from this dive).
- `documentation/opencli-deep-dive.md` — the two OpenCLI specifications.
- `documentation/cli-description-formats-deep-dive.md` — docopt, Fig, carapace, `--cli-schema`, man pages and the comparison of all formats.
- `ai-agents/harness-engineering-deep-dive.md` — tools as the agent-computer interface; `effect` is one way to describe them.
