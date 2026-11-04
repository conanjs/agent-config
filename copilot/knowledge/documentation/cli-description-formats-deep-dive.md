---
schema: deep-dive/v1
topic: documentation
status: verified
applies-to: ["docopt 0.6.2", "Fig completion specs (@withfig/autocomplete-types 1.31.0)", "carapace-spec (schema read 2026-11-03)", "argc (read 2026-11-03)", ".NET 10 SDK --cli-schema (preview)", "OpenCLI 0.1 and 1.0.0-alpha.16", "usage 7.1.5", "IEEE Std 1003.1-2024", "sources read 2026-11-03"]
last-verified: 2026-11-03
last-updated: 2026-11-03
synthesized-into:
  - { path: documentation/interface-description-standards.md, on: 2026-11-03 }
tags: [cli, interface-description, docopt, fig, amazon-q, carapace, argc, dotnet, posix, clig, comparison]
---

# Describing a command-line program: every format compared

## Summary
**TL;DR:** Besides OpenCLI and usage, five other ways exist to write down a CLI's interface. Each was built for a different job:
- **docopt**: the help text *is* the parser.
- **Fig completion specs**, now Amazon Q Developer CLI: describe a CLI so a terminal can autocomplete it.
- **carapace-spec**: YAML for shell completion in a dozen shells.
- **argc**: comment tags inside a Bash script.
- **.NET `--cli-schema`**: a program prints its own command tree as JSON; still a preview.

Two non-file standards set the rules any description should follow:
- the POSIX utility conventions (synopsis notation);
- the Command Line Interface Guidelines (help, exit codes, stdout versus stderr).

For a description that other programs, people and AI agents can rely on, usage covers the most, OpenCLI (opencli.org) has the strongest backing, and the rest are completion or parsing tools.
**Use this when:**
- you choose how to describe a CLI;
- you find one of these formats in a project and need to know what it can and cannot say;
- you need the decision guide in §6.

**Depth:**
- each format's purpose, file shape, maintenance status and one example;
- the two rule sets every format should respect;
- a feature matrix across all nine formats;
- a decision guide;
- the failure modes of each choice;
- the verification status.

---

## 1. Words first

| Term | Plain English | Analogy | Concrete artifact |
|---|---|---|---|
| Interface description | A file that tells a reader how to call a program without its source | A menu | `workflow-graph.usage.kdl` |
| Completion spec | A description written so a shell can suggest the next word when you press Tab | Predictive text on a phone | Fig's `git.ts` |
| Synopsis | The one-line pattern at the top of a man page that shows a command's form | The pattern on a form: "Name ____ Date __/__" | `record <run> --node <id> [--task <task>]` |
| Self-description | A program prints its own interface when asked | A machine that prints its own manual | `dotnet clean --cli-schema` |
| Parser | The code that turns the words typed into named values | A mail sorter | Node's `util.parseArgs` |

The two most complete formats have their own deep dives: OpenCLI in `opencli-deep-dive.md` and usage in `usage-spec-deep-dive.md`.

---

## 2. The rules every format should respect

| Source | What it fixes | Status |
|---|---|---|
| POSIX Utility Conventions, IEEE Std 1003.1-2024, chapter 12 | The synopsis notation (options, operands, `[optional]`, `...` for repeats) and the Utility Syntax Guidelines | ✅[^posix] |
| Command Line Interface Guidelines (clig.dev) | `-h`/`--help` always works; docs match the installed version; exit 0 on success and non-zero codes mapped to failure kinds; data on stdout, messages on stderr; `--json` for machines | ✅[^clig] |

A description file *records* these choices; it does not replace them. A CLI that prints its usage error on stdout breaks the clig.dev stdout rule, however well it is described.

---

## 3. The other formats, one by one

### 3.1 docopt: the help text is the parser

- **Idea:** write the help message by hand; the library parses arguments from that message ✅[^docopt].
- **Shape:** a `Usage:` section of patterns, then an `Options:` section:
  - `<arg>` is an argument;
  - `[ ]` is optional, `( )` is required and `|` is a choice;
  - `...` repeats;
  - `[default: x]` sets a default.
- **Status:** Python package 0.6.2, released 2014-06-16 and the latest on PyPI. The repository is not archived; its last push was 2025-06-23 ✅[^docopt][^docopt_pypi].
- **Example** (written for this doc):

```text
Usage:
  workflow-graph record <run> --node=<id> --result=<result> [--task=<task>] [--project=<dir>]
  workflow-graph (-h | --help)
```

- **Limits:** it has no exit codes, environment variables, output formats or schema to check against. It is a human text format: a program reads it only by running docopt's parser.

### 3.2 Fig completion specs (now Amazon Q Developer CLI)

- **Idea:** a declarative description of each CLI's subcommands, options and args, used to show IDE-style suggestions in a terminal ✅[^fig].
- **Status:** Fig became Amazon Q Developer CLI ✅[^fig]. The specs repo `withfig/autocomplete` has 25k stars; its last push was 2025-05-05. The types package `@withfig/autocomplete-types` 1.31.0 dates from 2024-05-08 ✅[^fig][^fig_types].
- **Shape:** a TypeScript object. Fields read from the type definitions ✅[^fig_types]:
  - `Subcommand`: `name`, `subcommands`, `options`, `args`, `loadSpec`;
  - `Option`: `name`, `args`, `isPersistent`, `isRequired`, `isRepeatable`, `requiresSeparator`, `exclusiveOn`, `dependsOn`;
  - `Arg`: `name`, `description`, `suggestions`, `template`, `generators` (run code for live suggestions), `isVariadic`, `isOptional`, `default`, `isDangerous`.
- **Notable:** `isDangerous` makes a command harder to run by accident. The `rm` spec uses it ✅[^fig_types]. It is a cousin of usage's `effect`.
- **Limits:** it is a TypeScript module, so reading it needs a JavaScript runtime. It has no exit codes and no output formats; it is built for suggestions, not contracts.

### 3.3 carapace-spec: YAML for many shells

- **Idea:** a multi-shell completion spec, based on the carapace project ✅[^carapace].
- **Shape:** YAML. The `Command` object has these fields ✅[^carapace_schema]:
  - `name`, `aliases`, `description`, `group`, `hidden`;
  - `parsing` (`interspersed`, `non-interspersed` or `disabled`);
  - `flags`, `persistentflags`, `exclusiveflags`;
  - `run`, `completion`, `commands`, `documentation`, `examples`.

  Flag suffixes mark an optional value (`?`), a repeatable flag (`*`) and a flag that takes a value (`=`). Completion values can be macros such as `$files` ✅[^carapace].
- **Shells:** bash, elvish, fish, ion, nushell, oil, powershell, tcsh, xonsh, zsh ✅[^carapace].
- **Generators:** from clap, kingpin, kong, urfave/cli, oclif, click-extra and man pages ✅[^carapace].
- **Status:** a JSON Schema 2020-12 is published ✅[^carapace_schema]. There is no version number or release ✅[^carapace]. The project has 36 stars and was pushed 2026-11-03.
- **Limits:** it has no exit codes, environment variables or output formats.

### 3.4 argc: comment tags in a Bash script

- **Idea:** describe a Bash CLI's flags, options, positional arguments and subcommands in comment tags. argc parses the arguments, validates them, prints usage text, binds environment variables, generates completions and man pages, and can build a standalone script ✅[^argc].
- **Status:** active; 1,180 stars, pushed 2026-10-30, Apache-2.0 ✅[^argc].
- **Limits:** it is for Bash programs. The description lives inside the script, not in a file that other tools exchange.

### 3.5 .NET `--cli-schema`: self-description as JSON

- **Idea:** every `dotnet` command accepts `--cli-schema` and prints its command tree as JSON, for tool authors, shell integration and scripting ✅[^dotnet10].
- **Shape (sample):** `name`, `version`, `description`, `arguments` (a map with `arity` `{minimum, maximum}`), `options` (a map with `helpName`) and `subcommands` ✅[^dotnet10].
- **Status:** hidden and preview. The .NET CLI team said it "intends to align with OpenCLI" and will not stabilize the flag before that (July 2025) ✅[^dotnet_issue].
- **Lesson:** the self-description pattern is the same idea as Spectre.Console's `--help-dump-opencli` and usage's `--usage-spec`. The program is the source, and CI compares its output with a committed file.

---

## 4. Feature matrix

✅ = the format has a field for it; ❌ = none, checked against the format's schema, types or docs on 2026-11-03.

| Can describe … | opencli.org 0.1 | opencli.dev α16 | usage 7.1 | docopt | Fig | carapace | argc | .NET `--cli-schema` |
|---|---|---|---|---|---|---|---|---|
| Nested subcommands | ✅ | ✅ | ✅ | ✅ (patterns) | ✅ | ✅ | ✅ | ✅ |
| Required / optional | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`?`) | ✅ | ✅ (arity) |
| Repeatable flag | ❌ | ✅ | ✅ | ✅ (`...`) | ✅ | ✅ (`*`) | ✅ | ✅ (arity) |
| Value types | ❌ | ✅ | ✅ (validate) | ❌ | ❌ | ❌ | ✅ | ❌ in the sample |
| Default values | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ in the sample |
| Environment variables | ❌ | ✅ (per flag) | ✅ (per flag, config) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Exit codes | ✅ | ✅ (fixed statuses) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| stdout format + JSON Schema | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| State-change marker | ❌ | ❌ | ✅ `effect` | ❌ | ✅ `isDangerous` | ❌ | ❌ | ❌ |
| stdin payload | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JSON Schema of the file itself | ✅ | ✅ | ❌ (KDL) | ❌ | TypeScript types | ✅ | ❌ | ❌ |
| Breaking-change checker | ❌ | ❌ | ✅ `usage diff` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Docs / man pages generated | via Spectre/others | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ man | ❌ |
| Shell completions generated | — | — | ✅ 5 shells | ❌ | Amazon Q | ✅ 10+ shells | ✅ | `dotnet completions` (separate) |

No format describes **stdin**. A program that reads JSON on stdin, like a coding-agent hook handler, needs a separate JSON Schema for it, whatever CLI format it uses.

---

## 5. Worked comparison: the same command in three formats

The command is `workflow-graph record <run> --node <id> --result <result> [--task <task>]`. It exits 0 when the step is recorded, 1 when the step breaks a graph rule, and 2 on a usage error.

| Format | How it looks | Exit codes said? |
|---|---|---|
| docopt | `workflow-graph record <run> --node=<id> --result=<result> [--task=<task>]` | No |
| usage | `cmd "record" effect="write" { arg "<run>"; flag "--node <id>" required=#true; … }` plus top-level `exit_code 1 "…"` | Yes |
| opencli.org | `{ "name": "record", "arguments": [{ "name": "run", "required": true }], "options": [{ "name": "--node", "required": true, … }], "exitCodes": [{ "code": 1, … }] }` | Yes |

The full usage and OpenCLI versions are in their deep dives.

---

## 6. Decision guide

| Your situation | Pick | Why |
|---|---|---|
| Others (people, CI, AI agents) must rely on the CLI; you want breaking changes caught | **usage** | Exit codes, outputs with JSON Schema, `effect`, `usage diff`, lint |
| .NET program on Spectre.Console | **OpenCLI (opencli.org)**, exported with `--help-dump-opencli` | Free export; .NET SDK alignment announced |
| You want a contract-first YAML and Go/Cobra code generation | **OpenCLI (opencli.dev)** | `ocli gen cli`, env and config sources |
| Only shell completion is wanted | **carapace-spec** or the framework's own completion generator | Built for that; widest shell list |
| A Bash script | **argc** | Parsing, help, completion and man page from comments |
| A tiny Python script | docopt | Help text is the parser. Note the 2014 last release |
| Terminal autocomplete in Amazon Q | Fig completion spec | That product's format |

Whatever you pick, add a **drift check**: a test that compares the program's real parser with the description. A description nobody checks goes stale, as `specs/019-workflow-graph/contracts/cli.md` in this repo did. It was written before the `run` command existed and was never updated.

---

## 7. Failure modes

| Choice | Fails when | Mitigation |
|---|---|---|
| Any format, no drift check | A flag is added in code only; docs and agents keep the old interface | A test that compares the parser's tables with the file; or self-description plus a CI diff |
| opencli.org | You need env vars, defaults or types | `metadata` entries, plus a table in the repo's catalog |
| opencli.dev | Its single accepted version changes (`1.0.0-alpha.16` today) and old files stop validating | Pin the schema copy you validate against |
| usage | The team must install the `usage` binary (Rust) for lint and diff | Run it only in CI; keep a parser-level drift test in the project's own language |
| Completion specs (Fig, carapace) | Used as the contract; they have no exit codes or outputs | Use them as *generated* outputs, not as the source |
| docopt | The project needs maintenance or new features | Choose a maintained format |
| Self-description only | The program must be built and run to see its interface; reviewers see no diff | Commit the printed file and diff it in CI |

---

## 8. Verification status

- Verified (✅), 2026-11-03:
  - each project's own README, schema, type definitions or docs, and GitHub or registry metadata for stars, dates and versions;
  - POSIX and clig.dev, read the same day for `interface-description-standards.md`;
  - the absences in the matrix (❌), read from each format's schema or type file.
- Not tested: running any of these tools. The matrix records what each format *documents*, not measured tool behaviour.

## References
- [Utility Conventions, IEEE Std 1003.1-2024](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap12.html) — The Open Group / IEEE. [^posix]
- [Command Line Interface Guidelines](https://clig.dev/) — Prasad, Firshman, Tashian, Parish. [^clig]
- [docopt/docopt](https://github.com/docopt/docopt) — README and repository metadata. [^docopt]
- [docopt on PyPI](https://pypi.org/project/docopt/) — latest release 0.6.2. [^docopt_pypi]
- [withfig/autocomplete](https://github.com/withfig/autocomplete) — completion specs; Fig is now Amazon Q Developer CLI. [^fig]
- [@withfig/autocomplete-types 1.31.0](https://unpkg.com/@withfig/autocomplete-types@1.31.0/index.d.ts) — type definitions 1.31.0 (read through unpkg). [^fig_types]
- [carapace-sh/carapace-spec](https://github.com/carapace-sh/carapace-spec) — README. [^carapace]
- [carapace-spec schema.json](https://github.com/carapace-sh/carapace-spec/blob/master/schema.json) — `Command` fields. [^carapace_schema]
- [sigoden/argc](https://github.com/sigoden/argc) — README. [^argc]
- [What's new in the .NET 10 SDK](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/sdk) — `--cli-schema`. [^dotnet10]
- [dotnet/command-line-api issue 2632](https://github.com/dotnet/command-line-api/issues/2632) — alignment with OpenCLI. [^dotnet_issue]

[^posix]: pubs.opengroup.org, base definitions chapter 12.
[^clig]: clig.dev, read 2026-11-03.
[^docopt]: github.com/docopt/docopt and the GitHub API, read 2026-11-03.
[^docopt_pypi]: pypi.org JSON API: version 0.6.2, uploaded 2014-06-16.
[^fig]: github.com/withfig/autocomplete README and the GitHub API.
[^fig_types]: unpkg.com/@withfig/autocomplete-types@1.31.0/index.d.ts; npm registry time for 1.31.0.
[^carapace]: github.com/carapace-sh/carapace-spec README and the GitHub API.
[^carapace_schema]: carapace-spec schema.json, `$defs.Command`.
[^argc]: github.com/sigoden/argc README and the GitHub API.
[^dotnet10]: learn.microsoft.com, .NET 10 SDK, "CLI introspection with --cli-schema".
[^dotnet_issue]: dotnet/command-line-api#2632, 2025-07-16.

## Related
- `documentation/interface-description-standards.md` — which format fits which interface kind (synthesized from this dive).
- `documentation/opencli-deep-dive.md` — both OpenCLI specifications in full.
- `documentation/usage-spec-deep-dive.md` — usage in full.
- `frameworks/agentic-sdlc/foundations/design/contract-design.md` — contract rules CON-1 … CON-14.
