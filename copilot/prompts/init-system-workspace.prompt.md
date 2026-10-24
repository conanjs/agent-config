---
name: init-system-workspace
description: Create or adopt a multi-repo system's architecture repo and clone the whole system into the standard local layout.
argument-hint: "system=<name> repo=<url|new> root=<REPOS_ROOT var> [layout=flat|grouped]"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

System: {{system}}
System repo: {{repo}}
Repos root variable: {{root}}
Layout: {{layout}}

Any value that is empty or still a literal `{{...}}` placeholder counts as not provided; `layout` then defaults to `flat`, and anything else missing must be asked for.

Follow the procedure at `~/.copilot/procedures/init-system-workspace.procedure.md` exactly, using the values above as its inputs. This prompt is intentionally a thin pointer — read the procedure in full first.
