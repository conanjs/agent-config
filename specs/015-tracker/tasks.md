# Tasks: The tracker

- [x] T001 Read how the sources keep open work, and what each tool's session-start hook can output (`research.md`)
- [x] T002 Schema `tracker/v1` with TR-1 … TR-10 (`copilot/tracker/tracker.schema.md`)
- [x] T003 [US1][US2][US3] Scenarios first (`tests/tracker/`); shared steps: arguments with spaces, stdin, branches, merges, stashes, origin-only branches
- [x] T004 `tracker.mjs`: check, `--brief`, `--hook claude|copilot`, `--stdin`, `--add`/`--update`/`--close`/`--drop`, done-when checks
- [x] T005 `tracker-hook.sh`; `copilot/hooks/tracker.json`; `claude/settings.json` seed; `mapping.yaml`; instruction bullet; `scripts/check-docs.sh`; atlas area and kinds
- [x] T006 Sabotage: 68 of 68 caught
- [x] T007 agent-config's own `TRACKER.md`, seeded with the work left on this branch
- [x] T008 Merge the `SessionStart` hook into this machine's `~/.claude/settings.json` (done by V on 2026-10-31; refused to the agent as self-modification) and confirm the reminder in a new session
- [x] T009 Codex: `--hook codex` (scenario first), `codex/hooks.json`, `mapping.yaml` → `~/.codex/hooks.json`; D-7 revised
- [ ] T010 Link `~/.codex/hooks.json` on this machine, trust it in Codex `/hooks`, and confirm the reminder in a Codex session (the user's step; tracked as T-5 in `TRACKER.md`)
