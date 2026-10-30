# Loop Engineering

**Status:** Verified against multiple independent sources published 2025–2026 (see References). Term is recent industry jargon, not an academic standard — treat naming (e.g. "Ralph Loop") as practitioner slang, not settled terminology.

## 1. Plain-English definition

**Analogy:** A single LLM prompt-response is a *vending machine* — you press a button, it dispenses one item, done. Loop engineering turns that into a *thermostat* — it takes an action (heat/cool), measures the result (room temperature), compares it to a goal, and acts again, repeatedly, until the goal is met, with no human pressing a button each cycle.

**Definition:** Loop engineering is the practice of designing the *repeating cycle* an AI agent runs in — action → observe result → decide next action — rather than designing a single prompt. Where prompt engineering optimizes *what you say to the model once*, loop engineering optimizes *how the system keeps calling the model, feeding it feedback, and deciding when to stop*.

**Concrete artifact:** This very Claude Code session is a loop instance — each turn: (LLM reasons) → (calls a tool, e.g. `Bash`/`Read`) → (observes the tool result) → (reasons again) → repeat until the task's stopping condition (task done, or you interrupt). The `/loop` skill available in this environment (`Run a prompt or slash command on a recurring interval`) is a literal, local implementation of the "scheduling/heartbeat" layer described in §5 below.

## 2. Core mechanism — the base agentic loop

**Verified** (Anthropic, "Building Effective Agents"): *"Agents are typically just LLMs using tools based on environmental feedback in a loop."* The loop has four moving parts, each owned by a different actor in the system:

| Step | Owner | What happens |
|---|---|---|
| 1. Reason | **LLM** | Reads current task state + history, decides next action |
| 2. Act | **Tool Executor** | Runs the chosen tool (code exec, file edit, API call, browser action) |
| 3. Observe | **Environment** | Returns ground-truth feedback: stdout, test results, error trace, API response |
| 4. Decide | **LLM (again)** | Judges the observation against the goal; loops back to step 1, or stops |

**Cross-actor interactions** (what a change on one side does to the others):

- LLM changes its plan → Tool Executor's next call changes accordingly (no fixed path — this is what distinguishes an *agent loop* from a *workflow*, per Anthropic: workflows have "predefined code paths," agents "dynamically direct their own processes").
- Environment returns an error → LLM must re-reason before acting again (this is the feedback that makes it a loop, not a chain).
- Human Overseer sets a stopping condition or guardrail → constrains every future LLM decision in the loop (a stop condition is a contract on the LLM, not a suggestion — if absent or too loose, see §7 failure modes).
- Verifier/Grader (if present, see §5 Loop 2) rejects output → the *same* loop re-enters step 1 with the rejection reason appended as new context; it does not skip back to a blank slate.

## 3. Worked example — a coding agent fixing a failing test

Stepping through with explicit ownership, so the loop boundaries are obvious (dates fictional, used only to anchor "iteration N" language):

1. **Human (T+0):** "Fix the failing test in `checkout.spec.ts`." → this sets the goal and implicit stopping condition ("tests pass").
2. **LLM Reasoner (iteration 1):** Reads the test file and the source under test; hypothesizes the bug is a null check.
3. **Tool Executor:** Applies an edit, then runs `npm test`.
4. **Environment:** Returns "1 failing — TypeError at line 42" (a *different* error than before → real progress signal, not a repeat).
5. **LLM Reasoner (iteration 2):** Re-reasons from the new stack trace, adjusts the fix.
6. **Tool Executor → Environment:** Re-runs tests → "3 passing, 0 failing."
7. **LLM Reasoner:** Compares observation to stopping condition → goal met → **loop terminates**, reports to human.

This is the ReAct pattern (§6) in miniature: Reason → Act → Observe, repeated until the termination condition — "all tests pass" — is literally true, not just plausible.

## 4. Loop engineering vs. prompt engineering vs. fixed workflows

| | Prompt engineering | Fixed workflow (prompt chaining) | Loop engineering (agent) |
|---|---|---|---|
| Unit of design | A single instruction | A fixed sequence A→B→C | A repeating cycle with a stop condition |
| Who evaluates each step | Human, after the fact | Predetermined code path | The loop itself, via feedback |
| Adapts mid-execution? | No | No (rigid order) | Yes (dynamically re-plans) |
| Best for | One-shot Q&A, single transforms | Predictable multi-step tasks | Open-ended tasks where the number of steps can't be known in advance (Anthropic: "difficult or impossible to predict the required number of steps") |

## 5. The loop stack — four nested levels (LangChain taxonomy, "The Art of Loop Engineering")

Each level wraps the one below it; omitting a level just means that layer's failure mode goes unmitigated (noted per row).

1. **Agent Loop** (base, §2–3) — LLM calls tools until done. *If this is the only layer:* the agent can silently produce wrong-but-plausible output, since nothing checks its work.
2. **Verification Loop** — a **grader** (separate from the acting LLM) checks output against a rubric; on failure, sends it back with feedback for another pass (`RubricMiddleware` / `after_agent` hooks, per LangChain). *Cost:* added latency/tokens per verified run. *If absent:* Loop 1's blind spot stands.
3. **Event-Driven Loop** — the whole Loop 1+2 stack becomes a background component triggered by an event (new doc lands, webhook, cron) instead of a human invoking it manually. *If absent:* the agent only ever runs on-demand, never autonomously in response to the world changing.
4. **Hill-Climbing Loop** — production traces from many runs feed an *analysis* agent that automatically tunes the prompt/tools/grader of the lower loops. *If absent:* the system doesn't improve itself over time; a human must manually tune prompts.

LangChain's framing: "the return arrow doesn't just loop back to the top — it reaches inside and updates the agent loop directly," i.e., Loop 4's output is a config change to Loop 1, not just another data point.

## 6. Named design patterns (catalog)

| Pattern | Mechanism |
|---|---|
| **ReAct** | Perceive → Reason → Plan → Act → Observe, repeat. The foundational pattern nearly everything else builds on. |
| **Reflection Loop** | Agent generates output, then critiques its own output before returning it, looping until self-evaluation passes. |
| **Tool Use Loop** | Agent calls external APIs/tools mid-loop to fetch ground truth outside training data (§2 step 2, generalized). |
| **Evaluator-Optimizer Loop** | Like Verification Loop (§5.2) but framed as two distinct agents: one generates, one critiques. |
| **Multi-Agent Supervisor Loop** | A supervisor agent delegates to specialized worker agents, each running its own internal loop. |
| **Circuit Breaker** | Monitors iterations for stagnation/repetition; force-terminates the loop if no progress is detected across N cycles — a direct mitigation for §7's infinite-loop failure mode. |
| **Heartbeat Loop** | Agent wakes on a schedule/event, checks a condition, acts only if needed, sleeps again (matches this environment's `/loop` skill). |
| **Bounded Execution** | Hard caps on iteration count / token budget / wall-clock time, plus deliberate control of what context enters each cycle. |
| **"Ralph Loop"** | Practitioner term (2025 origin, per Data Science Dojo — **unverified beyond that single secondary source**) for running an agent continuously until an external validator (tests/linter/compiler) confirms success — essentially §3's worked example, automated in a shell loop. |

Prompt Chaining is included in some catalogs for contrast only — it is explicitly **not** a loop (fixed, deterministic sequence, no runtime feedback-driven branching).

## 7. Failure modes and mitigations (verified via arXiv 2607.01641, "When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents")

| Cause | Symptom | Mitigation |
|---|---|---|
| No/weak termination condition | Loop never converges to "done" | Explicit, checkable stop condition (e.g. "all tests pass," not "code looks good") |
| Tool misuse / retry-with-same-input | Agent repeats an identical failing call expecting a different result | State/tool-call pattern monitoring; Circuit Breaker pattern |
| State cycling | Agent oscillates between two states without net progress | Circuit Breaker; require the observation to *change* between iterations |
| Vague task specification | Agent pursues an ineffective strategy indefinitely, technically "trying" | Bounded Execution (hard iteration/token/time caps) as a backstop |

Documented in the wild in LangChain's `AgentExecutor`, LangGraph multi-agent setups, CrewAI (issue #330), and AutoGen, per the paper. The paper's conclusion, directly relevant to anyone implementing this: **no single mitigation suffices** — production systems need layered defenses (hard caps *and* state monitoring *and* explicit stop conditions), not any one of them alone.

## 8. Real-world examples

- **Claude Code** (this tool), **OpenAI Codex Agent**, **Devin** — all named explicitly (MindStudio) as coding agents whose core architecture *is* an agent loop: read files → write code → run tests → analyze errors → revise → repeat, with the loop only closing when tests pass or the agent hits a human checkpoint/stop condition.
- **LangGraph / LangSmith** — infrastructure explicitly built around the 4-level loop stack in §5 (deployment supports cron/webhook triggers for Loop 3; "LangSmith Engine" instruments Loop 4).
- **This environment's `/loop` skill** — a local, directly-inspectable instance of Loop 3 (event/schedule-driven invocation of an otherwise-manual agent task).

## 9. What's verified vs. what isn't

- **Verified against primary/engineering-blog sources:** base agent-loop mechanism (Anthropic), the 4-level loop stack and its terminology (LangChain), infinite-loop failure modes and mitigations (arXiv paper).
- **Verified against secondary/marketing sources only, treat as directionally correct but not rigorously sourced:** IBM's and MindStudio's framing of "loop engineering" as a named discipline distinct from prompt engineering — these are 2026 explainer/blog pieces, not standards bodies or peer-reviewed work. The term itself has no formal specification; different vendors use it with slightly different scopes (LangChain emphasizes the 4-loop *stack*; IBM/MindStudio emphasize the single-loop ReAct-style cycle).
- **Explicitly flagged as thin evidence:** "Ralph Loop" naming (single secondary source).

## References

**Local artifacts:**
- This Claude Code session's own agentic tool-use loop (directly observable behavior).
- `/loop` skill in this environment (`.claude` skill listing) — local implementation of the heartbeat/event-driven loop layer.

**External authoritative sources:**
- [Building Effective Agents — Anthropic Engineering](https://www.anthropic.com/engineering/building-effective-agents) — canonical definition of the agent-loop pattern and its distinction from fixed workflows.
- [The Art of Loop Engineering — LangChain Blog](https://www.langchain.com/blog/the-art-of-loop-engineering) — the 4-level loop-stack taxonomy (Agent / Verification / Event-Driven / Hill-Climbing).
- [What Is Loop Engineering? — IBM Think](https://www.ibm.com/think/topics/loop-engineering) — Goal/Action/Observation/Adjustment framing; loop engineering vs. prompt engineering distinction.
- [What Is Loop Engineering? The New Meta for AI Coding Agents — MindStudio](https://www.mindstudio.ai/blog/what-is-loop-engineering-ai-coding-agents) — ReAct-for-coding mechanism; named examples (Claude Code, Devin, Codex Agent).
- [10 Loop Engineering Design Patterns Every AI Developer Should Know (2026) — Data Science Dojo](https://datasciencedojo.com/blog/loop-engineering-design-patterns/) — pattern catalog (§6 of this doc), including the "Ralph Loop" term (single-source, flagged unverified).
- [When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents — arXiv 2607.01641](https://arxiv.org/pdf/2607.01641) — failure-mode taxonomy and mitigation research (§7 of this doc).

## Related

- [[loop-engineering-playbook]] — applied playbook: what to actually build (policy-skill template, hook template, autonomous-loop template, decision rule for when it's worth the setup), including a worked example against this repo's dead-code migration.
- Anthropic's broader "workflows vs. agents" taxonomy (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer) — worth a follow-up doc if any of these get used deliberately in a project here.
- `{{AGENT_HOME}}/knowledge/github-copilot/copilot-cli-internals.md` and `copilot-prompts-agents-setup.md` — likely relevant since Copilot CLI is itself an agent-loop implementation; worth cross-checking whether its internals match §2–5 here.
- [[context-engineering-deep-dive]] — context engineering (referenced in §5/§6 as a loop component), now its own deep dive.
- [[prompt-engineering-deep-dive]] and [[harness-engineering-deep-dive]] — the instruction layer and the code around the loop; the harness dive compares all five disciplines.
