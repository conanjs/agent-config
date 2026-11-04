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

### T-9 Reload VS Code and confirm the Copilot token report there
- status: waiting
- next: Run Developer: Reload Window in VS Code, then end one Copilot turn: see whether the report's progress lines show in the chat, and that ~/.copilot/turn-tokens/ gets the session; record the answer in copilot-usage-reference.md
- waiting-on: V
- from: 2026-11-02

### T-11 Split the Graph Engineering study guide below ~400 lines (KD-6)
- status: open
- next: Move the runnable simulation and its trace, or the survey views, into their own knowledge-doc/v1 doc; keep a pointer
- from: 2026-11-02

### T-14 Explain the Codex launch-guard cause in detail
- status: waiting
- next: V asks; explain from zero: what a hook matcher is (the pattern Agent|apply_patch|Edit|Write), tool names and namespaces, why collaborationspawn_agent did not match, why the message arrives encrypted, and the task_name convention (specs/019 research.md D20, codex-usage-reference.md)
- waiting-on: V
- from: 2026-11-03

### T-19 Describe the repo's other programs in the interface catalog
- status: open
- next: One spec per program listed as 'not yet described' in INTERFACES.md (validators, atlas, tracker, turn-tokens, installers, check-docs): usage spec, JSON Schemas, a drift check (CON-15, CON-16)
- from: 2026-11-03

### T-20 Live P6 check of the workflow runner (spec 020 T011b)
- status: waiting
- next: Run a real run through P6 with one coding agent in a scratch repo (paid): run start, approve each gate, confirm the task worktree, checks, review and merge; record the result in specs/020 and close
- waiting-on: V
- from: 2026-11-04

## Done

### T-16 Finish the workflow runner (spec 020, phase 2)
- status: done
- next: Built; doc comments now follow the stack reference (D35); progress lines (D36). Left: V decides cleanup of the R-007 test run in agent-config (.specify/runs/R-007.*, ../agent-config.runs/R-007, branch run/R-007), commit + stacked PR, and the live P6 check (T011b)
- from: 2026-11-03
- updated: 2026-11-03
- closed: 2026-11-04

### T-15 Review and merge PR #11 (spec 019, workflow graph phase 1)
- status: done
- next: V reviews https://github.com/conanjs/agent-config/pull/11 and says when to merge (merge commit, then pull main)
- waiting-on: V
- from: 2026-11-03
- closed: 2026-11-04

### T-18 Run usage lint on the workflow-graph CLI spec
- status: done
- next: Install the usage CLI (brew install usage), run: usage lint -W copilot/frameworks/agentic-sdlc/tools/workflow-graph/interfaces/workflow-graph.usage.kdl; fix findings; record the result in usage-spec-deep-dive.md (specs/021 T013)
- waiting-on: V
- from: 2026-11-03
- closed: 2026-11-04

### T-17 Give every repo a published interface catalog (start with workflow-graph)
- status: done
- next: V approves the design: CON-15/CON-16 in contract-design.md + new format rows; then INTERFACES.md, catalog-info.yaml, an OpenCLI file, JSON Schemas for files and hook payloads, --help/--version, and a drift test for the workflow-graph tool
- waiting-on: V
- from: 2026-11-03
- closed: 2026-11-03

### T-13 Decide the Codex launch guard
- status: done
- next: V re-trusts the Codex PreToolUse hook (matcher now *) in /hooks; then the agent re-runs the live Codex launch check (spawn with task_name r…_p4_architecture at an unapproved G2 must be refused)
- waiting-on: V
- from: 2026-11-03
- updated: 2026-11-03
- closed: 2026-11-03

### T-12 Finish the workflow guard setup for Codex and Claude Code
- status: done
- next: Codex: trust the PreToolUse and UserPromptSubmit hooks in /hooks, then repeat specs/019 quickstart §4; Claude Code: merge hooks.PreToolUse and hooks.UserPromptSubmit from claude/settings.json into ~/.claude/settings.json
- waiting-on: V
- from: 2026-11-03
- closed: 2026-11-03

### T-10 Decide whether to turn agentic-sdlc's written workflow into an enforced graph
- status: done
- next: Location decided (agent-config, written new: D18, D19). V approves the design; then /speckit-tasks and build phase 1 test-first
- waiting-on: V
- from: 2026-11-02
- updated: 2026-11-03
- closed: 2026-11-03

### T-8 Build the per-turn token report for Claude Code and Codex
- status: done
- next: Both Stop hooks are live (Claude Code and Codex, confirmed 2026-10-31). Left: check whether a new Claude Code session (desktop or terminal) runs the status line, since none ran in the session where it was added, so Claude Code limits show as unknown
- waiting-on: V
- from: 2026-10-31
- updated: 2026-10-31
- closed: 2026-10-31

### T-7 Commit the token docs and the No Shorthand In Answers pattern
- status: done
- next: Review the diff on docs/agent-token-accounting, then commit: one commit for the five knowledge docs, one for the pattern and instruction lines
- waiting-on: V
- from: 2026-10-31
- closed: 2026-10-31

### T-5 Turn on the tracker reminder in Codex
- status: done
- next: In Codex /hooks, turn the tracker SessionStart hook on (it is trusted but enabled = false); then ask the agent to verify with a plain codex exec
- waiting-on: V: switch the hook on in Codex /hooks
- from: 2026-10-31 · specs/015 T010
- updated: 2026-10-31
- closed: 2026-10-31 · codex exec 2026-10-31: hook ran, model listed T-2, T-5, T-3, T-4
- note: ~/.codex/hooks.json linked 2026-10-31; untrusted it is skipped (model got NONE)

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
