# QA decision record: spec 022 (repo split) test strategy, depth and P4 agent-check protocol

Role: qa · Mode: decide · Phase: P4 · Run: R-001 · Date: 2026-11-13 · Spec: `specs/022-repo-split/spec.md` (G2 approved 2026-11-13) · Tree: `trees/test-strategy-depth.tree.md` (TD)

Words used once here: **AC** = acceptance criterion (for example AC-7.1); **FR** = functional requirement; **BDD** = behaviour-driven development (tests written as Given/When/Then scenarios); **CI** = continuous integration (the GitHub Actions run); **KB** = knowledge base; **seam** = a deliberate hook in the code that lets a test replace the clock, the network, the operating system or a failure.

## 1. Decision in one paragraph

DR-QA-1: Test depth. Every phase of spec 022 gets all three levels: **unit** (pure logic), **scenario** (the tool run as a process on a throwaway home folder, written in Gherkin, repo practice per constitution IV and TST-14) and **contract** (the shipped schemas and worked examples are the contract; provider and consumer both run against them). Mac, Linux and Windows each run the scenarios in CI. Nothing in the automated suite uses the network, a real home, a real clock or a real agent. The nine unconfirmed agent behaviours (A-18 to A-26) are checked once, in P4, by a separate manual protocol (section 9) on Codex CLI and Copilot CLI with cheap models only.

## 2. Tree walk (TD)

| Node | Answer | Evidence | Consequence |
|---|---|---|---|
| TD-Q1 Constitution fixes a bar? | YES | `.specify/memory/constitution.md` principle IV (NON-NEGOTIABLE): each check of a validator, installer, hook or check script traces to a rule id, each rule id has at least one Given/When/Then scenario that runs in `scripts/check-docs.sh`; a changed requirement edits its scenario in the same commit; a tool with no tests gets characterization tests before it changes (TST-13, TST-14) | This is the floor. This record only adds to it (section 3 list). |
| TD-Q2 Auth, security or payment logic? | YES (fail-closed, risk tier not yet recorded by security) | No login or payment, but the installer replaces and deletes the user's files (AC-7.3, AC-7.6), merges the user's `~/.claude/settings.json` (AC-12.3), clones with V's credentials (AC-10.4, A-17) and must keep two local files out of git (AC-3.8). The tree's default says YES when evidence is unclear. | Negative cases are mandatory for each of those (section 4, rows marked N). Security sets the real tier; if it says HIGH, the same list becomes mandatory for every task (TD-Q2 forced YES) with no change to the levels below. |
| TD-Q3 Crosses a process or network boundary? | YES, multi-repo | The installer runs git, writes the file system, runs hooks and starts agents; four repos meet through contracts (`slots/v1`, `component/v1`, `knowledge-provider/v1`, `company-kb/v1`). | Unit + integration (scenario) + contract tests. |

Rejected alternatives (mandatory per conventions section 10):

| Alternative | Why rejected |
|---|---|
| Unit tests only for the installer | Misses what actually breaks: link creation, backups, exit codes, output text, the Windows differences. The existing `tests/installers/` already shows the repo's answer: run the real script on a fixture. |
| End-to-end tests with real Claude Code, Copilot CLI and Codex on every change | Costs V's subscription limits, is not deterministic (TST-5, TST-7), and the spec states file outcomes, not model behaviour (Out of Scope, last row). Kept only as the one-off P4 protocol and the per-phase manual checklist. |
| Network-based tests against the real GitHub repos | Flaky and not repeatable (TST-5). Replaced by local bare git repos built per scenario. |
| Windows covered by bash-with-fake-`uname` only | The existing finding F-1 (`specs/008-installer-tests/research.md`) says PowerShell needs a Windows runner. A fake `uname` proves routing, not links or paths. |
| Pinning today's byte counts (4,511 and about 4,950 characters) as expected values | The core text changes in phase 1. The test pins the method and the rule "measured <= recorded baseline", not a number that will drift. |

## 3. Bar this record adds to the constitution (QA constitution clauses for the plan)

1. **QB-1 Every AC has a scenario.** The scenario title starts with the AC id (NAM-12), for example `AC-7.1 A rerun with unchanged input reports no changes`. A coverage check (TST-14) reads the ids in `spec.md` and the titles in `tests/**/*.feature` and fails when an AC of a delivered phase has none. The 111 ACs of the spec today (counted 2026-11-13) are the denominator; the 14 edge cases are scenarios too, titled `EDGE-<n>`.
2. **QB-2 Exemption list.** An AC that cannot be automated is on one reviewed list with a reason and the manual check that replaces it (section 8). The coverage check fails on an AC that is neither covered nor listed.
3. **QB-3 Test first.** For a new tool the scenario is written failing (red) and the code makes it pass (TST-10 applies to every new rule, not only bug fixes). For the old tools that change (knowledge validator in phase 1, SDLC validator in phase 1, old installers in phase 0), characterization tests pin today's behaviour before the change (TST-13); the behaviour change then edits only the scenarios it changes, in the same commit.
4. **QB-4 Deterministic.** No real network, clock, home folder, random value or agent in the automated suite (TST-5). Seams listed in section 7 are required of the plan.
5. **QB-5 Same suite before and after each phase** (FR-043, SC-013). The previous phase's scenarios run unchanged; a phase may edit an old scenario only when its own AC says the behaviour changes, and the edit is named in the PR description.
6. **QB-6 Speed (TST-12).** Unit layer under 60 seconds in total. The scenario layer is a separate budget: proposed 3 minutes per operating system, measured at the end of phase 0 and written into the constitution; if exceeded, split into a fast set run on every commit and a full set run on pull requests.
7. **QB-7 Mutation proof for checks.** For each new validator or fitness check, one pass of the TST-13 step 4 exercise: disable the check, confirm a named scenario fails. Recorded once in the phase's `research.md`.
8. **QB-8 Synthetic data (QA-R8).** Fixtures use fake users (`Vinh Do`, `v`), fake URLs under `example.invalid` or local bare repos, no real tokens, no real company repo names beyond what the spec already names.
9. **QB-9 Windows is a real runner,** not a simulation, for everything that touches links, `%USERPROFILE%`, `install.ps1` or `uninstall.ps1`.

## 4. Test plan per component

Levels: **U** unit (pure function, table-driven, no file system), **S** scenario (tool run as a process on a temp home, Gherkin), **C** contract (shipped schema + worked example, provider and consumer both run against it). **N** = negative cases required by TD-Q2. Test tools and runners are tech-stack's choice; this table fixes what is tested, not with what. Existing layout stays: one folder per tool under `tests/<tool>/` with a `.feature`, a `tool.mjs` and fixtures, run by the root `cucumber.mjs`.

| Component | Phase | ACs | U | S | C | N | Notes |
|---|---|---|---|---|---|---|---|
| Schemas: `slots/v1`, `component/v1`, public list, local list, lock | 0 | 1.2 to 1.4, 5.5, 5.8 | validator functions for key checks, contract-list form, major-version rule (current and previous) | schema check run as a process on shipped example files and on mutated copies | The five shipped valid examples are the contract tests | old keys `count`, `mounts` rejected with replacement named; extra key `colour: blue` passes with exactly one warning (tolerant reader) | Compare messages exactly (TST-14 guidance). |
| Contracts index (14 contracts) | 0 | 1.1, 1.8 | none | a check that the index lists all 14 and each has owner, consumers, versioning rule, missing/stale behaviour | worked examples contain both citation forms | contract missing a field fails | Prose is checked by field presence, not meaning. |
| Constitution amendment | 0 | 1.5 | none | check version `2.0.0`, dated amendment, principle I wording present; `scripts/check-docs.sh` passes | none | none | Wording is a review item (llm), presence is the script. |
| Architecture fitness (allowed edges, baseline) | 0, 1 | 1.6, 9.1, 9.4, 15.3 | edge-set diff, baseline compare ("fails if any count rises") | fixture adds knowledge -> agentic-sdlc edge: fails naming the edge; real tree: counts equal the recorded baseline; after phase 1 the count goes to 0 and the check is "on for good" | none | rise of any count by 1 fails | Baseline numbers (109 lines in 67 files, the checks reading other areas) are recorded, not coded. |
| Dry-run baseline measurement | 0 | 1.7 | the **swap rules** (see section 5) | run on a fixture tree: writes nothing (file system snapshot before = after); output lists the required fields (characters per agent, token estimate marked estimate, method, tool version, date, `{{AGENT_HOME}}` line count, skill-list figure) | none | missing field fails | Rules are one module shared with the phase 5 renderer (A-28). |
| Old-installer plan snapshot ("golden plan") | 0 | 1.9, 8.6 | none | run the old `install.sh` against the real `mapping.yaml` with a private `HOME`; list every link and seeded file as `target -> source (mode)`; compare to a committed golden file. Mac, Linux, and Windows (`install.ps1`) each have their own golden file | none | phase 0 PR must leave all three goldens unchanged | Characterization (TST-13), recorded **before** phase 0 changes anything. Existing `tests/installers/` keeps running. |
| `repo-layout/v1` report mode | 0 | 1.1 (FR-012) | layout rule evaluation | run against a fixture tree and against agent-config in report mode: exit 0, findings listed, nothing fails | none | rule violation reported, not fatal | Becomes fatal in phase 8. |
| Knowledge validator changes | 1 | 9.2, 9.4 | none | existing `tests/validate-knowledge/` edited: "Used by" ignored without error; no backlink scan; never reads `companies/` | none | doc with "Used by" table still passes | Same-commit rule (QB-3). |
| SDLC validator `--knowledge --adapters` | 1 | 9.3 | none | missing citation fails naming citing file and path; no hard-coded folder names (fixture with renamed folders passes) | consumer-vs-provider export check | unresolved citation fails | `tests/validate-sdlc/` extended. |
| Citation writer/checker (`--write`) | 1 | 9.5 to 9.7, 5.10 | classifier: longest-prefix location match, bare relative path, unknown prefix; target generator from `repository` URL | `--write` makes the target, second `--write` changes nothing (byte-compare); run without `--write` on stale target fails naming file, citation, expected target; provider without `repository` fails | the `knowledge-provider/v1` worked example | unknown location fails; missing `repository` fails | Spaces and non-ASCII in paths in the unit table. |
| Core instructions wording | 1 | 9.8, 6.5 | none | check: `{{VAR}}` rule says resolve from `global-variables.md` and read locally, never fetch; no "read the link text" line; one-line `{{AGENT_HOME}}` definition and no other variable definition | none | each forbidden line, when added, fails | Compliance of agents with this wording is not tested here (see caveats). |
| Installer pipeline (read, resolve, plan, apply, report) | 2 | 2.x, 3.x, 4.x, 5.x, 6.x, 7.x | resolver (reuse, default, need, recursion, cycle, versions, exports, slot counts), needs-report builder (ordering components before variables), exit-code mapper, home chooser (env, platform), variable merge, hash/idempotent writer | one `.feature` per story: `home`, `sources`, `needs`, `resolve`, `variables`, `safety` (incl. `plan`, `doctor`, `uninstall`), `compat` | the five schema examples feed the installer scenarios (no private copies) | see below | The core of the plan. |
| Home and confirmation | 2 | 2.1 to 2.5 | home chooser: Mac/Linux `~/.agent-config`, Windows `%USERPROFILE%\.agent-config` (never `%APPDATA%`), `AGENT_CONFIG_HOME`, recorded home | S: first run exit 10 and **no file created** (snapshot compare of home and agent folders); confirmed rerun states home first and proceeds; moved env asks again and exits 10 without writing | none | AC-2.1, 2.5 are write-nothing negatives | Windows scenario on the Windows runner. |
| Sources: `git`, `path`, `archive` | 2 | 3.1 to 3.8 | source-type dispatch; lock record (SHA or `live`) | local **bare git repo** as `git` source (no network); `path` source on a temp folder; missing folder; unreachable git source after a good install keeps the old link; no `component.yaml` skips only that component; `init-component` writes a schema-valid starter and refuses overwrite; `archive` skipped with exact message; tracked `components.local.yaml`/`variables.local.yaml` fails | none | AC-3.3, 3.4, 3.5, 3.7, 3.8 | The same component runs once as `git` and once as `path` (SC-011): one parameterized scenario outline. |
| Needs and exit codes | 2 | 4.1 to 4.5 | exit-code mapper (0, 1, 2, 10) | missing slot -> 10 with exact command; missing variable -> 10; components before variables; `--json` is one document on stdout and stderr has no JSON; unknown command/flag -> 2 with a usage line; suggested source never fetched | the JSON shape has a schema and a shipped example | each is a negative | Compare text exactly. |
| Resolution by slot | 2 | 5.1 to 5.10 | resolver table | chain A->B, cycle printed in order, contract `/v2` only vs `/v1`+`/v2`, export violation, two providers for `multiple: false`, unknown slot skipped with warning, runtime `node >=18` on an old version (a fake `node --version`) | slot/contract fixtures | AC-5.4, 5.5, 5.6, 5.7, 5.9 | Swapping provider A for B leaves consumer files byte-identical (SC-008): a scenario. |
| Variables | 2 | 6.1 to 6.6 | merge of declarations; "closest names" suggestion | union of two components' variables exactly; disabled component's variable absent; `set` of unknown name exits 1 with close names; detected value is only a proposal; value change rewrites only the rendered file | none | AC-6.3 | |
| Safety, `plan`, `doctor`, `uninstall` | 2 | 7.1 to 7.7 | hash compare, fault classification | rerun = "no changes", zero files rewritten (compare modification times and bytes); failing check keeps previous links; real file at link target is backed up to `~/.agent-config-backups/<timestamp>/` (timestamp normalized as `<timestamp>`, as `tests/installers` does); `plan` writes nothing; each of the nine `doctor` faults has its own scenario and its own message; warnings exit 0; `uninstall` removes only recorded-and-unchanged files, keeps edited file, `path` folder, both local files, backups; `plan` and `doctor` twice give identical reports | `install-state.json` and lock have schemas and examples | AC-7.2, 7.3, 7.5, 7.6 | The `doctor` faults are a scenario outline with nine rows, one fault each, so a missing check shows as a missing row. |
| Compatibility links and sorting check | 2 | 8.1 to 8.5 | classifier of hard-coded `~/.copilot` lines (agent-home vs Copilot-own, allow-list) | ten sampled old paths resolve to the same content; Copilot's own folders not replaced; `retired:` removes only the installer's own link; a new hard-coded agent-home line fails the check; the 445 existing `{{AGENT_HOME}}` lines are unchanged by phase 2 (byte-compare of those lines before and after) | none | AC-8.3, 8.4 | The 484-line count (131 files) is recorded as a baseline the check reads, not asserted as a constant. |
| `agent-companies` move | 3 | 10.1 to 10.6 | none | search of core instructions and variables source for company names and `OTS_REPOS_ROOT` returns 0; install with and without the entry (both succeed); clone failure keeps the old version and names the cause; no deny-list file, no privacy-audit command; commit ids of agent-config unchanged (history not rewritten: compare the recorded pre-move SHAs); `agent-companies` check passes with a provider and exits naming `knowledge-storage` without | `company-kb/v1` example | AC-10.4, 10.6 | A history check on the new repo (commits kept) is a one-off at the move, recorded in the PR, not a standing test. |
| Build (skills and agents) | 4 | 11.1 to 11.9 | adapter field mapper (verified fields only), `auto-delegate` mapping, include inliner, stamp (source revision + adapter version), budget arithmetic | build one agent for three targets **twice** and compare bytes; stamp drift makes `doctor` fail; `auto-delegate: false` -> `infer: false` / `disable-model-invocation` / Codex warning; `{{include:}}` inlined and missing include fails with its path; per-component idle-cost ceiling; Claude description total above 15,000 tokens warns; duplicate skill name from two components fails naming both; a tracked build-output file fails the repo check; adding a platform folder under adapters adds a target and nothing else changes (SC-003: a scenario that adds a fake `fakeagent` adapter and diffs the file list) | adapter field lists (`fields.yaml`) are the contract | AC-11.2, 11.5, 11.8, 11.9 | Count checks (12 sources, 0 hand-written agent files, 0 pointer-only skills) are repo checks run each commit after phase 4. |
| Renderer | 5 | 16.1 to 16.10 | **path-style functions with the platform injected** (see section 5); citation rewriter; generated-from line placer (after front matter when required); read-only setter; allow-list matcher | per component: copies exist for the four components, none for the linked KB; Mac and Windows forms of AC-16.2 (Windows form asserted on every OS through injection, plus again natively on the Windows runner); 0 placeholders left except the allow-list; first line text exactly; `generated/index.md` states the mechanism once; write attempt refused; routes, instruction links and skill targets resolve under `generated/`; changed copy -> `doctor` exit 1 naming copy and source; stale source -> exit 1; `install` restores both; unchanged rerun rewrites nothing and read-only stays; hook re-render of an edited `path` source, then a second start re-renders nothing; failed re-render keeps old copy, session starts, message names the citation, `doctor` exit 1; tracked file with generated-from line fails repo check in all four repos | rendered-copies contract worked example (both OS forms) | AC-16.6, 16.9 | Home paths tested: plain, with spaces (`Vinh Do`), non-ASCII, Windows drive letter. Round trip: for every generated target, resolving it from the copy's folder reaches the cited file. |
| Full installer wiring | 5 | 12.1 to 12.7 | JSON merge that keeps unknown keys; 32 KiB size check; skill entry-by-entry linker | exactly 2 import lines owned by installer in Claude user file; Copilot routes file with `applyTo: "**"`; Codex `AGENTS.md` and `hooks.json`; original `settings.json` backed up and every V key preserved (fixture with unusual keys, comments absent, arrays, nested objects); skills linked per entry and a foreign synced skill left alone; Codex `AGENTS.md` at 32 KiB minus 1 passes and at 32 KiB exits 1 naming the size; hash mismatch makes `doctor` fail; idle-cost total over a ceiling fails naming the largest contributors; a service component registered and removed by `uninstall` | hooks contract example | AC-12.2, 12.3, 12.5, 12.6 | The settings merge is the highest-risk scenario set (user data); mutation proof (QB-7) required. |
| KB repo | 6 | 13.1 to 13.8 | link rule checker (relative links resolve and stay inside, fenced code skipped, code span naming a KB doc warns, legacy doc warns only), export list diff | KB alone in a clean checkout passes its own check; remove/rename an export without a major bump fails; 41 exports listed (count read from the provider, not hard-coded); `path` source at the old location and `git` source at the new repo give identical content (hash compare); stub left at old path | `knowledge-provider/v1` | AC-13.2, 13.3 | |
| SDLC repo | 7 | 14.1 to 14.4 | enable/disable file set builder | tag pinned; enabled project shows `sdlc-*` skills and agents, other project shows none; files kept out of git (`.git/info/exclude` entry) and `disable` removes them; validator passes with knowledge root as argument | none | AC-14.3 | Skill-list shrink is computed from characters (automated); the 824-token figure is the manual check (section 8). |
| Layout | 8 | 15.1 to 15.3 | layout rule evaluation | root entries equal the target set fixed at P4; **the phase-2 golden plan and the install state are identical before and after** (only mapping sources change); swapping the knowledge provider changes 0 lines of core | none | AC-15.2 | Strongest regression test of the feature: the three golden files. |

## 5. The two shared rule sets that need unit tests with tables

Both are pure functions, so they are cheap to test and both sit under G4 and G13.

**5.1 Swap rules** (dry run in phase 0, renderer in phase 5; A-28, one implementation). Input: text, home string, platform. Output: text. Table-driven cases (each is a scenario row and a unit row):

| Case | Input | Expected |
|---|---|---|
| Mac | `{{AGENT_HOME}}/knowledge/x.md`, home `/Users/v/.agent-config` | `/Users/v/.agent-config/knowledge/x.md` |
| Windows | same, home `C:\Users\v\.agent-config` | `C:\Users\v\.agent-config\knowledge\x.md` (text keeps the system's separators) |
| Spaces | home `/Users/Vinh Do/.agent-config` | link text shows the real path; target `../../knowledge/x.md` stays valid (spaces encoded where present) |
| Non-ASCII | user name `Vinh Đỗ` | same, no mojibake, byte-identical on a second run |
| Agent-home path in `~/.copilot` form | `~/.copilot/knowledge/x.md` where it means agent home | swapped |
| Copilot-own path | `~/.copilot/instructions/...` on the allow-list | kept |
| Allow-list | the one-line `{{AGENT_HOME}}` definition and the `{{VAR}}` rule line | kept (A-21); a third line naming the placeholder fails AC-16.3 |
| Generated-from line | file without front matter / with front matter | line first / line right after the closing `---` |
| Idempotence | render twice, same input | byte-identical output |
| Dry-run purity | any | nothing written; snapshot of the file system equal |

**5.2 Citation classifier** (AC-5.10, FR-023): table of link text -> class: `{{AGENT_HOME}}/knowledge/a.md` -> provider of the longest matching location; `../x.md` bare relative -> own file; `{{AGENT_HOME}}/nope/x.md` -> fail naming the path; two locations where one is a prefix of the other (`frameworks` and `frameworks/sdlc`) -> the longer wins. Test this rule table for the dry run, the phase 1 `--write` and the renderer from the same table file so the three cannot drift.

## 6. Cross-platform strategy (Mac, Linux, Windows)

| Layer | Mac | Linux | Windows | How |
|---|---|---|---|---|
| Pure logic (unit tables above) | CI + local | CI + local | CI + local | Platform is a parameter, so the Windows branch (drive letters, backslashes, `%USERPROFILE%`) is tested on every operating system, not only on Windows. |
| Bash scenarios (`install.sh`, `tests/installers`) | CI (macOS runner) + V's Mac | CI (ubuntu, exists today) | not applicable | Fake `uname` stays for routing. |
| PowerShell scenarios (`install.ps1`, `uninstall.ps1`) | not applicable | not applicable | CI (Windows runner) + V's Windows | Finding F-1 of spec 008 closes here. |
| Node installer core scenarios | CI | CI | CI | Same `.feature` files on all three; scenario tags `@mac`, `@windows`, `@posix` select the OS-specific ones. |
| Link creation | symlink | symlink | whichever kind the plan picks (symlink needs Developer Mode or elevation; junction does not) | Whether a GitHub Windows runner can create symlinks is **unconfirmed**; confirm in the phase 2 spike. The edge case "account cannot create links exits 1 changing nothing" is tested by injecting the failure (seam), and once on a real restricted account by hand. |
| Home folder override in tests | `HOME` | `HOME` | `USERPROFILE` (Node's `os.homedir()` reads `USERPROFILE` on Windows per the Node docs; confirm in phase 0) | Every scenario gets its own temp home; no scenario reads the runner's real home. |

CI change needed (devops task, flagged): `.github/workflows/validate-docs.yml` runs `ubuntu-latest` only. Add a matrix job `installer-tests` over `ubuntu-latest`, `macos-latest`, `windows-latest` running the `@cross-os` scenarios and the unit tables; keep the document validators on ubuntu. Branch protection requires only `validate-docs` today, so each new job name must be added to the required checks, or the new tests do not block a merge. `scripts/check-docs.sh` is bash; whether Git Bash on the Windows runner runs it unchanged is unconfirmed, so the Windows job should call the test runner directly.

Real-machine checklist at the end of every phase (FR-043; V by hand, Mac and Windows), run with a throwaway `AGENT_CONFIG_HOME` and a temp `HOME`/`USERPROFILE` first so V's live agent folders are not touched, then once for real:
1. `install` -> exit 10 (first run), confirm, `install` again -> done.
2. `install` a third time -> "no changes".
3. `plan`, `doctor` twice each -> identical reports, `doctor` exit 0.
4. Ten sampled old `~/.copilot/...` paths show the same content as before (phase 2 onward).
5. Start each agent once and ask for the first line of `{{AGENT_HOME}}/knowledge/index.md` (phase 2 onward; Claude Code only with V's go-ahead, see section 8).
6. On the Windows account: repeat with a user name containing a space.

## 7. Testability requirements the plan must meet (inputs to architecture and engineering)

Without these, the strategy cannot be executed. QA states the need; the design is architecture's.

| Id | Need | Needed by |
|---|---|---|
| TR-1 | Home, platform and clock are inputs (environment variable or argument), never read deep inside logic | home, renderer, backups |
| TR-2 | Git is reached through a port with a real adapter; scenarios use local bare repos, so the real adapter is exercised without a network | sources, AC-3.x, 10.4 |
| TR-3 | A fault-injection seam: "fail the nth write", "link creation not permitted", "fetch fails for component X" | AC-7.2, 3.4, edge cases "interrupted install", "cannot create links" |
| TR-4 | `plan` and the dry run share the apply code path up to the write step, so "plan = what apply does" is provable (compare `plan` output with the actual diff after `apply`) | AC-7.4, 1.7 |
| TR-5 | Messages and reports are produced in one place and compared as exact text | all negative scenarios |
| TR-6 | The swap rules and the citation classifier are one module each, imported by dry run, `--write` and renderer | A-28, FR-023 |
| TR-7 | The installer reports the runtime version it checks through a replaceable command (fake `node --version`) | AC-5.9 |
| TR-8 | Hooks print one machine-readable result line so the session-start hook is testable without an agent | AC-16.8, 16.9 |

## 8. What cannot be fully automated (QB-2 exemption list)

| AC / SC | Automated part | Not automated, and the replacement |
|---|---|---|
| AC-8.6, SC-002 | The files each agent would receive are hashed before and after phase 2; the paths resolve | That an agent actually loads that text. Replacement: P4 protocol items P4-14 and P4-26b plus the real-machine checklist step 5. Claude Code only with V's go-ahead. |
| AC-12.1 | File contents and link targets for all three agents | Agent reads them. Same replacement as above. |
| AC-14.2 | Skill-list size computed in characters for a project with and without the framework | The 824-of-9,900-token figure is a Claude Code measurement; re-measure by hand at phase 7 only if V approves a Claude Code run. |
| AC-16.8 (Codex part) | Hook command behaviour (TR-8) | Whether Codex runs it: P4-18. |
| AC-2.2, AC-7.3 (Windows), AC-12.3 | Windows runner | A real Windows account by hand, once per phase (section 6 checklist). |
| A-19 | none | VS Code click: P4-19, V by hand. |
| SC-004, SC-015 | Measured sizes against the baseline; counts of placeholders, writable files, generated-from lines, tracked rendered files | Token figures stay estimates (A-7). |

## 9. P4 agent-behaviour protocol (A-18 to A-26; plus A-14 because AC-12.1 depends on it)

Not run. Written so V, or an agent V approves, can run it step by step.

### 9.0 Rules for every item

- **Agents and models:** Codex CLI: `codex exec -m gpt-6-luna`. Copilot CLI: `copilot --model gpt-5.4-mini`. **Never Claude Code**, never Opus, Sonnet or `gpt-6.1-sol` (repo rule in `AGENTS.md`: these runs spend V's own limits). Record in every finding the agent, its version, the model and the note "a cheap model may behave differently from the models V uses daily".
- **Machine state on 2026-11-13 (this session):** `copilot` 1.0.109 is installed at `/opt/homebrew/bin/copilot`; `codex` is not on `PATH` here (earlier notes say Codex CLI ran bundled in the ChatGPT desktop app, so V may need its path or a standalone install). Find the real binary first: `codex --version`.
- **Isolation (no edit to V's live `~/.codex`, `~/.copilot`, `~/.claude`, `~/.agents`):**
  ```
  P4=$(mktemp -d)                       # one scratch root per run; delete when done
  export HOME_P4=$P4/home               # fake HOME for skills (~/.agents/skills)
  export CODEX_HOME=$P4/codex           # Codex state moved here
  export COPILOT_HOME=$P4/copilot       # Copilot CLI state moved here
  mkdir -p $HOME_P4 $CODEX_HOME $COPILOT_HOME $P4/proj
  ln -s ~/.codex/auth.json   $CODEX_HOME/auth.json     # reuse login, per instruction-loading.md 6.2
  ln -s ~/.copilot/config.json $COPILOT_HOME/config.json
  ```
  `CODEX_HOME` and `COPILOT_HOME` moving the home folders is recorded in `codex-usage-reference.md` and `copilot-usage-reference.md`. Overriding `HOME` (for `~/.agents/skills`) may break a login that lives in the system keychain: unconfirmed. If it does, fall back to a project-level skill folder (`$P4/proj/.agents/skills` for Codex, `$P4/proj/.github/skills` for Copilot) and write the fallback in the finding, because the path then differs from the install target.
- **Order of evidence:** (1) a file the harness wrote (hook log, session events, rollout) beats (2) the model's own answer. The model's answer is a secondary check only, because a cheap model can echo or guess.
- **Runs:** each probe twice minimum; a result counts only if both runs agree. Disagreement = "unstable", recorded as such, not as pass.
- **Negative control:** every item has one run where the expected effect must be absent, so a pass cannot come from a probe that always succeeds.
- **Cost cap:** at most 12 short sessions per item; stop at the first clear result.
- **Recording (constitution III, same turn as the run):** each finding goes into the matching doc under `copilot/knowledge/ai-agents/` or `github-copilot/` (named per item) with: what, how, version, model, date, pass/fail, counts "runs that complied / runs". Do not edit the spec; if a result contradicts an assumption, open an amendment before phase 5.

### 9.1 Items

Legend: **V** = needs V by hand. Doc = where to record.

| Id | Assumption | Agent / model | V by hand? |
|---|---|---|---|
| P4-14 | A-14 (and blueprint) Codex reads linked `~/.codex/AGENTS.md` and `hooks.json`; read permission through linked `~/.agent-config` | Codex, `gpt-6-luna` | yes: trust the hook in `/hooks` |
| P4-18 | A-18 Codex has a session-start hook that can re-render | Codex, `gpt-6-luna` | yes: trust the hook in `/hooks` |
| P4-19 | A-19 VS Code Markdown preview opens a relative `../x.md` target on click | none (VS Code) | yes, entirely |
| P4-20 | A-20 a `/`-leading target resolves against the workspace root; `C:\...` target is invalid; relative is valid | none (VS Code) | yes, entirely |
| P4-21 | A-21 allow-list is only the two core lines | none (script) | no |
| P4-22 | A-22 generated-from line after front matter is harmless | Codex `gpt-6-luna`, Copilot CLI `gpt-5.4-mini` | no |
| P4-23 | A-23 `repository` is a GitHub URL | none (script) | no |
| P4-24 | A-24 non-link mentions of `{{AGENT_HOME}}` handled by conversion or rewrite | none (script) | no |
| P4-25 | A-25 generated-class files protected by the hash check | none (script) | no |
| P4-26a | A-26 Codex accepts Copilot-only skill fields | Codex, `gpt-6-luna` | no |
| P4-26b | A-26 Copilot CLI applies `applyTo` to user instructions | Copilot CLI, `gpt-5.4-mini` | no |
| P4-26c | A-26 VS Code Local harness does not read `~/.copilot` | none (VS Code) | yes, entirely |
| P4-26d | A-26 skill with `disable-model-invocation` costs nothing in Copilot's list | Copilot CLI, `gpt-5.4-mini` | no |

### P4-14: Codex reads linked `AGENTS.md` and `hooks.json`; read permission through links

- **Setup:**
  1. `mkdir -p $P4/gen/codex $P4/home-ac/knowledge` ; `echo "# Probe index" > $P4/home-ac/knowledge/index.md`.
  2. `printf 'Probe marker for this session: LINKED-AGENTS-7731.\nWhen asked, read %s/home-ac/knowledge/index.md and quote its first line.\n' "$P4" > $P4/gen/codex/AGENTS.md`.
  3. `ln -s $P4/gen/codex/AGENTS.md $CODEX_HOME/AGENTS.md` (the install target is a link, like the installer will make).
  4. Hook file `$P4/gen/codex/hooks.json`: one `SessionStart` entry, matcher `startup|resume`, command `node $P4/hook.mjs` (the script appends `date, event name, session id` to `$P4/hook.log`), then `ln -s` it to `$CODEX_HOME/hooks.json`. Shape copied from this repo's `codex/hooks.json`.
  5. **V:** start `CODEX_HOME=$P4/codex codex` once interactively, open `/hooks`, review, **trust and enable** the SessionStart entry (two separate switches, per `harness-engineering-deep-dive.md`; trust is tied to the hook's hash, so any later change to the file needs trusting again). Quit.
  6. `cd $P4/proj` (an empty git repo: `git init`).
- **Prompt (run 1, with the AGENTS.md link):** `codex exec --json -m gpt-6-luna "What probe marker was given in your instructions? Then read the file the instructions name and quote its first line. Reply as: MARKER=<marker> LINE=<line>."`
- **Negative control (run 2):** remove the `AGENTS.md` link, repeat the prompt.
- **Expected observation:** run 1: reply contains `LINKED-AGENTS-7731` and `# Probe index`; the JSON events show a command reading `$P4/home-ac/knowledge/index.md` with exit code 0; `$P4/hook.log` gained one line. Run 2: no marker (the model says it was not given one).
- **Pass rule:** the marker is returned in 2/2 runs with the link and 0/2 without; the read of the file reached through the link succeeds 2/2 under Codex's default sandbox for `codex exec`; `hook.log` has exactly one new line per session. Fail on any: AC-12.1's "linked from `generated/codex/`" must change to "copied" (blueprint fallback: the installer writes copies); a failed read through the link sets the requirement that `~/.agent-config` is added to Codex's readable paths, an install step to specify.
- **Doc:** `codex-usage-reference.md` (hooks and trust) and a new line in `session-start-context-by-agent.md`.

### P4-18: Codex session-start hook can re-render

- **Setup:** as P4-14 steps 1, 4, 5, 6, with this hook script `$P4/hook.mjs`: reads `$P4/source.txt`, copies it to `$P4/rendered.txt`, appends `date + content` to `$P4/hook.log`, and prints JSON `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"RENDERED-VALUE: <content>"}}`. `echo alpha > $P4/source.txt`.
- **Prompt:** `codex exec --json -m gpt-6-luna "What is the RENDERED-VALUE in your session context? Reply with only the value."`
- **Runs:** (a) **before V trusts the hook** (negative control): expected no log line and an answer that says there is none. (b) After trust, source `alpha`: expect `alpha`. (c) Edit `source.txt` to `bravo` between sessions, no manual render: expect `bravo` and `rendered.txt` = `bravo`. (d) Make the hook exit 1 with `source.txt` = `charlie`: the session must still start and answer (never blocks, AC-16.9); `rendered.txt` keeps `bravo`.
- **Expected observation:** `hook.log` order and timestamps show the hook ran **before** the first model turn (compare with the `turn.started` event in the rollout file).
- **Pass rule:** (a) 0 hook runs, (b) and (c) hook runs once per session and `rendered.txt` equals `source.txt` after each, (c) answer is `bravo` in 2/2, (d) session completes in 2/2 and the old copy is kept. All four -> A-18 confirmed: AC-16.8 applies to Codex; otherwise the spec's fallback stands (Codex gets only the `doctor` stale-copy report; no spec change) and the finding is recorded. If (a) shows the hook running untrusted, record that too (it changes the installer's trust step).
- **V:** step 5 (trust). Also V decides whether the installer may ever edit `hooks.json`: every edit invalidates trust (hash), so the merged-hook design needs a documented re-trust step.
- **Doc:** `harness-engineering-deep-dive.md` section on Codex `SessionStart`; `codex-usage-reference.md`.

### P4-19: VS Code preview opens a relative target on click

- **Setup (V):** `mkdir -p $P4/home/knowledge $P4/home/generated/agentic-sdlc "$P4/home with space/knowledge" "$P4/home with space/generated/x"`. File `$P4/home/knowledge/x.md` ("# Target X"). File `$P4/home/generated/agentic-sdlc/foo.md` containing: `[/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md)`. Spaced variant: the same three files under `$P4/home with space/` (`knowledge/x.md`, `generated/x/foo.md`), with the target `../../knowledge/x.md`; and one more link in `$P4/home/generated/agentic-sdlc/foo.md` whose target crosses the spaced folder, written with `%20`: `../../../home%20with%20space/knowledge/x.md`.
- **Steps:** (1) Open **only** `$P4/home/generated/agentic-sdlc` as the workspace (the target lies outside it, the real case). (2) Open `foo.md`, press `Cmd+Shift+V` (Windows: `Ctrl+Shift+V`) for the preview, click the link. (3) Repeat with the cursor in the editor: `Cmd+Click` (Windows: `Ctrl+Click`) the target. (4) Repeat steps 1 to 3 for the spaced path. (5) Repeat on the Windows machine with a Windows-style link text `C:\Users\v\.agent-config\knowledge\x.md` and the same relative target.
- **Expected observation:** `x.md` opens in an editor tab.
- **Pass rule:** opens on the first click in the preview and on the editor click, for the plain and the `%20` case, on Mac and Windows. Any miss is recorded as the exact behaviour (nothing / opens browser / error toast). The spec needs only a valid target and a real-path text, so a fail changes no AC: it is recorded and the rendered-copy docs add "copy the path from the text".
- **Record:** VS Code version, OS, date, in `markdown-link-targets-in-vscode.md` (its "Lookup notes" already list this as open).

### P4-20: `/`-leading and `C:\` targets in VS Code

- **Setup (V):** same tree as P4-19. In `foo.md` add three lines: `[abs](/knowledge/x.md)`, `[abs2]($P4/home/knowledge/x.md)` (full absolute path), `[win](C:\Users\v\.agent-config\knowledge\x.md)`, and the relative one from P4-19. Workspace = the `generated/agentic-sdlc` folder.
- **Steps:** in the Problems panel and the editor squiggles, read what link validation says for each (turn link validation on in Settings; search "markdown validate"; the exact setting name is unconfirmed, check the Settings UI). Click each in the preview.
- **Expected observation:** `/knowledge/x.md` and the full absolute path are looked up under the workspace root and reported missing; the `C:\` form is reported invalid; the relative form is valid.
- **Pass rule:** the relative form is valid and opens; the other three do not resolve to the real file. Matches the documented behaviour -> A-20 stands. Any absolute form that does open -> record it and keep relative targets anyway (they work in both cases).
- **Record:** `markdown-link-targets-in-vscode.md` ("Lookup notes").

### P4-21, P4-23, P4-24, P4-25: no agent run (automated)

These four are design assumptions, not agent behaviour. Do not spend model runs on them; each becomes scenarios in the suite above:
- **P4-21 (A-21):** AC-16.3 scenario: a core with a third `{{AGENT_HOME}}` line fails the allow-list check naming the line; the plan lists the allowed lines and a scenario compares the list with the file.
- **P4-23 (A-23):** a provider with `repository: https://example.invalid/...` (non-GitHub) fails the `component/v1` check with a message naming the host rule; a GitHub URL passes; a URL with a trailing `.git` or `/tree/...` is normalized or rejected, per the plan.
- **P4-24 (A-24):** fixture with `{{AGENT_HOME}}/x.md` in a code span and in prose: the chosen behaviour (convert to citation or rewrite) is asserted exactly, and AC-16.3 (0 placeholders) holds either way.
- **P4-25 (A-25):** edit a generated-class file by hand: `doctor` exits 1 naming it; the three rendered-copy guards do not apply to it.

### P4-22: generated-from line after front matter is harmless

- **Setup:** two skill folders and an instruction file per agent, identical except for one line.
  - `$HOME_P4/.agents/skills/p4-plain/SKILL.md`: front matter `name: p4-plain`, `description: Use when asked for the p4 plain code.`, body `The p4 plain code is KIWI-1001.`
  - `$HOME_P4/.agents/skills/p4-gen/SKILL.md`: the same with name `p4-gen`, code `KIWI-2002`, and the line `Generated from \`src/p4-gen.md\`; edit that file, not this copy.` as the **first body line, right after the closing `---`**.
  - Copilot only: an instruction file `$COPILOT_HOME/instructions/p4.instructions.md` (front matter `applyTo: "**"`, then the generated-from line, then `Instruction marker: INSTR-3003.`) and an agent file `$P4/proj/.github/agents/p4-agent.agent.md` (front matter with `name`, `description`, then the line, then `Reply to every message with AGENT-4004.`).
  - Codex agents are TOML in this repo (no Markdown front matter), so only skills and the instructions text apply to Codex.
- **Prompts (each agent, 2 runs):** `"What is the p4 plain code? Use a skill if one applies. Reply with only the code."` and the same for `p4 gen` (`KIWI-2002`). Copilot additionally: `"What is the instruction marker?"` and `copilot -p --agent p4-agent --model gpt-5.4-mini "hello"`.
- **Expected observation:** both skills are discovered and used the same way; both codes are returned; the Copilot instruction marker is returned; the agent replies `AGENT-4004`.
- **Pass rule:** for each agent, the `p4-gen` variants behave exactly as the `p4-plain` ones in 2/2 runs: discovered (listed with its own name and description, not with the generated-from line as the description), used, correct answer. A skill listed with the generated-from line as its description, or not discovered, is a fail: then A-22 is false for that platform and the line must move (for example into a comment or to the end of the file); the spec's AC-16.4 wording needs an amendment before phase 5.
- **Claude Code:** not run. Its documented rule is that front matter comes first, which the design keeps; confirming the extra body line is harmless needs one Claude Code session, so ask V before spending it.
- **Doc:** `agent-skills-portability.md`; Copilot parts in `copilot-usage-reference.md`.

### P4-26a: Codex accepts Copilot-only skill fields

- **Setup:** `$HOME_P4/.agents/skills/p4-fields/SKILL.md` with front matter `name`, `description: Use when asked for the p4 fields code.`, plus the fields `argument-hint: "[topic]"`, `allowed-tools: "Read Grep"`, `user-invocable: false`, and body `The p4 fields code is KIWI-5005.` Control `p4-plain` from P4-22.
- **Prompt:** `codex exec --json -m gpt-6-luna "What is the p4 fields code? Use a skill if one applies. Reply with only the code."` Also capture the first lines of stderr and the JSON events for warnings about unknown fields.
- **Expected observation:** skill discovered and answered; stderr and events free of errors for those keys.
- **Pass rule:** answer `KIWI-5005` in 2/2 runs, the skill is discovered, and no error is shown for the three extra keys (a warning is recorded, not a failure). Pass -> two skill targets are enough (blueprint decision stands). Fail -> record which key breaks the skill; the build must strip or overlay-per-platform that key, and the number of skill targets is reopened in phase 4.
- **Caveat:** `user-invocable: false` hides a skill from the manual menu, which `codex exec` has no menu to show; for it the pass rule is only "no error and still discoverable".
- **Doc:** `agent-skills-portability.md`.

### P4-26b: Copilot CLI applies `applyTo` to user instructions

- **Setup:** `$COPILOT_HOME/instructions/` holds three files, each with front matter `applyTo`, and one marker line in the body: `a.instructions.md` (`applyTo: "**"`, marker `ALPHA-6001`), `b.instructions.md` (`applyTo: "src/**/*.py"`, marker `BRAVO-6002`), `c.instructions.md` (`applyTo: "docs/**"`, marker `CHARLIE-6003`). `$P4/proj` holds `README.md`, `src/a.py` and `docs/x.md`, as a git repo, and is marked trusted if Copilot asks.
- **Prompts:** run 1: `copilot -p --model gpt-5.4-mini "List every instruction marker (word with digits, ending -600n) you were given. Do not open any file. If none, say NONE."` Run 2: `copilot -p --model gpt-5.4-mini "Open src/a.py and print its first line, then list every instruction marker ending -600n you have."` Negative control: `--no-custom-instructions` on run 1 (recorded in `copilot-usage-reference.md` to turn off every custom instruction source): expect NONE.
- **Expected observation:** run 1 `ALPHA-6001` only if `applyTo` is honoured; all three if it is ignored; run 2 adds `BRAVO-6002` after reading the `.py` file if honoured. As a second line of evidence, compare the first-request input tokens from `session.usage_checkpoint` in `$COPILOT_HOME/session-state/*/events.jsonl` between run 1 and the control.
- **Pass rule:** AC-12.1 needs only that the `applyTo: "**"` routes file loads: `ALPHA-6001` returned in 2/2 and the control returns NONE. Record separately which of three outcomes occurred: honoured (A only in run 1, A+B in run 2), ignored but loaded (A+B+C in run 1), or not loaded (NONE). The third outcome fails AC-12.1 for Copilot CLI: the routes file location must change.
- **Doc:** `copilot-usage-reference.md` ("Location" row) and `vscode-copilot-loading.md`.

### P4-26c: VS Code Local harness does not read `~/.copilot`

- **Setup (V):** add one temporary file `~/.copilot/instructions/p4-vscode-probe.instructions.md` (front matter `applyTo: "**"`, body `Probe marker: VSC-7007.`). Quit VS Code fully (`Cmd+Q`, per `copilot-usage-reference.md`), reopen. Remove the file when done (this is the only edit to V's live folder in the whole protocol; skip the item if V prefers).
- **Steps:** open an empty folder; in Copilot Chat, with the **Local** harness selected, ask "What probe marker were you given? Reply NONE if none." Repeat with the **Copilot** harness selected. Also check the chat's "Used references" for the file.
- **Pass rule (a recording, not a pass/fail of the spec):** Local returns NONE and Copilot returns `VSC-7007` -> blueprint statement confirmed (VS Code's Local harness gets neither core nor routes). Any other outcome is recorded, and the "known gap" row in the docs is corrected.
- **Doc:** `vscode-copilot-loading.md`.

### P4-26d: `disable-model-invocation` skill costs nothing in Copilot's list

- **Setup:** three variants of `$HOME_P4/.agents/skills/` (fallback as in 9.0): (0) empty; (1) one skill `p4-cost` with a 2,000-character description (a repeated neutral sentence); (2) the same skill plus `disable-model-invocation: true`. Same `$P4/proj`, same model, same prompt.
- **Prompt:** `copilot -p --model gpt-5.4-mini --output-format json "Reply with the single word OK."` (method of `instruction-loading.md` section 6: difference in the first request's input tokens).
- **Expected observation:** input tokens (first request, from `session.usage_checkpoint` or the first `inputTokens`) for variants 0, 1, 2, each run twice.
- **Pass rule:** the probe is valid only if (1) minus (0) is at least 300 tokens and the two runs of each variant agree within 5 tokens. Then **pass** = (2) minus (0) is at most 10 tokens: the skill costs nothing in the list. Otherwise record the cost and the description-budget advice changes: hiding a skill from the model does not save idle cost for Copilot (spec AC-11.6 budgets must count it).
- **Doc:** `session-start-context-by-agent.md` and `agent-skills-portability.md`.

### 9.2 Order and effort

Run order (cheapest decision value first): P4-26d, P4-26a, P4-22 (no hand step), then P4-26b, then the V items P4-18, P4-14 together (one trust round), then P4-19, P4-20, P4-26c in one VS Code sitting. P4-21, P4-23, P4-24, P4-25 are not sessions; they become scenarios. About 55 short sessions in all at the 12-session cap, fewer in practice.

## 10. Phase gates (what QA requires green before each pull request merges)

| Phase | Added scenarios | Regression set that must stay green | Special gate |
|---|---|---|---|
| 0 | Schemas, contracts index, fitness, dry-run baseline, layout report, golden plans (recorded **first**) | Everything that exists today (`tests/**`, the validators) | Goldens identical before and after (AC-1.9); matrix job exists and is required |
| 1 | Citation writer/checker, validator argument changes, core wording | Phase 0 + changed old scenarios named in the PR | Fitness counts 109 -> 0 and the check is on |
| 2 | All of Stories 2 to 8 | Phase 0, 1; old installers' scenarios while FR-035 holds | 10 sampled old paths; Mac and Windows checklist; Windows runner green |
| 3 | Story 10 | Phases 0 to 2 | History check recorded; no company name in the core |
| 4 | Story 11 | Phases 0 to 3 | P4 protocol items P4-22, P4-26a, P4-26d answered (they decide field handling) |
| 5 | Story 12, Story 16 | Phases 0 to 4; the dry-run numbers and renderer share the rules (SC-004) | Protocol items P4-14, P4-18, P4-26b answered; size <= baseline everywhere |
| 6 | Story 13 | Phases 0 to 5 | KB alone in a clean checkout |
| 7 | Story 14 | Phases 0 to 6 | Skill-list shrink |
| 8 | Story 15 | Phases 0 to 7 | Three golden files unchanged |

## 11. Review against the QA rubric (self-check)

| Rule | Status |
|---|---|
| QA-R1 AC maps to a task and a test | Planned: QB-1/QB-2 coverage check; tasks come at P5, where the AC to task mapping is checked again (not done here). |
| QA-R3 levels match TD | Yes, section 2 and 4. |
| QA-R5 negative and edge cases | Section 4 column N; 14 edge cases become scenarios. |
| QA-R8 no real data | QB-8. |
| QA-R9 titles with spec-id prefix | QB-1. |

## 12. Caveats, assumptions, risks

- **Test counts are a plan, not a measure.** "111 ACs" counts `AC-n.n` ids in `spec.md` on 2026-11-13; the real scenario count will be higher (outlines, edge cases).
- **Unconfirmed:** Windows runner symlink permission; `os.homedir()` on Windows reading `USERPROFILE`; whether the Windows runner runs the bash check script; the VS Code link-validation setting name; whether a `HOME` override keeps Copilot's and Codex's login working; exact Codex and Copilot flags for the installed versions (flags are taken from this repo's recorded notes and the caller's instruction; run `--help` first).
- **Agent-behaviour risk:** the P4 protocol uses cheap models; their behaviour on hooks and skills may differ from the models V uses. A pass is evidence for the harness (file loading, hook running), which is model-independent, but not for what a model does with the text.
- **Not covered by tests here:** that agents follow the new core wording (AC-9.8). The repo has a method for it (`instruction-wording-findings.md`); run it on Codex and Copilot CLI with cheap models when phase 1 changes the wording, and ask V before any Claude Code run.
- **Escalation points:** none blocking G2. QA would escalate to the plan if TR-1 to TR-8 are rejected, because the strategy cannot be executed without them; and to devops for the required-checks change in section 6.

## 13. Next steps

1. Orchestrator: pass TR-1 to TR-8 to architecture and engineering as plan inputs; pass the CI matrix change to devops.
2. QA at P5: map each AC to tasks, generate `[QA]` test tasks per phase from section 4, with the golden-plan recording as the first task of phase 0.
3. V: schedule the by-hand P4 items (P4-14, P4-18 trust; P4-19, P4-20, P4-26c in VS Code) and say whether a Claude Code run is allowed for P4-22 and for the phase 7 skill-list figure.
4. Security: record the risk tier so TD-Q2 stops being fail-closed.
