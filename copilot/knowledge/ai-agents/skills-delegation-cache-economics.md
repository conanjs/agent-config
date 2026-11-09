---
schema: knowledge-doc/v1
type: concept
topic: ai-agents
status: verified
applies-to: ["Official documentation read 2026-11-07; host-specific behavior"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [skills, subagents, context, portability, prompt-caching]
---

# Skills, delegation and prompt-cache economics

## Summary
**TL;DR:** Skill loading selects instructions; delegation separates work; prompt caching reuses computation. Optimize each against a different objective and measure the completed task, including child work.
**Use this when:** designing a reusable agent workflow or comparing the cost of one agent with several workers.

## Problem
“More skills”, “more agents” and “more cached tokens” are not success measures. A workflow can use a smaller parent context yet spend more overall because workers duplicate reading. A correct cost comparison also needs the model and billing surface.

## Mental model
A recipe shelf, several cooks, and prepared ingredients solve different problems. Selecting one recipe limits reading; assigning cooks divides jobs; prepared ingredients avoid repeating preparation.

**Artifact — proposed workflow layout:**

```text
skills/review-evidence/SKILL.md    shared recipe
work/source-list.md              task-specific inputs
work/claims.md                   claims to check
work/result-a.md                 worker A evidence
work/result-b.md                 worker B evidence
work/review.md                   combined result
```

A **prefix** is the unchanged beginning of model input. A **cache breakpoint** is an eligible endpoint for storing/reusing that prefix. A **token** is a model's input/output unit, not necessarily a word. An **application programming interface (API)** is the service interface through which an application submits model requests.

## How it works
**Three actors in this illustrative design:**
- **Parent agent** — its job: define work and combine evidence.
- **Worker agents** — their job: check assigned claims and return bounded results.
- **Model service** — its job: process each request and report usage.

```text
Parent ── explicit task + paths ──> workers A and B
  │                                  │
  │ model requests                   │ model requests
  └──────────────> model service <───┘
  <──────── evidence results ────────┘
Parent ── combined review ──> user
```

1. Parent reads the selected recipe and constructs two complete job tickets.
2. Each worker reads its assigned inputs and submits its own model requests.
3. Service processes each request; available cache reuse depends on the request, not the worker's role name.
4. Workers return evidence; parent checks coverage and writes the combined review.

**Verified API constraints:** exact rendered-prefix matching and eligible lookup boundaries matter; matching visible text alone is insufficient. Output is generated anew. ✅[^cache]

| API family | Cache controls and billing boundary | Evidence |
|---|---|---|
| GPT-5.6 and later | Minimum 1,024 visible tokens; implicit or explicit breakpoints; `prompt_cache_options.ttl`: `30m` default or `12h`; writes cost 1.25× or 2.5× ordinary input | ✅[^cache] |
| Read pricing | Usually 0.1× for that family; GPT-6.1 Sol/Terra 0.05×; verify selected model | ✅[^cache] |
| Earlier models | Implicit caching only; breakpoints at model-dependent intervals, a minimum length that varies with request settings; retention through `prompt_cache_retention`, not the newer lifetime control | ✅[^cache] |
| Explicit-only with no breakpoint | No cache reads/writes | ✅[^cache] |
| Usage accounting | Read `input_tokens_details.cached_tokens`, `cache_write_tokens`, and write lifetime breakdown; subtract reads and writes from total input to obtain ordinary input | ✅[^cache] |

These are API facts, not a claim about ChatGPT subscription credits or the exact request layout produced by a desktop host. The cited page establishes no universal cross-agent cache hit guarantee.

## Worked example
**Illustrative arithmetic, not a benchmark.** Suppose one review needs a reusable prefix of 8,000 tokens. Choose a model with 0.1× read pricing and the 1.25× write option. Count only that prefix; exclude dynamic input, output and tools from this comparison.

| Request | Prefix action | Cost in ordinary-input-token equivalents |
|---|---|---|
| First | Write 8,000 tokens | 8,000 × 1.25 = 10,000 |
| Second, eligible exact match | Read 8,000 tokens | 8,000 × 0.1 = 800 |
| Total | One write plus one read | 10,800 versus 16,000 ordinary input; saving 5,200 |

If both workers have different prefixes and each writes once, the same comparison becomes 10,000 + 10,000 = 20,000. Delegation did not create reuse automatically. This arithmetic does not predict which requests will hit: inspect actual usage.

A proposed experiment compares a single-agent review with two workers on the same claim set. Record correctness, missing claims, elapsed time, ordinary input, cache writes by lifetime, cached reads and output for every worker and the parent. Keep model and task inputs fixed. Prefer the design that meets the quality target with acceptable total time and cost.

## Edge cases

| Case | Consequence to investigate | Design response |
|---|---|---|
| Timestamp inserted before stable material | Changed prefix may reduce reuse | Move run-specific data after stable instructions |
| More workers for a tiny task | Coordination and repeated reading can dominate | Use one agent as the comparison baseline |
| Large skill library but few activations | Catalog overhead remains a separate concern | Improve descriptions and remove irrelevant exposure |
| Prefix unchanged but saved endpoint unavailable | No guaranteed hit | Inspect breakpoints and reported cached tokens |
| Lifetime increased | Extra write cost may outweigh later reads | Compare actual reuse and model rates |
| Cached response assumed to be deterministic | False confidence in output repeatability | Evaluate returned evidence on every run |

## Trade-offs

This table is design synthesis, not a vendor performance promise.

| Choice | Gains | Costs |
|---|---|---|
| One agent, focused recipe | Simple state and result ownership | Research detail stays in one context |
| Several independent readers | Bounded investigations and possible time savings | Repeated inputs and integration work |
| Preload role-critical skills | Predictable initial instructions | Larger startup input |
| Load optional references when needed | Smaller typical input | Additional discovery/read steps |

## Takeaways
- Evaluate routing quality, answer quality, elapsed time and total billed work separately.
- Keep API model-family rules separate from application subscription accounting.
- Treat cache reuse between workers as a measurement question, not an architectural assumption.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 6 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

Source verification only: current official pages were read; illustrative configurations were not executed in a product session. Recommendations and worked scenarios are this document's synthesis, not measured product guarantees.

## References
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) — OpenAI, living, read 2026-11-07. Backs: exact-prefix/breakpoint rules, model-family differences and API accounting. [^cache]
- `copilot/knowledge/ai-agents/agent-skills-portability.md` — sourced loading and invocation facts underlying the design synthesis.
- `copilot/knowledge/ai-agents/subagent-execution-boundaries.md` — sourced delegation boundaries underlying the design synthesis.
- `copilot/knowledge/ai-agents/agent-token-accounting.md` — existing local measurements; preserved as version-scoped evidence.
- `copilot/procedures/review-docs.procedure.md` — source and meaning review used for this document.

## Related
- [Context engineering](context-engineering-deep-dive.md).
- [Measure agent tokens](measure-agent-tokens.md).
- [Codex usage and subscription accounting](codex-usage-reference.md).
