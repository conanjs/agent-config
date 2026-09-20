# Global Variables

Single source of truth for every `{{VAR}}` symbol referenced in docs across this repo and the deployed knowledge base. Defined here once so nothing else needs per-machine edits.

**Deployment:** this file is shipped as a template in the repo and deployed to `~/.copilot/global-variables.md` via the `seed-once` strategy in `mapping.yaml` — copied into place once, then never overwritten by future installs, so the machine-specific values below persist across `git pull`s of this repo. `copilot/instructions/personal-defaults.instructions.md` points every agent at the deployed copy.

## Path variables

| Variable | Value | Notes |
|---|---|---|
| `{{AGENT_HOME}}` | `~/.copilot` (macOS/Linux) or `%USERPROFILE%\.copilot` (Windows) | Deployed config root. Fixed per OS — no setup needed, correct as shipped. |
| `{{AGENT_CONFIG_REPO}}` | `<SETUP REQUIRED>` | This machine's actual clone path of the `agent-config` repo (e.g. `~/workspace/agent-config`). Filled in **automatically** by `SETUP.md` — the agent running setup detects this itself (e.g. via `git rev-parse --show-toplevel`) and writes it here; it then shows you the result to confirm before proceeding. If this still reads `<SETUP REQUIRED>`, setup wasn't completed. |

## Company repo roots

Where each company's actual project repos are cloned on this machine — used by that company's Company KB Framework instance (e.g. `{{AGENT_HOME}}/companies/ots/index.md`'s repo table) to give real, non-hardcoded paths. **Why these live here and not inside `companies/<company>/` itself:** `copilot/companies` deploys as a single symlink (see `mapping.yaml`) — a file nested inside an already-symlinked directory can't independently diverge per machine the way `seed-once` requires, so any per-machine value for a company has to live in a file outside that symlinked subtree. This file already is that place.

| Variable | Value | Notes |
|---|---|---|
| `{{OTS_REPOS_ROOT}}` | `<SETUP REQUIRED>` | Where OTS repos are cloned on this machine (e.g. `~/workspace/ots-projects`). Filled in by `SETUP.md`, same treatment as `{{AGENT_CONFIG_REPO}}` — detected from a known repo's location, then shown to you to confirm. |

Add one row per company here as new companies are onboarded — don't create a separate file per company for this.

## Preferences

| Variable | Value | Notes |
|---|---|---|
| `{{LANGUAGE}}` | English | Default language for agent responses/docs. Edit this line directly to change it — it will not be overwritten by future installs. Task-specific overrides still apply on top of this (e.g. team docs default to Simple English/CEFR A1 per `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` regardless of this setting). |

## References

**Local artifacts:**
- `copilot/instructions/personal-defaults.instructions.md` — points every agent at the deployed copy of this file.
- `mapping.yaml` — the `seed-once` entry that deploys this file.
- `SETUP.md` — fills in `{{AGENT_CONFIG_REPO}}` and company repo-root variables during onboarding.
- `{{AGENT_HOME}}/companies/ots/index.md` — consumes `{{OTS_REPOS_ROOT}}` in its repo table.
- `{{AGENT_HOME}}/frameworks/company-kb/` — the framework definition these company-specific variables support.

## Related

- `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` — a separate, task-specific language/level convention (team docs), not overridden by `{{LANGUAGE}}` above.
