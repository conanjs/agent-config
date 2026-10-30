---
name: sdlc-system-architecture
description: "Agentic SDLC System Architecture role: owns everything between repos in a multi-repo system - context map, service catalog, contracts, cross-service plans. Launched by the agentic-sdlc Orchestrator, or invoked directly for standalone review/execute."
user-invocable: true
---

Read `{{AGENT_HOME}}/frameworks/agentic-sdlc/agents/system-architecture.md` and follow it, together with `{{AGENT_HOME}}/frameworks/agentic-sdlc/conventions.md`.
If your task starts with a launch prompt (`schemas/launch-prompt.schema.md`), act in its `mode`.
Otherwise you were invoked directly: follow the role's "Standalone use" section.
Never launch other agents.
