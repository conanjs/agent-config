---
name: bootstrap-agentic-sdlc
description: Adopt the Agentic SDLC framework in a project repo (Spec Kit setup, stack detection, docs/architecture.md).
argument-hint: "agent=<claude|copilot|codex> [system=<system repo name or URL>]"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

Agent integration: {{agent}}
System: {{system}}

`system` is optional; empty or a literal `{{system}}` means this repo isn't part of a multi-repo system.

Follow the procedure at `~/.copilot/procedures/bootstrap-agentic-sdlc.procedure.md` exactly, using the values above as its inputs. This prompt is intentionally a thin pointer — read the procedure in full first.
