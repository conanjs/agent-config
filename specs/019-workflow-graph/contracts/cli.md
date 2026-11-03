# Contract: `workflow-graph`

`node copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts <command> [options]`

Installed form: `~/.copilot/frameworks/agentic-sdlc/tools/workflow-graph/src/main.ts`. Node.js ≥ 24, no dependencies except `--write`, which needs the repo's `pnpm install` for `yaml`.

| Command | Reads | Writes | Exit 0 when | Exit 1 when |
|---|---|---|---|---|
| `check-graph` | `workflow.graph.yaml`, `workflow.graph.json`, `conventions.md` (in `WORKFLOW_GRAPH_FRAMEWORK`, default the framework folder) | nothing | the graph is valid and the JSON and tables match the YAML | any WG-1 … WG-14 finding: `  WG-n  <file>: <message>` per finding, then `FAIL (<n>)` |
| `compile-graph` | the YAML, conventions.md | `workflow.graph.json`, the three generated blocks in `conventions.md` | written | the YAML breaks a graph rule (nothing written) |
| `record <run> --node <id> --result <r> [--task T…] [--feature <folder>] [--evidence a,b] [--role <role>] [--project <dir>]` | the graph, the ledger, the project's constitution budgets, the feature's tasks.md | one appended line (P6 execute lines get their `attempt` counted) | the move is allowed | not an edge, over budget, a gate result, a bad evidence path: `  WG-n  <run>: <message>` and `FAIL (1)`; nothing written |
| `check-run <run> [--project <dir>]` | the same | nothing | the run follows the graph (warnings allowed) | any WG-15 … WG-22 error |
| `status [<run>] [--project <dir>]` | the same | nothing | always, when the run can be read: last step, open gate and its reply, next allowed, tasks and retries left; without a run id every open run | the run id is bad or has no ledger |
| `hook guard --agent claude-code\|copilot-cli\|codex` | stdin (hook JSON), the graph, the ledger of the `run:` the launch names | stdout in the agent's format (`hooks.md`); a `guard-off` line when switched off | always exit 0 | never: errors become a deny |
| `hook approve --agent claude-code\|copilot-cli\|codex` | stdin (prompt JSON), the ledgers it names | one `human` line per `approve\|changes G<n> <run>` for an open gate | always exit 0; prints nothing (Claude, Codex) or `{}` (Copilot) | never |
| `verify-approvals <run> [--project <dir>]` | the ledger, each approval's session log (agent from the line's `source`) | nothing | every quote is a message typed in its session | an approval not found (WG-30) |

**Output style:** one finding per line with its rule id (as the other framework validators do since specs 002/006), then `PASS (<w> warning(s))` or `FAIL (<n>)`.

**Environment:** `AGENTIC_SDLC_GUARD=off` (set by the human for the harness) makes `hook guard` allow launches and append a `guard-off` line to a named run's ledger; `check-run` warns about each. `WORKFLOW_GRAPH_NOW` fixes the clock (tests). `COPILOT_HOME` moves Copilot's session logs.

**Launcher:** hooks call `workflow-graph-hook.sh`, which finds Node.js 24.12 or later (nvm included) and otherwise leaves the call alone.
