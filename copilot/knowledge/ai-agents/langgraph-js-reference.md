---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["@langchain/langgraph 1.6.0", "@langchain/langgraph-checkpoint-sqlite 1.1.0", "@langchain/core 1.3.2", "Node.js 24.22.1, macOS"]
last-verified: 2026-11-03
last-updated: 2026-11-03
tags: [langgraph, langgraph-js, graph-engineering, orchestration, checkpoints, human-in-the-loop]
---

# LangGraph.js: graph runtime facts for agent orchestration

## Summary
**TL;DR:** LangGraph.js runs a graph of plain JavaScript functions over a shared state. Conditional edges route; `Send` fans out with per-branch input; reducers join parallel writes. With a checkpointer, `interrupt()` pauses a run for a person, and a different process can resume it. Tested on 2026-11-03: a gate paused in one process and resumed in another from a SQLite file.
**Use this when:** deciding whether LangGraph.js can execute an agent workflow (gates, retries, parallel tasks, crash-safe runs), or writing such a runner.
**Not this doc:** what Graph Engineering is → `graph-engineering-study-guide.md`; the agentic-sdlc design that uses this → `specs/019-workflow-graph/` in agent-config.

## Scope
The JavaScript LangGraph packages listed in `applies-to`, from the official docs read on 2026-11-02/03 and a spike run on this machine on 2026-11-03 (a five-node graph: plan, three parallel tasks each running a child process, a join, a budgeted retry loop, a gate).

## Catalog

### Building blocks

| Item | Fact | Status |
|---|---|---|
| Nodes | Functions that take the state and return an update; "an LLM or just good ol' code". A node may run a child process (`execFileSync`) | ✅[^1][^5] |
| Conditional edges | `addConditionalEdges(node, fn)`: `fn(state)` returns the next node name(s) or `END`; several names run in parallel in the next super-step | ✅[^1] |
| `Send` | A conditional edge may return `new Send(node, input)` objects: one branch per object, each with its own input (map-reduce, unknown branch count) | ✅[^1][^5] |
| Reducers | One per state key: `(stored, update) => next`; the default replaces. A concat reducer collects every parallel branch's write | ✅[^1][^5] |
| Join | A node reached by an edge from parallel branches ran **once**, after all three branches finished | ✅[^5] |
| Recursion limit | Caps super-steps per run, default 25 (`recursionLimit` at the top level of the config); exceeding it throws `GraphRecursionError` | ✅[^1] |
| Name clash | `addNode` throws when a node id equals a state key ("… is already being used as a state attribute (a.k.a. a channel), cannot also be used as a node name") | ✅[^5] |

### Checkpoints and human-in-the-loop

| Item | Fact | Status |
|---|---|---|
| Checkpointer | Saves the graph state per thread, named by `configurable.thread_id`; enables human-in-the-loop, time travel, recovery after a failure | ✅[^3] |
| Without a checkpointer | `compile()` with no checkpointer runs a graph start to end; a node calling `interrupt()` then throws `GraphValueError: No checkpointer set` | ✅[^5] |
| `MemorySaver` | Built into `@langchain/langgraph`; pause and resume work within one process; the state is gone when the process exits | ✅[^5] |
| Other savers | Separate packages: `@langchain/langgraph-checkpoint-sqlite` 1.1.0, `-postgres` 1.1.2, `-redis` 1.1.0 (npm, 2026-11-03) | ✅[^4] |
| SQLite saver | `@langchain/langgraph-checkpoint-sqlite` exports `SqliteSaver.fromConnString(<file>)`; it depends on `better-sqlite3` (native; a prebuilt binary installed on Node 24.22.1, macOS) | ✅[^4][^5] |
| `interrupt(value)` | Pauses inside a node; needs a checkpointer and a `thread_id`; the caller gets `value` under `__interrupt__` | ✅[^2][^5] |
| Resume | `graph.invoke(new Command({ resume: x }), config)` with the same `thread_id`; `x` becomes `interrupt()`'s return value; the node re-runs from its start, so code before `interrupt()` runs again | ✅[^2] |
| Across processes | Process 1 stopped at the gate and exited; process 2, with the same SQLite file and `thread_id`, resumed and finished | ✅[^5] |
| Resuming a finished thread | Re-ran nothing and returned the final state | ✅[^5] |

## Lookup notes
- Code before `interrupt()` in a node runs again on resume: keep side effects (launching an agent, writing a ledger line) after the interrupt or in a separate node.
- Keep node ids and state keys in different namespaces (for example, prefix node ids).
- The npm README and the API reference show different `fromConnString` examples (`":memory:"` vs `""`); pass a file path for durable runs.

## Takeaways
- LangGraph.js can execute a gated, budgeted, parallel workflow whose workers are command-line agents; the gate survives the process.
- Put side effects after `interrupt()`, never before it.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-03

## References
- [Graph API (JavaScript)](https://docs.langchain.com/oss/javascript/langgraph/graph-api) — LangChain, living. Backs: nodes, conditional edges, `Send`, reducers, recursion limit. [^1]
- [Interrupts (JavaScript)](https://docs.langchain.com/oss/javascript/langgraph/interrupts) — LangChain, living. Backs: `interrupt()`, checkpointer and `thread_id` requirement, `Command({ resume })`, node re-run on resume. [^2]
- [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) — LangChain, living. Backs: per-thread checkpoints and what they enable. [^3]
- [@langchain/langgraph-checkpoint-sqlite](https://npmjs.com/package/@langchain/langgraph-checkpoint-sqlite) — npm registry, read 2026-11-03 (1.1.0, depends on `better-sqlite3` ^12.10.0). Backs: `SqliteSaver`, the native dependency; the Postgres and Redis saver versions (`npm view`, same day). [^4]
- Spike in agent-config's session scratch folder — local test, 2026-11-03, Node 24.22.1, the package versions in `applies-to`: fan-out, child-process nodes, join, budgeted loop, gate paused in one process and resumed in another, the name clash, no-checkpointer and `MemorySaver` behaviour; recorded in `specs/019-workflow-graph/research.md` (capability spikes). [^5]

## Related
- `ai-agents/graph-engineering-study-guide.md` — what Graph Engineering is and the five implementation steps.
- `ai-agents/claude-code-usage-reference.md` — Claude Code dynamic workflows, the built-in alternative (no mid-run user input).
- `ai-agents/harness-engineering-deep-dive.md`
