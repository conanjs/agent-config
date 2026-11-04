# agent-config: interfaces

Every program in this repo that people, coding agents or other programs call, and where its interface is described.
An **interface** is any way in or out of a program: commands and flags, exit codes, files it reads or writes, the JSON a
hook sends it, environment variables (rule CON-15 in
`copilot/frameworks/agentic-sdlc/foundations/design/contract-design.md`). Programs read the same list from
[`catalog-info.yaml`](catalog-info.yaml) (Backstage descriptor format).

**Described** means the program has its own catalog: `INTERFACES.md`, `catalog-info.yaml` and machine-readable
descriptions that a check compares with the code (CON-16). **Not yet described** means its interface is known only from
its source, its usage comment and the doc named in the last column; each one is a later spec.

| Program | What it does | Called by | Status | Where to read about it now |
|---|---|---|---|---|
| [workflow-graph](copilot/frameworks/agentic-sdlc/tools/workflow-graph/INTERFACES.md) | Keeps agentic-sdlc runs on the workflow graph: ledger, guard and approval hooks, headless runner | people, Claude Code, Copilot CLI, Codex, `check-docs.sh` | **described** (specs/021) | its `INTERFACES.md` |
| `copilot/frameworks/knowledge/tools/validate-knowledge.mjs` | Checks the knowledge base against its schemas | `check-docs.sh`, the doc hook | not yet described | `copilot/frameworks/knowledge/schemas/_system.md` |
| `copilot/procedures/tools/validate-procedures.mjs` | Checks procedures | `check-docs.sh` | not yet described | `copilot/procedures/procedure.schema.md` |
| `copilot/frameworks/agentic-sdlc/tools/validate.mjs`, `validate-project.mjs` | Check the agentic-sdlc framework, and a project that uses it | `check-docs.sh`, role agents | not yet described | `copilot/frameworks/agentic-sdlc/schemas/_system.md` |
| `copilot/frameworks/agent-foundry/tools/validate-foundry.mjs` | Checks agent-foundry charters and floors | `check-docs.sh` | not yet described | `copilot/frameworks/agent-foundry/` |
| `copilot/atlas/tools/atlas.mjs` | Checks and writes the repo map | `check-docs.sh`, people | not yet described | `copilot/atlas/schemas/atlas.schema.md` |
| `copilot/tracker/tracker.mjs`, `tracker-hook.sh` | Reads and updates `TRACKER.md`; session-start hook | people, agents, session hooks | not yet described | `copilot/tracker/tracker.schema.md` |
| `copilot/hooks/turn-tokens/turn-tokens.mjs`, `turn-tokens-hook.sh` | The turn token report (Stop hook, status line) | Claude Code, Codex, Copilot CLI | not yet described | `copilot/hooks/turn-tokens/turn-tokens.schema.md` |
| `copilot/hooks/scripts/desktop-notify.js` | Desktop notification hook | Copilot CLI | not yet described | `copilot/hooks/desktop-notify.json` |
| `installers/install.sh`, `install.ps1`, `uninstall.sh`, `uninstall.ps1` | Link or seed this repo into the home folder | people | not yet described | `SETUP.md`, `mapping.yaml` |
| `scripts/check-docs.sh`, `scripts/claude-doc-hook.sh` | Run every check; the Claude Code doc hook | people, CI, Claude Code | not yet described | their header comments |
