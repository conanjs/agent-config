# Tasks: The turn token report

- [x] T001 Read what each tool's `Stop` hook and status line give, the price pages, and what the logs hold (`research.md`)
- [x] T002 Schema `turn-tokens/v1` with TT-1 … TT-12 (`copilot/hooks/turn-tokens/turn-tokens.schema.md`)
- [x] T003 [US1][US2][US3] Scenarios first (`tests/turn-tokens/`): fixture logs for both tools, run before the tool exists
- [x] T004 `turn-tokens.mjs` (`--hook claude|codex`, `--text`, `--statusline`) and `prices.mjs`
- [x] T005 `turn-tokens-hook.sh`; `Stop` hook in `codex/hooks.json`; `Stop` hook and `statusLine` in the seed `claude/settings.json`; atlas area and kinds; `SETUP.md`; `README.md`; `measure-agent-tokens.md`
- [x] T006 Sabotage: break each TT rule and see a scenario fail (46 of 46 caught)
- [x] T007 Run on this machine's real logs and compare with each tool's own counter (SC-003)
- [ ] T008 V: merge the `Stop` hook and `statusLine` into `~/.claude/settings.json`; trust the Codex `Stop` hook in `/hooks`; confirm a report after a turn in each tool (Claude Code `Stop` and Codex `Stop` confirmed 2026-10-31; the Claude Code status line not seen running yet)
