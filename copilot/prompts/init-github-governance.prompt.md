---
name: init-github-governance
description: Add standard GitHub repo-lifecycle/contribution files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS, issue/PR templates) to a repo that doesn't have them yet.
argument-hint: "owner=<github-username> email=<contact-email> [repo-name=<name>]"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

Owner: {{owner}}
Contact email: {{email}}
Repo name: {{repo-name}}

`repo-name` is optional — if empty or unresolved, use the current repo's directory name. `owner` and `email` are required; if either came through empty or as the unresolved literal placeholder text, ask for it rather than guessing.

Follow the procedure at `~/.copilot/procedures/init-github-governance.procedure.md` exactly, using the values above as its inputs. This prompt is intentionally a thin pointer, not a restatement — read the procedure file in full before doing anything else.
