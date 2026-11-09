---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Claude Code 2.1.318 with Claude Opus 5.5", "GitHub Copilot CLI 1.0.105 with Claude Sonnet 5.5", "Codex CLI 0.166.0-alpha.6 with gpt-6.1-sol", "runs of 2026-11-07 and 2026-11-09"]
last-verified: 2026-11-09
last-updated: 2026-11-09
tags: [instructions, wording, compliance, triggers, agents-md, claude-md, copilot-instructions, measurement]
---

# How coding agents follow instruction wording: tested findings

## Summary
**TL;DR:** A log of how real coding agents followed specific instruction wordings in measured runs. Each entry gives the exact words, the agents and models, the count of runs that complied, and the date. The pattern so far: a trigger the agent can see in its context (a tag, a phrase, a placeholder) is followed almost every time. A condition the agent must look up (does a graph exist?) makes it read files to find out. A layout called "default" is treated as optional, and `gpt-6.1-sol` skipped it every time. Naming the cases ("every response, including drafts, emails and short answers") fixed it in all three agents.
**Use this when:** writing or changing agent instructions, skills, prompts or `AGENTS.md` / `CLAUDE.md` files, choosing between wordings, or planning a test of a new wording.
**Not this doc:** what the instructions cost in tokens → `tokenizers-for-coding-agents.md` and `agent-token-accounting.md`; general prompt technique → `prompt-engineering-deep-dive.md`.

## Scope
Covered: wordings in this repo's global instructions (`copilot/instructions/`) and in the candidate core of `proposals/instruction-loading.md`, as followed by three agents:
- Claude Code 2.1.318 with Claude Opus 5.5;
- GitHub Copilot CLI 1.0.105 with Claude Sonnet 5.5;
- Codex CLI 0.166.0-alpha.6 with `gpt-6.1-sol`.

The runs were scripted (`claude -p`, `copilot -p`, `codex exec`), in a small test project, two runs per prompt and wording. Copilot Chat in VS Code and other models are not covered yet. Each count is "runs that complied / runs".

**Analogy:** a recipe card in a busy kitchen. "When the order says *vegan*, use the blue binder" works, because the cook sees the word on the order. "When the pantry has saffron, use the red binder" makes the cook walk to the pantry to check. "The default plate has four sides" gets ignored when the order is a quick snack.

## Catalog

### Findings

| Id | Wording tested (exact) | What the agents did | Claude Code, Claude Opus 5.5 | Copilot CLI, Claude Sonnet 5.5 | Codex CLI, `gpt-6.1-sol` | Status |
|---|---|---|---|---|---|---|
| IW-1 | Default layout, two wordings: the library's "`## default [used when no tag is given]` Sections: 1. Answer — … 2. Rationale — …", and the candidate's "Default layout: 1. Answer: direct, no preamble. 2. Rationale: why, briefly. 3. Caveats … (omit if none). 4. Next steps … (omit if none)." | Often skipped. An email draft came back as only the email; Codex answered every ordinary question in one or two paragraphs | Email 1/4, ordinary questions 10/12 | Email 1/4, ordinary questions 4/12 | Email 0/4, ordinary questions 0/12 | ✅[^1] |
| IW-2 | "At the start of every response, greet the user as "V"" and "Start every response by greeting the user as "V"." | Followed in every run | 32/32 | 32/32 | 32/32 | ✅[^1] |
| IW-3 | Candidate wording: "A message starting with `pattern:<name>` (any case): strip the tag, read `<file>`, apply that pattern." | The file was read in every tagged message and in no untagged one | Read 4/4 tagged, 0/10 untagged | Read 4/4, 0/10 | Read 4/4, 0/10 | ✅[^1] |
| IW-4 | "Unknown name: say so briefly and use the default." (tag `pattern:haiku`) | Every answer said the pattern was unknown and fell back to the default, under both wordings | 4/4 | 4/4 | 4/4 | ✅[^1] |
| IW-5 | Candidate wording: "\"Deep dive\", \"thorough\", \"in detail\", … : apply the `deepdive` pattern in `<file>`." | The file was read, and the answer had a table and marked verified claims | Read 2/2, table and marks 2/2 | Read 2/2, 2/2 | Read 2/2, 2/2 | ✅[^1] |
| IW-6 | A global `AGENTS.md` saying "Read and follow these files … `<three paths>`" | Codex ran `cat` on all three files before answering, whatever the task, an email included | — | — | 26/26 (16 on 2026-11-09, 10 on 2026-11-07) | ✅[^1][^2] |
| IW-7 | Candidate wording: "Exploring code, impact or review in a repo with an indexed code-review-graph: prefer its MCP tools and read `<guide>` before the first call. No graph: targeted file search." | With no graph and no graph tools in the session, agents read the guide anyway to find out | Read 1/2 | Read 0/2 | Read 2/2 | ✅[^1] |
| IW-8 | "A doc has `{{VAR}}` placeholders …: resolve them from `~/.copilot/global-variables.md`; never guess." (and today's longer form) | The variables file was read and the path resolved correctly | 4/4 | 4/4 | 4/4 | ✅[^1] |
| IW-9 | A project rule "When working on services/payments, read services/payments/AGENTS.md." plus the nested file's two checks | Found and both checks stated, in every agent's native file (`CLAUDE.md` imports for Claude Code) | 4/4 | 4/4 | 4/4 | ✅[^1] |
| IW-10 | "Before committing changes under `copilot/knowledge/` …, and for any doc drafted in another AI chat: use the `review-docs` skill." (and today's longer form) | The skill was used for a doc "drafted in another AI chat" | 4/4 | 4/4 | 4/4 | ✅[^1] |
| IW-11 | Candidate wording: "Use this layout for every response, including drafts, emails and short answers, unless a `pattern:` tag says otherwise: 1. Answer: direct, no preamble (a requested draft goes here). 2. Rationale: why, briefly. 3. Caveats … (omit if none). 4. Next steps … (omit if none)." | The layout was used, the draft placed under "Answer". Sections with nothing to say were left out, as allowed. Same-day runs of today's wording (IW-1) for comparison: email 0/6, ordinary questions 6/18 | Email 2/2, ordinary questions 6/6 | Email 2/2, ordinary questions 5/6 | Email 2/2, ordinary questions 6/6 | ✅[^3] |
| IW-12 | Candidate wording: "code-review-graph MCP tools are available in this session: prefer them for exploring code, impact and review, and read `<guide>` before the first call. Otherwise use targeted file search and do not read that guide." | With no graph tools in the session, no agent read the guide, and every agent still found the caller by file search (compare IW-7) | Read 0/2, found 2/2 | Read 0/2, found 2/2 | Read 0/2, found 2/2 | ✅[^3] |
| IW-13 | "Before your first tool call, work out every file this task needs: those named below, in the message, or in files you already know. Request them all in one turn, as parallel tool calls. Make another round only for paths you learn from what you just read." | Fewer model requests for the same files; the same files read and the same answers. A read that depends on an earlier one still takes its own round. Compared with the same core without the line, on 5 prompts that read files | Model requests 34 → 28, input −16.8%, list-price estimate −2.9% | Model calls 26 → 25, input −2.6%, AI credits −5.1% | Input −9.6%; commands 28 → 34, so more reads per request | ✅[^4] |

## Lookup notes
- **The pattern behind the findings.**
  - Triggers keyed to something in the message or the context were followed in every run: a `pattern:` tag (IW-3), a phrase (IW-5), a `{{VAR}}` placeholder (IW-8).
  - A trigger keyed to a fact the agent must look up was not: whether a graph exists (IW-7). Key a trigger to what the agent can see, for example "when code-review-graph tools are available in this session".
- **"Default" reads as optional; naming the cases works.** Neither wording of IW-1 made the layout reliable, and Codex never applied it. The wording of IW-11 names the cases it covers ("every response, including drafts, emails and short answers") and was followed in 23 of 24 runs. It cost little output: Copilot CLI's output rose 1%, and Codex's fell.
- **Asking for reads up front saves requests.** IW-13 had agents plan their file reads before the first tool call and issue them together. Claude Code saved the most (6 fewer model requests in 10 sessions, −16.8% input), because its context is large and each saved request resends it.
- **Key a condition to the session, and say what not to do.** IW-7 asked about a fact the agent had to check (an indexed graph), and agents read the guide to find out. IW-12 asks about the session (tools available) and adds "do not read that guide": 0 reads in 6 runs.
- **A pointer is a command to Codex.** Codex executes "read these files" on every task (IW-6). Each read costs a model request that sends the whole context again (`agent-token-accounting.md`).
- **The counts are small.** Two runs per prompt, wording and agent, in one test project, on one day per wording. Treat a 2/2 as "works in this setup", not as a rate.
- **How these were measured:** the agents ran without the user's own global instructions, and each variant was swapped in:
  - Claude Code: `claudeMdExcludes`, with the variant as the project `CLAUDE.md`.
  - Copilot CLI: a temporary `COPILOT_HOME`.
  - Codex: a temporary `CODEX_HOME`.

  Answers were checked by script, then read by hand wherever a check failed. The method and raw numbers are in agent-config `proposals/instruction-loading.md` sections 6.1–6.2.
- **Adding a finding:** quote the exact wording, name the agent version and model, give "complied / runs", the date, and the source run. Add a row; never overwrite an older row when a new wording is tested: add the new wording as its own row.

## Takeaways
- Write each trigger as "<something visible in the message or session>: <action>". Avoid conditions the agent has to investigate. [rule-candidate]
- Do not call a layout "default" and expect it to be used. Say "every response, including …" and name the cases, as in IW-11. [rule-candidate]
- Before changing an instruction, look for its row here. After testing a change, add the result here.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-09

## References
- Local measurement, 2026-11-09:
  - **Agents and models:** Claude Code 2.1.318 (Claude Opus 5.5), GitHub Copilot CLI 1.0.105 (Claude Sonnet 5.5), Codex CLI 0.166.0-alpha.6 (`gpt-6.1-sol`).
  - **Runs:** 8 prompts × 2 instruction variants (today's three files and the candidate core) × 2 runs per agent, 96 sessions. Every answer was checked by script and read where a check failed.
  - **Details:** agent-config `proposals/instruction-loading.md` section 6.2. [^1]
- Local benchmark, 2026-11-07 — Codex CLI 0.166.0-alpha.6 with `gpt-6.1-sol`, 10 sessions with today's global `AGENTS.md`; recorded in `ai-agents/codex-usage-reference.md`, section "Global instructions that point to other files". [^2]

- Local measurement, 2026-11-09, second run: the same three agents and models; 4 prompts (an email, find the caller, two ordinary questions) × today's instructions and the revised candidate core (IW-11, IW-12) × 2 runs per agent, 48 sessions; details in agent-config `proposals/instruction-loading.md` section 6.3. [^3]

- Local measurement, 2026-11-09, third run: the same three agents and models; 5 prompts that read files (`pattern:bugfix`, deep dive, payments rule, doc review, find the caller) × the revised core with and without IW-13's line × 2 runs per agent, 60 sessions; details in agent-config `proposals/instruction-loading.md` section 6.4. [^4]

## Related
- `ai-agents/agent-token-accounting.md` — why each file read adds a full model request.
- `ai-agents/tokenizers-for-coding-agents.md` — measuring what an instruction costs per model.
- `ai-agents/prompt-engineering-deep-dive.md` — general prompt technique and evidence.
- `ai-agents/codex-usage-reference.md` — the Codex pointer benchmark.
