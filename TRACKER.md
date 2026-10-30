# Tracker

Work this repo still owes, carried from one session to the next. Format and tool: tracker/v1 (agent-config, copilot/tracker/).

## Open

### T-1 Merge the stacked PRs #1, #2 and #3 into main
- status: waiting
- priority: high
- next: Update PR #3's title and description, then merge #1, #2 and #3 in that order with merge commits, deleting each branch so GitHub retargets the next
- waiting-on: V's approval
- done-when: merged feat/mod-11-and-coordinator into main
- from: 2026-10-30 · PR #3

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
- next: Link codex/hooks.json to ~/.codex/hooks.json (or rerun the installer), trust the hook in Codex /hooks, then start a Codex session in agent-config and check the open items appear
- waiting-on: V
- from: 2026-10-31 · specs/015 T010

## Done
