# Tasks: agent-config as a motherboard of replaceable components

**Input**: `specs/022-repo-split/` — `spec.md` (G2 approved 2026-11-13), `plan.md`, `research.md`, `data-model.md`, `contracts/`, `decisions/`. Run R-001, phase P5. Risk tier **HIGH** (DR-001): at P6 the `security` role reviews only the tasks that implement the nine blocker mitigations (tagged `[Sec]`, G4-1); every task is reviewed by engineering and qa; security signs off the blocker tasks of each phase before G5.

**G3 approval** (`approve G3 R-001`, 2026-11-13): every default in plan.md "Questions for V at G3" except question 1. V's overrides, applied by the tasks of Phase A:

1. **Node**: always the latest Node 24 (24.12 or later), as `.nvmrc` (24) and `engines` (`>=24 <25`; workflow-graph `>=24.12 <25`). No Node 18 floor anywhere. New runtime code is TypeScript run directly by Node type stripping (typescript-node stack profile; vitest allowed). The Node 18 CI job is dropped. DR-101, DR-107, DR-108, DR-109 and anything else that assumed Node 18 or plain `.mjs` for new code are superseded. Question 1 parts c (JSON Schema plus a reader with a parity test) and d (lint baseline for new code, exemption for legacy `.mjs` tools) keep their defaults.
2. **Roles**: for the rest of this run only `engineering` and `qa` take part. So the 26 spec and blueprint amendments, plus the Node override, are the first tasks, owned by engineering. Delivery files, contracts and architecture-document tasks that the default inference would give to `[DevOps]`, `[Arch]` or `[SysArch]` are tagged `[Eng]` here; **G4 confirms this** (conventions.md §6).

**Tests**: requested. Constitution principle IV (NON-NEGOTIABLE) and DR-501 require unit, scenario (Gherkin, CLI run as a process on a throwaway home) and contract tests on every phase, with negative cases mandatory. Scenario tasks come before the code they cover; a scenario file has one scenario per acceptance criterion with the id starting the title (QB-1).

**Organization**: by the plan's phases, providers before consumers (Phase A, then 0 to 8, then Z). Spec Kit's generic Setup and Foundational phases are the first tasks of each phase. Story tags follow spec.md: Phase 0 is US1; Phase 1 is US9; Phase 2 is US2 to US8; Phase 3 is US10; Phase 4 is US11; Phase 5 is US12 and US16; Phase 6 is US13; Phase 7 is US14; Phase 8 is US15. Priority: P1 stories (US1 to US8) form the MVP, which is phases 0 and 2 (phase 1 is a P2 story but comes between them in the blueprint order, which is unchanged).

## Format

`- [ ] Tnnn [P]? [USn]? description (path)  [Dept] [Exec]` and an indented line `touches · refs · procedure · hot-path · requires` (task-line/v1).

- **[P]**: no shared file with any other `[P]` task and no `requires:` on another `[P]` task. Up to 4 `[P]` tasks run at once (constitution budgets).
- **(path)**: the primary file or folder the task writes. A path that starts with `agent-companies/`, `agent-knowledge/` or `agentic-sdlc-repo/` is in that new repo, a sibling checkout, not in agent-config.
- **Dept and Exec**: `[Eng]` or `[QA]`; `[llm]` is a role instance in execute mode, `[script]` runs the profile checks exactly as declared.
- **[Sec]**: after `[Exec]`; the task implements one of the nine blocker mitigations (M-01, M-02, M-03, M-04, M-05, M-09, M-11, M-14, M-18), so the `security` role reviews it at P6 in addition to engineering and qa (G4-1). Scenario, mutation-proof and amendment tasks carry no tag.
- **touches**: `none` on every task. Tasks that call git, GitHub or the agent folders cannot name an integration yet, because section 6 of `docs/architecture.md` has no id-safe dependency names. The Phase A architecture task adds them; the planner then updates `touches` before G4.
- **procedure**: `none` on every task. The one catalog entry, `typescript-node/add-port-and-adapter`, allows paths under `src/` of the component folder, and the installer core lives at `installers/core/src/`, which the component `installers` does not cover. G4 should split the component (see the analysis report) before a port task can use the procedure.
- **refs**: only the stack reference topics that match the task, and contract sketches. A reference topic outside this list is reported in `unlisted_needs`.
- **Reserved ids**: AC-3.9, AC-3.10, AC-4.6, AC-4.7, AC-4.8, AC-12.8 and EDGE-15 are created by the Phase A amendments. If an amendment numbers them differently, the scenario tasks follow the new numbers.
- **Test levels** (DR-501): unit tests live next to the code and are written by the implementing task; scenario files live under `tests/`; the coverage check (QB-1) reads both.

## Human steps (V, not tasks)

No task line is written for these, because only V can do them. A phase does not merge before its steps are done.

| When | Step | Source |
|---|---|---|
| Before phase 0 merges | Create the annotated tag `pre-022` at `825ea82`; confirm GitHub's free runner minutes for public repos on the first new repo | Q7 |
| Phase 0 | Commit the golden plan the Windows job produces; after merge tag `contracts/v1.0.0` | plan Phases |
| Phase 2 | Add `installer (macos)` and `installer (windows)` as required checks; run the runbook on Mac then Windows (rehearsal in a throwaway home, rollback drill with `uninstall --restore` then `--legacy`, 10 sampled old paths, a Windows account with a space in its name); security sign-off; merge; tag agent-config | DR-208, DR-205 |
| Phase 3 | Create the public `agent-companies` repo with history kept by `git filter-repo`, branch protection with required check `check`, secret scanning and push protection | Q7 |
| Before phase 4 | Give the Codex binary path (Codex is not on PATH on this Mac); the Claude Code part of P4-22 stays unconfirmed by default | Q5 |
| Before phase 5 | Trust the Codex hooks for P4-14 and P4-18; run P4-19, P4-20 and P4-26c in VS Code by hand | Q5, QA protocol |
| Phase 5 | Rehearsal with the exact `settings.json` diff from `plan`; backup of `settings.json` confirmed; restore drill; real Windows account run; security sign-off; tag | DR-208 |
| Phase 6 | Create the `agent-knowledge` repo with history kept, protections as above | Q7 |
| Phase 7 | Create the `agentic-sdlc` repo, annotated tag equal to `framework-version`, protections as above | Q7 |
| Phase 8 | Cut the separate release that retires the compatibility links | DR-207 |
| Every phase | Run the per-phase runbook on Mac then Windows, then merge (G5) | DR-208 |

## Phase A: G3 amendments and the Node 24 override (engineering, before any code task)

**Purpose**: apply what V approved with G3 on 2026-11-13 (every default in plan.md "Questions for V at G3" except question 1) so spec, blueprint, plan, research, data model and architecture agree before code starts. Owner: engineering, by V's instruction for this run. One task per amendment id; the Node override is id N-1. New acceptance criteria and edge cases get the ids reserved in the task line (the amendment may renumber, then T-tasks below follow the new ids).

**Checkpoint**: no phase 0 task starts until the amendment gate (the last task of this phase) passes.

- [x] T001 N-1 Node override: add decision records that supersede DR-101, DR-107, DR-108, DR-109 and the Node 18 job of DR-206, and mark conflict C-8 moot. Content: latest Node 24 from 24.12 only, TypeScript run directly by Node type stripping with erasable syntax and .ts import specifiers, vitest for unit tests, one lint baseline for new code, aliases by package.json imports because there is no build step, no Node 18 floor job. Each record lists rejected options and says Decided by human (specs/022-repo-split/research.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T002 S-12 add a decision record with the YAML parser limits for yaml 2.9.1, checked against the library documentation: no custom tags, alias limit, 256 KiB cap per file, and the exact option names; clears unlisted need U-1 and backs M-17 (specs/022-repo-split/research.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T001
- [x] T003 U-2 walk the paradigm tree for installers/core and contracts/lib and record the choice. The record must state that Node type stripping rejects constructor parameter properties, so a class-modeled choice needs explicit field declarations, and must name the paradigm for each tier. This is unlisted need U-2 from the plan, added here because every code task depends on it (specs/022-repo-split/research.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T002
- [x] T004 N-1 Node override: amend spec.md assumption A-2 to the latest Node 24 from 24.12, and the AC-5.9 example to a runtime older than 24.12 reported by a replaceable node command; no Node 18 text remains (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T005 S-1 add AC-4.6 under US4: install exits 10 with a privileged changes need that lists every new or changed hook, MCP service, status line, route and skill or agent text in full with component and commit, writes nothing, and approval records the hash of the approved set; add AC-12.8 under US12: the session-start and post-merge hooks never change the privileged set; adjust FR-016 and FR-039 (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T004
- [x] T006 S-2 change AC-3.1, FR-020 and FR-028 so install checks out the SHA in the lock; add AC-3.9: install --update with an optional name advances a git source and prints the commit range; add AC-3.10: a locked tag that now resolves to another SHA exits 1 with tag moved (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T005
- [x] T007 S-3 amend FR-019: a source URL with a user-info part fails validation naming the component only, and every report redacts user-info and token query parts (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T006
- [x] T008 S-4 amend AC-6.1 and FR-025: set refuses names containing TOKEN, SECRET, PASSWORD, APIKEY or API_KEY and values with common token prefixes; variables are public values (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T007
- [x] T009 S-5 amend AC-4.5 so a suggested source is labelled suggested by the component, unverified, and never printed as a ready command; add AC-4.7: home confirmation and privileged approval need an interactive terminal, else exit 10, and amend AC-2.1 and AC-2.5 to match; add a requirement next to FR-048 with AC-4.8: one core line says agents never run add, use or an approval from a NEEDS report without V approval in chat (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T008
- [x] T010 S-6 amend the Edge Cases line on hooks for agents not installed, AC-7.5 and AC-8.3: doctor warns only for agents absent from the machine and fails on a merged hook whose command does not resolve; retired refuses to remove a compatibility link that a merged hook command uses (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T009
- [x] T011 S-7 amend AC-7.5: add the doctor fault of a symlink in a linked path source whose real path leaves the component root (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T010
- [x] T012 S-8 clarify FR-004 and FR-005: ids match the pattern for lowercase letters, digits and hyphens up to 64 characters; path fields are relative with no .. segment, drive letter, backslash or NUL (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T011
- [x] T013 S-9 amend AC-7.3: the home, the backups folder and every backup are owner-only, and doctor warns otherwise (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T012
- [x] T014 S-10 amend AC-12.3: the merge touches only installer-owned hooks entries and the core status line; an unparsable file exits 1 writing nothing; the file hash is re-checked before the rename (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T013
- [x] T015 S-11 number the 14 existing Edge Cases EDGE-1 to EDGE-14 in their current order so the coverage check can read them, and add an Edge Case with id EDGE-15: concurrent runs use one home-wide lock and a second run waits or exits 1 naming the lock (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T014
- [x] T016 D-1 amend AC-7.6 and FR-030: uninstall with restore puts back every item in the newest backup manifest that the install replaced (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T015
- [x] T017 D-2 amend FR-035: install.sh with legacy and install.ps1 with Legacy stay available through phase 5 plus one tag (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T016
- [x] T018 D-3 amend AC-7.3 and FR-026: backups also cover V two local files before set, add and use rewrite them (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T017
- [x] T019 D-4 amend FR-014: the home also holds store, install.lock, the journal install-state.pending.json and install-log.jsonl (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T018
- [x] T020 D-5 amend the AC-7.5 warnings: doctor also prints references to old agent-home paths found in agent config files, backup count and size, and degraded Windows links (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T019
- [x] T021 A-1 amend AC-1.6 and AC-9.1: the baseline and the zero target cover the whole agent-knowledge component, 123 lines in 73 files instead of 109 in 67 (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T020
- [x] T022 A-2 amend AC-13.4 and FR-040: add the 42 AGENT_HOME lines in 11 files of the two frameworks to the phase 6 conversion (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T021
- [x] T023 A-3 amend FR-001 and AC-1.1: fourteen contracts become fifteen, adding framework/v1 (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T022
- [x] T024 A-6 amend FR-014: add the core locations instructions, patterns, procedures, references, atlas, tracker, frameworks/agent-foundry and the global-variables.md link (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T023
- [x] T025 P-2 amend FR-044 wording: each consumer check runs the shared build cite (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T024
- [x] T026 A-4 amend the blueprint phases: the minimal routes renderer moves into phase 3, per-entry skill and agent targets into phase 4, and the 4 SDLC procedures move to agentic-sdlc in phase 4 (specs/022-repo-split/blueprint.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T027 A-5 amend the blueprint contract table: the slots/v1 row loses count, and the knowledge-provider/v1 row loses the no-other-component-path rule and the companies mount (specs/022-repo-split/blueprint.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T026
- [x] T028 N-1 Node override: replace node >=18 in the blueprint dependency row and the Node on every machine row by the latest Node 24 from 24.12 (specs/022-repo-split/blueprint.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T027
- [x] T029 [P] P-1 amend the security record M-01 phase column: consent for routes lands in phase 3 and for skill and agent text in phase 4 (specs/022-repo-split/decisions/security.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T030 [P] P-3 record in the constitution style deviations that legacy .mjs tools are exempt from the lint baseline until each is rewritten, and say what rewritten means so touching one line does not trigger the full baseline (.specify/memory/constitution.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T031 [P] N-1 Node override: update plan.md technical context, constraints, installer core description, project structure from .mjs to .ts, phase 0 and 2 content, the CI paragraph without the Node 18 job, the unconfirmed list, and mark question 1 parts a and b as overridden by V (specs/022-repo-split/plan.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T032 [P] N-1 Node override: change the depends.runtime example in the data model to node >=24.12 (specs/022-repo-split/data-model.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T033 [P] N-1 Node override: change node >=18 in the component contract sketch and the shim and main.mjs lines in the installer interface sketch to Node 24.12 and main.ts. V list did not name the contract sketches but they hold Node 18 text (specs/022-repo-split/contracts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T034 [P] N-1 Node override: update docs/architecture.md section 3 installers note, section 4 CompositionRoot.mjs to .ts, section 6 Node row to 24.12 or later, section 8 decision rows for the superseding records, section 10 gaps; give section 6 dependency cells id-safe names so tasks can use touches (docs/architecture.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T035 Amendment gate: run validate-project and an id extractor over the amended files. Pass when every reserved id exists in spec.md AC-3.9, AC-3.10, AC-4.6, AC-4.7, AC-4.8, AC-12.8 and EDGE-15, no Node 18 text remains in spec, blueprint, plan, research, data model, architecture and contract sketches, and validate-project names no failure under specs/022 (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029, T030, T031, T032, T033, T034

**V's G4 answers** (all defaults, applied after the gate as extra amendments; T257 to T262 are already done):

- [x] T257 G4-1 security review only for the nine blocker-mitigation tasks: plan.md Security and Phase table say so; the tasks that implement M-01, M-02, M-03, M-04, M-05, M-09, M-11, M-14 and M-18 carry the [Sec] tag (specs/022-repo-split/plan.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T258 G4-2 amend AC-8.6: in each phase the core text agents load is compared by content hash with the hash recorded at the end of the previous phase, a difference only when the pull request names the core change (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T259 G4-3 functional-pipeline paradigm for installers/core and contracts/lib: decision records PDM-installers-core and PDM-contracts-lib, the plan Language and Paradigm rows, the paradigm in docs/architecture.md (specs/022-repo-split/research.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T260 G4-4 add AC-12.9: the guard hook with no Node 24.12 or later denies in a folder that has .specify/runs and allows elsewhere (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T261 G4-5 conversion order: amend FR-032 and A-15 and the plan phase 5 and 6 rows so the 484 hard-coded lines are converted in phase 5 after rendering, and knowledge files go straight to their final form in phase 6 (specs/022-repo-split/spec.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none
- [x] T262 G4-6 installer-core as its own component in docs/architecture.md so tasks can name installers/core/ and use the typescript-node procedures, with contracts-lib, contracts-tools and contracts-schemas in the planned block (docs/architecture.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: none

## Phase 0: Contracts and fitness (US1, nothing installed changes)

**Goal**: every connection has a contract, the files the installer will read have schemas, and fitness checks stop the structure from getting worse. **Independent test**: with only this phase merged, the full check command passes and the three golden install plans are unchanged (AC-1.9).

**Test depth** (DR-501): unit, scenario and contract on every task, negative cases mandatory because the risk tier is HIGH. Order inside the phase: golden plans first (QB-3), then scenarios, then code.

- [ ] T036 [P] [US1] Record the golden plans of the old bash installers on Mac and Linux before anything changes: run install.sh against the real mapping.yaml with a private HOME and list every link and seeded file as target to source with mode, one committed golden file per OS. Characterization test, QB-3 (tests/installers/golden/posix)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T035
- [ ] T037 [P] [US1] Record the golden plan of install.ps1 on the Windows runner before anything changes, in the same listing form; V commits the file the Windows job produces (tests/installers/golden/windows)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T035
- [ ] T038 [US1] Scenario AC-1.9: the plan of the old installers on the phase 0 branch equals each golden file on Mac, Linux and Windows; a changed mapping makes it fail (tests/installers/golden.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T036, T037
- [ ] T039 [US1] Toolchain per the superseding records: exact dev dependencies for prettier, eslint, typescript-eslint, typescript, @types/node 24, vitest, ajv and eslint-plugin-n; package scripts; engines of the new packages set to >=24.12 <25; root tsconfig with strict, noUncheckedIndexedAccess, erasableSyntaxOnly, allowImportingTsExtensions and noEmit; vitest limited to src test files; prettier ignores vendor (package.json)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/subpath-imports.md  ·  procedure: none  ·  hot-path: no  ·  requires: T035
- [ ] T040 [P] [US1] ESLint flat config for the installer tier carrying every name in the stack lint baseline, complexity 10 and 50 lines per unit from the constitution, import-x/no-cycle and the module-boundary zones of the architecture; legacy .mjs tools stay exempt per the P-3 record. The config sits at the component root so validate-project finds it (installers/eslint.config.mjs)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/subpath-imports.md  ·  procedure: none  ·  hot-path: no  ·  requires: T039
- [ ] T041 [P] [US1] The same lint baseline for the contracts tier with its own zone: contracts imports nothing else in the repo (contracts/eslint.config.mjs)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/subpath-imports.md  ·  procedure: none  ·  hot-path: no  ·  requires: T039
- [ ] T042 [US1] Extend the Cucumber config to load new tool.ts and support .ts files by type stripping, keep the old .mjs patterns, and register the scenario tags mac, windows and posix so a scenario can run on one OS only (cucumber.mjs)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T039
- [ ] T043 [US1] Shared scenario support for the new tools: temporary home per scenario, snapshot of a file tree before and after for the write nothing scenarios, exact text compare with the timestamp normalizer, a runner for tools under contracts/ and scripts/ (tests/support/tools.ts)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T042
- [ ] T044 [US1] Confirm what the plan lists as unconfirmed for Node and Windows and record it with sources, version and date in the knowledge base: Node 24.12 type stripping limits and warning text, os.homedir reading USERPROFILE on Windows, symbolic links, junctions and rename over a directory link on the Windows runner, chmod read-only on Windows (copilot/knowledge/js-runtime)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T042
- [ ] T045 [P] [US1] Scenarios for the schema check, one per criterion with the id starting the title: AC-1.2 the five valid examples pass and an extra key colour gives exactly one warning naming it; AC-1.3 count and mounts fail naming the replacement; AC-1.4 the three starting slots and a contract list of two. Negatives: bad id, .. segment, drive letter, backslash and NUL each fail naming the field; P4-23 a repository URL that is not a GitHub address fails naming the host rule and a GitHub address passes (tests/contracts/schemas.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T046 [P] [US1] Contract test: every shipped valid and invalid example is run through the JSON Schema with ajv and through the reader; both must agree, so the two forms of each contract cannot drift (contracts/lib/parity.test.ts)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T047 [P] [US1] Scenarios AC-1.1 the index lists all fifteen contracts and each has owner, consumers, versioning rule and missing or stale behaviour, and an entry missing a field fails; AC-1.8 the worked examples of knowledge-provider/v1 and rendered-copy/v1 show the source and rendered citation on Mac and Windows with the relative target ../../knowledge/x.md (tests/contracts/index.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T048 [P] [US1] Scenario AC-1.5: principle I says the source is single and per-platform files are generated, version 2.0.0, a dated amendment stating the change, and check-docs passes (tests/contracts/constitution.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T049 [P] [US1] Scenario AC-1.6: a fixture with the edge knowledge depends on agentic-sdlc fails naming the edge; the real tree counts equal the recorded baseline; a rise of one fails. Includes the forbidden edges knowledge to companies and contracts to any component (tests/fitness/fitness.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T050 [P] [US1] Scenarios AC-1.7: the dry run writes nothing, the baseline holds per agent always-loaded characters with an estimate-marked token figure, method, tool version, date, the AGENT_HOME line count and the Claude Code skill list figure with its sdlc share; a missing field fails. Plus the swap rule table: Mac, Windows, spaces, non-ASCII, tilde copilot agent-home path, Copilot-own path kept, allow-list, generated-from line placement, idempotence (tests/baseline/baseline.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T051 [P] [US1] Scenarios for FR-012: repo-layout in report mode exits 0 on agent-config and lists findings; a rule violation in a fixture is reported and not fatal (tests/repo-layout/layout.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T052 [P] [US1] Scenarios for the coverage check QB-1 and QB-2: it reads the ids in spec.md and the scenario titles, fails on an acceptance criterion of a delivered phase with no scenario, honours the exemption list, and rejects an exemption with no reason or no manual replacement (tests/coverage/coverage.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T043
- [ ] T053 [US1] Write the reviewed exemption list in machine form with reason and manual replacement for each: AC-8.6, SC-002 and AC-12.1 agent load, AC-14.2 token figure, AC-16.8 Codex part, AC-2.2, AC-7.3 and AC-12.3 on a real Windows account, A-19, SC-004 and SC-015 token estimates (tests/coverage/exemptions.yaml)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T052
- [ ] T054 [US1] The one yaml wrapper over yaml 2.9.1 vendored and byte-compared with the lockfile, with the M-17 limits: no custom tags, alias limit, 256 KiB cap per file. Unit tests with hostile files (contracts/lib/yaml.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T045, T041, T002
- [ ] T055 [US1] Tolerant manifest and list reader: unknown keys warn, count and mounts rejected with the replacement named, ids and path fields checked against the M-03 rules, current and previous major accepted. Unit tests table driven (contracts/lib/reader.ts)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T054
- [ ] T056 [US1] Slot, location and citation classifier: longest location prefix wins, a bare relative path is the component own file, a path under no location fails naming it. One shared rule table fixture used later by the dry run, build cite and the renderer (contracts/lib/citations.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T055
- [ ] T057 [US1] Render rules as pure functions with the platform injected: path swap for Mac, Windows, spaces and non-ASCII, tilde copilot agent-home paths, allow-list, generated-from line after front matter where required, idempotent; plus the character counter (contracts/lib/render-rules.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: yes  ·  requires: T056
- [ ] T058 [US1] Contract slots/v1 with contracts/slots.yaml holding the reserved core slot and the three starting slots: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/slots/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/slots-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T059 [US1] Contract component/v1 including the id and path rules, variables as public values, and idle-cost: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/component/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/component-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T060 [US1] Contract components-list/v1 for the public and the local list: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/components-list/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/components-list-and-lock-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T061 [US1] Contract components-lock/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/components-lock/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/components-list-and-lock-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T062 [US1] Contract knowledge-provider/v1 with the two citation forms as a worked example: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/knowledge-provider/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/knowledge-provider-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T063 [US1] Contract company-kb/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/company-kb/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/knowledge-provider-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T064 [US1] Contract rendered-copy/v1 with the Mac and Windows worked example: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/rendered-copy/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/rendered-copy-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T065 [US1] Contract routes/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/routes/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/routes-hooks-variables-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T066 [US1] Contract skill-source/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/skill-source/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T067 [US1] Contract agent-source/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/agent-source/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T068 [US1] Contract adapter-fields/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/adapter-fields/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T069 [US1] Contract build/v1 including the schema of the baseline file the budget subcommand writes: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/build/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T070 [US1] Contract repo-layout/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/repo-layout/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T071 [US1] Contract hooks/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/hooks/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/routes-hooks-variables-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T072 [US1] Contract variables/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/variables/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/routes-hooks-variables-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T073 [US1] Contract framework/v1: schema.json in JSON Schema 2020-12, README with owner, consumers, versioning rule, behaviour when missing or stale, worked examples, and valid and invalid example files shared with the parity test. Sketch is the starting point (contracts/framework/v1)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/build-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T046, T047, T045
- [ ] T074 [US1] Contracts index listing the fifteen contracts with owner, consumers, versioning rule and missing or stale behaviour, and the install-report and install-state interfaces as in-repo interfaces (contracts/index.md)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/README.md  ·  procedure: none  ·  hot-path: no  ·  requires: T058, T059, T060, T061, T062, T063, T064, T065, T066, T067, T068, T069, T070, T071, T072, T073
- [ ] T075 [US1] Build tool skeleton with the budget subcommand and its baseline option as a dry run: swap rules and generated-from line applied in memory, writes nothing, reports per agent characters, token estimate marked estimate, method, tool version, date, AGENT_HOME line count and skill list figure (contracts/tools/budget.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T057, T050, T069
- [ ] T076 [US1] The layout subcommand in report mode: evaluates the repo-layout rules, lists findings, exits 0 (contracts/tools/layout.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T051, T070
- [ ] T077 [US1] Entry point build.ts dispatching the subcommands, usage error exit 2, honest help text (contracts/tools/build.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T075, T076
- [ ] T078 [US1] Schema check command that runs the reader over example files and any file given, printing warnings and failures with exact messages; used by the scenarios and by check-docs (contracts/tools/check-schemas.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T055, T074
- [ ] T079 [US1] Run the budget baseline once per agent and commit the recorded always-loaded baseline file with method, tool version and date (docs/baselines/always-loaded.json)  [Eng] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T077, T050
- [ ] T080 [US1] Atlas registry: the four components, allowed edges, forbidden edges knowledge to agentic-sdlc, knowledge to companies and contracts to any component, then regenerate the atlas pages (copilot/atlas/atlas.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T049
- [ ] T081 [US1] Fitness check script: edge diff against the architecture and atlas, recorded baselines of 123 lines in 73 files, core to agentic-sdlc 20 and core to companies 1 and the checks that read another area, fails only on a rise, names the edge. Unit tests (scripts/check-fitness.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T080, T040
- [ ] T082 [US1] Record the fitness baseline counts with method, tool version and date (docs/baselines/fitness.json)  [Eng] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T081
- [ ] T083 [US1] Coverage check QB-1: reads spec.md acceptance criteria and EDGE ids and the feature titles, reads the exemption list, fails on an uncovered id of a delivered phase. Unit tests (scripts/check-ac-coverage.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T053, T040
- [ ] T084 [US1] Amend constitution principle I to one source generated per platform, version 2.0.0 as a MAJOR amendment with date and stated change (.specify/memory/constitution.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T048, T030
- [ ] T085 [US1] Workflow installer.yml: Ubuntu, macOS and Windows with a throwaway home, Node from .nvmrc, no Node 18 job, read-only permissions, actions pinned to full commit SHAs, no secrets. This is delivery work done by engineering because only engineering and QA take part in this run (.github/workflows/installer.yml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T042
- [ ] T086 [US1] Wire format, lint, typecheck, unit tests, schema check, fitness in report mode, coverage and layout report into the one check entry, and keep the old validators and scenarios running unchanged (scripts/check-docs.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T078, T081, T083, T077, T040
- [ ] T087 [US1] Mutation proof QB-7 for each new phase 0 check: disable it and show that the named scenario fails; record the proof once in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T086, T079, T082, T084, T038
- [ ] T088 [US1] Measure the unit layer and the scenario layer run time per OS against the 60 second and 3 minute budgets QB-6 and write the measured figures into the constitution budgets section (.specify/memory/constitution.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T087, T085
- [ ] T089 [US1] Phase 0 exit check FR-043 and SC-013: check-docs green, the three golden plans unchanged, AC-1.1 to AC-1.9 scenarios pass, the baseline file has method, tool version and date, coverage check passes. Matrix job required is a human step (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T088, T044

## Phase 1: Cut the cycles (US9)

**Goal**: the knowledge area stops depending on the SDLC framework, and citations get checked targets. **Independent test**: run the knowledge validator against a checkout holding only the knowledge area; run the SDLC validator with and without the write option.

Characterization scenarios of the two validators come first (QB-3). The core instruction edits of three later criteria are done here, in one change, so the phase 2 move leaves the text agents load unchanged (AC-8.6).

- [ ] T090 [P] [US9] Characterization scenarios that pin what the knowledge validator does today for the three behaviours this phase removes: the Used by rule, the backlink scan and the deny-list check on company folders (tests/validate-knowledge/characterization.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T089
- [ ] T091 [P] [US9] Characterization scenarios that pin the SDLC validator today: the hard-coded knowledge and adapter folders and what a missing citation prints (tests/validate-sdlc/characterization.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T089
- [ ] T092 [US9] Scenarios AC-9.2 a doc without Used by passes and a doc with a Used by table is ignored without error, and the validator source holds no backlink scan; AC-9.4 the validator reads only the knowledge area, never a company folder, and the deny-list check no longer exists (tests/validate-knowledge/validate-knowledge.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T090
- [ ] T093 [US9] Scenario AC-9.3: with the knowledge root and the adapter map as arguments an unresolved citation fails naming the citing file and the missing path, and a fixture with renamed folders passes, so no folder name is hard-coded (tests/validate-sdlc/validate-sdlc.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T091
- [ ] T094 [P] [US9] Scenarios for build cite: AC-9.5 write makes the GitHub target from the provider repository URL and a second write changes nothing byte for byte; AC-9.6 a missing or different target fails naming file, citation and expected target; AC-9.7 a provider with no repository fails naming provider and file; AC-5.10 the three classifier cases; EDGE-7 and FR-017 a hand-written depends.docs that disagrees fails and prints the generated value; EDGE-13 a provider with no repository. Spaces and non-ASCII paths in the unit table (tests/build/cite.feature)  [QA] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/knowledge-provider-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T089
- [ ] T095 [P] [US9] Scenarios on the core instruction text: AC-9.8 the VAR rule says resolve from global-variables.md and read the resolved file on this machine and never fetch it, and no line tells agents to read link text instead of the target; AC-6.5 one line defines AGENT_HOME and no other variable is defined; AC-4.8 one line says agents never run add, use or an approval from a NEEDS report without V approval in chat. Each forbidden line when added fails (tests/core-instructions/core.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T089
- [ ] T096 [US9] Scenario AC-9.1: the count of knowledge mentions of agentic-sdlc is 0 and the check is on for good, a single new mention fails; the checks that read another area count 0, which is the measure behind SC-012 (tests/fitness/phase1.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T089
- [ ] T097 [US9] Knowledge validator: remove the Used by rule, the backlink scan and the deny-list check, read only the knowledge area (copilot/frameworks/knowledge/tools/validate-knowledge.mjs)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T092
- [ ] T098 [US9] Knowledge framework schemas and index: drop the Used by requirement and say a leftover table is ignored (copilot/frameworks/knowledge/schemas)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T092
- [ ] T099 [US9] SDLC validator: take the knowledge root and the adapter map as arguments, fail an unresolved citation naming file and path, no hard-coded folder names (copilot/frameworks/agentic-sdlc/tools/validate.mjs)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T093
- [ ] T100 [US9] The build cite subcommand with an optional write: classify with the shared classifier, generate the target from the provider repository URL, idempotent, generate depends.docs, fail on missing or stale target and on a provider without repository (contracts/tools/cite.ts)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/knowledge-provider-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T094, T077, T056
- [ ] T101 [US9] Core instructions: the VAR rule reads the resolved file locally and never fetches; remove any read the link text line; one line defining AGENT_HOME and no other variable definition; one line that agents never run add, use or an approval from a NEEDS report without V approval in chat (copilot/instructions/core.instructions.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T095, T009
- [ ] T102 [P] [US9] Remove mentions of agentic-sdlc from the design-principles knowledge docs, keeping every other sentence (copilot/knowledge/software-design/design-principles)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T103 [P] [US9] Remove mentions of agentic-sdlc from the architecture-styles knowledge docs (copilot/knowledge/software-design/architecture-styles)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T104 [P] [US9] Remove mentions of agentic-sdlc from the oop knowledge docs (copilot/knowledge/software-design/oop)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T105 [P] [US9] Remove mentions of agentic-sdlc from the functional-modeling knowledge docs (copilot/knowledge/software-design/functional-modeling)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T106 [P] [US9] Remove mentions of agentic-sdlc from the ddd docs and the software-design root (copilot/knowledge/software-design/ddd)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T107 [P] [US9] Remove mentions of agentic-sdlc from the js-runtime knowledge docs (copilot/knowledge/js-runtime)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T108 [P] [US9] Remove mentions of agentic-sdlc from the ai-agents knowledge docs (copilot/knowledge/ai-agents)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T109 [P] [US9] Remove mentions of agentic-sdlc from the error-handling knowledge docs (copilot/knowledge/error-handling)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T110 [P] [US9] Remove mentions of agentic-sdlc from the documentation and code-documentation knowledge docs (copilot/knowledge/documentation)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T111 [P] [US9] Remove mentions of agentic-sdlc from the concurrency, testing, operations, web-apis and versioning docs and the knowledge root index (copilot/knowledge)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T112 [P] [US9] Remove mentions of agentic-sdlc from the knowledge framework and the company-kb framework files (copilot/frameworks/company-kb)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T096
- [ ] T113 [US9] Fitness check: switch the knowledge to agentic-sdlc count and the checks that read another area from a baseline to a hard zero, on for good (scripts/check-fitness.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T102, T103, T104, T105, T106, T107, T108, T109, T110, T111, T112, T097, T098, T081
- [ ] T114 [US9] Check entry: run the SDLC validator with the knowledge root and adapter map arguments and build cite in check mode over fixtures; real consumer enforcement starts in phase 6 when a provider repository URL exists (scripts/check-docs.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T099, T100, T113, T086
- [ ] T115 [US9] Mutation proof QB-7 for the zero count check, the cite checks and the core wording check; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T114, T101, T087
- [ ] T116 [US9] Phase 1 exit check: fitness count is 0 and on for good, AC-9.1 to AC-9.8 scenarios pass, phase 0 scenarios pass unchanged QB-5, and the install difference is empty (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T115

## Phase 2: Minimal installer (US2 to US8)

**Goal**: one install command composes components from git or path sources by slot, confirms the home first, stops and asks instead of guessing, keeps the old state on any failure, and keeps every old path working. **Independent test**: run install twice on a clean account (without and with confirmation); install one component as git and as path; break a source; run doctor; run uninstall.

Blocker mitigations in this phase: M-01 mechanism, M-02, M-03, M-04, M-05, M-11, M-14 for retired, M-18 for detect. Every module has the four layers of MOD-9, ports owned by the application layer, and the pure planner returns one Plan (DR-306). The old installers keep wiring the agent folders, now pointed at the new home (FR-035).

- [ ] T117 [US2] Scenario world for the installer: a temporary home and agent folders per scenario, local bare git repos as git sources with no network, a replaceable node version command, a fixed clock, a scripted terminal that answers or is absent, and exact text compare with the timestamp normalizer (tests/support/installer-world.ts)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T116, T043
- [ ] T118 [US7] Fault adapter for the scenario layer, built only by the test composition: fail the nth write, links not permitted, fetch fails for component X, process killed between two link switches. It can only make an operation fail, never invent a success (tests/support/fault-adapters.ts)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T117
- [ ] T119 [P] [US2] Scenarios AC-2.1 first run states ~/.agent-config, lists it as a need, exits 10 and changes nothing; AC-2.2 Windows states USERPROFILE not APPDATA; AC-2.3 AGENT_CONFIG_HOME is stated; AC-2.4 a confirmed home is stated first and asks nothing; AC-2.5 a moved home names both and exits 10 without writing. Negative: with no interactive terminal the confirmation exits 10 (tests/installer/home.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T120 [P] [US3] Scenarios AC-3.1 to AC-3.8 plus AC-3.9 install stays on the locked SHA and install update advances it with the commit range, and AC-3.10 a moved tag exits 1. One outline runs the same component as git and as path for SC-011. Negatives: missing path folder, unreachable git source keeps the old link, no manifest skips only that component, archive refused with the exact text, tracked local file fails; FR-034 no package manager install (tests/installer/sources.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T121 [P] [US4] Scenarios AC-4.1 to AC-4.5 plus AC-4.6 privileged changes need and nothing written, AC-4.7 confirmation and approval need an interactive terminal else exit 10, AC-4.5 as amended with the suggested source labelled unverified and never a ready command, and the exit code table. The json document is one document on standard output and standard error has none; text is compared exactly (tests/installer/needs.feature)  [QA] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/installer-cli.md  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T122 [P] [US5] Scenarios AC-5.1 to AC-5.9: reuse, default, chain, cycle printed in order, contract majors N and N-1, export violation, two providers for a single slot, unknown slot skips only that component, runtime older than 24.12 through the fake node command. SC-008 swapping provider A for B leaves consumer files byte identical (tests/installer/resolve.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T123 [P] [US6] Scenarios AC-6.1 to AC-6.4 and AC-6.6: set stores a value, exact union of two components variables, unknown name lists the closest declared names, a detect result is only a proposal, a changed value rewrites only the rendered file. Negatives from M-08: secret-like names and values refused. M-18 detect never runs a command. DR-414 existing values imported (tests/installer/variables.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T124 [P] [US7] Scenarios AC-7.1 to AC-7.7: no changes with zero rewritten files, failing check keeps previous links, real file backed up and named, plan writes nothing and equals the diff after apply TR-4, a doctor outline with one row per fault, uninstall removes only recorded and unchanged files and restores from the newest backup manifest, plan and doctor repeat identically. Includes owner-only permissions and backup of the two local files (tests/installer/safety.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T125 [P] [US8] Scenarios AC-8.1 ten sampled old paths show the same content, AC-8.2 Copilot own folders untouched, AC-8.3 retired removes only the installer own link and reports a real file, AC-8.4 the sorting check classifies every hard-coded copilot line and fails a new one, AC-8.5 the 445 AGENT_HOME lines are byte identical before and after, AC-8.6 hash of the text each agent would receive is unchanged (tests/installer/compat.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T126 [P] [US7] Edge case scenarios EDGE-1 unmanaged files in the home, EDGE-2 two machines share nothing committed, EDGE-3 account cannot create links exits 1 changing nothing, EDGE-4 interrupted install completes or restores, EDGE-5 local entry wins and plan shows it, EDGE-6 removed component links removed and path folder untouched, EDGE-9 network down on a rerun, EDGE-10 same variable with two descriptions fails naming both, EDGE-15 concurrent runs and the lock (tests/installer/edge-cases.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T127 [P] [US4] Negative security scenarios, each named by its mitigation id: M-01 new or changed privileged entry exits 10 and writes nothing, M-02 tag moved, M-03 traversal through every path field and name, M-04 clone symlink and out-of-root link, M-05 refs and URLs starting with a dash, ext and file transports, submodules ignored with a warning, timeouts, M-07 credentials in a URL, M-10 permissions, M-11 non-interactive approval refused, M-12 second run waits or exits naming the lock, M-16 log line shape and rotation, M-17 hostile YAML, M-18 detect and build never run component code (tests/installer/security.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T128 [P] [US2] Scenarios for the entry scripts on their own OS: Node lookup with the NODE override first, one line need and exit 10 when no Node 24.12 or later is found, exit code passed through, install.sh with legacy and install.ps1 with Legacy run the old installer, a home path with a space. Traces FR-033 and FR-035 (tests/installer/shims.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T118
- [ ] T129 [US2] Installer core package: package.json with engines >=24.12 <25 and the imports map, tsconfig, four-layer folders per module with keep files, vitest include for src test files (installers/core)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/subpath-imports.md  ·  procedure: none  ·  hot-path: no  ·  requires: T119, T120, T121, T122, T123, T124, T125, T126, T127, T128, T003, T040
- [ ] T130 [US4] Shared module, domain neutral only: M-03 path containment and name rules, hashing, redaction of user-info and token query parts M-07, exit codes 0 10 1 2, the report model and the one message catalog TR-5. Unit tests with negatives (installers/core/src/modules/shared)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T129, T055
- [ ] T131 [US3] Manifests module: read and validate component.yaml, both lists and the slots file through contracts/lib, name and path rules M-03, credentials in a source URL refused M-07, archive skipped with the exact text (installers/core/src/modules/manifests)  [Eng] [llm] [Sec]
      touches: none  ·  refs: specs/022-repo-split/contracts/installer-cli.md  ·  procedure: none  ·  hot-path: no  ·  requires: T130
- [ ] T132 [US7] State module: components.lock, install-state.json, journal with interrupted-run restore, home-wide install.lock with a 10 minute stale timeout M-12, backups with manifest including V two local files and owner-only permissions M-10, install-log.jsonl rotated at 1 MB M-16, store pruning to current and previous. FileSystem, Links and HomeLock ports; temp file plus rename; Windows link ladder (installers/core/src/modules/state)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/operations/structured-logging.md  ·  procedure: none  ·  hot-path: no  ·  requires: T131
- [ ] T133 [US3] Sources module: path adapter linked live, git adapter with managed clone and SHA in the lock, core.symlinks off M-04, no shell and dash refusal and allowed protocols and no submodules and timeouts and git 2.50.1 check M-05, checkout of the locked SHA and tag moved exit M-02, archive refused. Git port with a real adapter run against local bare repos (installers/core/src/modules/sources)  [Eng] [llm] [Sec]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/abort-signal.md  ·  procedure: none  ·  hot-path: no  ·  requires: T132
- [ ] T134 [US5] Resolution module, pure: reuse a filled slot, take the default, else a need; recursion, cycles printed in order, majors N and N-1, exports against citations, slot counts, fixed-point fallback DR-418, components needs before variables needs. Unit tables (installers/core/src/modules/resolution)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T131
- [ ] T135 [US6] Variables module: declarations, values, set, closest-name suggestions, detect proposals that are declarative only M-18, refusal of secret-like names and values M-08, same name with two descriptions fails, import of existing values DR-414 (installers/core/src/modules/variables)  [Eng] [llm] [Sec]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/operations/config-at-startup.md  ·  procedure: none  ·  hot-path: no  ·  requires: T130
- [ ] T136 [US8] Wiring module, phase 2 part: compatibility links that never replace Copilot own folders, retired that removes only the installer own link and refuses one a merged hook uses M-14, and the privileged set computation with its diff against install-state for the M-01 consent need (installers/core/src/modules/wiring)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T132, T134
- [ ] T137 [US6] Rendering module, phase 2 part: global-variables.md with one row per variable of each enabled component, and generated/index.md (installers/core/src/modules/rendering)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T135, T131
- [ ] T138 [US4] Commands install and plan on one pipeline read, resolve, plan, apply, report: staged trees validated before any switch, journaled switch, needs report ordered home, components, variables, privileged, exit 10 with nothing written, update option with commit range, interactive-only confirmation M-11, install-log line (installers/core/src/modules/commands/application/install)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T133, T134, T135, T136, T137
- [ ] T139 [US7] Command doctor: the faults and warnings of AC-7.5 with the S-6, S-7, S-9 and D-5 changes, repeatable output, journal restore, one finding per fault with its own message (installers/core/src/modules/commands/application/doctor)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T138
- [ ] T140 [US3] Commands set, add, use and init-component: backup of the local files first, secret refusal, starter component.yaml that passes the schema check and refusal to overwrite (installers/core/src/modules/commands/application/edit)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T138
- [ ] T141 [US7] Command uninstall and its restore option: remove only recorded entries that still match their hash, never follow a link, keep edited files, path folders, the two local files and backups, restore from the newest backup manifest (installers/core/src/modules/commands/application/uninstall)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T138
- [ ] T142 [US4] CompositionRoot.ts as the only file that chooses adapters, and main.ts with argument parsing, usage error exit 2 with one usage line, json report on standard output only, no stack traces (installers/core/src/CompositionRoot.ts)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/operations/config-at-startup.md  ·  procedure: none  ·  hot-path: no  ·  requires: T138, T139, T140, T141
- [ ] T143 [US4] Interface catalog for the installer: usage spec, JSON Schemas for the install report and the install-state file with examples, entries in the root INTERFACES.md and catalog-info.yaml, checked against the code like spec 021 (installers/core/interfaces)  [Eng] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/installer-cli.md  ·  procedure: none  ·  hot-path: no  ·  requires: T142
- [ ] T144 [US2] Bash entry scripts install.sh and uninstall.sh: find Node 24.12 or later with the NODE override first, run main.ts, pass the exit code through, one line need and exit 10 when no Node, the legacy option (installers/install.sh)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/operations/config-at-startup.md  ·  procedure: none  ·  hot-path: no  ·  requires: T142, T128
- [ ] T145 [US2] PowerShell entry scripts install.ps1 and uninstall.ps1 with the same behaviour for Windows PowerShell 5.1 and the Legacy switch (installers/install.ps1)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T142, T128
- [ ] T146 [US8] Move the old bash and PowerShell installers and mapping.yaml to installers/legacy, point them at the new home so they keep wiring agent folders FR-035, re-record the golden plans in this change with the target differences reviewed (installers/legacy)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T144, T145
- [ ] T147 [P] [US3] Core component.yaml for the reserved core slot and the public components.yaml default list with stand-in entries for the knowledge base and agentic-sdlc as path sources (component.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T131, T059
- [ ] T148 [P] [US3] In-repo stand-in manifests for the knowledge base and the SDLC framework so they install as path sources until their repos exist (copilot/knowledge/component.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T131, T059
- [ ] T149 [US8] Sorting check: classify each hard-coded copilot agent-home line as agent-home content or a Copilot-own path on a named allow-list, record the baseline count and file count with method and date, fail a new agent-home line. Unit tests with the classifier table (scripts/check-copilot-paths.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T125, T040
- [ ] T150 [US3] Check that components.local.yaml and variables.local.yaml are never inside a tracked path or staged, naming the file (scripts/check-local-files.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T120, T040
- [ ] T151 [P] [US3] Integration docs for GitHub and the git program as in-repo interface notes, then point the architecture section 6 rows at them (docs/integrations)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T133
- [ ] T152 [US7] Add the scenario layer to installer.yml on the three OS runners and create integration.yml, nightly and on components.yaml changes, with a throwaway home and pinned actions (.github/workflows/integration.yml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T142, T085
- [ ] T153 [US7] Check entry: run the sorting check, the local file check, the installer unit tests and the installer scenarios (scripts/check-docs.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T149, T150, T142, T114
- [ ] T154 [US7] Windows spike on the runner: symbolic link creation, junction without administrator rights, rename over a directory link, hash-tracked copy fallback; record with sources, version and date (copilot/knowledge/js-runtime)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T152
- [ ] T155 [US7] Mutation proof QB-7 for the phase 2 checks that guard user data: disable M-01 consent, M-02 lock, M-03 containment, M-04, M-05, M-14 retired guard, the backup step and the hash match in uninstall; the named scenario must fail each time. Record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T153, T146, T143, T115
- [ ] T156 [US7] Phase 2 exit check: stories 2 to 8 scenarios pass on the three runners, phase 0 and 1 scenarios unchanged QB-5, golden plans reviewed, 10 sampled old paths resolve, AC-8.6 hash equal. Rehearsal, rollback drill and the Windows run are human steps (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T155, T154, T151, T147, T148

## Phase 3: Company KB to agent-companies, with a minimal routes renderer (US10)

**Goal**: company knowledge is its own public repo and leaves the core and the default install. **Independent test**: install once with and once without the company repo listed; search the core for company names. Paths that start with agent-companies/ are in that new repo, a sibling checkout; V creates the repo first (human step in the table below).

- [ ] T157 [P] [US10] Scenarios AC-10.1 the core instructions and the variables source name no company repo and no OTS_REPOS_ROOT and no company folder remains; AC-10.2 the new repo holds the KB instances, names and variable and fills company-knowledge-storage; AC-10.3 index.md resolves and routes appear with the entry and vanish without it; AC-10.4 a failed clone keeps the old version and names the cause; AC-10.5 commit ids of agent-config unchanged and no deny-list, privacy audit or company folder check; AC-10.6 the agent-companies check passes with a provider and names knowledge-storage without (tests/companies/companies.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T156
- [ ] T158 [P] [US10] Scenarios for the minimal routes renderer: the Copilot routes file with applyTo of all files, one Claude import line, the Codex AGENTS.md as core plus routes below 32 KiB, company routes added and removed with the entry, and M-01 consent when a route is new or changed (tests/installer/routes.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T156
- [ ] T159 [US10] Minimal routes renderer in wiring and rendering: generate the three agent route forms from component routes, route text in the privileged set with consent M-01, no write outside the agent folders (installers/core/src/modules/wiring/application/routes)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T158, T116
- [ ] T160 [US10] agent-companies component.yaml filling company-knowledge-storage with the company variable OTS_REPOS_ROOT, its routes and its repository URL (agent-companies/component.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T157, T159
- [ ] T161 [P] [US10] agent-companies check script: run the company-KB validator from the provider passed as an argument, every KB citation must be in the provider exports, and with no provider exit with a message naming the slot knowledge-storage (agent-companies/scripts/check.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T160
- [ ] T162 [P] [US10] agent-companies workflow check.yml: job check, read-only permissions, runs on pull request, push to main, manual and weekly, actions pinned to full SHAs, contracts tool fetched by a pinned commit M-19, no secrets (agent-companies/.github/workflows/check.yml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T160
- [ ] T163 [US10] Remove the company line and the company repo names from the core instructions and the OTS_REPOS_ROOT row from the variables source; init-repo-kb line 61 becomes plain words (copilot/instructions/core.instructions.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T160, T157
- [ ] T164 [P] [US10] Remove the company variable row from global-variables.md (global-variables.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T163
- [ ] T165 [P] [US10] init-repo-kb procedure: company references as plain words, no company path (copilot/procedures/init-repo-kb.procedure.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T163
- [ ] T166 [US10] Remove the company folder from agent-config after the new repo holds its history; agent-config commits keep their ids, nothing is rewritten (copilot/companies)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T163, T161
- [ ] T167 [US10] Add the agent-companies git entry to the public component list (components.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T166
- [ ] T168 [US10] Atlas: drop the companies area and regenerate; fitness core to companies 1 becomes a hard 0 (copilot/atlas/atlas.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T166, T113
- [ ] T169 [US10] Mutation proof QB-7 for the route consent and the company name search; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T168, T167, T165, T164, T162, T155
- [ ] T170 [US10] Phase 3 exit check: story 10 scenarios pass, no company name in the core, install passes with and without the entry, phases 0 to 2 scenarios unchanged QB-5 (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T169

## Phase 4: Build step and per-entry targets (US11)

**Goal**: skills and agents have one source each, built at install per platform from verified fields, stamped, drift-checked and budget-checked; built output is linked entry by entry into the agent folders. **Independent test**: build one migrated agent for all three targets twice and compare; list tracked files of the provider for build output.

Agent behaviour items P4-22, P4-26a and P4-26d must be answered before this phase starts (QA protocol): Codex CLI with gpt-6-luna and Copilot CLI with gpt-5.4-mini only, never Claude Code, in an isolated CODEX_HOME, COPILOT_HOME and fake HOME, two runs and a negative control, result with agent, version, model and date recorded in the knowledge base in the same change.

- [ ] T171 [P] [US11] Protocol item P4-22: is the generated-from line after front matter harmless. Run on Codex and Copilot. The Claude Code part stays unconfirmed by V default at G3, so record the doc source and mark it unconfirmed (copilot/knowledge/ai-agents/generated-from-line-after-front-matter.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T172 [P] [US11] Protocol item P4-26a: does Codex accept Copilot-only skill fields (copilot/knowledge/ai-agents/codex-copilot-only-skill-fields.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T173 [P] [US11] Protocol item P4-26d: does a skill with disable-model-invocation cost nothing in the Copilot list (copilot/knowledge/ai-agents/copilot-disable-model-invocation-cost.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T174 [P] [US11] Scenarios AC-11.1 three targets from one source with verified fields only, stamped, built twice byte identical; AC-11.2 stamp drift makes doctor fail and keeps the previous output; AC-11.3 auto-delegate false mapping and the Codex warning; AC-11.4 repo counts of agent sources and no hand-written or pointer-only files; AC-11.5 include inlined and a missing include fails with its path; AC-11.6 per-component ceiling and the 15,000 token warning; AC-11.7 a fake agent adapter adds a target and nothing else changes SC-003; AC-11.8 duplicate skill name; AC-11.9 provider CI runs the pinned build and a tracked build file fails (tests/build/build.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T175 [P] [US11] Scenarios for per-entry targets: built output linked entry by entry into the Claude and shared skill folders and the three agent folders, skills synced from elsewhere left alone FR-027, M-01 consent for skill and agent text, M-03 and M-04 on build input, M-18 the build runs no component script (tests/installer/targets.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T176 [US11] Scenario: the citation count from core to agentic-sdlc is 0 and the check is on for good (tests/fitness/phase4.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T170
- [ ] T177 [US11] Adapter field lists for the three platforms with verified marks and dates, recording what P4-22 and P4-26 items showed (adapters/claude/fields.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T171, T172, T173, T068
- [ ] T178 [US11] Codex adapter field list (adapters/codex/fields.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T171, T172, T173, T068
- [ ] T179 [US11] Copilot adapter field list including infer false and disable-model-invocation (adapters/copilot/fields.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T171, T172, T173, T068
- [ ] T180 [US11] Build subcommand: field mapper using verified fields only, auto-delegate mapping, include inliner contained to the component root M-03, symlink refusal M-04, stamp of source revision and adapter version, deterministic output, duplicate skill name fails, runs only the pinned tool and no component script M-18 (contracts/tools/build-targets.ts)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T174, T175, T177, T178, T179, T077, T066, T067
- [ ] T181 [US11] Per-component idle-cost ceiling check and the Claude description total above 15,000 tokens warning, on the rendered-form text rules from the shared module (contracts/tools/budget.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180, T075
- [ ] T182 [US11] Wiring: link built output entry by entry into the skill folders and the three agent folders, leave skills synced from elsewhere alone, skill and agent text in the privileged set M-01, contained to the home and the named agent folder M-03 (installers/core/src/modules/wiring/application/targets)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180, T159
- [ ] T183 [US11] Doctor: fail on a stamp naming a source revision or adapter major that no longer matches and keep the previous output linked (installers/core/src/modules/commands/application/doctor)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T182, T139
- [ ] T184 [US11] Migrate the SDLC role agents to agent sources with the shared body, one source each (copilot/frameworks/agentic-sdlc/agents)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180
- [ ] T185 [P] [US11] Migrate the foundry agents and the Windows software agent to core-owned agent sources; reconcile the count of 12 sources in AC-11.4 with the 13 files now in copilot/agents (agents)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180
- [ ] T186 [P] [US11] Migrate the wrapper skills to skill sources; procedures become skills or references; no skill body only points at a procedure (skills)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180
- [ ] T187 [US11] Move the 4 SDLC procedures into the in-repo agentic-sdlc folder (copilot/procedures)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T180
- [ ] T188 [US11] Remove the hand-written wrapper agent files of the three platforms and check that no built file is tracked (claude/agents)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T184, T185, T186, T187
- [ ] T189 [US11] Remove citations from core procedures to agentic-sdlc (copilot/procedures)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T176, T187
- [ ] T190 [P] [US11] Remove citations from core patterns, prompts, hooks and foundry files to agentic-sdlc (copilot/patterns)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T176
- [ ] T191 [US11] Provider checks: run the pinned build and the per-component budget check in the check entry, fail on a build error, an excess or a tracked build output file AC-11.9; CI pins the tool by full SHA M-19 (scripts/check-docs.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T181, T188, T153
- [ ] T192 [US11] Fitness: core to agentic-sdlc from 20 to a hard 0, and record the skill list size against the baseline (scripts/check-fitness.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T189, T190, T113
- [ ] T193 [US11] Mutation proof QB-7 for the build checks, stamp drift, duplicate name and the tracked build output check; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T191, T192, T183, T169
- [ ] T194 [US11] Phase 4 exit check: story 11 scenarios pass, same source built twice is byte identical, 0 hand-written agent files, core to agentic-sdlc is 0, skill list size against the baseline, earlier phases unchanged QB-5 (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T193

## Phase 5: Installer, full (US12 and US16)

**Goal**: every agent sees the components through rendered copies with real paths, routes, merged hooks and registered services, with the settings merge safe for V's own keys. **Independent test**: install on a clean account, start each agent, compare the layers; compare each rendered file with a fresh render.

Blocker mitigations: M-01 for hooks, services and status line, M-03, M-04, M-09, M-11, M-14 with the guard deletion test. Items P4-14, P4-18 and P4-26b run before the phase: Codex CLI with gpt-6-luna and Copilot CLI with gpt-5.4-mini only, never Claude Code, in an isolated CODEX_HOME, COPILOT_HOME and fake HOME, two runs and a negative control, result with agent, version, model and date recorded in the knowledge base in the same change. P4-19, P4-20 and P4-26c are V by hand in VS Code.

- [ ] T195 [P] [US12] Protocol item P4-14: does Codex read a linked AGENTS.md and hooks.json and a linked home. V trusts the hook in the Codex hooks screen first (copilot/knowledge/ai-agents/codex-reads-linked-agents-and-hooks.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T196 [P] [US12] Protocol item P4-18: can Codex run a session-start hook that re-renders. Decides whether AC-16.8 covers Codex (copilot/knowledge/ai-agents/codex-session-start-hook.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T197 [P] [US12] Protocol item P4-26b: does Copilot CLI apply applyTo to user instructions (copilot/knowledge/ai-agents/copilot-cli-applyto-user-instructions.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T198 [P] [US16] Scenarios AC-16.1 to AC-16.10 for rendering, one per criterion: copies for the four components and none for the linked KB, the Mac and Windows forms by platform injection and natively on the Windows runner, zero placeholders except the allow-list, exact generated-from line, write refused, no route or link into a source repo, drift names copy and source, no rewrite on rerun, session-start re-render, failed re-render keeps the old copy, tracked generated file fails. Includes P4-21 allow-list, P4-24 non-link mentions and P4-25 generated-class guard, and home paths plain, with a space, non-ASCII and with a drive letter (tests/installer/rendering.feature)  [QA] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/rendered-copy-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T199 [P] [US12] Scenarios AC-12.1 to AC-12.8 for wiring: exactly 2 import lines, the routes file, Codex files below 32 KiB minus one passing and at 32 KiB failing naming the size, settings merge keeping every key of a fixture with unusual keys with the original backed up, per-entry skill links leaving foreign skills, hash mismatch fails doctor, idle-cost total naming the largest contributors, a service registered and removed by uninstall, the hooks never change the privileged set (tests/installer/wiring.feature)  [QA] [llm]
      touches: none  ·  refs: specs/022-repo-split/contracts/routes-hooks-variables-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T200 [P] [US12] Negative security scenarios named by mitigation: M-01 hooks, services and status line new or changed exit 10, M-06 no git porcelain in a path source, M-09 unparsable settings exits 1 writing nothing and a hash changed between read and rename aborts and no component can add permissions, env or apiKeyHelper, M-12 the hook only tries the lock, M-13 bounded time and no network, M-14 delete the guard script and doctor exits 1 and a merged command never uses a compatibility path, M-15 homes with a space, dollar, backtick, quotes and a refused newline (tests/installer/security-wiring.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T201 [P] [US16] Edge case scenarios EDGE-8 a hook for an agent not installed warns only while one that does not resolve fails, EDGE-11 a home with a space and non-ASCII keeps a valid relative target, EDGE-12 a source changed mid session refreshes at the next start, EDGE-14 rendered copies exist only under each machine home and no repo tracks them (tests/installer/edge-render.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T202 [P] [US16] Scenario for SC-004: the rendered always-loaded size per agent is at most the phase 0 baseline everywhere, and the renderer and the dry run use the same rule module so the two numbers stay comparable (tests/baseline/phase5.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T203 [P] [US12] Scenario AC-12.9, the G3 default on the guard when no Node 24.12 is found: deny where a .specify/runs folder exists, allow elsewhere, for each of the three agents hook output shapes (tests/workflow-graph/no-node.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T194
- [ ] T263 [US12] Implement AC-12.9: when the guard wrapper finds no Node 24.12 or later, it denies tool calls only in a folder that has .specify/runs and allows elsewhere, superseding spec 019 D6 for that case; T203 must pass (copilot/frameworks/agentic-sdlc/tools/workflow-graph/workflow-graph-hook.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T203
- [ ] T204 [US16] Renderer: copy each component that cites another into generated/<component> using the shared render rules, citation text real absolute path and target relative, generated-from line after front matter, read-only, built skills and agents rendered after the build, the knowledge base left linked, symlink and traversal refusal M-03 M-04, load paths per DR-307, store trees (installers/core/src/modules/rendering/application/render)  [Eng] [llm] [Sec]
      touches: none  ·  refs: specs/022-repo-split/contracts/rendered-copy-v1.md  ·  procedure: none  ·  hot-path: yes  ·  requires: T198, T202, T195, T196, T197, T182, T057
- [ ] T205 [US16] The rerender command for the session-start hook: only changed components, detection by file times or by reading the head file and never git status M-06, only tries the lock M-12, no network and a 5 second budget and old copy kept on timeout M-13, one machine readable result line TR-8, exit 0 always, never changes the privileged set (installers/core/src/modules/commands/application/rerender)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/promise-rejections.md  ·  procedure: none  ·  hot-path: yes  ·  requires: T204, T200
- [ ] T206 [US12] Wiring of agent targets: switch routes, instruction links and skill and agent links to the rendered copies, Claude import lines exactly two, Copilot routes file and links, Codex AGENTS.md as core plus routes below 32 KiB and hooks.json generated, post-merge re-render (installers/core/src/modules/wiring/application/agents)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T199, T159
- [ ] T207 [US12] One tested quoting function for bash and one for PowerShell with a home containing a space, dollar, backtick, single and double quote, refusing a newline or NUL M-15 (installers/core/src/modules/shared/application/quoting)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T200, T130
- [ ] T208 [US12] Hooks merge, services and status line: only installer-owned entries under hooks and the core status line recorded in install-state, a component can add no other key M-09, unparsable file exits 1 writing nothing, temp file plus rename after re-reading the hash, backup first, same rules for the Codex and Copilot hook files, merged commands use the real home path M-14, MCP services registered and removed, everything in the privileged set M-01 (installers/core/src/modules/wiring/application/hooks)  [Eng] [llm] [Sec]
      touches: none  ·  refs: specs/022-repo-split/contracts/routes-hooks-variables-v1.md  ·  procedure: none  ·  hot-path: no  ·  requires: T206, T207
- [ ] T209 [US12] Doctor drift and budget checks: rendered differs from a fresh render naming the source to edit, writable rendered file, hash mismatch of generated files, merged hook command that does not resolve fails and a missing agent only warns, total idle-cost per target naming the largest contributors, old agent-home paths, backup size and degraded Windows links (installers/core/src/modules/commands/application/doctor)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T208, T183
- [ ] T210 [US12] Guard wrapper: when no Node 24.12 or later is found, deny the tool call only where a .specify/runs folder exists and allow elsewhere, with the right empty or deny output for each agent (copilot/frameworks/agentic-sdlc/tools/workflow-graph/workflow-graph-hook.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T203
- [ ] T211 [P] [US12] Git post-merge hook that re-renders core changes for the Codex file (.githooks/post-merge)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T205
- [ ] T212 [P] [US12] Integration docs for the Claude Code, Copilot and Codex agent folders and point architecture section 6 at them (docs/integrations/claude-code.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T206
- [ ] T213 [P] [US8] Convert agent-home hard-coded copilot lines to the AGENT_HOME placeholder in the atlas pages, keeping Copilot own paths on the allow-list. Done after rendering so the text agents receive is unchanged (copilot/atlas)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T214 [P] [US8] Convert agent-home hard-coded copilot lines in the agentic-sdlc folder (copilot/frameworks/agentic-sdlc)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T215 [P] [US8] Convert agent-home hard-coded copilot lines in prompts, efficiency-audit, tracker, references, procedures, patterns, instructions and hooks (copilot/prompts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T216 [US8] Convert agent-home hard-coded copilot lines in skills sources (skills)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T217 [P] [US8] Convert agent-home hard-coded copilot lines in the claude and codex folders (codex)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T218 [P] [US8] Convert agent-home hard-coded copilot lines in tests, README, SETUP, docs and the tracker files (README.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T204, T149
- [ ] T219 [US12] Check entry and workflows: run the rendering, wiring and security scenarios, make installer macos and installer windows required checks in the matrix, run the sorting check as a hard failure (scripts/check-docs.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T209, T213, T214, T215, T216, T217, T218, T210, T191
- [ ] T220 [US12] Mutation proof QB-7 for the settings merge, the guard deletion test, quoting, drift checks and the read-only guard, the highest risk set because it touches V own files; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T219, T211, T212, T205, T193
- [ ] T221 [US12] Phase 5 exit check: stories 12 and 16 scenarios pass, rendered size at most the baseline, Codex AGENTS.md below 32 KiB, earlier phases unchanged QB-5. Rehearsal with the exact settings.json diff, restore drill and security sign-off are human steps (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T220

## Phase 6: Knowledge base to agent-knowledge (US13)

**Goal**: the KB is its own repo, passes its own checks alone, and exports its citable docs. **Independent test**: clone the KB repo alone and run its check command. Paths that start with agent-knowledge/ are in that new repo.

- [ ] T222 [P] [US13] Scenarios AC-13.1 the KB alone in a clean checkout passes, AC-13.2 exports listed with the count read from the provider and a removal without a major bump fails, AC-13.3 a consumer citation of a missing export fails, AC-13.5 link rules including legacy docs warning only, AC-13.7 stub at a moved exported path, AC-13.8 a path source at the old location and a git source give identical content by hash. AC-13.4 and AC-13.6 have their own scenarios (tests/kb/kb.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T221
- [ ] T223 [P] [US13] Scenarios AC-13.4 the AGENT_HOME lines become 9 relative links and 11 plain words in the KB and 42 more lines in the two frameworks and a check forbids new ones; AC-13.6 neither constitution principle III nor the review-docs procedure names copilot/knowledge (tests/kb/conversion.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T221
- [ ] T224 [US13] Link rule checker in the knowledge validator: every relative link in the whole body of a non-legacy doc resolves and stays inside the KB, fenced code skipped, no AGENT_HOME, a code span naming a KB doc warns, legacy docs warn only; export list diff against the manifest (copilot/frameworks/knowledge/tools/validate-knowledge.mjs)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T222, T221
- [ ] T225 [US13] Convert the 20 AGENT_HOME lines in 10 KB files to relative links or plain words, and the hard-coded copilot agent-home lines in the KB files straight to that final form, so no KB file ever carries the placeholder (copilot/knowledge)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T223
- [ ] T226 [US13] Convert the 42 AGENT_HOME lines in 11 files of the knowledge framework and the company-kb framework (copilot/frameworks/company-kb)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T223
- [ ] T227 [US13] Amend constitution principle III so it no longer names copilot/knowledge and bump the version by the amendment rule (.specify/memory/constitution.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T223
- [ ] T228 [US13] review-docs procedure and its skill stop naming copilot/knowledge (copilot/procedures/review-docs.procedure.md)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T223
- [ ] T229 [US13] Leave a stub at the old path of each moved exported doc for one release (copilot/knowledge/stubs)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T225, T224
- [ ] T230 [US13] agent-knowledge component.yaml with provides contracts knowledge-provider and company-kb, the exports 41 or more, its repository URL and locations (agent-knowledge/component.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T224, T225, T226
- [ ] T231 [P] [US13] agent-knowledge check script and workflow check.yml: knowledge validator, company-KB validator and their scenarios, read-only permissions, pinned actions, weekly run (agent-knowledge/scripts/check.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T230
- [ ] T232 [US13] Switch knowledge-storage to the git source in the public list and remove the KB and both frameworks from agent-config; the install state is unchanged for agents (components.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T230, T229, T222
- [ ] T233 [US13] Remove the moved folders from agent-config (copilot/frameworks/knowledge)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T232
- [ ] T234 [US13] Run build cite with write in core and in the in-repo SDLC and enforce it as a check from now on FR-044; first real use of provider repository URLs (copilot/instructions)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T232, T100
- [ ] T235 [US13] Run build cite with write in agent-companies and enforce it in its check (agent-companies/scripts/check.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T232, T100
- [ ] T236 [US13] Mutation proof QB-7 for the link rule checker, the export diff and the cite enforcement; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T234, T235, T233, T231, T227, T228, T220
- [ ] T237 [US13] Phase 6 exit check: story 13 scenarios pass, KB alone passes its check, path and git sources give identical content, earlier phases unchanged QB-5 (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T236

## Phase 7: agentic-sdlc to its own repo, on only in SDLC projects (US14)

**Goal**: the SDLC framework is its own tagged repo, enabled per project, and the guard still blocks after the move. Paths that start with agentic-sdlc-repo/ are in the new repo.

- [ ] T238 [P] [US14] Scenarios AC-14.1 the tag is pinned, AC-14.2 enabled project shows the sdlc skills and agents and another shows none with the skill list shrinking in characters, AC-14.3 enable keeps the added files out of git through the exclude file and disable removes them, AC-14.4 the framework validator passes with the knowledge root as an argument. Plus the guard still blocks after the move M-14 (tests/framework/framework.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T237
- [ ] T239 [US14] Commands enable and disable for a project per framework/v1, links kept out of version control, doctor reports a project state (installers/core/src/modules/commands/application/framework)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T238, T073
- [ ] T240 [US14] agentic-sdlc component.yaml with its framework slot, tag equal to framework-version, hook entries of the workflow graph moved with it DR-413, REFERENCE_REPOS_ROOT variable (agentic-sdlc-repo/component.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T238, T237
- [ ] T241 [P] [US14] agentic-sdlc check script and workflow check.yml: the workflow-graph line, validate.mjs with the knowledge root argument, validate-project and their scenarios (agentic-sdlc-repo/scripts/check.sh)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T240
- [ ] T242 [US14] Pin the agentic-sdlc tag in the public list and remove the in-repo folder from agent-config (components.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T240, T239, T238
- [ ] T243 [US14] Remove the agentic-sdlc folder and move the workflow-graph hook entries to the component (copilot/frameworks/agentic-sdlc)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T242
- [ ] T244 [US14] Mutation proof QB-7 for enable, disable and the guard still blocks scenario; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T243, T241, T236
- [ ] T245 [US14] Phase 7 exit check: story 14 scenarios pass, pin and tag round trip, guard blocks after the move, earlier phases unchanged QB-5 (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T244

## Phase 8: Layout (US15)

**Goal**: the root holds only motherboard parts and every installed path is identical to before the phase. **Independent test**: list the root; run install and doctor; compare the three golden files and the install state.

- [ ] T246 [P] [US15] Scenarios AC-15.1 root entries equal the target set, AC-15.2 the golden files and the install state are identical before and after, AC-15.3 replacing the knowledge provider changes 0 lines of the core (tests/repo-layout/phase8.feature)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T245
- [ ] T247 [US15] Move the core content folders to home with only the mapping sources changing (home)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T246
- [ ] T248 [US15] Move the platform adapter folders and agent and skill sources to the target root set (adapters)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T247
- [ ] T249 [US15] mapping.yaml goes into installers/legacy or is removed if the legacy installer has retired (installers/legacy/mapping.yaml)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T247
- [ ] T250 [US15] repo-layout becomes blocking and the check entry is renamed check.sh (contracts/tools/layout.ts)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T248, T249
- [ ] T251 [US15] Retire the compatibility links in a separate release once the evidence holds, through retired with the M-14 guard that refuses a link a merged hook uses (installers/core/src/modules/wiring/application/retire)  [Eng] [llm] [Sec]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T250
- [ ] T252 [US15] Mutation proof QB-7 for the layout check and the retired guard; record in research.md (specs/022-repo-split/research.md)  [QA] [llm]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T251, T244
- [ ] T253 [US15] Phase 8 exit check: story 15 scenarios pass, three golden files unchanged, root entries equal the target set (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T252

## Phase Z: Close-out checks across the feature

**Purpose**: confirm the whole feature against the success criteria and the QA bar once every phase is done.

- [ ] T254 Run the coverage check over the final spec: every acceptance criterion and edge case has a scenario or a reviewed exemption, and report any exemption that is no longer needed (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T253
- [ ] T255 Run every verified-by scenario named in the success criteria SC-001 to SC-015 and record the result per criterion in research.md (specs/022-repo-split/research.md)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T254
- [ ] T256 Run the full scenario and unit layers on the three runners and compare run times with the QB-6 budgets (specs/022-repo-split)  [QA] [script]
      touches: none  ·  refs: none  ·  procedure: none  ·  hot-path: no  ·  requires: T255

## Dependencies & Execution Order

- **Phase A** (amendments) has no dependency and blocks everything: Phase 0 tasks require the amendment gate. Inside Phase A, the amendments that edit `spec.md` and `research.md` run one after another; the others are `[P]`.
- **Phase 0** blocks Phase 1; **Phase 1** blocks Phase 2 (the core instruction edits of AC-9.8, AC-6.5 and AC-4.8 land in phase 1 so the phase 2 move leaves the text agents load unchanged); each later phase requires the previous phase's exit check. One pull request per phase.
- **Inside a phase**: the golden or characterization tasks first (QB-3), then the scenario tasks, then the shared modules, then the module that uses them, then the commands, then the entry points, then the mutation proof (QB-7) and the exit check. A scenario task is a `requires:` of the code it covers, so the code never starts before its failing scenario exists.
- **Phase 2 module order** follows the allowed edges of the architecture: shared, then manifests, then state, then sources and resolution and variables, then wiring and rendering, then commands, then the composition root, then the entry scripts.
- **Parallel opportunities**: all `[P]` scenario files of one phase (distinct files); the knowledge-area mention removals of phase 1 (distinct folders); the three adapter field lists; the conversion batches of phase 5; the new-repo files of phases 3, 6 and 7.

## Implementation Strategy

1. **MVP**: Phase A, Phase 0, Phase 1, Phase 2. Stop and validate with the runbook on Mac and Windows. This delivers contracts, the minimal installer with consent and lock, and compatibility links; nothing else depends on later phases (spec US1 to US8).
2. **Providers first**: Phase 3 (company KB and routes renderer), Phase 4 (build step and per-entry targets), Phase 5 (rendering and wiring) ship before their consumers. Content moves of phases 6 to 8 are last because the knowledge base already works as a `path` source.
3. **Rollback** per phase is in plan.md (DR-205); the last resort is the tag `pre-022`.

## Traceability: acceptance criteria and rules to scenario tasks

One scenario per acceptance criterion; the title of each scenario starts with its id. Spec ids as of G2 plus the seven reserved ids. The coverage check (T083, with its scenarios in T052) reads this from the scenario files, not from this table; the table is the plan.

| Id | Scenario task (phase) |
|---|---|
| AC-1.1 | T047 (0) |
| AC-1.2 | T045 (0) |
| AC-1.3 | T045 (0) |
| AC-1.4 | T045 (0) |
| AC-1.5 | T048 (0) |
| AC-1.6 | T049 (0) |
| AC-1.7 | T050 (0) |
| AC-1.8 | T047 (0) |
| AC-1.9 | T038 (0) |
| AC-2.1 | T119 (2) |
| AC-2.2 | T119 (2) |
| AC-2.3 | T119 (2) |
| AC-2.4 | T119 (2) |
| AC-2.5 | T119 (2) |
| AC-3.1 | T120 (2) |
| AC-3.2 | T120 (2) |
| AC-3.3 | T120 (2) |
| AC-3.4 | T120 (2) |
| AC-3.5 | T120 (2) |
| AC-3.6 | T120 (2) |
| AC-3.7 | T120 (2) |
| AC-3.8 | T120 (2) |
| AC-3.9 | T120 (2) |
| AC-3.10 | T120 (2) |
| AC-4.1 | T121 (2) |
| AC-4.2 | T121 (2) |
| AC-4.3 | T121 (2) |
| AC-4.4 | T121 (2) |
| AC-4.5 | T121 (2) |
| AC-4.6 | T121 (2) |
| AC-4.7 | T121 (2) |
| AC-4.8 | T095 (1) |
| AC-5.1 | T122 (2) |
| AC-5.2 | T122 (2) |
| AC-5.3 | T122 (2) |
| AC-5.4 | T122 (2) |
| AC-5.5 | T122 (2) |
| AC-5.6 | T122 (2) |
| AC-5.7 | T122 (2) |
| AC-5.8 | T122 (2) |
| AC-5.9 | T122 (2) |
| AC-5.10 | T094 (1) |
| AC-6.1 | T123 (2) |
| AC-6.2 | T123 (2) |
| AC-6.3 | T123 (2) |
| AC-6.4 | T123 (2) |
| AC-6.5 | T095 (1) |
| AC-6.6 | T123 (2) |
| AC-7.1 | T124 (2) |
| AC-7.2 | T124 (2) |
| AC-7.3 | T124 (2) |
| AC-7.4 | T124 (2) |
| AC-7.5 | T124 (2) |
| AC-7.6 | T124 (2) |
| AC-7.7 | T124 (2) |
| AC-8.1 | T125 (2) |
| AC-8.2 | T125 (2) |
| AC-8.3 | T125 (2) |
| AC-8.4 | T125 (2) |
| AC-8.5 | T125 (2) |
| AC-8.6 | T125 (2) |
| AC-9.1 | T096 (1) |
| AC-9.2 | T092 (1) |
| AC-9.3 | T093 (1) |
| AC-9.4 | T092 (1) |
| AC-9.5 | T094 (1) |
| AC-9.6 | T094 (1) |
| AC-9.7 | T094 (1) |
| AC-9.8 | T095 (1) |
| AC-10.1 | T157 (3) |
| AC-10.2 | T157 (3) |
| AC-10.3 | T157 (3) |
| AC-10.4 | T157 (3) |
| AC-10.5 | T157 (3) |
| AC-10.6 | T157 (3) |
| AC-11.1 | T174 (4) |
| AC-11.2 | T174 (4) |
| AC-11.3 | T174 (4) |
| AC-11.4 | T174 (4) |
| AC-11.5 | T174 (4) |
| AC-11.6 | T174 (4) |
| AC-11.7 | T174 (4) |
| AC-11.8 | T174 (4) |
| AC-11.9 | T174 (4) |
| AC-12.1 | T199 (5) |
| AC-12.2 | T199 (5) |
| AC-12.3 | T199 (5) |
| AC-12.4 | T199 (5) |
| AC-12.5 | T199 (5) |
| AC-12.6 | T199 (5) |
| AC-12.7 | T199 (5) |
| AC-12.8 | T199 (5) |
| AC-12.9 | T203, T263 (5) |
| AC-13.1 | T222 (6) |
| AC-13.2 | T222 (6) |
| AC-13.3 | T222 (6) |
| AC-13.4 | T223 (6) |
| AC-13.5 | T222 (6) |
| AC-13.6 | T223 (6) |
| AC-13.7 | T222 (6) |
| AC-13.8 | T222 (6) |
| AC-14.1 | T238 (7) |
| AC-14.2 | T238 (7) |
| AC-14.3 | T238 (7) |
| AC-14.4 | T238 (7) |
| AC-15.1 | T246 (8) |
| AC-15.2 | T246 (8) |
| AC-15.3 | T246 (8) |
| AC-16.1 | T198 (5) |
| AC-16.2 | T198 (5) |
| AC-16.3 | T198 (5) |
| AC-16.4 | T198 (5) |
| AC-16.5 | T198 (5) |
| AC-16.6 | T198 (5) |
| AC-16.7 | T198 (5) |
| AC-16.8 | T198 (5) |
| AC-16.9 | T198 (5) |
| AC-16.10 | T198 (5) |
| EDGE-1 | T126 (2) |
| EDGE-2 | T126 (2) |
| EDGE-3 | T126 (2) |
| EDGE-4 | T126 (2) |
| EDGE-5 | T126 (2) |
| EDGE-6 | T126 (2) |
| EDGE-7 | T094 (1) |
| EDGE-8 | T201 (5) |
| EDGE-9 | T126 (2) |
| EDGE-10 | T126 (2) |
| EDGE-11 | T201 (5) |
| EDGE-12 | T201 (5) |
| EDGE-13 | T094 (1) |
| EDGE-14 | T201 (5) |
| EDGE-15 | T126 (2) |

**Rule-traced scenarios** (no acceptance criterion; constitution IV: each check traces to a written rule id):

| Id | Scenario task (phase) |
|---|---|
| FR-012 | T051 (0) |
| FR-027 | T175 (4) |
| FR-033 | T128 (2) |
| FR-034 | T120 (2) |
| FR-035 | T128 (2) |
| M-01 | T127 (2), T158 (3), T175 (4), T200 (5) |
| M-02 | T127 (2) |
| M-03 | T127 (2), T175 (4) |
| M-04 | T127 (2), T175 (4) |
| M-05 | T127 (2) |
| M-06 | T200 (5) |
| M-07 | T127 (2) |
| M-08 | T127 (2) |
| M-09 | T200 (5) |
| M-10 | T127 (2) |
| M-11 | T127 (2) |
| M-12 | T127 (2), T200 (5) |
| M-13 | T200 (5) |
| M-14 | T200 (5), T203 (5), T238 (7) |
| M-15 | T200 (5) |
| M-16 | T127 (2) |
| M-17 | T127 (2) |
| M-18 | T127 (2), T175 (4) |
| QB-1 | T052 (0) |
| QB-2 | T052 (0) |
| SC-003 | T174 (4) |
| SC-004 | T202 (5) |
| SC-008 | T122 (2) |

**Exemptions** (QB-2, listed in `tests/coverage/exemptions.yaml`, each with a manual replacement): AC-8.6 agent load, SC-002, AC-12.1 agent read, AC-14.2 token figure, AC-16.8 Codex part, AC-2.2, AC-7.3 and AC-12.3 on a real Windows account, A-19, SC-004 and SC-015 token estimates. The automated part of each is covered by the tasks above.

## Notes

- Security review at P6 (risk tier HIGH) is limited to the `[Sec]` tasks, those that implement a blocker mitigation (G4-1); every other task gets engineering and qa review. Blocker mitigations: M-01, M-02, M-03, M-04, M-05, M-09, M-11, M-14, M-18; each has a negative scenario task before its code (security.feature files in phases 2 and 5).
- Sibling-repo tasks (phases 3, 6, 7) are written here because spec 022 owns them; they run in the new repo checkout.
- Commit after each task or logical group; a changed requirement changes its scenario in the same commit (constitution IV).
- A scenario that must change because its own criterion changed is named in the pull request (QB-5).
