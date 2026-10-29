# Research: Install skills one link per skill (`link-each`)

## DR-004: How skills are installed
- **Tree path:** none
- **Criteria:** `~/.claude/skills` also holds `synced/`, the skills Claude Code downloads from claude.ai (the `syncClaudeAiSkills` setting in Claude Code's settings schema). The whole-folder link moves that folder into the backup. Test B (below) found it was not downloaded again.
- **Options considered:** A. Link each skill into the real folder (`link-each`) | B. Link the whole folder (`symlink`, as before) | C. Link the whole folder and turn the claude.ai sync off
- **Chosen:** B — V, after A was built and test B was run: the synced claude.ai skills are minor and come back once they are used again; one whole-folder link keeps the installer as it was.
- **Rejected:** A — built and tested (`f853077`), then reverted to keep the installer simple; C — gives up the claude.ai skills.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** human · **Approved at:** G1 (2026-10-29; first A, then B)

## Verification

| What | How | Result |
|---|---|---|
| Test B on this machine | Copied `~/.claude/skills` to `~/.agent-config-backups/manual-20261029223850-before-test-b/`; ran the real installer (whole-folder link; `synced/` moved to the backup); ran `claude -p "Reply with the single word OK."` (Claude Code 2.1.129); waited about a minute | The session ran; no `synced/` appeared in the repo's `skills/` or anywhere else: **not re-downloaded**. A separate `~/.claude/plugins/synced/` exists and was not touched |
| Restore | Removed the link, moved the folder back, compared with the copy | identical |
| Scenarios | 5 link-each scenarios added, 4 changed (`tests/installers/`), file state written first; bash implemented after | 419 of 419 pass |
| PowerShell | Parsed all three scripts; ran `Invoke-LinkEachMapping` with pwsh on macOS, with the Windows-only path and capability helpers replaced by stand-ins | links each skill, leaves `synced/`, skips on a second run. A real Windows run is still open (008/F-1) |
| Option A on this machine | `install.sh` with the new mapping | 17 per-skill links in `~/.claude/skills` and `~/.agents/skills`; `synced/` identical to the copy; no backup made; `claude --agent sdlc-coordinator -p …` answered from the installed framework |
| Reverted to B | The installer, mapping, README and scenarios restored from before `f853077`; `install.sh` run again | `~/.claude/skills` links the whole repo folder; the earlier folder, with `synced/`, is in the run's backup |
