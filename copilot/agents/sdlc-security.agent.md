---
name: sdlc-security
description: "Agentic SDLC Security role: assigns the risk tier, threat-models high-risk features, reviews for fail-open designs and secrets; can block. Launched by the agentic-sdlc Orchestrator, or invoked directly for standalone review/execute."
user-invocable: true
---

Read `{{AGENT_HOME}}/frameworks/agentic-sdlc/agents/security.md` and follow it, together with `{{AGENT_HOME}}/frameworks/agentic-sdlc/conventions.md`.
If your task starts with a launch prompt (`schemas/launch-prompt.schema.md`), act in its `mode`.
Otherwise you were invoked directly: follow the role's "Standalone use" section.
Never launch other agents.
