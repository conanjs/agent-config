# Research: The agentic-sdlc workflow as an enforced graph

## What the sources say (read 2026-11-02)

| Source | Fact used | Where |
|---|---|---|
| Graph Engineering survey | Graph engineering builds explicit, evolving graphs of tasks, agents and system states; three views: task organization, agent coordination, runtime state management (recording, fault localization, failure recovery), plus evolution | [arXiv 2608.21156](https://arxiv.org/abs/2608.21156) §4 |
| TrueFoundry guide | Five steps: nodes, edges and routing (including the unexpected result), state, failure handling, tracing with graph/run/node ids; start simple | [TrueFoundry](https://www.truefoundry.com/blog/graph-engineering-enterprise-guide) |
| LangGraph Graph API (JS) | Nodes are plain functions, "an LLM or just good ol' code"; conditional edges return the next node(s); `Send` fans out with per-branch state; one reducer per state key; recursion limit default 25 | [Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api) |
| LangGraph interrupts (JS) | `interrupt(value)` pauses a node and needs a checkpointer and a `thread_id`; resume with `new Command({ resume })`; the node re-runs from its start on resume | [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) |
| LangGraph persistence | A checkpointer saves state per thread: human-in-the-loop, time travel, recovery after a failure | [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) |
| npm registry (2026-11-02) | `@langchain/langgraph` 1.6.0, `@langchain/langgraph-checkpoint-sqlite` 1.1.0, `@langchain/core` 1.3.2 | `npm view` |
| OpenTelemetry GenAI agent spans | Span names `invoke_workflow {gen_ai.workflow.name}`, `invoke_agent {gen_ai.agent.name}`, `execute_tool {gen_ai.tool.name}`; status Development (not stable); moved to its own repository | [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md) |
| Claude Code hooks | `PreToolUse` denies with `hookSpecificOutput.permissionDecision: "deny"` and a reason, or exit 2; the subagent tool is `Agent` with `subagent_type`, `prompt`, `description`; `SubagentStart` cannot block | [Hooks reference](https://code.claude.com/docs/en/hooks) |
| Copilot hooks | `preToolUse` input `toolName`, `toolArgs`; deny with `{"permissionDecision":"deny","permissionDecisionReason":…}` (reason required); the subagent tool is `task`, matched as `Agent` in the PascalCase form | [CLI hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) |
| Codex hooks | `PreToolUse` fires for `spawn_agent` (also matched as `Agent`); deny with the same `hookSpecificOutput` JSON, legacy `{"decision":"block"}`, or exit 2; hooks must be trusted in `/hooks` | [Hooks](https://learn.chatgpt.com/docs/hooks) |

## Decisions

| # | Question | Options | Chosen | Why |
|---|---|---|---|---|
| D1 | Who orchestrates | (a) chat session only, with enforcement; (b) LangGraph runner only; (c) both in phases | (c) | V, 2026-11-02: "Both, in phases (Recommended)" |
| D2 | Graph file format | YAML · JSON · LangGraph code as the source | YAML in the framework folder | Readable in review; the framework's other registries (atlas) are YAML; phase 2 builds the LangGraph graph from it, so code never becomes a second source |
| D3 | Where the ledger lives | the project repo `.specify/runs/` · the agent's home folder · a database | project repo, `.specify/runs/<run>.jsonl`, committed with the feature | The run is part of the feature's evidence (reviewed at G5); survives sessions and machines; same append-only JSON Lines form as the turn token history |
| D4 | Tamper evidence | none · a hash chain · signed lines | hash chain (each line has the SHA-256 of the line before) | Catches an edited or deleted line with no keys to manage; signing is overkill for one person's runs |
| D5 | Enforcement point in chat | instructions only · a hook on subagent launch · a hook on every tool | hook on the subagent-launch tool | All three tools can deny that call (sources above); every phase change in agentic-sdlc is a role launch, so this one point covers the graph's edges |
| D6 | Hook failure | allow (fail open) · deny (fail closed) | deny, with the reason | A guard that silently lets calls through when it breaks is not a guard; only agentic-sdlc launches (a `run:` in the prompt) are affected |
| D7 | Field names | our own · OpenTelemetry GenAI names | GenAI names where one exists | Phase 2 exports traces without a mapping table; status is Development, so the schema pins the convention version it follows |
| D8 | Rule-id prefix | `WG` | `WG` | Not used by any other schema (checked against the framework's 342 rule ids at implementation) |

### Design decisions added at plan time (2026-11-03)

| # | Question | Options | Chosen | Why |
|---|---|---|---|---|
| D9 | Graph source format and what hooks read | (a) YAML read by every tool (needs a parser at hook time); (b) JSON only (no comments, harder to review); (c) YAML source compiled to JSON | (c): `yaml` 2.9.1 as a devDependency, used only by `--write`; hooks and the runner read `workflow.graph.json` | Hooks stay dependency-free; the source stays reviewable with comments; the JSON is drift-checked like the atlas pages |
| D10 | Who records a gate approval | (a) the Orchestrator via `--record`; (b) a prompt-submit hook from V's own message | (b) | With (a) the agent could approve its own gate. Claude Code and Copilot both pass the typed text as `prompt` |
| D11 | Where the Copilot hooks install | (a) project `.github/hooks/`; (b) user `~/.copilot/hooks/` | (b) | Spike: Copilot did not load a repository hook in a folder outside `trustedFolders`; user hooks always loaded |
| D12 | How phase 2's dependencies are kept away from hooks | (a) add to the root `package.json`; (b) own `package.json` under `runner/` | (b) | 79 MB of `node_modules` and a native module stay out of every hook start and out of `check-docs.sh` installs |
| D13 | Checkpoint store for phase 2 | (a) `@langchain/langgraph-checkpoint-sqlite` (`better-sqlite3`, native); (b) a custom saver on Node's built-in `node:sqlite`; (c) LangGraph's in-memory saver | (a) | Tested working; (b) means maintaining LangGraph's checkpoint interface ourselves; (c) loses gates on exit. Revisit (b) if the native build fails on Windows |
| D14 | Kill switch | none · env var set by the human · a file flag the agent could write | env var `AGENTIC_SDLC_GUARD=off` in the harness's own environment | Hooks inherit the harness's environment, not the agent's shell, so the agent cannot flip it; a file flag could be written by the agent |

### Design decisions added 2026-11-03, after V chose class-modeled

| # | Question | Options | Chosen | Why |
|---|---|---|---|---|
| D15 | How TypeScript runs in hooks with no build | (a) Node 24 type stripping, erasable syntax only; (b) `tsc` build to a committed `dist/`; (c) build at install time; (d) `--experimental-transform-types` | (a), `erasableSyntaxOnly: true`, `tsc --noEmit` for checking | Stable since Node 24.12.0 (Node docs); tested on 24.22.1: a class with `#` fields and an interface ran with no warning. (b) keeps two copies; (c) breaks when the install step is skipped; (d) is experimental and **removed in Node 26**. Cost: no parameter properties (tested: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX … parameter property is not supported in strip-only mode`), no `enum` (already banned by TSN-20), no tsconfig `paths` (Node ignores tsconfig), `.ts` extensions in relative imports |
| D16 | How three coding agents are supported | (a) `if/else` or `switch` on the agent name wherever behaviour differs; (b) one copy of the tool per agent; (c) ports owned by the application, one adapter per agent, chosen once by a registry in the composition root, plus a capability value object | (c) | (a) spreads the agent name through parsing, output, session logs and installing: every new agent edits every branch (Open/Closed, Single Responsibility; `knowledge/software-design/design-principles/open-closed.md`); (b) forks the rules three times. (c) is hexagonal ports and adapters (`architecture-styles/hexagonal-architecture.md`): the rules never name an agent; a new agent is new files plus one registry line. Three verified variants already exist, so the abstraction is earned, not speculative |
| D17 | How the adapters are kept honest | (a) per-adapter tests only; (b) one shared contract suite run against every adapter with its recorded real payloads | (b) | Proves each adapter can replace another (Liskov substitution) instead of trusting the interface's types; the recorded Claude Code and Copilot payloads from the 2026-11-03 spikes are the first fixtures |

### Decisions added 2026-11-03: where the code lives, and whether to copy agent-runtime

| # | Question | Options | Chosen | Why |
|---|---|---|---|---|
| D18 | Where phase 1 is built | (a) agent-config, `copilot/frameworks/agentic-sdlc/tools/workflow-graph/` as its own package; (b) a new repo pinned by tag and SHA; (c) agent-runtime | (a). V, 2026-11-03: "for now, only implement in this agent-config repo" | The rulebook and its guard change in one pull request; the installers already link `~/.copilot`. Move out only if the tool gets users outside these installers or needs a runtime dependency |
| D19 | Copy agent-runtime's code and modify it, or write new | (a) copy all and modify; (b) copy selected files; (c) write new, reusing agent-runtime's verified facts and ideas by citation | (c) | Phase 1 needs none of agent-runtime's machinery: no LangGraph, no workers, no patch export, no SQLite. A copy would bring about 2,400 lines and a native module into hooks that must load no dependencies. Its shape is not class-modeled as our overlay defines it (one 601-line `Runtime` class holding the graph and every node inline; 11 exported functions; no domain/application/infrastructure layers or ports), so a copy would be rewritten anyway. Two diverging copies would also break constitution principle I. **Reused by citation:** digest-bound approval (an approval names exactly what it approves), the operation registry for a launch whose outcome is unknown after a crash (phase 2), and its verified Codex headless flags (`--ephemeral`, `--output-schema`, `--output-last-message`, the `-c` sandbox settings) for phase 2's `CodexExecLauncher` |

### D20 (2026-11-03): the Codex launch guard

**What failed, tested separately:** (1) trusted matcher `Agent|apply_patch|Edit|Write`: the hook ran for `apply_patch` and `UserPromptSubmit`, never for the spawn; (2) `-c features.multi_agent_v2=false`: no change, the spawn stayed in the `collaboration` namespace (`codex features list` already shows v2 off); (3) a logging-only hook matching `*` for one run needs `--dangerously-bypass-hook-trust`, which the agent's safety classifier refuses.

**Cause, from Codex's source** (`registry.rs` `function_hook_tool_name`, identical at `rust-v0.164.0-alpha.11` and `main`): the `Agent` alias is given only to `spawn_agent` in the default or `multi_agent_v1` namespace; in `collaboration` the hook name is `collaborationspawn_agent`, which `Agent` (case-sensitive regex) cannot match. Separately, collaboration tools carry encrypted arguments, so the `message` (our launch prompt) reaches the client as ciphertext; `task_name` is plaintext.

| Option | Gains | Costs |
|---|---|---|
| (a) Matcher `Agent\|spawn_agent\|…` | Precise | Breaks again if Codex renames or re-namespaces the tool (the app build already differs from the docs) |
| (b) Matcher `*` (chosen, V: "try a match-everything matcher") | Every tool reaches the guard; the adapter decides in tested code | About 0.1 s per Codex tool call, as in Copilot |
| (c) Read the run from `task_name` (chosen, needed with (a) or (b)) | Works although the message is encrypted | A naming convention the Orchestrator must follow in Codex (`r004_p4_architecture`) |
| (d) Accept no launch guard in Codex | Nothing to change | Codex runs only checked afterwards by `check-run` |

## P4 decision records (the framework's trees, walked for this feature)

Node ids are cited exactly (`conventions.md` §10). Rejected alternatives are listed with each.

| Tree | Path taken | Decision | Rejected |
|---|---|---|---|
| Tech stack (TS) | First walk: TS-Q0 no org standard → TS-Q1 the mission names no stack → TS-Q2 extends an existing codebase → inherit → JavaScript. **Re-walked 2026-11-03:** TS-Q1 the mission now fixes the paradigm `class-modeled`, whose `supports:` lists only `typescript-node` → **TypeScript on Node 24** | TypeScript run by Node's type stripping, no build (D15) | Plain JavaScript (the first answer: no stack overlay exists for class-modeled in JS, so its lint rules could not be enforced); TypeScript compiled to a committed `dist/` (a second, generated copy of every file); Python LangGraph |
| Toolchain (TC) | TC-Q1 the repo has tool config → **inherit as-is** | pnpm 12.15, Cucumber.js 13.3, `scripts/check-docs.sh`, CI `validate-docs` | A unit-test runner beside Cucumber (`node:test`): the constitution's bar is scenarios; one runner keeps one report |
| Architecture pattern (AP) | AP-Q1 single team, single cadence → AP-Q2 moderate growth → **single project, modules by responsibility** (phase 2 a separate package for its dependencies, D12) | `tools/workflow-graph/` modules: graph, compile, ledger, run-check, decide, adapters, cli | One large script (breaks the 50-line unit limit); a separate repo (two places to install) |
| Paradigm (PDM) | The tree's walk (2026-11-02): PDM-Q1 the existing tools follow no one declared paradigm → PDM-Q2 owns invariants across operations? → PDM-Q3 input → output transform? yes → `functional-pipeline`. **Superseded by V on 2026-11-03:** "please follow the foundations, practices, class-modeled paradigm when writing code". Re-walked with that decision: PDM-Q2 **yes**: the `Run` owns invariants that must hold across many operations of one run (legal moves, budgets, gates, append-only chain), and three coding agents vary behind one port, the substitution case the paradigm's "Why classes" names | **`class-modeled@1`** with the `typescript-node` overlay. Tier B: only `main.ts` and `CompositionRoot.ts`. **Form deviation (R11):** injected collaborators are `readonly #field`s set in the constructor instead of `private readonly` constructor parameters (D15) | `functional-pipeline` (the tree's first answer; kept as the rejected option: it fits the checks but gives no home to the per-agent variation and the run's invariants) |
| Risk tier (RT) | RT-Q1 authn/authz? **yes**: the guard authorizes agent actions → **HIGH** | Threat model in `plan.md`; security review of every task; sign-off before G5 | MEDIUM (the guard is a security control, so fail-closed says HIGH) |
| Test strategy (TD) | TD-Q1 the constitution fixes a bar (principle IV) → TD-Q2 forced yes by HIGH → unit tests mandatory + security review → TD-Q3 crosses a process boundary (the harness calls the hook; the runner calls the CLIs) → **unit + integration** | Scenarios per rule (unit level, through the CLI with fixtures); recorded real hook payloads; live checks per tool (`quickstart.md`) | Mocks of the CLIs only (a field rename in a tool would pass the tests and fail live) |
| Deployment topology (DT) | DT-Q1 changes deployment (new hook files) → DT-Q2 topology exists (installers link `~/.copilot`, seed `~/.claude`, `~/.codex`) → **inherit** → DT-Q4 risky behaviour → **flag**: opt-in per run (`run:`) and the D14 kill switch | Hooks ship through the existing installers | A separate install step |
| Contract change (CC) | CC-Q1 additive only? **yes** (`run:` in `launch-prompt/v1`, `requires:` in task lines; old prompts and lines still parse) → **minor** | No schema major bump | — |
| Scope boundary (SCOPE) | SCOPE-Q1 inside the mission → SCOPE-Q2 no accepted criterion of a merged spec changes → SCOPE-Q3 phase 2 is not needed for phase 1's stories to be testable → **phase 2 is P2/its own spec** | Phase 2 out of this spec | — |

## Capability spikes (run 2026-11-03, throwaway code in the session scratch folder)

| Spike | What ran | Result |
|---|---|---|
| LangGraph.js runtime | `@langchain/langgraph` 1.6.0 + `@langchain/langgraph-checkpoint-sqlite` 1.1.0 on Node 24.22.1: plan → `Send` × 3 tasks (each node runs `node -e` as a child process) → join → verify loop with budget → G5 `interrupt()` → end, with `SqliteSaver` on a file | Process 1 stopped at G5 with the interrupt payload; process 2 resumed with `Command({ resume: "approved by V" })` and finished; a third resume re-ran nothing. The join ran once after all three tasks. **Gotcha:** a node may not share a name with a state key ("gate is already being used as a state attribute"), so the runner prefixes node ids or keeps state keys distinct (WG rule) |
| Claude Code guard | Temp project with `.claude/settings.json` `PreToolUse` matcher `Agent` → a script printing the deny JSON; `claude -p … --setting-sources project --model haiku --output-format json` (2.1.129) | Denied; the agent reported the exact reason. The recorded input: `tool_name: "Agent"`, `tool_input: {description, prompt, subagent_type}`. Cost $0.044 |
| Copilot guard, untrusted folder | Same in a temp folder outside `trustedFolders` with `.github/hooks/guard.json` (`preToolUse`) | The hook never ran (session log: `sessionStart` and `agentStop` user hooks ran, no `preToolUse`); the subagent ran |
| Copilot guard, trusted folder | Same in a temp folder under `/Users/vinh.doq` (trusted), removed afterwards | Denied: "Denied by preToolUse hook: G2 not approved in run R-007 (spike)". Input: `toolName: "task"`, `toolArgs: {name, prompt, agent_type, description, mode}` |
| Headless roles | `claude -p --agent sdlc-qa` and `copilot -p --agent sdlc-qa` | Both loaded the role wrapper (Claude answered `qa`; Copilot named the role file). Codex not run: it has no `--agent` flag |
| Spend | — | Claude $0.07; Copilot about 33 AI credits ($0.33) |

## Existing runtime: `agent-runtime` (built by Codex, read 2026-11-03)

`/Users/vinh.doq/workspace/agent-runtime` is a separate TypeScript project on the same LangGraph.js 1.6.0 and SQLite checkpoint packages. Its README says it is independent of agent-config.

| Aspect | agent-runtime (specs 001, 002 there) | This spec (019) |
|---|---|---|
| Job | Run one coding task: writer → tests ∥ reviewer → bounded rework → you accept an exact patch digest → export | Make the whole agentic-sdlc workflow (P0–P7, G0–G5, ten roles) follow a written graph |
| Graph | Fixed in code: `prepare`, `implement`, `execute_tests`, `inspect_review`, `decision`, `approval` (`interrupt`), `export` | A data file the tools read |
| Our knowledge | **None by design**: the worker prompt holds only the task, acceptance and allowed paths; Codex runs with `project_doc_max_bytes=0`, `skills.include_instructions=false`, hooks and multi-agent disabled | The roles' own files, presets, profiles and `refs:` load as they do in chat |
| Workers | Codex only; Claude Code and Copilot per role planned (its spec 002, not built) | Phase 1: the chat session's own subagents in all three tools |
| Storage | LangGraph `SqliteSaver` plus its own `operations.sqlite` (runs, leases, operations, events) and a folder per run with work copies | A JSON Lines ledger per run in the project; phase 2 adds a checkpoint file |
| Crash safety | An operation registry: a launch whose outcome is unknown after a crash stops as "needs attention" instead of running twice | Ledger plus `--status`; phase 2 would need the same registry |
| Human input | One decision at the end; its spec 002 plans a question and permission inbox | Every gate, from your typed message |

**Consequence for phase 2:** a second LangGraph runner in agent-config would repeat agent-runtime's hardest parts (leases, operation registry, digest-bound decisions). The options move to the phase 2 spec: (a) agent-runtime reads `workflow.graph.json` and builds worker prompts from agent-config's launch prompts; (b) a separate runner here; (c) keep them apart (agent-runtime for single coding tasks, phase 1 here for the chat workflow). Phase 1 does not depend on the choice.

## The graph, today in prose (what the file must hold)

| From `conventions.md` | Becomes |
|---|---|
| §5 phase table (P0–P7, owners, outputs, gates G0–G5) | nodes with `owner`, `output`; gate nodes with an `approved` edge and an `changes-requested` edge |
| §5 P0 classification, first match wins | the `paths` list: condition → phase sequence |
| §5 P6 loop, steps 1–5 | sub-nodes `execute`, `checks`, `review`; edges `pass`, `fail` (budget 2), `review-fail` (budget 2), `spec-or-plan-wrong` (to P3/P4, budget 1) |
| §8 fix fast path | a path P0 → P6 → P7 with its eligibility condition |
| §9 budgets | `budget:` on each back-edge; parallel `[P]` cap 4 as a graph setting; constitution overrides read from "Agentic SDLC budgets" |

## Phase 2 (its own spec, after this one ships)

**Runtime options (decided in the phase 2 spec, kept here so neither is lost — constitution principle V):**

| Option | Gains | Costs |
|---|---|---|
| LangGraph.js runner (default) | Works with all three tools as headless workers; `interrupt()` pauses for a gate mid-run; SQLite checkpoints survive closing the session | One dependency family (`@langchain/*`) to keep current; the runner, not a chat window, is where you approve |
| Claude Code dynamic workflows | Built into Claude Code: a JavaScript script with `agent()`, `parallel()`, `pipeline()`; progress view; replay of saved results on relaunch ([docs](https://code.claude.com/docs/en/workflows)) | Claude Code only; "no mid-run user input", so each gate ends one workflow and starts the next; resume needs the same session; the script cannot read files, so the graph file must be passed in as `args` |

- **Runner**: `workflow-run.mjs` builds a LangGraph.js `StateGraph` from `workflow.graph.yaml` (same nodes, edges, budgets), with `SqliteSaver` checkpoints keyed by the run id as `thread_id`.
- **Workers**: each role node runs a headless agent: `claude -p --agent sdlc-<role> --output-format json`, `copilot -p`, or `codex exec --json < /dev/null`, with the launch prompt as input; the reply follows `message.schema.md`.
- **Gates**: `interrupt()` with the gate message; V approves in the runner's terminal (or a small page); the quote goes to the ledger.
- **How V continues a paused run**: three commands, never the SQLite file: `workflow-run status R-007` (where it stopped and what it asks), `workflow-run approve R-007 G3 "looks good"` (the runner calls `invoke(new Command({ resume }))` with `thread_id` R-007; LangGraph loads the checkpoint by itself), `workflow-run resume R-007` (after a crash: continue from the last checkpoint). agent-runtime already has this shape: `status RUN_ID`, `decide RUN_ID --digest … --decision accept`, `resume RUN_ID`.
- **Parallel tasks**: `Send` per ready `[P]` task, capped at the budget; the join waits for every required task.
- **Tracing**: the same ledger lines, plus optional OpenTelemetry spans.
- **To verify first**: each CLI's headless flags and permission mode for unattended edits, and that a headless run picks up the role's agent file.
