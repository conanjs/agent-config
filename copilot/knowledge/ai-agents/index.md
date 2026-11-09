---
schema: topic-index/v1
kind: topic
topic: ai-agents
last-updated: 2026-11-09
---

# Ai Agents

Agent and workflow coordination: prompt, context and harness engineering, feedback loops, graph orchestration, the relationship to specification-driven delivery, and how Claude Code and Codex count, report and save tokens. Product setup rules live in procedures and framework configuration.

## Docs

| Doc | Type | Summary | Status |
| --- | --- | --- | --- |
| [Graph Engineering study guide](graph-engineering-study-guide.md) | concept | Introductory study guide: where the term stands (2026), the survey's three views, nodes, state, routing, feedback, five implementation steps, operational controls, and a runnable simulation | draft |
| [Graph Engineering, SDD, AI-DLC, and Spec Kit](graph-engineering-vs-sdd-ai-dlc-spec-kit.md) | concept | Concept comparison and illustrative integration with dependencies, ownership, and acceptance evidence | draft |
| [Prompt engineering, end to end](prompt-engineering-deep-dive.md) | deep-dive | Prompt parts, message roles, techniques with evidence, reasoning models, evals, prompt injection, failure matrix | verified |
| [Context engineering, end to end](context-engineering-deep-dive.md) | deep-dive | Why long contexts fail; write/select/compress/isolate; caching, memory, compaction, sub-agents; interaction and failure matrices | verified |
| [Harness engineering, end to end](harness-engineering-deep-dive.md) | deep-dive | Agent = model + harness; guides and sensors; the five disciplines compared; Anthropic, OpenAI and LangChain cases; failure matrix | verified |
| [Agent Skills portability](agent-skills-portability.md) | reference | Portable format versus host discovery, invocation and execution controls; acceptance cases | verified |
| [Subagent execution boundaries](subagent-execution-boundaries.md) | reference | Claude forked skills, custom agents, Codex inheritance, permissions and delegation tickets | verified |
| [Skills, delegation and cache economics](skills-delegation-cache-economics.md) | concept | Combined workflow design, API model-family cache rules, illustrative cost comparison and measurement plan | verified |
| [Claude Code subagents and skills](claude-code-agents-and-skills.md) | reference | Where agents and skills load, the four ways to call an agent, and the synced claude.ai skills folder | verified |
| [Token accounting in coding agents](agent-token-accounting.md) | concept | Why one agent turn is many requests, what each usage field counts in Claude Code vs. Codex, cache and compaction effects, counting traps | verified |
| [Claude Code usage, context and multi-agent controls](claude-code-usage-reference.md) | reference | Where usage is recorded, usage fields, commands, JSON and OpenTelemetry outputs, cache and compaction settings, subagents, teams, workflows, fast mode | verified |
| [Codex usage, context and multi-agent controls](codex-usage-reference.md) | reference | Rollout and SQLite records, usage fields, `/status` and `/usage`, `exec --json`, OTel, config keys, cache breakers, subagents, fast modes, credits | verified |
| [Measure tokens in a Claude Code or Codex session](measure-agent-tokens.md) | how-to | Two tested Python scripts and jq/SQL one-liners that report requests, peak context, output, cache hits and the tool's own totals | verified |
| [How coding agents follow instruction wording](instruction-wording-findings.md) | reference | Tested wordings with complied/run counts per agent and model: triggers on visible tags and phrases work, conditions the agent must look up cause extra reads, a "default" layout is skipped | verified |
| [Counting tokens for the models behind coding agents](tokenizers-for-coding-agents.md) | reference | Each vendor's official tokenizer or count endpoint (OpenAI `tiktoken` and `input_tokens`, Anthropic `count_tokens`, Google `countTokens` and `LocalTokenizer`), Copilot's lack of one, tokenizer changes, each agent's `/context` | verified |
| [GitHub Copilot usage, AI credits and hooks](copilot-usage-reference.md) | reference | Session logs with per-call tokens and exact AI-credit cost, the monthly allowance, the shared CLI/VS Code hooks (`agentStop`, progress lines), and VS Code's stale instruction copy | verified |
| [LangGraph.js: graph runtime facts](langgraph-js-reference.md) | reference | Nodes as functions, conditional edges, `Send` fan-out, reducers and joins, SQLite checkpoints, `interrupt()` gates resumed from another process (tested) | verified |
| [Tools and techniques that cut agent tokens](token-saving-tools.md) | reference | Third-party tools (ccusage, RTK, Serena, code-review-graph, Context7, Repomix, TOON, claude-mem, routers) and vendor techniques, with activity and evidence | draft |
| [Loop Engineering](loop-engineering.md) | legacy | Existing explanation of agent feedback loops | — |
| [Loop Engineering playbook](loop-engineering-playbook.md) | legacy | Existing implementation-oriented playbook | — |

## References

- `../../frameworks/knowledge/schemas/_system.md` — document types, claim marking, and index conventions.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: explanation and how-to serve different documentation needs.

## Related

- [Global knowledge](../index.md).
