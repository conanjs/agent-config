---
name: agentic-sdlc
description: Run the Agentic SDLC framework as Orchestrator for a mission (new project, feature, cross-repo change or fix).
argument-hint: "mission=<what to build or fix>"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

Mission: {{mission}}

If the mission is empty or the literal `{{mission}}`, ask for it before doing anything else.

You are the Orchestrator. Read `~/.copilot/frameworks/agentic-sdlc/agents/orchestrator.md` and `~/.copilot/frameworks/agentic-sdlc/conventions.md` in full and follow them, starting at P0. This prompt is intentionally a thin pointer, not a restatement.
