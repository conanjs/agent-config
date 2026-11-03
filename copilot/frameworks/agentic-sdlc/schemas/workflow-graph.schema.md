---
schema: schema/v1
last-updated: 2026-11-03
---

# Schema: Workflow Graph and Run Ledger (`workflow-graph/v1`)

**Applies to:** `workflow.graph.yaml` and its generated `workflow.graph.json` (framework root), each run's ledger `<project>/.specify/runs/<run>.jsonl`, and the guard and approval hooks · **Store:** A (graph) and D (ledgers) · **Written by:** the framework maintainer (graph, through a spec and a PR); the Orchestrator with `record`, and the approval hook (ledgers) · **Read by:** `tools/workflow-graph` (`check-graph`, `compile-graph`, `record`, `check-run`, `status`, `hook`, `verify-approvals`) · **Loaded as:** ③-adjacent (the Orchestrator runs `status` at P0)

The **graph** is the rulebook: which phases, gates and per-task steps exist, which move may follow which result, and how often a loop may repeat. The **ledger** is the score sheet of one run: one JSON line per step, append-only and hash-chained. Analogy: the rules of a board game versus the score sheet of one game. Design: `specs/019-workflow-graph/` in agent-config.

## Graph file

```yaml
schema: workflow-graph/v1
name: agentic-sdlc                 # gen_ai.workflow.name in ledger lines
version: 2.0.0                     # framework-version in index.md
start: P0
budgets:                           # defaults; a project constitution's "Agentic SDLC budgets" table overrides
  re-execute-after-check: { default: 2, loop: "Re-execute after failed script check", exhausted: "Escalate with failing output" }
nodes:
  P3: { kind: phase, title: Specify, owner: [product-spec], gate: G2, runs-when: "…", owners-text: "…", speckit: "…", output: "…" }
  G2: { kind: gate }
  P6.execute: { kind: step, of: P6 }
  escalate: { kind: end }
edges:
  - { from: P3, to: G2, on: done }
  - { from: G2, to: P4, on: approved }
  - { from: P6.checks, to: P6.execute, on: fail, budget: re-execute-after-check }
  - { from: G0, to: P2, on: approved, paths: [new-project] }   # only for runs whose P0 result is one of these paths
paths:                              # P0 classification, first match wins
  - { id: new-feature, when: "New feature", run: [P1, P3, P4, P5, P6, P7] }
```

`on: otherwise` matches any result no other edge of that node names. Step nodes (`kind: step`) are tracked per task.

## Ledger line

```json
{"seq":3,"prev":"<sha256 of line 2's hash>","hash":"<sha256(prev + this line without hash)>","at":"2026-11-03T09:12:44.000Z","run":"R-007","node":"G2","result":"approved","actor":"human","quote":"approve G2 R-007 looks good","source":"UserPromptSubmit","session":"…","gen_ai.workflow.name":"agentic-sdlc"}
```

Required: `seq`, `prev`, `hash`, `at`, `run`, `node`, `result`, `actor` (`orchestrator` · `script` · `human` · `runner`), `gen_ai.workflow.name`. Optional: `task`, `attempt`, `evidence` (paths), `feature` (on the first line: the feature folder whose `tasks.md` the join reads), `gen_ai.agent.name`, `usage`, `quote`, `source`, `session`. Line 1's `prev` is the SHA-256 of the run id.

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| WG-1 | The graph file has the shape above | It parses and has `schema: workflow-graph/v1`, `name`, `version`, `start`, `budgets`, `nodes`, `edges`, `paths` | script |
| WG-2 | Node ids and kinds are valid | Every id matches `^[A-Za-z][A-Za-z0-9.-]*$`; every `kind` is `phase`, `gate`, `step` or `end` | script |
| WG-3 | Edges join existing nodes | Every `from` and `to` is a node | script |
| WG-4 | Every node is reachable from `start` | A walk along edges from `start` reaches it | script |
| WG-5 | Every node can finish | From every node that is not an end, a walk reaches an end node | script |
| WG-6 | Every branching node has one `otherwise` edge | A node with two or more outgoing edges has exactly one `on: otherwise` | script |
| WG-7 | Every gate can be approved and sent back | A gate has at least one `approved` edge, approved edges have disjoint `paths`, and it has a `changes-requested` edge | script |
| WG-8 | Owners are roles | Every `owner` entry is a role id in `conventions.md` §1 | script |
| WG-9 | A phase's gate exists | A phase's `gate` names a node of kind `gate` | script |
| WG-10 | Budgets are defined and whole | Every edge `budget` names a key of `budgets`; every `default` is an integer ≥ 0 | script |
| WG-11 | A loop with no gate has a budget | Every loop that passes no gate has at least one edge with a `budget`; the edge that closes an unbounded loop is reported (a loop through a gate is bounded by the human) | script |
| WG-12 | Paths are walkable | Each phase of a path's `run` is reachable from the one before it; the first is reachable from `start` | script |
| WG-13 | The JSON is the compiled YAML | `workflow.graph.json` equals what `compile-graph` would write | script |
| WG-14 | The conventions tables are generated | The marked blocks in `conventions.md` §5 and §9 equal what `compile-graph` would write | script |
| WG-15 | Ledger lines are well formed | Each line is JSON with the required fields; `seq` runs 1, 2, 3 …; `at` never goes back | script |
| WG-16 | The ledger is hash-chained | Each line's `prev` is the previous line's `hash` and its `hash` is SHA-256 of `prev` plus the line without `hash` | script |
| WG-17 | Every move follows an edge | A run-level line follows the previous run-level line by an edge whose `on` is that line's result (and whose `paths` include the run's path); a step line does the same within its task | script |
| WG-18 | Loops stay within budget | Following a budgeted edge more than its budget (per task for steps, per run otherwise) is refused | script |
| WG-19 | Gate results come only from a human | A gate line has `actor: human`, `quote`, `source`, `session`; `record` refuses gate results and `actor: human` | script |
| WG-20 | The join waits for every task | The `done` line of a node with `join: all-tasks` (P6) comes only after every task of the feature's `tasks.md` has a `P6.review` `pass` line | script |
| WG-21 | Evidence holds paths, not contents | Each `evidence` entry is a single-line relative path of at most 300 characters | script |
| WG-22 | Guard-off windows are visible | With `AGENTIC_SDLC_GUARD=off` the guard allows and appends a `guard-off` line; `check-run` warns about each one | script |
| WG-23 | `status` tells where a run stands | It prints the last step, the open gate and its approval reply, the next allowed steps and attempts left; with no run id it lists open runs | script |
| WG-24 | The guard denies a launch the run does not allow | A subagent launch whose prompt names `run:` is denied unless its phase is open (gate approved, edge allowed) and, in P6, the task's attempt is within budget; the reason names what is missing | script |
| WG-25 | The guard leaves other calls alone | A launch without `run:`, or any other tool, gets no decision | script |
| WG-26 | The guard fails closed | Unreadable hook input, a missing or broken ledger for a named run, or any unexpected error gives a deny with the reason | script |
| WG-27 | Ledgers are edited only by the tool | An edit or write tool call on a path under `.specify/runs/` is denied | script |
| WG-28 | Approvals come from the human's own message | A prompt containing `approve G<n> <run>` or `changes G<n> <run>` for that run's open gate appends a human line quoting the prompt; any other prompt writes nothing; the hook never blocks the prompt | script |
| WG-29 | Each agent gets its own output form | Deny and no-decision outputs match `specs/019-workflow-graph/contracts/hooks.md` for Claude Code, Copilot CLI and Codex | script |
| WG-30 | Approvals are verified against the session log | `verify-approvals` finds each human line's quote as a user message in that agent's session log | script |

## References

**Local artifacts:**
- `specs/019-workflow-graph/` (agent-config): spec, plan, data model, contracts, decisions.
- `conventions.md` §5, §8, §9: the workflow the graph encodes.
- `schemas/launch-prompt.schema.md`: the `run:` key the guard reads.

**External authoritative sources:**
- [OpenTelemetry GenAI agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md): the `gen_ai.*` field names (status Development).
- [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Copilot CLI hooks](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference), [Codex hooks](https://learn.chatgpt.com/docs/hooks): hook inputs and deny outputs.

## Related

- `agents/orchestrator.md`: ORC-R3 and ORC-R5 are checked against this graph and the ledger.
- `copilot/knowledge/ai-agents/graph-engineering-study-guide.md`: what an explicit workflow graph is for.
