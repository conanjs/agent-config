---
name: spec-driven-development
description: Bootstrap GitHub Spec Kit in a project (new or existing) and run its spec -> plan -> tasks -> implement -> converge workflow.
argument-hint: "agent=<claude|copilot|codex> [new=<project-name>|existing]"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

Agent integration: {{agent}}
Mode: {{new}}

`new` is optional. If it names a project, this is a brand-new project with that name. If it's empty, unresolved (`{{new}}` literal), or says `existing`, treat this as an existing repo (the current one) — same "unresolved placeholder = not provided" handling as `init-repo-kb.prompt.md`.

Follow the procedure at `~/.copilot/procedures/spec-driven-development.procedure.md` exactly, using the agent integration and mode above as its inputs. This prompt is intentionally a thin pointer, not a restatement — read the procedure file in full before doing anything else.
