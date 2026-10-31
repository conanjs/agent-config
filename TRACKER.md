# Tracker

Work this repo still owes, carried from one session to the next. Format and tool: tracker/v1 (agent-config, copilot/tracker/).

## Open

### T-2 Decide on the stashed ChatGPT draft (Evidence-backed agent build checks)
- status: waiting
- next: Review it with review-docs.procedure.md and commit it, or drop the stash
- waiting-on: V
- done-when: no-stash Evidence-backed agent build checks
- from: 2026-10-30 · stash@{0}

### T-3 Synthesize the prompt, context and harness deep dives into knowledge-doc/v1 docs
- status: open
- priority: low
- next: Follow deep-dive.schema.md, Synthesis, for each of the three; fill synthesized-into
- from: 2026-10-30 · 1b631c6

### T-4 Verify the four procedures that PR-4 flags against their tools' docs
- status: open
- priority: low
- next: For each PR-4 warning in check-docs.sh, read the tool's current docs and record version and last-verified
- from: 2026-10-30 · check-docs.sh warnings

### T-5 Turn on the tracker reminder in Codex
- status: waiting
- next: In Codex /hooks, turn the tracker SessionStart hook on (it is trusted but enabled = false); then ask the agent to verify with a plain codex exec
- waiting-on: V: switch the hook on in Codex /hooks
- from: 2026-10-31 · specs/015 T010
- updated: 2026-10-31
- note: ~/.codex/hooks.json linked 2026-10-31; untrusted it is skipped (model got NONE)

## Done

### T-6 Fix the 12 Codex agent role files: Codex ignores them as malformed TOML
- status: done
- priority: high
- next: Write %USERPROFILE%\.copilot without an invalid escape (use a ''' literal string), add a scenario that parses every codex/agents/*.toml, then confirm codex exec shows no 'malformed agent role' warning
- from: 2026-10-31 · codex exec 2026-10-31
- closed: 2026-10-31 · specs/016: 12 wrappers fixed, WRAP checks every codex/agents/*.toml; codex exec shows no malformed warning

### T-1 Merge the stacked PRs #1, #2 and #3 into main
- status: done
- priority: high
- next: Update PR #3's title and description, then merge #1, #2 and #3 in that order with merge commits, deleting each branch so GitHub retargets the next
- waiting-on: V's approval
- done-when: merged feat/mod-11-and-coordinator into main
- from: 2026-10-30 · PR #3
- closed: 2026-10-31 · PRs #1 0c2b6aa, #2 084aad3, #3 051b76b
