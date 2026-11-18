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

### T-21 Check the workflow guard in VS Code's Copilot
- status: waiting
- next: In VS Code (Copilot harness, hooks in Preview), run /agentic-sdlc on a scratch repo to a gate, then ask the agent to launch the next role: confirm the preToolUse hook fires, the sub-agent tool is named task (the guard only matches task/Agent), and the deny shows; record the result in copilot-usage-reference.md
- waiting-on: V
- from: 2026-11-04

### T-22 Fix the defects found in the first Copilot run of the workflow graph
- status: waiting
- next: Review of session 8dd89c27 (api-portal-frontend, R-001), 2026-11-04: (1) DONE 2026-11-05, no change needed: Copilot runs a preToolUse command hook once per tool call with toolName even when the log batches toolCalls[] (copilot-usage-reference.md [^7]), so the guard already sees parallel launches; (2) P0 chose new-feature in a repo with no .specify/, skipping P2, and the constitution stayed an empty template; (3) record accepts role steps with no launch (T003 execute/checks/review in one second, review by the orchestrator); (4) tasks.md boxes not ticked; (5) no way to park a run stopped before P7; (6) P6 ran on develop with no feature branch; (7) gen_ai.agent.name sdlc-script; (8) no frontend stack; (9) desktop-notify.js fails on every agentStop: an ES-module error when node is found (VS Code 2026-11-05), node: command not found when VS Code started without the shell PATH (2026-11-02, 2026-11-03)
- waiting-on: V
- from: 2026-11-04
- updated: 2026-11-05

### T-25 Verify the Windows docs on a real Windows machine
- status: open
- next: Windows docs are verified against Microsoft Learn but their examples were never run; run each stage exercise in knowledge/windows/learning-path.md on Windows 10/11 or a VM and replace illustrative outputs with captured ones
- from: 2026-11-04
- updated: 2026-11-04

### T-30 Synthesize the 13 JavaScript deep dives into typed docs
- status: open
- next: Follow deep-dive.schema.md Synthesis for each javascript/*-deep-dive.md: extend existing v1 docs or add concept/reference docs (browser/ has none yet), fill synthesized-into both ways
- from: 2026-11-04

### T-31 Knowledge schema v1.1: image convention and missing doc types
- status: waiting
- next: V drafts or approves: assets folder + alt-text rule, tutorial/learning-path, troubleshooting, glossary types, source-license field, mechanical-verification limits; then validator scenarios and tests
- waiting-on: V
- from: 2026-11-04

### T-32 Merge PR #19 (reviewed leftover agent-config changes)
- status: waiting
- next: When validate-docs passes: GH_TOKEN=$(gh auth token -u conanjs) gh pr merge 19 -R conanjs/agent-config --merge
- waiting-on: CI validate-docs
- from: 2026-11-05

### T-36 Repair stale Spec Kit complex-features source URL
- status: open
- next: Find and open the current authoritative replacement for the HTTP 404 complex-features.html link in copilot/knowledge/ai-agents/graph-engineering-vs-sdd-ai-dlc-spec-kit.md; update only its supported claim and reference.
- from: 2026-11-07

### T-37 Repair stale Spec Kit existing-projects source URL
- status: open
- next: Find and open the current authoritative replacement for the HTTP 404 existing-projects.html link in copilot/knowledge/testing/characterization-tests.md; preserve the existing explanation and rerun URL validation.
- from: 2026-11-07

### T-41 Repair stale AWS hexagonal-architecture source URL
- status: open
- next: Find the current AWS Prescriptive Guidance page replacing the HTTP 404 hexagonal-architecture.html link in copilot/knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md; update only its reference
- from: 2026-11-09 · 2026-11-09, link check during the tokenizer doc

### T-42 Shrink the tracker hook output and scope the sdlc-* skills (instruction-loading D9)
- status: open
- next: Brief part done 2026-11-10 (TR-11: at most 5 items, items untouched for over 2 days left out; the model's brief here fell from 1,952 to 615 tokens). Left: the 13 sdlc-* skills (824 tokens in every skill list). disable-model-invocation would hide them in Claude Code but then the sdlc-* agents cannot preload them (Claude Code sub-agents docs); V decides between installing them only in repos that use the agentic SDLC, or leaving them
- from: 2026-11-09 · 2026-11-09, proposals/instruction-loading.md D9 (V: "D9 -> a")
- updated: 2026-11-10

### T-43 Decide where VS Code's copilot-lessons.instructions.md belongs (instruction-loading D10)
- status: waiting
- next: V deferred D10 on 2026-11-09 ("ignore (note, deal later)"); when picked up, choose between moving its rules into this repo for every agent or keeping it VS Code-only
- waiting-on: V
- from: 2026-11-09 · 2026-11-09, proposals/instruction-loading.md VS-1

### T-44 Make the atlas cheap to use: trigger wording and search noise
- status: open
- next: Done 2026-11-10: .ignore keeps copilot/atlas/map/ out of searches; an AGENTS.md trigger to atlas.mjs --explain was tested twice on Codex gpt-6-luna and dropped (IW-14, IW-15: the agent explained, then read the files anyway, +66% input). Left: make 'atlas.mjs --explain <path that does not exist yet>' print the facts of the kind that path would belong to (schema, index, checks, scenarios, install target), with scenarios; then re-test a trigger on that
- from: 2026-11-09 · 2026-11-09, atlas review and IW-14
- updated: 2026-11-10

### T-46 Efficiency audit: add --suggest once 3 weeks of history exist (efficiency-auditor D10)
- status: open
- next: After the week of 2026-11-16 is in ~/.copilot/efficiency-audit/history.jsonl: build --suggest, which sends the flagged detectors' counts and paths (no text) to codex exec -m gpt-6-luna or copilot --model gpt-5.4-mini and writes proposed detector rules to a draft for V; add scenarios
- from: 2026-11-10

### T-47 Cut Copilot's cache rebuilds after a pause (efficiency-auditor D13)
- status: doing
- next: Trial started 2026-11-10: Copilot CLI contextTier=default (~/.copilot/settings.json); V sets Context Size to the default window for Claude Opus 5.5 in VS Code's chat model picker and uses /compact before a break, /new per task; the turn token report shows each large cache's expiry and notifies 2 minutes before it (TT-17, TT-18, live after PR #24 merges). On 2026-11-17 run efficiency-audit.mjs week --week 2026-11-16: target Copilot EA-6a below 20% of its AI credits (48.7% from 2026-11-02 to 2026-11-10); record the result in copilot-usage-reference.md
- from: 2026-11-10
- updated: 2026-11-10

### T-49 Check whether Claude Code's 9,900-token skill list is already cut
- status: open
- next: In an interactive Claude Code session run /doctor (or start with --debug and look for the skill-listing budget warning); record the answer in copilot/knowledge/ai-agents/session-start-context-by-agent.md and drop its one unverified marker. claude -p "/doctor" did not finish in print mode on 2026-11-11
- from: 2026-11-11

### T-50 Repair two dead Spec Kit URLs in the knowledge base
- status: open
- next: Find the current pages replacing github.github.com/spec-kit/concepts/complex-features.html (ai-agents/graph-engineering-vs-sdd-ai-dlc-spec-kit.md) and github.github.io/spec-kit/guides/existing-projects.html (testing/characterization-tests.md), both HTTP 404 on 2026-11-11; update only those references
- from: 2026-11-11

### T-51 Spec 022 phase 2: T130 security follow-ups for T138/T142 (parked on feat/022-phase-2)
- status: open
- next: From the T130 security pass (2026-11-17): (1) installers/eslint.config.mjs noProcessOutput still allows a default or namespace import of node:process (proc.stdout.write) and fs.writeFileSync('/dev/stdout'|'/dev/stderr'|'/dev/tty'|'CON') outside the presenter: ban both when T138/T142 write ConsolePresenter.ts; (2) copyKnownFields keeps only string or boolean fields (new String(url) prints a secret one character at a time); (3) keep U+FE0E/FE0F only once right after an Extended_Pictographic character; (4) optionally redact again after escaping in redactDeep. Keep the needsRedaction refusal rule for T136/T208
- from: 2026-11-18

### T-52 Spec 022 phase 2: crashed-run lock and Windows owner-only permissions (parked on feat/022-phase-2)
- status: open
- next: From T132 (2026-11-17): (1) a killed install leaves install.lock; the next run refuses it until it is 10 minutes old (M-12, pid is informative only). Decide whether doctor (T139) may clear a lock whose pid is not alive on this host, or the message tells V to wait or remove it; EDGE-4's scenario moves the clock 11 minutes forward between runs. (2) Windows owner-only ACL (A-30, @windows safety scenarios): state setMode is a no-op on Windows; an icacls adapter is needed in T142 or later, tested on the Windows runner
- from: 2026-11-18

### T-53 Spec 022 phase 2: T136 wiring follow-ups and the T159 route note (parked on feat/022-phase-2)
- status: open
- next: From the T133/T136 security re-check (2026-11-17): (1) apply the ASCII rule to a route's when text; refuse a run of more than 8 spaces in a hook or service command, or show it as a count; (2) name the known limits of HookUsage.textNamesPath in its header (globs, ?, $(echo knowledge), cd then a relative path, Cyrillic lookalikes; doctor is the backstop); (3) T159: a route's hash leaves out the commit, so route file content can change without consent until phase 3
- from: 2026-11-18

### T-54 Rewrite references to the moved agentic-sdlc framework
- status: open
- next: Framework now lives in ~/workspace/agentic-sdlc (plain folder, not a repo; installed via the link ~/.copilot/frameworks/agentic-sdlc). Rewrite the ~119 repo files that still point to copilot/frameworks/agentic-sdlc (agents x3, skills/sdlc-*, atlas, contracts, tests/validate-sdlc, procedures, patterns, docs, README/SETUP/INTERFACES, scripts/check-docs.sh, pnpm-workspace.yaml); leave proposals/ and TRACKER.done.md as history. Then make scripts/check-docs.sh pass again (now FAIL 51: agentic-sdlc validate.mjs and workflow-graph missing)
- from: 2026-11-18

### T-55 Rewrite references to the knowledge base moved to conanjs/agent-knowledge
- status: open
- next: KB and frameworks/knowledge now live in ~/workspace/agent-knowledge (github.com/conanjs/agent-knowledge), linked at ~/.copilot/knowledge and ~/.copilot/frameworks/knowledge. Update the ~129 repo files naming copilot/knowledge or copilot/frameworks/knowledge (AGENTS.md, core instructions, review-docs procedure, atlas, scripts/check-docs.sh validate-knowledge step), and add a check workflow to agent-knowledge
- from: 2026-11-18

### T-56 Teach the installer the split layout before running it again
- status: open
- next: mapping.yaml still links ~/.copilot/knowledge and the whole ~/.copilot/frameworks to this repo; running installers/install.sh now would replace the per-entry links (agent-foundry, company-kb -> agent-config; knowledge -> agent-knowledge; agentic-sdlc -> ~/workspace/agentic-sdlc) and break knowledge and agentic-sdlc. Old links recorded in ~/.agent-config-backups/*-split/links-before.txt
- from: 2026-11-18

### T-57 Split the company KB into its own folder and repo
- status: open
- next: Move copilot/companies and copilot/frameworks/company-kb out of agent-config into their own folder and GitHub repo (history kept, like agent-knowledge); decide visibility first because copilot/companies holds company material (ots)
- from: 2026-11-18

### T-58 Check the new layout on Windows and in CI
- status: open
- next: Not run: (1) install.ps1 with scripts/build.mjs --link and the per-entry ~/.copilot/frameworks links on a Windows machine, then record tests/installers/golden/windows/windows.txt with golden/windows/plan.ps1; (2) CI has no ../agent-knowledge or ../agentic-sdlc next to the checkout, so the Mac golden plan (recorded with both present) and the build differ there: clone agent-knowledge in the workflow, and decide how CI gets agentic-sdlc (it is a plain folder today)
- from: 2026-11-18

## Done
