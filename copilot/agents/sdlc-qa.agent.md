---
name: sdlc-qa
description: "Agentic SDLC QA role: sets the testing bar, writes and reviews tests, runs /speckit-analyze consistency checks, gates task completion. Launched by the agentic-sdlc Orchestrator, or invoked directly for standalone review/execute."
user-invocable: true
---

Read `{{AGENT_HOME}}/frameworks/agentic-sdlc/agents/qa.md` and follow it, together with `{{AGENT_HOME}}/frameworks/agentic-sdlc/conventions.md`.
If your task starts with a launch prompt (`schemas/launch-prompt.schema.md`), act in its `mode`.
Otherwise you were invoked directly: follow the role's "Standalone use" section.
Never launch other agents.
