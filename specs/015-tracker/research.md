# Research: The tracker

## What the sources do (read 2026-10-30)

| Source | What it keeps | Where |
|---|---|---|
| Anthropic, long-running agents | `claude-progress.txt` and a JSON feature list with a `passes` field, read at the start of every session | the repo |
| OpenAI, harness engineering | Execution plans (`active/`, `completed/`) and `tech-debt-tracker.md`, versioned with the code | the repo |
| Claude Code hooks | `SessionStart`: plain stdout or `additionalContext` goes to the model; `systemMessage` is shown to the user | `~/.claude/settings.json` |
| Copilot CLI hooks | `sessionStart`: only `additionalContext` is used; user hooks load from `~/.copilot/hooks/*.json` | `~/.copilot/hooks/` |
| Codex hooks (read 2026-10-31) | `SessionStart`: plain stdout or `hookSpecificOutput.additionalContext` becomes developer context; `systemMessage` is shown as a warning; a non-managed hook runs only once the user trusts it (`/hooks`) | `~/.codex/hooks.json` |

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | One file per prompt, per repo, or global? | Per prompt; per repo; one global | Per repo. Per-prompt files pile up unread. A global file mixes repos and needs paths. An item that spans repos lives where the work happens |
| D-2 | Format | JSON; YAML; Markdown with fixed fields | Markdown, `### T-<n>` plus `- key: value`. People read it in any viewer and in PRs, the tool parses it strictly (TR-1 … TR-6), and edits go through the tool, which addresses the risk Anthropic cites for Markdown (free edits) |
| D-3 | Committed or local? | Committed; local | Local by default, committed by choice. `--add` lists a new file in `.git/info/exclude`, so a work repo never shows a stray file; `git add -f` once shares it (git: tracked files are not affected by exclude). agent-config commits its own |
| D-4 | How does it remind? | Instruction only; hook | Both. The instruction is the guide (add, close). The session-start hook is the sensor: it does not depend on the model remembering to look |
| D-5 | What makes it "smart"? | Free text; checks | `done-when` checks the tool can run without changing anything (merged, exists, gone, commit, no-stash): an item whose work happened is reported as looks done. Plus overdue (`due`) and stale (14 days without change). It never closes an item by itself: a person or agent confirms |
| D-6 | Reading GitHub (PR merged, CI) | Yes; no | No: it needs the network and a token at every session start. `merged <branch> into main` covers the common case offline once the branches are fetched |
| D-7 | Codex | Hook; instruction | **Revised 2026-10-31: hook.** The first answer, "instruction only", was made without reading Codex's docs, and the gap was not put in the tracker. Codex runs `SessionStart` hooks from `~/.codex/hooks.json`, reads the same `hookSpecificOutput.additionalContext` and `systemMessage` as Claude Code, and runs a hook only after the user trusts it in `/hooks`. So `--hook codex` prints Claude Code's JSON, and `codex/hooks.json` is linked to `~/.codex/hooks.json` |

## Found while building

- **Hooks may start without the login shell's `PATH`.** `tracker-hook.sh` therefore looks for Node the way `scripts/check-docs.sh` does (`$NODE`, `PATH`, nvm). It was tested with `env -i PATH=/usr/bin:/bin`, and prints nothing rather than failing when no Node is found.
- **A `TRACKER.md` inside a repo's sub-folder is not the tracker.** The tracker is always at the repo's top level, so a fixture or example inside a repo is never read as that repo's tracker.
- **ChatGPT (the chat app) cannot take part.** It has no hooks and cannot read local files, so a tracker reaches it only when pasted in.
- **Linking `~/.codex/hooks.json` from a session is refused too** (auto mode: unauthorized persistence), and the trust step is the user's anyway.
- **Editing `~/.claude/settings.json` from a session is refused by Claude Code's auto mode as self-modification.** The machine-local merge is therefore a step for the user (`SETUP.md` step 11); new machines get it from the seed.

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | `tests/tracker/tracker.feature` run before `tracker.mjs` existed | All failed (no tool) |
| Scenarios | `tests/tracker`, then the whole suite | 40 tracker scenarios pass; 487 in all |
| Sabotage | Every `fail`/`warn` call switched off, plus 49 targeted breaks of the brief, hook, edit and check rules | 68 of 68 caught. The first run left 7 alive: 4 checks had no scenario (2 scenarios added), the tie-break duplicated the file's own order (removed), key order was untested (the update scenario now compares the whole file), and the date check had three redundant parts (now one comparison) |
| Hook commands | Pipe test of both launch commands on agent-config, and with a minimal `PATH` on a copy outside any repo | Valid JSON; summary for the user; 1,145 characters of context |
| Codex hook | Pipe test: Codex-shaped payload (`cwd`, `source`) on stdin to `tracker-hook.sh --hook codex --stdin` | Valid `SessionStart` JSON |
| Live Codex session (2026-10-31) | After V trusted and enabled the hook: a plain `codex exec` (Codex 0.164.0-alpha in the ChatGPT app) in agent-config, asking for the ids of the items it was given | "hook: SessionStart Completed", and the model answered "T-2, T-5, T-3, T-4": the open items in the hook's order. Before enabling, it answered "NONE" |
| Live Claude Code session | After V merged the hook (2026-10-31): `claude -p … --output-format stream-json` in agent-config, asking for the ids of the items it was given | The `SessionStart` hook ran (`hook_response` with the summary), and the model answered "T-1, T-2, T-3, T-4" |
