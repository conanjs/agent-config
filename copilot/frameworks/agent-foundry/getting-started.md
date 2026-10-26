---
schema: guide/v1
last-updated: 2026-10-25
---

# Getting started with the Agent Foundry

> **Short answer:** a **Charter** is one agent's job description. The Foundry holds many Charters and the parts they **share**. Three Charters exist now: `pr-reviewer` (reviews pull requests), `ci-failure-triager` (explains failed CI runs) and `knowledge-researcher` (writes source-traced deep dives).

## 1. What is shared and what is per-agent

```text
SHARED by every Charter                       PER AGENT (you write these)
────────────────────────                      ───────────────────────────
principles.md   8 principles                  charters/<id>.charter.md   the job description
floors.md       rules nobody can lower        trees/<something>.tree.md  its own decision flow
resolver.md     what to recall, who wins      (optional) a Lens folder   its team lessons / waivers
schemas/*       the shapes of all files
tools/validate-foundry.mjs
```

The decision tree is the **only big piece you write per agent**, because "how to think about a PR" and "how to think about a failed build" are different questions.

## 2. What works today and what does not

| Piece | Status |
|---|---|
| Schemas, floors, principles, resolver rules, trees, three Charters, example Lens | **Written and validated** |
| `validate-foundry.mjs` | **Works** (`node tools/validate-foundry.mjs`) |
| Tool wrappers: `foundry-pr-reviewer`, `foundry-ci-failure-triager` and `foundry-knowledge-researcher` as Claude (`claude/agents/`), Copilot (`copilot/agents/`) and Codex (`codex/agents/`) agents | **Written, not yet run on a real case.** They deploy with the existing `mapping.yaml` routes |
| The Resolver as code | **Not built.** Today the agent follows `resolver.md` by reading it |
| The Observer (turns human reactions into candidate lessons) | **Not built** |
| Golden set for evals | **Not built** (so no lesson can be promoted yet) |
| Builder agent that drafts Charters from an interview | **Not built** (this is what you do by hand in §4) |

So the honest state: the **design and the files exist**; nothing is **running** yet. The smallest step that makes something run is §3.

## 3. Make the first agent run (smallest path)

Goal: `pr-reviewer` reviewing one real pull request in **suggest-only** mode, with no learning.

1. **Pick one real repo.** Write its `zones.md` (copy `examples/orders-team/zones.md`; use real owners; mark vendored or other-team folders `foreign`).
2. **Create a lens folder** for that repo, e.g. `docs/lens/` with `index.md` and `zones.md`. Leave `lessons/` and `waivers/` empty; the agent works without them.
3. **Add a thin wrapper** so a tool can start the agent. It says only: "Read `{{AGENT_HOME}}/frameworks/agent-foundry/charters/pr-reviewer.charter.md`, follow it, using the lens at `<path>`." One wrapper per tool, following `patterns/shared-procedure-thin-wrapper.pattern.md`. (Written: `foundry-<charter-id>` in each tool's agents folder; tell it the lens path in your request.)
4. **Run it on a closed PR you already know the answer to.** Compare its summary with what the humans said.
5. **Fix the gaps in the tree or the rubric**, not by editing the model's behaviour in chat.
6. **Then** add lessons by hand (write `LS-*.md`) once you see a repeated pattern.

## 4. Create a new Charter (any job)

Use this when you want an agent for something other than PRs, for example "answer onboarding questions", "write release notes", "triage incidents".

| Step | Do this | Ask yourself |
|---|---|---|
| 1 | Write the purpose in one sentence | "What single job does it do?" |
| 2 | List what it must **not** do | "What would be dangerous if it did it by itself?" |
| 3 | Copy `charters/ci-failure-triager.charter.md` to `charters/<id>.charter.md`; set `id`, `autonomy: suggest-only` | |
| 4 | Fill `Knowledge bindings`: name the rules, references, facts it needs | "What would a new human need to know first?" |
| 5 | Write its tree in `trees/<name>.tree.md` using `tree/v2` (copy `ci-triage.tree.md`) | "What do I look at first? What is my default if I do not know? When do I ask a human?" |
| 6 | Decide if it reviews something. If yes add `rubric-prefix` and rubric rows (floors must be `blocker`). If no, write "Not used" under `## Review rubric` | |
| 7 | Set `Lens` scopes and the `Eval` metrics that would convince you to trust it more | "How would I know it is right?" |
| 8 | Run `node tools/validate-foundry.mjs` | |
| 9 | Wrap per tool, run on a few real cases in `suggest-only` | |

Rule of thumb for the tree: **start with 4 to 6 questions**. Add nodes only when a real case shows a missing question.

## 5. Ideas for other Charters (not built)

| Charter | Job | Needs a new tree about |
|---|---|---|
| `incident-triager` | First-look at an alert: what changed, who owns it | alert to owner to recent deploys |
| `release-notes-writer` | Draft notes from merged PRs | which changes users notice |
| `onboarding-guide` | Answer "where is X / how do we do Y" from the Company KB | what to cite, when to say "not documented" |
| `legacy-boundary-auditor` | Find places where new code touches foreign code without an adapter | the border checks from `PRV-Q4`, alone |

## 6. Where to look when confused

| Question | File |
|---|---|
| What is the thing called? | `index.md` §1 |
| Who decides what the agent does next? | the Charter's `Decision flow` tree |
| Why did it say X? | the finding's `provenance` and the Context Pack |
| Why can't the team lower this rule? | `floors.md` |
| How does it learn? | `trees/lesson-promotion.tree.md` |

## References

**Local artifacts:**
- `index.md`, `schemas/charter.schema.md`, `charters/*`, `trees/*`.
- `proposals/agent-foundry-worked-example.md`: the same ideas on one concrete pull request.

## Related

- `patterns/artifact-types.pattern.md`: how a Charter becomes an agent, skill or prompt per tool.
