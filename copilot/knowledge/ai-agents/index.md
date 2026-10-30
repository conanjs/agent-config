---
schema: topic-index/v1
kind: topic
topic: ai-agents
last-updated: 2026-10-30
---

# Ai Agents

Agent and workflow coordination: prompt, context and harness engineering, feedback loops, graph orchestration, and the relationship to specification-driven delivery. Product setup rules live in procedures and framework configuration.

## Docs

| Doc | Type | Summary | Status |
| --- | --- | --- | --- |
| [Graph Engineering study guide](graph-engineering-study-guide.md) | concept | Introductory study guide: nodes, state, routing, feedback, operational controls, and a runnable simulation | draft |
| [Graph Engineering, SDD, AI-DLC, and Spec Kit](graph-engineering-vs-sdd-ai-dlc-spec-kit.md) | concept | Concept comparison and illustrative integration with dependencies, ownership, and acceptance evidence | draft |
| [Prompt engineering, end to end](prompt-engineering-deep-dive.md) | deep-dive | Prompt parts, message roles, techniques with evidence, reasoning models, evals, prompt injection, failure matrix | verified |
| [Context engineering, end to end](context-engineering-deep-dive.md) | deep-dive | Why long contexts fail; write/select/compress/isolate; caching, memory, compaction, sub-agents; interaction and failure matrices | verified |
| [Harness engineering, end to end](harness-engineering-deep-dive.md) | deep-dive | Agent = model + harness; guides and sensors; the five disciplines compared; Anthropic, OpenAI and LangChain cases; failure matrix | verified |
| [Claude Code subagents and skills](claude-code-agents-and-skills.md) | reference | Where agents and skills load, the four ways to call an agent, and the synced claude.ai skills folder | verified |
| [Loop Engineering](loop-engineering.md) | legacy | Existing explanation of agent feedback loops | — |
| [Loop Engineering playbook](loop-engineering-playbook.md) | legacy | Existing implementation-oriented playbook | — |

## References

- `../../frameworks/knowledge/schemas/_system.md` — document types, claim marking, and index conventions.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: explanation and how-to serve different documentation needs.

## Related

- [Global knowledge](../index.md).
