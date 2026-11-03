# Data model: workflow graph and run ledger

Two files carry everything: the **graph**, one per framework version, and the **ledger**, one per run. The graph says what *may* happen; the ledger says what *did* happen. Every check is a comparison of the two.

## 1. The graph: `workflow.graph.yaml` (source) → `workflow.graph.json` (generated)

### Shape (excerpt; the full file is written in the build from `conventions.md` §5, §8, §9)

```yaml
schema: workflow-graph/v1
name: agentic-sdlc            # becomes gen_ai.workflow.name
version: 2.0.0                # the framework version this graph belongs to (`framework-version` in index.md)
budgets:                      # defaults; a project constitution's "Agentic SDLC budgets" table overrides
  re-execute-after-check: 2
  re-execute-after-review: 2
  rework-per-feature: 1
  parallel-tasks: 4
nodes:
  P0: { kind: phase, owner: orchestrator, output: "mission type, profile report" }
  P3: { kind: phase, owner: product-spec, output: spec.md, gate: G2 }
  G2: { kind: gate, approves: P3 }
  P4: { kind: phase, owner: [tech-stack, architecture, engineering, security, qa, devops], output: plan.md, gate: G3 }
  P6.execute: { kind: step, of: P6, per: task }
  P6.checks:  { kind: step, of: P6, per: task, executor: script }
  P6.review:  { kind: step, of: P6, per: task }
  P7: { kind: phase, owner: [architecture, devops], output: PR, gate: G5, join: all-tasks-done }
  escalate: { kind: end }
  done: { kind: end }
edges:
  - { from: P3, to: G2, on: done }
  - { from: G2, to: P4, on: approved }
  - { from: G2, to: P3, on: changes-requested }
  - { from: P6.checks, to: P6.review, on: pass }
  - { from: P6.checks, to: P6.execute, on: fail, budget: re-execute-after-check }
  - { from: P6.checks, to: escalate, on: otherwise }
  - { from: P6.review, to: P6.execute, on: review-fail, budget: re-execute-after-review }
  - { from: P6.review, to: P3, on: spec-or-plan-wrong, budget: rework-per-feature }
paths:                        # P0 classification, first match wins
  - { when: multi-service, run: [system-P1, system-P3, system-P4, system-P5] }
  - { when: new-project, run: [P1, P2, P3, P4, P5, P6, P7] }
  - { when: new-feature, run: [P1, P3, P4, P5, P6, P7] }
  - { when: fix-changes-behaviour, run: [P3, P4, P5, P6, P7] }
  - { when: fast-path, run: [P6, P7] }
```

### Entities and rules

| Entity | Fields | Rules (become WG ids in the schema) |
|---|---|---|
| Graph | `schema`, `name`, `version`, `budgets`, `nodes`, `edges`, `paths` | `version` matches the framework index; `workflow.graph.json` equals the compiled YAML (drift check) |
| Node | id (key), `kind` phase · gate · step · end, `owner` role id(s), `output`, `gate`, `of`, `per`, `executor`, `join` | Every `owner` is a role in `conventions.md` §1; every phase with `gate` has that gate node; a node id never equals a state key used by the runner (spike gotcha); every node is reachable from a path start; every non-end node reaches an end |
| Edge | `from`, `to`, `on` (result value or `otherwise`), `budget` | Endpoints exist; an edge to an earlier node in its path (a cycle) has a `budget`; every node with conditional edges has one `otherwise` edge; each gate has exactly one `approved` edge |
| Path | `when` (P0 condition id), `run` (phase sequence) | Order matches `conventions.md` §5 "first match wins"; each sequence is a walk the edges allow |
| Budgets | loop name → integer ≥ 0 | Every `budget:` on an edge names a key here |

## 2. The ledger: `.specify/runs/<run>.jsonl`

One run = one feature's pass through the graph (`R-<nnn>`, numbered per project). One JSON object per line; lines are only appended.

### Line

```json
{"seq":7,"prev":"9f2c…e1","hash":"41ab…77","at":"2026-11-03T09:12:44Z",
 "run":"R-007","node":"P6.checks","task":"T004","attempt":2,"result":"fail",
 "actor":"orchestrator","evidence":["specs/023-cart/tasks.md"],
 "gen_ai.workflow.name":"agentic-sdlc","gen_ai.agent.name":"sdlc-engineering","gen_ai.operation.name":"execute_tool",
 "usage":{"input_tokens":41200,"output_tokens":3100,"cost":{"value":0.42,"unit":"usd"}}}
```

| Field | Required | Meaning | Rule |
|---|---|---|---|
| `seq` | yes | 1, 2, 3 … | No gaps, no repeats |
| `prev`, `hash` | yes | SHA-256 of the previous line's `hash` + this line without `hash` | The chain verifies from line 1 (`prev` of line 1 is the run id's hash) |
| `at` | yes | UTC time | Not earlier than the line before |
| `run`, `node`, `result` | yes | Which run, which graph node, what happened | `node` exists; the move from the previous node of the same task (or the run) is an edge whose `on` equals the previous `result` |
| `task` | for P6 steps | Task id from `tasks.md` | Exists in `tasks.md` |
| `attempt` | for looping steps | 1-based | ≤ budget + 1 |
| `actor` | yes | `orchestrator` · `script` · `human` · `runner` | `human` only with `source: UserPromptSubmit` (or the runner's terminal) |
| `quote`, `source`, `session` | gate approvals | V's exact words, where they came from, the session id | The quote appears in that session's user messages |
| `evidence` | no | Paths produced or checked | Paths only, never contents |
| `gen_ai.*` | yes | OpenTelemetry GenAI names | Pinned to the convention version named in the schema |
| `usage` | no | Tokens and cost from the turn token report | Left out when unknown |

### State transitions

```text
Gate:  (none) ──P<n> done──► open ──human "approve G<n> <run>"──► approved
                                └─human "changes G<n> <run>"──► changes-requested ──P<n> redone──► open
Task:  ready ──► P6.execute ──► P6.checks ──pass──► P6.review ──pass──► done
                    ▲              │fail (≤2)            │review-fail (≤2)
                    └──────────────┘◄─────────────────────┘
                 budget exhausted ─► escalate        spec-or-plan-wrong (≤1 per feature) ─► P3/P4
Run:   P0 ─► the path's phases in order ─► P7 (join: every task done) ─► G5 approved ─► done
```

## 3. Task dependencies (task line continuation)

```markdown
- [ ] T005 [P] [US1] [Eng] [llm] Implement cart API (src/cart/api.ts)
      touches: none · refs: none · procedure: none · requires: T002, T003
```

| Rule | Example that fails |
|---|---|
| Every `requires:` id exists | `requires: T099` |
| No cycle | T005 requires T006, T006 requires T005 |
| Two `[P]` tasks released together never write the same path | T005 and T006 both `(src/cart/api.ts)` |
| A `[P]` task does not require another task in its own batch | T005 `[P]` requires T006 `[P]`, both ready at once |
| P7 waits for every task (join) | `--check-run` sees P7 before T006 has `done` |

## 4. Class model (class-modeled@1: who owns which rule)

The tables above are the stored shapes. In code each rule has one owning class (PDM-class-modeled-R2); callers ask, the owner checks.

| Class | Kind | Owns (invariants) | Operations (intention-named, return `Result` for expected failures) |
|---|---|---|---|
| `WorkflowGraph` | aggregate, read-only after load | Edge endpoints exist, every loop has a budget, one `approved` edge per gate, reachability | `static load(json): Result<WorkflowGraph, GraphInvalid[]>`, `allows(from, result, to)`, `nextAfter(position)`, `budgetOf(edge)` |
| `Run` | aggregate root | Moves follow the graph; attempts within budget; a phase after a gate needs that gate approved; P7 only after every task is done; entries only appended | `static replay(entries, graph): Result<Run, LedgerBroken>`, `permitLaunch(launch): Result<LaunchPermit, LaunchDenied>`, `recordStep(step, clock): Result<LedgerEntry, MoveRejected>`, `approveGate(approval, clock): Result<LedgerEntry, ApprovalRejected>`, `status(): RunStatus` |
| `LedgerEntry` | value object | Its hash is SHA-256 of the previous hash plus its own content; fields as in §2 | `static next(previous, content): LedgerEntry`, `verifiesAfter(previous): boolean`, `toJsonLine(): string` |
| `Approval` | value object | A human actor, a non-empty quote, a session id, a source | `static fromPrompt(prompt, openGates): Result<Approval, NotAnApproval>` |
| `LaunchRequest` | value object | `run`, `phase`, `role`, `mode` present and valid when the prompt names a run | `static fromLaunchPrompt(text): Result<LaunchRequest \| NotAWorkflowLaunch, MalformedLaunch>` |
| `GuardRoleLaunch`, `RecordApproval`, `RecordStep`, `CheckRun`, `CheckGraph`, `ReportRunStatus` | application services (use cases) | None of their own: they load, ask the aggregate, save | `run(input): Promise<Result<…>>`; ports arrive in the constructor as `readonly #runs: RunRepository`, … (D15 form) |
| `FrameworkGraphFiles`, `JsonlRunRepository`, `ConstitutionBudgets`, `SystemClock` | adapters (`workflow/infrastructure`) | File format details; the YAML parser is loaded only when the source is read | Implement the `workflow` ports |
| `RunProgress` | domain service used by `Run` | The replay state machine: which line may follow (WG-17 … WG-21) | `admit`, `apply` |
| `ClaudeCodeHookDialect`, `CopilotCliHookDialect`, `CodexHookDialect`, `…SessionLog` | adapters (`coding-agents/infrastructure`) | One agent's JSON shapes and log location | Implement `HookDialect`, `SessionLog` (`contracts/coding-agent.md`) |

**Expected failures** (`LaunchDenied`, `MoveRejected`, …) are `Result` errors with a code and the reason text the hook shows. **Unexpected failures** (unreadable file, broken JSON) are typed `Error` subclasses with `cause`; the hook handler turns them into a deny, which is the fail-closed rule.

## 5. Phase 2 runner state (LangGraph)

The runner's LangGraph state is **derived**: `thread_id` = run id. State keys are `run`, `path`, `position`, `attempts` (map), `tasks`, `results`, `gate` (a list reducer for the join). Node ids come from the graph and are prefixed `n_` so they never collide with a state key. The ledger stays the record: the SQLite checkpoint can be deleted and rebuilt from it.
