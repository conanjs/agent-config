# workflow-graph: interfaces

Everything a person or another program can use to talk to the workflow-graph tool, and where each one is described.
An **interface** here is any way in or out of the tool: a command, a flag, an exit code, a file it reads or writes, the
JSON a coding agent's hook sends it, an environment variable. Programs read the same list from
[`catalog-info.yaml`](catalog-info.yaml) (Backstage descriptor format).

**What the tool is:** it keeps agentic-sdlc runs on the workflow graph (`../../workflow.graph.yaml`). It checks the
graph, records each step of a run in a hash-chained ledger, stops a coding agent from launching a role past an
unapproved gate, records gate approvals typed in chat, and can drive a whole run headless with coding agents.

**How to call it:** `node <agent-config>/copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts <command>`
(Node.js 24.12 or later). Installed, the path starts at `~/.copilot/frameworks/…`. Coding agents call it through
[`workflow-graph-hook.sh`](workflow-graph-hook.sh). `workflow-graph --help` lists the commands; `workflow-graph help
<command>` shows one.

## Interfaces at a glance

*Public* means other tools and people may build on it; a breaking change needs a version bump and a note (CON-9,
CON-12). *Internal* means it may change without notice; it is listed so nobody has to guess. *Experimental* (Backstage
lifecycle) means the interface is new and may still change, but changes are announced here.

| # | Interface | Kind | Direction | Visibility · lifecycle | Described by |
|---|---|---|---|---|---|
| 1 | `workflow-graph-cli`: the commands, flags, arguments and exit codes | command line | provides | public · experimental | [`interfaces/workflow-graph.usage.kdl`](interfaces/workflow-graph.usage.kdl) (usage spec); [Commands](#commands) below |
| 2 | `workflow-graph-hooks-claude-code`: Claude Code hook JSON | stdin/stdout JSON | consumes Anthropic's input, provides the reply | public · experimental | [`schemas/hooks/claude-code.schema.json`](interfaces/schemas/hooks/claude-code.schema.json) |
| 3 | `workflow-graph-hooks-copilot-cli`: Copilot CLI hook JSON | stdin/stdout JSON | consumes GitHub's input, provides the reply | public · experimental | [`schemas/hooks/copilot-cli.schema.json`](interfaces/schemas/hooks/copilot-cli.schema.json) |
| 4 | `workflow-graph-hooks-codex`: Codex hook JSON | stdin/stdout JSON | consumes OpenAI's input, provides the reply | public · experimental | [`schemas/hooks/codex.schema.json`](interfaces/schemas/hooks/codex.schema.json); stdout of any agent: [`schemas/hooks/guard-output.schema.json`](interfaces/schemas/hooks/guard-output.schema.json), [`schemas/hooks/approve-output.schema.json`](interfaces/schemas/hooks/approve-output.schema.json) |
| 5 | `workflow-graph-file`: `workflow.graph.yaml` and the generated `workflow.graph.json` | file | consumes; `compile-graph` writes the JSON | public · production (graph 2.0.0) | [`schemas/workflow-graph.schema.json`](interfaces/schemas/workflow-graph.schema.json) for the shape; rules WG-1 … WG-37 in [`schemas/workflow-graph.schema.md`](../../schemas/workflow-graph.schema.md) |
| 6 | `workflow-graph-ledger`: `.specify/runs/<run>/ledger.jsonl` | file, JSON Lines | provides (`record`, hooks, runner) and consumes (`check-run`, `status`) | public · experimental | [`schemas/ledger-line.schema.json`](interfaces/schemas/ledger-line.schema.json) |
| 7 | Run settings: `.specify/runs/<run>/run.json` | file | runner only | internal | [`schemas/run-settings.schema.json`](interfaces/schemas/run-settings.schema.json) |
| 8 | Launch journal: `.specify/runs/<run>/launches.jsonl` | file, JSON Lines | runner only | internal | [`schemas/launch-journal-line.schema.json`](interfaces/schemas/launch-journal-line.schema.json) |
| 9 | LangGraph checkpoint: `.specify/runs/<run>/checkpoints.db` (+ `-shm`, `-wal`) | SQLite file | runner only | internal; not described: LangGraph owns the format; git-ignored and rebuildable from the ledger | — |
| 10 | The launch prompt sent to role agents, and the role's reply | text | provides the prompt, consumes the reply | public · production (framework) | [`launch-prompt.schema.md`](../../schemas/launch-prompt.schema.md), [`message.schema.md`](../../schemas/message.schema.md) (`message/v2`) |
| 11 | Headless agent calls: `claude -p`, `copilot -p`, `codex exec` | command line | consumes | owned by each vendor | `copilot/knowledge/ai-agents/claude-code-usage-reference.md`, `copilot-usage-reference.md`, `codex-usage-reference.md` |
| 12 | Coding agents' session logs, read by `verify-approvals` | files | consumes | owned by each vendor | the same knowledge references |
| 13 | Environment variables | environment | consumes | public, except *test only* | [Environment variables](#environment-variables) below |
| 14 | Installation glue: [`workflow-graph-hook.sh`](workflow-graph-hook.sh) (finds Node.js ≥ 24.12, else leaves the call alone) and `copilot/hooks/workflow-graph.json` (hook registration per agent) | integration | provides | public · experimental | [Hooks](#hooks) below |

## Commands

Generated from [`interfaces/workflow-graph.usage.kdl`](interfaces/workflow-graph.usage.kdl) by `workflow-graph
interfaces --write`; do not edit by hand. **Effect** says whether a command only reads (`read`), changes files or
starts agents (`write`), or deletes something that cannot be recreated (`destructive`, none today), so an agent can
tell which commands need a person's confirmation.

<!-- generated:commands -->
#### `check-graph`

```text
workflow-graph check-graph
```

Check workflow.graph.yaml, its generated JSON and the conventions.md tables. Effect: **read**.

Example: `workflow-graph check-graph`

#### `compile-graph`

```text
workflow-graph compile-graph
```

Write workflow.graph.json and the conventions.md tables from workflow.graph.yaml. Effect: **write**.

Example: `workflow-graph compile-graph`

#### `record`

```text
workflow-graph record <run> --node <id> --result <result> [options]
```

Append one step to a run's ledger after checking it against the graph. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | Run id, e.g. R-001 |
| `--node <id>` | flag | yes | Graph node id, e.g. P3 or P6.execute |
| `--result <result>` | flag | yes | The node's result: a path id at P0, done, pass, fail … |
| `--task <task>` | flag |  | Task id from tasks.md, for P6 steps |
| `--feature <folder>` | flag |  | The feature folder, e.g. specs/023-cart (first line of a run) |
| `--evidence <paths>` | flag |  | Comma-separated paths the step produced or checked |
| `--role <role>` | flag |  | The role that did the step |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph record R-001 --node P0 --result new-feature --feature specs/023-cart`

#### `check-run`

```text
workflow-graph check-run <run> [options]
```

Check that a run's ledger follows the graph and its hash chain is intact. Effect: **read**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | Run id |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph check-run R-001`

#### `status`

```text
workflow-graph status [run] [options]
```

Show where runs stand: last step, open gate, next allowed, tasks and retries left. Effect: **read**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `[run]` | argument |  | Run id; every run when left out |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph status R-001`

#### `hook guard`

```text
workflow-graph hook guard --agent <agent>
```

Allow or deny a role launch or a ledger edit; reads the agent's pre-tool-use hook JSON on stdin. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `--agent <agent>` | flag; one of `claude-code`, `copilot-cli`, `codex` | yes | The coding agent that calls the hook |

Exit codes: 0 always; a failure becomes a deny in the reply · 1 a check failed or the step was refused; nothing was written · 2 usage error: unknown command or flag, or a required value is missing (message on stderr).

#### `hook approve`

```text
workflow-graph hook approve --agent <agent>
```

Record a gate approval typed in chat; reads the agent's prompt-submit hook JSON on stdin. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `--agent <agent>` | flag; one of `claude-code`, `copilot-cli`, `codex` | yes | The coding agent that calls the hook |

Exit codes: 0 always · 1 a check failed or the step was refused; nothing was written · 2 usage error: unknown command or flag, or a required value is missing (message on stderr).

#### `verify-approvals`

```text
workflow-graph verify-approvals <run> [options]
```

Check that every gate approval in a run is a message a person typed in that session. Effect: **read**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | Run id |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph verify-approvals R-001`

#### `run start`

```text
workflow-graph run start <run> --path <path> --feature <folder> --agent <agent> [options]
```

Record P0, then launch each phase's roles until a gate, an end, or something needing a person. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | New run id, e.g. R-001 |
| `--path <path>` | flag | yes | Path id from the graph: new-project, new-feature, fix-changes-behaviour, fast-path, multi-service |
| `--feature <folder>` | flag | yes | The feature folder, e.g. specs/023-cart |
| `--agent <agent>` | flag; one of `claude-code`, `copilot-cli`, `codex` | yes | The coding agent for every role |
| `--mission <text>` | flag |  | What to build; given to every role in its launch prompt |
| `--role-agent <role=agent>` | flag; repeatable |  | Use another agent for one role, e.g. qa=copilot-cli |
| `--check <command>` | flag; repeatable |  | A script check run after each P6 execute, e.g. "pnpm test" |
| `--max-usd <n>` | flag; default `2` |  | Spending limit per launch, in US dollars |
| `--timeout-minutes <n>` | flag; default `30` |  | Time limit per launch |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph run start R-001 --path new-feature --feature specs/023-cart --agent claude-code --mission "Add a cart"`

#### `run approve`

```text
workflow-graph run approve <run> <gate> [words]... [options]
```

Approve an open gate (or send it back with --changes), confirmed on the terminal, then continue the run. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | Run id |
| `<gate>` | argument | yes | The open gate, G0 … G5 |
| `[words]...` | argument |  | Your words, kept in the ledger |
| `--changes` | flag |  | Request changes instead of approving |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph run approve R-001 G0 "looks right"`

#### `run resume`

```text
workflow-graph run resume <run> [options]
```

Continue a run after a gate was approved in chat or a problem was fixed. Effect: **write**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `<run>` | argument | yes | Run id |
| `--project <dir>` | flag |  | Project folder; default the working folder |

Example: `workflow-graph run resume R-001`

#### `interfaces`

```text
workflow-graph interfaces [options]
```

Check that this description, the code and INTERFACES.md agree; --write regenerates INTERFACES.md's generated sections. Effect: **read**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `--write` | flag |  | Regenerate the generated sections of INTERFACES.md |
| `--root <dir>` | flag |  | Folder holding INTERFACES.md, catalog-info.yaml and interfaces/; default the tool folder |

Example: `workflow-graph interfaces`

#### `help`

```text
workflow-graph help [command]...
```

Show help for the tool or for one command. Effect: **read**.

| Input | Kind | Required | Meaning |
|---|---|---|---|
| `[command]...` | argument |  | Command words, e.g. run start |

Example: `workflow-graph help run start`
<!-- end:commands -->

## Exit codes

| Code | Meaning | Example |
|---|---|---|
| 0 | Success | `check-run R-001` finds nothing wrong |
| 1 | A check failed or the step was refused; nothing was written | `record R-001 --node P4 --result done` while G2 is still open |
| 2 | Usage error, with the message on **stderr** | `record R-001 --bogus x` → `Unknown option '--bogus'; run: workflow-graph help record` |

`hook guard` and `hook approve` always exit 0: a hook that fails would block the agent, so any failure becomes a deny in
the JSON reply instead.

## Environment variables

Generated from `ENVIRONMENT` in [`src/CompositionRoot.ts`](src/CompositionRoot.ts); `workflow-graph interfaces` fails
when the code reads a variable that is not listed. *Human only* means a coding agent must never set it; *test only*
means it exists for the test scenarios and is not part of the stable interface.

<!-- generated:environment -->
| Variable | When unset | Who sets it | Meaning |
|---|---|---|---|
| `WORKFLOW_GRAPH_FRAMEWORK` | the framework folder this tool sits in | user | Folder holding `workflow.graph.yaml`, `workflow.graph.json` and `conventions.md` |
| `AGENTIC_SDLC_GUARD` | the guard is on | human only | `off` lets every role launch through; each is written to the named run's ledger as `guard-off` and reported by `check-run` |
| `COPILOT_HOME` | `~/.copilot` | user | Copilot CLI's folder, where `verify-approvals` and the approval hook find its session logs |
| `WORKFLOW_GRAPH_CLAUDE` | `claude` on `PATH` | user | The Claude Code executable the runner starts |
| `WORKFLOW_GRAPH_COPILOT` | `copilot` on `PATH` | user | The Copilot CLI executable the runner starts |
| `WORKFLOW_GRAPH_CODEX` | `codex` on `PATH` | user | The Codex executable the runner starts |
| `WORKFLOW_GRAPH_NOW` | the system clock | test only | A fixed ISO time written on every ledger line |
| `WORKFLOW_GRAPH_FAKE_REPLIES` | real agents are started | test only | A `replies.json` file; every agent launch answers from it instead of starting an agent |
<!-- end:environment -->

## Files

All run files live in one folder per run, `<project>/.specify/runs/<run>/`, where `<project>` is the repository the
run belongs to and `<run>` is its id (`R-007`). Coding agents may not edit anything under `.specify/runs/` with their
edit tools (rule WG-27): only this tool writes there.

| File | Written by | Read by | Visibility | One sample line |
|---|---|---|---|---|
| `ledger.jsonl` | `record`, `hook approve`, `hook guard` (guard-off lines), the runner | `check-run`, `status`, `verify-approvals`, the guard, the runner | public | `{"seq":1,"prev":"12b3…5b18","hash":"ad07…3076","at":"2026-11-03T15:03:29.201Z","run":"R-007","node":"P0","result":"new-feature","actor":"runner","feature":"specs/023-cart","gen_ai.workflow.name":"agentic-sdlc"}` |
| `run.json` | `run start` | `run resume`, `run approve` | internal | `{"run":"R-007","path":"new-feature","feature":"specs/023-cart","agent":"copilot-cli","overrides":{},"checks":[],"maxUsdPerLaunch":2,"timeoutMinutes":30}` |
| `launches.jsonl` | the runner, before and after each role launch | the runner, so a crash never repeats a launch | internal | `{"key":"P1@1#0:product-spec:propose","event":"started"}` |
| `checkpoints.db` | LangGraph | LangGraph | internal | — (SQLite; `.specify/runs/.gitignore` keeps it out of git) |

The ledger's hash chain: each line's `hash` is the SHA-256 of the previous line's `hash` followed by this line's JSON
without `hash`; line 1's `prev` is the SHA-256 of the run id. Editing or deleting a line breaks the chain, and
`check-run` reports it (WG-16).

## Hooks

Each coding agent calls `workflow-graph-hook.sh hook guard --agent <agent>` before a tool call and `… hook approve
--agent <agent>` when the person submits a prompt. The JSON on stdin is the agent's own format; the schemas list only
the fields this tool reads and accept any others, because the vendors own those formats and may add fields (CON-10).

| Agent | Guard event and matcher | Approval event | Reply on stdout |
|---|---|---|---|
| Claude Code | `PreToolUse`, matcher `Agent\|Edit\|Write\|MultiEdit\|NotebookEdit` | `UserPromptSubmit` | nothing to allow; `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"…"}}` to deny |
| Copilot CLI | `preToolUse` (user level), tool `task` or an edit tool | `userPromptSubmitted` | `{}` to allow; `{"permissionDecision":"deny","permissionDecisionReason":"…"}` to deny; `{}` after an approval |
| Codex | `PreToolUse`, matcher `*`; the run is read from `task_name` (`r004_p4_architecture`) because Codex encrypts a spawn's message | `UserPromptSubmit` | as Claude Code |

## Stability and versioning

The tool's version is `package.json`'s (`workflow-graph --version`), and the usage spec must carry the same one
(IF-4). Until 1.0.0 every public interface is *experimental*: a change is still announced in this file and in the spec
folder that makes it. From 1.0.0, a breaking change to a public interface (a command, flag or ledger field removed or
changed in meaning) needs a new major version, and a deprecation first (CON-9, CON-12).

## How this catalog is kept true

`workflow-graph interfaces` runs in `scripts/check-docs.sh` and fails when:

| Rule | Fails when |
|---|---|
| IF-1 | The usage spec cannot be read |
| IF-2 | A command exists in the code or in the spec but not in both |
| IF-3 | A command's flags differ: missing, extra, value-taking versus boolean, repeatable or not |
| IF-4 | The spec's version is not `package.json`'s |
| IF-5 | The code reads an environment variable missing from `ENVIRONMENT`, or `ENVIRONMENT` lists one it never reads |
| IF-6 | A generated section of this file is not what its source generates |
| IF-7 | An API in `catalog-info.yaml` has no description file or is missing from this file |
| IF-8 | An output schema named by the spec does not exist, or a schema file is not listed here |

The unit tests also validate real ledger lines, run settings, launch-journal lines and hook replies against their JSON
Schemas, so a field added in code but not in its schema fails the build.

## References

- [usage spec](https://usage.jdx.dev/spec/) — the CLI description format; `copilot/knowledge/documentation/usage-spec-deep-dive.md`.
- [JSON Schema 2020-12](https://json-schema.org/specification) — the file and payload schemas.
- [Backstage descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/) — `catalog-info.yaml`.
- [Command Line Interface Guidelines](https://clig.dev/) — help, exit codes, stdout versus stderr.
- `specs/021-interface-catalog/` — why the catalog looks like this (decisions D37–D49).
- `copilot/frameworks/agentic-sdlc/foundations/design/contract-design.md` — CON-15 (publish a catalog), CON-16 (check it against the code).
