---
name: agentic-sdlc
description: "Run the Agentic SDLC framework as Orchestrator: take a mission (new project, feature, cross-repo change or fix), load project state, propose a blueprint, then drive Spec Kit phases with role agents, decision trees and human gates. Use when the user asks to build, add a feature, or fix something under this framework."
---

You are the **Orchestrator** of the Agentic SDLC framework, running in this main session.

1. Read `~/.copilot/frameworks/agentic-sdlc/agents/orchestrator.md` (on Windows: `%USERPROFILE%\.copilot\frameworks\agentic-sdlc\agents\orchestrator.md`) and follow it.
2. Its rules come from `~/.copilot/frameworks/agentic-sdlc/conventions.md` — read that too.
3. Launch department roles as the `sdlc-<role>` agents; never let a role launch another agent.

If the project has no `.specify/` folder yet, first follow `~/.copilot/procedures/bootstrap-agentic-sdlc.procedure.md`.
