---
schema: topic-index/v1
kind: topic
topic: ai-agents
last-updated: 2026-10-31
---

# Ai Agents

Agent and workflow coordination: prompt, context and harness engineering, feedback loops, graph orchestration, the relationship to specification-driven delivery, and how Claude Code and Codex count, report and save tokens. Product setup rules live in procedures and framework configuration.

## Docs

| Doc | Type | Summary | Status |
| --- | --- | --- | --- |
| [Graph Engineering study guide](graph-engineering-study-guide.md) | concept | Introductory study guide: nodes, state, routing, feedback, operational controls, and a runnable simulation | draft |
| [Graph Engineering, SDD, AI-DLC, and Spec Kit](graph-engineering-vs-sdd-ai-dlc-spec-kit.md) | concept | Concept comparison and illustrative integration with dependencies, ownership, and acceptance evidence | draft |
| [Prompt engineering, end to end](prompt-engineering-deep-dive.md) | deep-dive | Prompt parts, message roles, techniques with evidence, reasoning models, evals, prompt injection, failure matrix | verified |
| [Context engineering, end to end](context-engineering-deep-dive.md) | deep-dive | Why long contexts fail; write/select/compress/isolate; caching, memory, compaction, sub-agents; interaction and failure matrices | verified |
| [Harness engineering, end to end](harness-engineering-deep-dive.md) | deep-dive | Agent = model + harness; guides and sensors; the five disciplines compared; Anthropic, OpenAI and LangChain cases; failure matrix | verified |
| [Claude Code subagents and skills](claude-code-agents-and-skills.md) | reference | Where agents and skills load, the four ways to call an agent, and the synced claude.ai skills folder | verified |
| [Token accounting in coding agents](agent-token-accounting.md) | concept | Why one agent turn is many requests, what each usage field counts in Claude Code vs. Codex, cache and compaction effects, counting traps | verified |
| [Claude Code usage, context and multi-agent controls](claude-code-usage-reference.md) | reference | Where usage is recorded, usage fields, commands, JSON and OpenTelemetry outputs, cache and compaction settings, subagents, teams, workflows, fast mode | verified |
| [Codex usage, context and multi-agent controls](codex-usage-reference.md) | reference | Rollout and SQLite records, usage fields, `/status` and `/usage`, `exec --json`, OTel, config keys, cache breakers, subagents, fast modes, credits | verified |
| [Measure tokens in a Claude Code or Codex session](measure-agent-tokens.md) | how-to | Two tested Python scripts and jq/SQL one-liners that report requests, peak context, output, cache hits and the tool's own totals | verified |
| [Tools and techniques that cut agent tokens](token-saving-tools.md) | reference | Third-party tools (ccusage, RTK, Serena, code-review-graph, Context7, Repomix, TOON, claude-mem, routers) and vendor techniques, with activity and evidence | draft |
| [Loop Engineering](loop-engineering.md) | legacy | Existing explanation of agent feedback loops | — |
| [Loop Engineering playbook](loop-engineering-playbook.md) | legacy | Existing implementation-oriented playbook | — |

## References

- `../../frameworks/knowledge/schemas/_system.md` — document types, claim marking, and index conventions.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: explanation and how-to serve different documentation needs.

## Related

- [Global knowledge](../index.md).
