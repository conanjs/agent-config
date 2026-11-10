# Done items

Items closed or dropped in TRACKER.md, newest first. Format and tool: tracker/v1 (agent-config, copilot/tracker/).

## Done

### T-48 Fast-path the workflow guard hook when no workflow run is active
- status: done
- next: workflow-graph-hook.sh starts Node twice (a version check, then main.ts) before every tool call in Codex (PreToolUse '*') and Copilot (preToolUse): 130-190 ms each, even with no agentic-sdlc run. Exit before starting Node when the repo has no active run (for example no .specify/runs/*/ledger.jsonl), and cache the Node version check; add scenarios in tests/workflow-graph
- from: 2026-11-10 · 2026-11-10, efficiency review of agent-config
- closed: 2026-11-10 · workflow-graph-hook.sh answers in about 10 ms instead of 130-190 ms when no workflow run can be involved (WG-38, 3 scenarios)

### T-40 Instruction loading: answer the decisions in proposals/instruction-loading.md
- status: done
- next: Deployed 2026-11-09 (core, references, skills, root AGENTS.md, mapping relinked by the installer; D1–D14 in proposals/instruction-loading.md). Left: V approves the commit and PR on chore/instruction-loading-inventory; restart VS Code fully so it drops its cached instructions
- waiting-on: V
- from: 2026-11-09 · 2026-11-09, Codex handoff graph-instructions-handoff.md
- updated: 2026-11-09
- closed: 2026-11-10 · V closed it 2026-11-10: core deployed and merged (PR #20); restart VS Code fully to drop its cached instructions

### T-45 Fill the browser and web-platform gaps against javascript.info
- status: done
- next: Write knowledge docs for the 32 uncovered javascript.info lessons (events: mouse, pointer, keyboard, scroll, drag-and-drop; forms and focus; element size, scroll and coordinates; selection and range; popups and clickjacking; File and FileReader; fetch progress and options, XMLHttpRequest, resumable upload; IndexedDB; CSS and JS animation, Bezier curves; the 7 web-components lessons), deepen the 12 mentioned only in passing, and add YDKJS boxing/unboxing and [[Class]]; done when every javascript.info lesson in parts 2-8 is cited by a knowledge doc
- from: 2026-11-09 · 2026-11-09, coverage check of javascript.info (commit 20208769e5) and You-Dont-Know-JS (2nd-ed 7a83c85, 1st-ed 59d33b0)
- closed: 2026-11-10 · PR conanjs/agent-config#21: 10 typed browser docs, lesson map for all 64 Parts 2-8 lessons, lab how-to, boxing and [[Class]] in the types deep dive; check-docs passes

### T-38 Commit the reviewed agent-config changes (57 files, review of 2026-11-09)
- status: done
- next: V approves; then commit on chore/review-pending-agent-config (macOS, ai-agents, algorithms, performance, js-runtime, gcp, OTS infra, indexes, atlas) and push to PR #19 or a new PR
- waiting-on: V
- from: 2026-11-09
- closed: 2026-11-09 · Committed after re-checking all files and checks; pushed to PR #19 and merged

### T-35 macOS knowledge base (copilot/knowledge/macos/): integrate the 9 agent-written docs
- status: done
- next: Ten macOS articles integrated and the atlas regenerated. Review the local changes and confirm whether to commit and push the macOS files to pull request #19. The separate Dock app verification is tracked in T-34.
- waiting-on: V
- from: 2026-11-05
- updated: 2026-11-06
- closed: 2026-11-09 · Covered by T-38: the macOS docs are committed with the 2026-11-09 review

### T-34 Make node available to apps started from the Dock (VS Code hooks, MCP servers)
- status: done
- next: The LaunchAgent (launchctl setenv PATH) did not reach VS Code reopened from the Dock (08:26, still /usr/bin:/bin:/usr/sbin:/sbin). V runs /tmp/set-app-path.sh in Terminal (sudo launchctl config user path …, removes the LaunchAgent), reboots, opens VS Code; then Claude checks VS Code's main process PATH has node-fallback, marks the Verify claim in macos/macos-app-path.md verified, and closes
- waiting-on: V
- from: 2026-11-05
- updated: 2026-11-05
- closed: 2026-11-09 · After the reboot of 2026-11-07, VS Code's main and helper processes have node-fallback on PATH; macos-app-path.md marked verified

### T-39 Decide the form of the OTS cpuset Q&A doc
- status: done
- next: V picks: keep import-shipment-api-cpuset-and-availableparallelism-qa.md as a word-for-word chat Q&A, or fold its unique part (section 3, the live-pod check) into import-shipment-api-cpu-memory-limits.md and drop the rest
- waiting-on: V
- from: 2026-11-09
- closed: 2026-11-09 · V keeps the Q&A doc as it is: it reads well on its own

### T-9 Reload VS Code and confirm the Copilot token report there
- status: done
- next: Run Developer: Reload Window in VS Code, then end one Copilot turn: see whether the report's progress lines show in the chat, and that ~/.copilot/turn-tokens/ gets the session; record the answer in copilot-usage-reference.md
- waiting-on: V
- from: 2026-11-02
- closed: 2026-11-05 · 2026-11-05 VS Code probe: progress lines are not shown in VS Code; turn-tokens did run and saved each session to ~/.copilot/turn-tokens/ (copilot-usage-reference.md [^8])

### T-33 Verify the 3 VS Code rows in copilot-usage-reference.md, then mark the doc verified
- status: done
- next: V picks: allow a temporary user-level probe (hook + instruction file under ~/.copilot, removed after) and glance at the VS Code chat for PROBE-PROGRESS-LINE; or move the 3 VS Code claims out so the doc can be status: verified
- waiting-on: V
- from: 2026-11-05
- closed: 2026-11-05 · 2026-11-05: VS Code probes done with V; copilot-usage-reference.md has 37 verified, 0 unverified, status verified

### T-29 Topic deep dives covering the 23 commercial ebook subjects (7)
- status: done
- next: On V's go-ahead: functional programming, data structures in JS, browser DOM/events/fetch (javascript.info Parts 2-3 from the private mirror), Node services, data wrangling, design patterns, modern ES2015-2025; from open sources only, never from the PDFs
- waiting-on: V
- from: 2026-11-04
- closed: 2026-11-04

### T-28 Deep dives from Eloquent JavaScript (2) and feed browser/Node topics
- status: done
- next: On V's go-ahead: regular expressions (ch9 + javascript.info regexp part), building a small language (ch12 Egg); use the root NN_*.md chapters and code/solutions, not src/ (build scripts)
- waiting-on: V
- from: 2026-11-04
- closed: 2026-11-04

### T-27 Deep dives from You Don't Know JS (4)
- status: done
- next: On V's go-ahead: scope & closures (2nd ed), objects/classes + this & prototypes, types & coercion, async & performance (1st ed); own words only (CC BY-NC-ND forbids adaptations); verify in the Node lab; synthesize into javascript/
- waiting-on: V
- from: 2026-11-04
- closed: 2026-11-04

### T-26 Merge PR #16 (IEEE 754 and JavaScript knowledge)
- status: done
- next: When validate-docs passes, merge with the conanjs token: gh pr merge 16 -R conanjs/agent-config --merge
- waiting-on: CI validate-docs
- from: 2026-11-04
- closed: 2026-11-04

### T-23 Commit the Linux knowledge base (copilot/knowledge/linux)
- status: done
- next: Review the new docs on branch docs/linux-knowledge-base (knowledge/linux: 33 docs + deep dive; knowledge/kubernetes: 16 new docs; knowledge/windows: 12 new docs; indexes and atlas), then commit and open a PR
- waiting-on: V
- from: 2026-11-04
- updated: 2026-11-04
- closed: 2026-11-04 · Linux, Kubernetes, Windows, algorithms and performance knowledge committed on docs/linux-knowledge-base and merged by PR, 2026-11-04

### T-24 Verify the remaining unverified claims in the linux docs
- status: done
- next: Check each ⚠️ unverified claim in knowledge/linux (about 120 across 31 docs) and knowledge/kubernetes (about 90 across 16 docs) against kernel.org, man7.org and kubernetes.io; mark ✅ or remove it, and promote docs with none left to verified
- from: 2026-11-04
- updated: 2026-11-04
- closed: 2026-11-04 · All unverified claims in linux (129) and kubernetes (70) resolved by lab runs or sources; windows (57) resolved against Microsoft Learn; docs promoted to verified, 2026-11-04

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
