---
name: init-repo-kb
description: Bootstrap repo-overview KB docs for one, several, or all undocumented repos in a company, following the Company KB Framework's schema.
argument-hint: "company=<name> [repos=<name>|<name1>,<name2>|all]"
agent: 'agent'
---

<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->

Company: {{company}}
Repos: {{repos}}

`repos` is optional and accepts a single name, a comma-separated list, or `all`. **If the Repos value above came through empty, or literally as the unresolved text `{{repos}}`, treat that the same as `all`** — untested whether Copilot's templating leaves an omitted optional argument blank or passes the placeholder through literally, so handle either case as "not provided."

Follow the procedure at `~/.copilot/procedures/init-repo-kb.procedure.md` exactly, using the company and repos above as its inputs — that procedure's own Step 2 covers resolving a single name, a list, or `all` into the actual target repos. This prompt is intentionally a thin pointer, not a restatement, so the steps can't drift out of sync the way this repo's `conventions.md`/`schemas/_system.md` once did.

Read the procedure file in full before doing anything else — do not proceed from memory or assumption about what it says.
