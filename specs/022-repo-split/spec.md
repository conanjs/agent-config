# Feature Specification: agent-config as a motherboard of replaceable components

**Feature Branch**: `feat/022-repo-split`

**Created**: 2026-11-13

**Status**: Draft (attempt 2 of 3, reworked for `changes G2 R-001`), awaiting G2

**Input**: Approved blueprint `specs/022-repo-split/blueprint.md` (G0 approved 2026-11-12, amended 2026-11-13; G2 feedback folded in 2026-11-13). V, 2026-11-11: "Every part is a replaceable component, like the cards in a computer: agent-config stays compact and talks to the others only through configuration files."

## Reading guide

- **Words.** Terms in **bold** are defined once under Key Entities and used with that meaning everywhere.
- **What counts as "how".** Paths, file names, command names, exit codes and field names that V or another tool sees are the interface of this feature, so they appear here. Languages, libraries, file formats of internal state and algorithms do not; they belong in `plan.md`.
- **Phases.** The blueprint orders the work in nine phases (0 to 8), one pull request each. Stories carry the phase number. **Priority** says how much value a story carries (P1 = the feature is worth shipping with only P1 done); **order** is the blueprint's phase order and is unchanged. Phase 3 is early in order because company content has no skills or agents to build, but P3 in value. Story numbers are stable ids, not an order: Story 16 (rendering) belongs to Phase 5.
- **Depth.** Phases 0 and 2 are specified in full. Phases 1 and 3 to 8 are specified at outcome level: each has testable acceptance criteria, and each is re-checked against this spec by an amendment before its phase starts (the framework's rule that a behaviour change amends the spec).

## Why

Today `agent-config` holds eleven kinds of content in one repo: the knowledge base, company knowledge, the agentic SDLC framework, per-platform agent and skill wrappers, installers and tools. Consequences measured on 2026-11-11 (blueprint, "Dependency facts"):

| Problem | Evidence |
|---|---|
| The knowledge base and the SDLC framework cite each other | 109 lines in 67 knowledge files mention the framework; the framework has 91 cells citing the knowledge base |
| Company knowledge ships with everything, though it is read only while working on that company's repos | `copilot/companies/ots` (22 files), company repo names in the core instructions and a company row in `global-variables.md` |
| Agents resolve placeholders by hand | 445 lines use `{{AGENT_HOME}}`; every agent must look up the variables file and substitute, and a link to GitHub invites an agent to fetch what it should read locally |
| Adding a platform edits many places | At least 3 files outside any platform folder change per new platform |
| Every agent pays for everything | Claude Code's skill list costs 9,900 tokens, 824 of them for `sdlc-*` skills that matter only in SDLC projects |
| Platform files are hand-written copies | 12 agents x 3 platforms = 36 wrapper files |
| Checks reach into each other's files | At least 2 checks read another area's files (the "Used by" backlink scan, the deny-list check; the second retires with the company move, AC-9.4) |

The cure the blueprint chose: define the contracts first, then a minimal installer that composes components from any source, then move content out one component at a time.

## User Scenarios & Testing *(mandatory)*

Actors: **V** (the only maintainer and user), **an agent** (Claude Code, Copilot CLI or Codex reading files at session start), **a provider** (a component's repo), **a consumer** (a component whose docs cite another component).

### User Story 1 - Contracts and fitness exist before anything moves (Priority: P1) (Phase 0)

V can read, for every connection between parts, one contract that says who owns it, who uses it, how it is versioned and what happens when it is missing or stale. Machine-checkable schemas exist for the files the installer will read, and fitness checks stop the structure from getting worse while the split proceeds. Nothing moves yet.

**Why this priority**: Every later phase builds against these contracts; without them each repo would invent its own. It also fixes the baselines that G4 and G13 are measured from.

**Independent Test**: With phase 0 merged and nothing else, run the repo's full check command, then the install and verification steps V uses today on Mac and Windows. All pass, and every installed path is identical to before.

**Acceptance Scenarios**:

1. **AC-1.1** **Given** the contracts index, **When** V looks up each of the fourteen contracts (`slots/v1`, `component/v1`, the component lists with lock, `knowledge-provider/v1`, `company-kb/v1`, rendered copies, generated routes, `skill-source/v1`, `agent-source/v1`, adapter field files, build and checks, `repo-layout/v1`, hooks, variables), **Then** each has an owner, its consumers, a versioning rule and a stated behaviour when the contract is missing or stale on a machine.
2. **AC-1.2** **Given** shipped valid example files for `slots/v1`, `component/v1`, the public component list, the local component list and the lock, **When** the schema check runs, **Then** all five pass; **And Given** a copy of the `component/v1` example with an extra key `colour: blue`, **Then** the check passes with one warning naming the key (tolerant reader).
3. **AC-1.3** **Given** a `slots/v1` file that still uses `count: 0..1` or `mounts:`, **When** the schema check runs, **Then** it fails and the message names the key and the replacement (`required` + `multiple`, `locations`).
4. **AC-1.4** **Given** the three starting slots, **When** V reads `slots/v1`, **Then** `knowledge-storage` is `required: false, multiple: false` with contract `knowledge-provider/v1`; `company-knowledge-storage` is `required: false, multiple: true` with `company-kb/v1`; `framework` is `required: false, multiple: true`, per project, with `framework/v1`; and a slot whose `contract` is a list of two contracts validates.
5. **AC-1.5** **Given** the constitution, **When** V reads principle I, **Then** it says the source is single and the per-platform files are generated, the version is `2.0.0`, the amendment is dated and states the change, and `scripts/check-docs.sh` passes.
6. **AC-1.6** **Given** the architecture map, **When** a fixture adds the edge "knowledge area depends on agentic-sdlc", **Then** the fitness check fails and names the edge; **And Given** the real tree, **Then** the current violation counts (109 mention lines in 67 files; the checks that read another area's files) are recorded as a baseline and the check fails if any count rises.
7. **AC-1.7** **Given** the baseline file, **When** V opens it, **Then** it holds for Claude Code, Copilot CLI and Codex the always-loaded size in characters (and a token estimate marked as an estimate), the measurement method, the tool version and the date, the count of `{{AGENT_HOME}}` lines in the files that agent loads at session start, and the Claude Code skill-list figure with its `sdlc-*` share.
8. **AC-1.8** **Given** the `knowledge-provider/v1` and rendered-copies contracts, **When** V reads their worked examples, **Then** each shows one citation in both forms: the source form (link text `{{AGENT_HOME}}/knowledge/x.md`, target a GitHub address) and the rendered form on Mac (`/Users/v/.agent-config/knowledge/x.md`) and Windows (`C:\Users\v\.agent-config\knowledge\x.md`), each with the relative target `../../knowledge/x.md` for a copy at `generated/<component>/foo.md`.
9. **AC-1.9** **Given** phase 0 merged, **When** V compares the install plan of the old installers before and after, **Then** the difference is empty.

---

### User Story 2 - First install confirms where the agent home lives (Priority: P1) (Phase 2)

V runs one install command. It names the agent home, asks V to confirm it, and writes nothing until V does.

**Why this priority**: The home is the stable address every other path hangs from; a wrong guess here is expensive to undo.

**Independent Test**: On a clean machine account, run the install command twice, once without and once with confirmation.

**Acceptance Scenarios**:

1. **AC-2.1** **Given** a Mac or Linux account with no home and no override, **When** V runs `install`, **Then** the report states the home as `~/.agent-config`, lists it as a need to confirm, exits 10 and changes nothing on disk (no folder created, no agent file touched).
2. **AC-2.2** **Given** a Windows account with no override, **When** V runs `install`, **Then** the stated home is `%USERPROFILE%\.agent-config`, not `%APPDATA%`.
3. **AC-2.3** **Given** `AGENT_CONFIG_HOME=/data/ac` and no confirmation, **When** V runs `install`, **Then** the report states `/data/ac` as the home.
4. **AC-2.4** **Given** V confirmed the home on an earlier run, **When** V runs `install` again, **Then** the report still states the home on its first line, asks for no confirmation, and proceeds.
5. **AC-2.5** **Given** a confirmed home and `AGENT_CONFIG_HOME` changed to a new location, **When** V runs `install`, **Then** the report states both the recorded and the new home, asks V to confirm the move, and exits 10 without writing.

---

### User Story 3 - Components come from git or a local folder, listed in two files (Priority: P1) (Phase 2)

V keeps the public default list in agent-config and a private local list beside the home. Each component is a git repo or a local folder; both work the same.

**Why this priority**: This is the plug-in mechanism the whole feature exists for (G8, G11).

**Independent Test**: Install the same component once as a `git` source and once as a `path` source; install and `doctor` pass for both.

**Acceptance Scenarios**:

1. **AC-3.1** **Given** a default list entry `{name: agent-knowledge, source: git URL + ref}` and no local entry, **When** V runs `install` with everything confirmed, **Then** a managed clone appears under `components/agent-knowledge/`, the lock records its commit SHA, and the slot location is linked from the home.
2. **AC-3.2** **Given** a local entry for the same name with a `path` source, **When** V runs `install`, **Then** the local entry wins, the home links to that folder live (no copy), the lock records `live`, and `doctor` prints "not version-controlled" as a warning (exit 0).
3. **AC-3.3** **Given** a `path` source whose folder is missing, **When** V runs `install`, **Then** it exits 1, names the folder, and leaves every earlier link untouched; **And** `doctor` fails with the same message.
4. **AC-3.4** **Given** a `git` source that cannot be fetched, **When** V runs `install`, **Then** the previously linked version stays linked, the exit code is 1, and the message names the component and the source.
5. **AC-3.5** **Given** a folder that holds a valid `component.yaml`, **When** it is listed as a `path` source, **Then** it installs; **And Given** a folder without one, **Then** that component is skipped, `doctor` fails, and every other component still installs.
6. **AC-3.6** **Given** an empty folder `~/x`, **When** V runs `init-component ~/x`, **Then** a starter `component.yaml` that passes the schema check is written; **And Given** a `component.yaml` already there, **Then** the command refuses, changes nothing and says why.
7. **AC-3.7** **Given** a source of type `archive` in a list, **When** V runs `install`, **Then** that component is skipped with the message "source type archive not supported in this release" and the exit code is 1 only if the component was required by another.
8. **AC-3.8** **Given** the repo's checks, **When** `components.local.yaml` or `variables.local.yaml` lies inside a tracked path or is staged, **Then** the check fails naming the file; **And Given** the local list holding a `path` source, **Then** the public list is unchanged.

---

### User Story 4 - Installing stops and asks, instead of guessing (Priority: P1) (Phase 2)

When the installer needs something only V can supply, it prints everything it needs in one report and changes nothing.

**Why this priority**: A half-installed machine is worse than none; exit codes also let scripts and agents drive the installer.

**Independent Test**: Run `install` with a component source missing, then with a variable missing, and compare the two reports and disk state.

**Acceptance Scenarios**:

1. **AC-4.1** **Given** a component whose `depends` names a slot nobody fills and agent-config has no default for it, **When** V runs `install`, **Then** the report has a "components" need that names the slot, the contract and the exact command to satisfy it, the exit code is 10, and nothing changed.
2. **AC-4.2** **Given** components are satisfied but a variable has no value, **When** V runs `install`, **Then** the report has a "variables" need listing each variable, its description and the component that defines it, the exit code is 10, and nothing changed; **And** components needs are always reported before variables needs.
3. **AC-4.3** **Given** `--json`, **When** the same run happens, **Then** standard output is one JSON document with the status, the exit code and the list of needs, and standard error carries no JSON.
4. **AC-4.4** **Given** a successful run, **Then** the exit code is 0; **Given** any failed check, **Then** it is 1; **Given** an unknown command or flag, **Then** it is 2 with a usage line (assumption A-8).
5. **AC-4.5** **Given** a component only suggests a source in its `component.yaml` (for example "install github.com/x/y"), **When** V runs `install`, **Then** nothing is fetched from it and the suggestion appears in the report as a need V may act on with `add`.

---

### User Story 5 - Dependencies resolve by slot, not by repo name (Priority: P1) (Phase 2)

A component says "I need a `knowledge-storage` that offers contract `knowledge-provider/v1` and these documents"; it never names a repo.

**Why this priority**: This is what makes a provider swappable (G8).

**Independent Test**: Install a consumer with provider A, then replace A with B in the lists; the consumer's files do not change.

**Acceptance Scenarios**:

1. **AC-5.1** **Given** a consumer needing slot `knowledge-storage` and that slot already filled, **When** V runs `install`, **Then** the filled provider is reused and nothing new is fetched.
2. **AC-5.2** **Given** the slot is empty and agent-config's default list has a provider for it, **When** V runs `install`, **Then** that default is acquired and filled.
3. **AC-5.3** **Given** a chain consumer → A → B where B fills a slot that A needs, **When** V runs `install`, **Then** B is resolved before A is accepted.
4. **AC-5.4** **Given** components forming a cycle, **When** V runs `install`, **Then** it exits 1, prints the cycle in order, and changes nothing.
5. **AC-5.5** **Given** a consumer requiring contract `knowledge-provider/v1` and a provider offering `/v2` only, **When** V runs `install`, **Then** the report names both versions and the consumer is not installed; **And Given** the provider offers `/v1` and `/v2` (current and previous major), **Then** it installs.
6. **AC-5.6** **Given** a consumer citing `{{AGENT_HOME}}/knowledge/a/b.md` that is not in the provider's `provides.exports`, **When** V runs `install`, **Then** it exits 1 naming the consumer file, the citation and the provider.
7. **AC-5.7** **Given** a second provider for a slot that allows one (`multiple: false`), **When** V runs `install`, **Then** it exits 1 naming both providers and the command (`use`) that picks one; **And** a `multiple: true` slot accepts both, each in its own location.
8. **AC-5.8** **Given** a component naming a slot absent from `slots/v1`, **When** V runs `install`, **Then** only that component is skipped, with a warning, and the others install.
9. **AC-5.9** **Given** a component with `runtime: node >=18` on a machine with an older version, **When** V runs `install`, **Then** it exits 1 naming the requirement, the found version and the component.
10. **AC-5.10** **Given** a citation of another component written in a source repo as a Markdown link with text `{{AGENT_HOME}}/<location>/<path>`, **When** the check runs, **Then** the longest matching slot location classifies it; **And Given** a bare relative path, **Then** it is read as that component's own file; **And Given** `{{AGENT_HOME}}/<unknown>/x.md` matching no slot location, **Then** the check fails naming the path.

---

### User Story 6 - Variables are declared by the component that uses them (Priority: P1) (Phase 2)

Each component declares the variables its docs use; V sets values once; the installer renders one compact variables file that agents read.

**Why this priority**: Without it the core would have to list every component's variables and could not stay compact (G4).

**Independent Test**: Install with two components that declare different variables; the rendered file holds exactly the union.

**Acceptance Scenarios**:

1. **AC-6.1** **Given** agent-config declares `AGENT_HOME`, `AGENT_CONFIG_REPO` and `LANGUAGE`, **When** V runs `set LANGUAGE=English`, **Then** the value is stored in V's private variables file and the next `install` renders it.
2. **AC-6.2** **Given** two enabled components that declare 3 and 1 variables, **When** `install` ends, **Then** the rendered `global-variables.md` under the home's `generated/` folder has exactly 4 rows plus `AGENT_HOME`, each with value and description, and no row for a disabled component's variable.
3. **AC-6.3** **Given** `set NAME=value` where `NAME` no enabled component declares, **When** V runs it, **Then** it exits 1 and names the declared variables closest to `NAME`.
4. **AC-6.4** **Given** a variable with a detect rule that finds a value, **When** `install` needs it, **Then** the value is shown as a proposal in the needs report; it is used only after V runs `set`.
5. **AC-6.5** **Given** the core instructions, **Then** they define `{{AGENT_HOME}}` in one line and contain no other variable definition.
6. **AC-6.6** **Given** a variable whose value changed, **When** V runs `install`, **Then** only the rendered file changes; linked sources are untouched.

---

### User Story 7 - Re-running is safe, failures keep the old state, and V can inspect and undo (Priority: P1) (Phase 2)

**Why this priority**: V runs this on two operating systems; a bad update must never leave agents without their core files.

**Independent Test**: Run `install` twice; break one source on the third run; run `doctor`; run `uninstall`.

**Acceptance Scenarios**:

1. **AC-7.1** **Given** a completed install, **When** V runs `install` again with no input changed, **Then** it reports "no changes", exit 0, and rewrites no file whose content is identical.
2. **AC-7.2** **Given** a new version fails any check (schema, cycle, exports, budget, render), **When** V runs `install`, **Then** the previous version of every component stays linked and the report names the failing check.
3. **AC-7.3** **Given** a real file or folder sits where the installer must link (for example a real `~/.copilot/knowledge`), **When** V runs `install`, **Then** it is copied to `~/.agent-config-backups/<timestamp>/` (Windows: `%USERPROFILE%\.agent-config-backups\<timestamp>\`) before it is replaced, and the report names the backup.
4. **AC-7.4** **Given** any install, **When** V runs `plan`, **Then** the report lists each link and generated file that would change, and nothing under the home or any agent folder changes.
5. **AC-7.5** **Given** a healthy install, **When** V runs `doctor`, **Then** it exits 0; **And** for each of these faults it exits 1 and names the item: a link whose target is gone, a generated or rendered file whose hash differs from `install-state.json`, a rendered copy that differs from a fresh render (it names the source file to edit), a rendered file that is writable, a lock entry with no source, a component without a valid manifest, a missing required variable, a citation that no longer resolves, a missing `path` source; **And** warnings (exit 0) cover not-version-controlled path sources and compatibility links still present.
6. **AC-7.6** **Given** an install, **When** V runs `uninstall`, **Then** every link and generated file listed in `install-state.json` is removed if it still matches its recorded hash, read-only rendered files included; a file V edited is left and listed; a `path` source folder, `components.local.yaml` and `variables.local.yaml` are never deleted; backups remain.
7. **AC-7.7** **Given** `plan` or `doctor` run twice in a row, **Then** both runs print the same report.

---

### User Story 8 - Running sessions and old paths keep working during the move (Priority: P1) (Phase 2)

**Why this priority**: Open sessions, memories and hook commands name `~/.copilot/…` paths; breaking them mid-move loses V's working context.

**Independent Test**: Before install, note ten `~/.copilot/…` paths that resolve to agent-home content; after install, all ten still resolve to the same content.

**Acceptance Scenarios**:

1. **AC-8.1** **Given** compatibility links are on, **When** V opens `~/.copilot/knowledge/index.md` and `{{AGENT_HOME}}/knowledge/index.md`, **Then** both show the same file; the same holds for `companies`, `frameworks`, `patterns`, `references`, `procedures`, `instructions/core.instructions.md` and `global-variables.md`.
2. **AC-8.2** **Given** Copilot's own folders (its instructions, hooks and agents folders under `~/.copilot`), **When** install ends, **Then** they are not replaced by compatibility links.
3. **AC-8.3** **Given** a compatibility link listed under `retired:` for the release that removes it, **When** V runs `install`, **Then** the link is removed only if it is still the installer's own link; a real file at that path is left and reported.
4. **AC-8.4** **Given** the tracked files, **When** the sorting check runs, **Then** each of the 484 hard-coded `~/.copilot` lines (131 files, count of 2026-11-11) is classified as agent-home content (to become `{{AGENT_HOME}}`) or a Copilot-own path (kept, on a named allow-list); a new hard-coded agent-home line fails the check.
5. **AC-8.5** **Given** the 445 existing `{{AGENT_HOME}}` lines, **When** the home moves in phase 2, **Then** none of them is edited by that phase and all resolve against the new home; **And** the link targets that `--write` adds to cross-component citations in later phases (AC-9.5) are the only edits to those lines.
6. **AC-8.6** **Given** each agent (Claude Code, Copilot CLI, Codex) started after install, **Then** until phase 5 it loads the same core instructions it loaded just before the move (compared by content hash of the text it receives); from phase 5 the comparison is with the rendered text (AC-16.1).

---

### User Story 9 - The knowledge area stops depending on the SDLC framework, and citations get checked targets (Priority: P2) (Phase 1)

**Why this priority**: The cycle blocks both splits, and the citation form must exist before any component moves; but nothing user-visible is lost if it waits.

**Independent Test**: Run the knowledge validator against a checkout containing only the knowledge area; run the SDLC validator with `--write` and then without it.

**Acceptance Scenarios**:

1. **AC-9.1** **Given** the knowledge area, **When** the fitness check runs, **Then** it finds 0 mentions of `agentic-sdlc` (the baseline of 109 lines goes to 0) and the check is on for good.
2. **AC-9.2** **Given** the knowledge framework, **Then** it no longer requires "Used by" sections and the knowledge validator contains no backlink scan; **And Given** a doc that still has a "Used by" table, **Then** it is ignored without error.
3. **AC-9.3** **Given** the SDLC framework's validator run with the knowledge root and the adapter map as arguments, **When** a citation does not resolve, **Then** it fails naming the citing file and the missing path; **And** with no hard-coded repo folder names.
4. **AC-9.4** **Given** the knowledge validator, **Then** it reads only the knowledge area and never a company folder; **And** the former deny-list check that read `companies/*/repos` no longer exists.
5. **AC-9.5** **Given** a consumer file with a citation whose link text is `{{AGENT_HOME}}/knowledge/x.md` and no target, **When** the consumer's validator runs with `--write`, **Then** the target becomes the GitHub address of that file in the provider's repository, taken from the `repository` URL in the provider's `component.yaml`, and a second `--write` changes nothing.
6. **AC-9.6** **Given** a citation whose target is missing or differs from the generated one (for example the provider's `repository` URL changed), **When** the validator runs without `--write`, **Then** it fails naming the file, the citation and the expected target.
7. **AC-9.7** **Given** a provider whose `component.yaml` has no `repository`, **When** the validator checks a citation of it, **Then** it fails naming the provider and the citing file.
8. **AC-9.8** **Given** the core instructions, **Then** the `{{VAR}}` rule still says to resolve from `global-variables.md` and now also says to read the resolved file on this machine and never fetch it; **And** no line of the core tells agents to read a link's text instead of its target.

---

### User Story 10 - Company knowledge is its own repo, still public (Priority: P2) (Phase 3)

**Why this priority**: Its readers differ (it is read only while working on that company's repos), so it leaves the core and the default install; nothing else depends on it. P2 by V's choice at G2 (2026-11-13), although the privacy reason is gone.

**Independent Test**: Install once with and once without the company repo listed; search the core for company names.

**Acceptance Scenarios**:

1. **AC-10.1** **Given** the move done, **When** V searches the current tree of agent-config for `companies/ots`, `OTS_REPOS_ROOT` and the four company repo names that the core instructions name today, **Then** the core instructions and the variables source have 0 lines naming a company repo or `OTS_REPOS_ROOT`, and no company folder remains in the tree.
2. **AC-10.2** **Given** the new `agent-companies` repo, **Then** it is public, holds the company KB instances with their history, the company repo names, the company variable (`OTS_REPOS_ROOT`) and its routes, and declares them as a component filling `company-knowledge-storage`.
3. **AC-10.3** **Given** `agent-companies` listed in the public or the local list, **When** V runs `install`, **Then** `{{AGENT_HOME}}/companies/index.md` resolves and company routes appear; **And Given** the entry removed, **Then** install succeeds, no company route exists and nothing in the core names a company.
4. **AC-10.4** **Given** a clone that fails (network down or V's credentials missing), **When** V runs `install`, **Then** only that component fails to acquire (the previous version stays) and the message names the cause.
5. **AC-10.5** **Given** the move, **Then** the existing commits of agent-config keep their ids (no history rewrite) and the repo has no deny-list file, no privacy-audit command and no check that reads company folders.
6. **AC-10.6** **Given** a checkout of `agent-companies` and a knowledge provider supplied to it, **When** its check command runs, **Then** it passes and every KB citation in it is in the provider's `provides.exports`; **And Given** no provider supplied, **Then** it exits with a message naming the slot `knowledge-storage`.

---

### User Story 11 - Skills and agents are built at install from one source per platform (Priority: P2) (Phase 4)

**Why this priority**: Removes 36 hand-written files and enables per-platform optimisation; independent of the installer's agent-folder work.

**Independent Test**: Build one migrated agent for all three targets twice and compare the two outputs; list the tracked files of the provider for build output.

**Acceptance Scenarios**:

1. **AC-11.1** **Given** one agent source, **When** the build runs at install, **Then** a Claude Code, a Copilot and a Codex file are produced, each using only fields the adapter's field list marks verified for that platform, the output is stamped with the source revision and adapter version, and the same source built twice gives identical output; **And** the renderer then copies the output into `generated/` (Story 16).
2. **AC-11.2** **Given** installed built output whose stamp names a source revision or adapter major that no longer matches, **When** V runs `doctor`, **Then** it exits 1 naming the file and the previous output stays linked.
3. **AC-11.3** **Given** `auto-delegate: false` in a source, **Then** the Copilot CLI output carries `infer: false`, the VS Code output carries `disable-model-invocation`, and Codex output states no tool restriction possible (build warning).
4. **AC-11.4** **Given** the 12 agents and the wrapper skills, **When** the migration ends, **Then** there are 12 agent sources, 0 hand-written per-platform agent files, 0 skill bodies that only point at a procedure and 0 built files tracked in any repo.
5. **AC-11.5** **Given** a source with `{{include:}}`, **Then** the build inlines it; **And** an include of a missing file fails with its path.
6. **AC-11.6** **Given** a component declaring `idle-cost` and a build over it, **Then** the per-component budget check fails when measured characters exceed the declared ceiling, and the Claude Code description total above 15,000 tokens warns.
7. **AC-11.7** **Given** a new platform, **Then** adding its folder under adapters and nothing else produces its build target (G3).
8. **AC-11.8** **Given** the same skill name from two components, **When** V runs `install`, **Then** the second fails with both names.
9. **AC-11.9** **Given** a provider repo, **When** its CI runs, **Then** it runs the pinned build and the per-component budget check and fails on a build error or an excess; **And Given** a build-output file added to the tracked files, **Then** the repo's check fails naming it.

---

### User Story 12 - The full installer wires every agent (Priority: P2) (Phase 5)

**Why this priority**: Phase 2 composes components; this step makes each agent actually see them.

**Independent Test**: Install on a clean account; start each agent; each lists the same layers and skills.

**Acceptance Scenarios**:

1. **AC-12.1** **Given** an install, **Then** Claude Code's user file holds exactly 2 import lines owned by the installer, Copilot has the routes file with `applyTo: "**"` plus linked instruction files, and Codex has `~/.codex/AGENTS.md` and `~/.codex/hooks.json` generated or linked from the home's `generated/codex/`.
2. **AC-12.2** **Given** the rendered Codex `AGENTS.md`, **Then** its size is below 32 KiB or the install exits 1 naming the size.
3. **AC-12.3** **Given** V's existing keys in `~/.claude/settings.json`, **When** hooks are merged, **Then** every key V set is preserved and only the installer's hook entries are added or changed; the original is backed up first.
4. **AC-12.4** **Given** the two skill targets, **Then** built skills appear in `~/.claude/skills` and `~/.agents/skills` linked entry by entry to the rendered skills under `generated/`, and skills synced from elsewhere into those folders are left alone.
5. **AC-12.5** **Given** core text changed and Codex's file not re-rendered, **When** V runs `doctor`, **Then** it fails on the hash mismatch; **And** a post-merge hook and the session-start hook (AC-16.8) re-render it.
6. **AC-12.6** **Given** all enabled components, **When** `install` or `doctor` totals their declared `idle-cost` per target, measured on the rendered text the agent receives (clarification C-4), **Then** a total over the target's ceiling fails and names the largest contributors.
7. **AC-12.7** **Given** a component providing a service (for example an MCP server), **Then** it is registered for each agent at install and removed by `uninstall`.

---

### User Story 13 - The knowledge base is its own repo (Priority: P3) (Phase 6)

**Why this priority**: Delivers G1, but the KB is already usable as a component through a `path` source, so P1 does not depend on the move.

**Independent Test**: Clone the KB repo alone and run its check command.

**Acceptance Scenarios**:

1. **AC-13.1** **Given** a checkout of the KB repo only, **When** its check command runs, **Then** it passes.
2. **AC-13.2** **Given** the KB's `component.yaml`, **Then** it lists every citable doc (41 today) in `provides.exports`; removing or renaming one without a major version bump fails the KB's check.
3. **AC-13.3** **Given** a consumer citing an export, **When** the consumer's validator runs, **Then** it checks the citation against the provider's export list; a missing one fails.
4. **AC-13.4** **Given** the KB's 20 `{{AGENT_HOME}}` lines in 10 files, **Then** 9 are relative links inside the KB and 11 are plain words, and a check forbids new ones.
5. **AC-13.5** **Given** a non-legacy KB doc, **Then** every relative Markdown link in the whole body, fenced code skipped, resolves and stays inside the KB, `{{AGENT_HOME}}` appears nowhere, and a code span naming a KB doc is a warning; **And** a legacy doc (no `schema:` key) produces warnings only.
6. **AC-13.6** **Given** constitution principle III and the `review-docs` procedure, **Then** neither names `copilot/knowledge`.
7. **AC-13.7** **Given** a moved exported doc, **Then** a stub stays at the old path for one release.
8. **AC-13.8** **Given** the move, **Then** a `path` source pointing at the old in-repo KB location and a `git` source for the new repo both install, and the KB content seen by agents is identical.

---

### User Story 14 - The SDLC framework is its own repo, on only in SDLC projects (Priority: P3) (Phase 7)

**Why this priority**: Delivers the G4 saving outside SDLC projects; the framework works in place until then.

**Independent Test**: Open an SDLC project and a non-SDLC project and compare the always-loaded skill list.

**Acceptance Scenarios**:

1. **AC-14.1** **Given** the framework repo with a release tag, **Then** agent-config pins that tag.
2. **AC-14.2** **Given** a project with the framework enabled, **Then** its `sdlc-*` skills and agents are visible; **Given** a project without, **Then** none is, and the Claude Code skill list shrinks by the `sdlc-*` share recorded in the baseline (824 tokens on 2026-11-11).
3. **AC-14.3** **Given** enabling in a project, **Then** the added files are kept out of version control (assumption A-13) and a `disable` step removes them.
4. **AC-14.4** **Given** the framework's validator, **Then** it passes with the knowledge area given as an argument and contains no hard-coded folder of another repo.

---

### User Story 15 - The root holds only motherboard parts (Priority: P3) (Phase 8)

**Why this priority**: Tidiness; every deployed path stays the same.

**Independent Test**: List the root; run install and `doctor`.

**Acceptance Scenarios**:

1. **AC-15.1** **Given** the final tree, **Then** the root entries are the target set fixed at P4 (today 25 entries plus a `copilot/` folder with 11 subfolders), and no content-only folder remains.
2. **AC-15.2** **Given** phase 8 merged, **Then** only the mapping sources changed: every installed path in the agent folders and the home is identical to before the phase.
3. **AC-15.3** **Given** replacing the knowledge provider in the component lists, **Then** 0 lines of the core instructions change (G8).

---

---

### User Story 16 - Agents load only rendered copies with real paths (Priority: P2) (Phase 5)

Every component that cites another is copied at install into `{{AGENT_HOME}}/generated/<component>/`. In the copy, each citation shows the real absolute path on this machine as its text and a relative path as its target. Copies are read-only, say where they come from, and are refreshed when their source changes. Agents load the copies, never the source files.

**Why this priority**: Without it every agent resolves `{{AGENT_HOME}}` by hand (G13) and may follow a GitHub target instead of reading the local file; but phases 0 to 4 work with the variables file, so this can follow them.

**Independent Test**: Install with core, agentic-sdlc, agent-companies and agent-knowledge enabled; list what each agent loads; compare each rendered file with a fresh render.

**Acceptance Scenarios**:

1. **AC-16.1** **Given** those four components installed, **When** `install` ends, **Then** `generated/core/`, `generated/agentic-sdlc/` and `generated/agent-companies/` hold copies of their files, built skills and agents each have a copy, and no `generated/agent-knowledge/` exists because the knowledge base is linked (its links are relative).
2. **AC-16.2** **Given** a file `agentic-sdlc/foo.md` citing `{{AGENT_HOME}}/knowledge/x.md`, **When** `install` ends, **Then** on a Mac with home `/Users/v/.agent-config` the copy `/Users/v/.agent-config/generated/agentic-sdlc/foo.md` shows link text `/Users/v/.agent-config/knowledge/x.md` and target `../../knowledge/x.md`; **And** on Windows with home `C:\Users\v\.agent-config` the link text is `C:\Users\v\.agent-config\knowledge\x.md` and the target is the same `../../knowledge/x.md`.
3. **AC-16.3** **Given** every rendered file, **When** V counts, **Then** `{{AGENT_HOME}}` path placeholders number 0 (the allow-list in A-21 excepted), and every citation target is relative and resolves to an existing file.
4. **AC-16.4** **Given** a rendered file, **Then** its first line (after front matter where the format requires front matter first, A-22) reads "Generated from `<source path>`; edit that file, not this copy."; `{{AGENT_HOME}}/generated/index.md` states once what is rendered, from where, and that edits belong in the source; and writing to the file is refused until its permission is changed.
5. **AC-16.5** **Given** the routes, the Copilot instruction links, `~/.claude/skills` and `~/.agents/skills`, **When** V resolves each, **Then** 0 of them resolve into a source repo of a rendered component; those for rendered components resolve under `generated/`.
6. **AC-16.6** **Given** a rendered copy that V changed after lifting its read-only permission, **When** V runs `doctor`, **Then** it exits 1 naming the copy and the source file to edit; **And Given** a source changed since the last render, **Then** `doctor` exits 1 for the same reason; **And** `install` restores both.
7. **AC-16.7** **Given** the same files and no change, **When** `install` runs again, **Then** it rewrites no rendered file (AC-7.1) and a rendered copy that is already read-only stays so.
8. **AC-16.8** **Given** a `path` source file edited after the last install, **When** a Claude Code or a Copilot CLI session starts, **Then** the session-start hook has re-rendered that component's copy (its content equals a fresh render) before the session reads it, and the next session start re-renders nothing; **And** for Codex the same holds only if the P4 check confirms a session-start hook, otherwise `doctor` reports the stale copy (A-18).
9. **AC-16.9** **Given** a re-render that fails (for example a citation to a doc no longer exported), **When** the hook runs, **Then** the previous copy stays, the session starts, the message names the failing citation, and `doctor` exits 1.
10. **AC-16.10** **Given** any of the four repos, **When** its check runs, **Then** it fails if a tracked file begins with the generated-from line or lies in a build-output folder.

### Edge Cases

- The home folder exists but belongs to another tool or holds unmanaged files: install adds only what it records; unmanaged files stay (AC-7.3 covers real files at link targets).
- Two machines (Mac and Windows) with different homes: lists and variables are per machine; nothing machine-specific is committed.
- Windows account that cannot create links: install exits 1 with a message naming the cause, having changed nothing. (Link kind is a plan matter.)
- Interrupted install (power loss, Ctrl-C): the next `install` completes or restores; `doctor` reports half-states.
- Local list names a component also in the public list with a different source: local wins, shown in `plan`.
- Component removed from both lists: its links are removed on the next install; a managed clone is removed; a `path` folder is never touched.
- A hand-written `depends.docs` that disagrees with citations: the check fails and prints the generated value (FR-017).
- A component shipping a hook for an agent that is not installed: skipped, `doctor` warns only.
- Network down on a rerun with all git sources already acquired and unchanged refs: install succeeds from the lock where no fetch is needed; any needed fetch fails per AC-3.4.
- Two components ask the same variable name with different descriptions: install fails naming both.
- A home path with spaces or non-ASCII characters (a user name such as `Vinh Do`): the link text shows the real path; the relative target stays a valid Markdown target (spaces encoded) and resolves.
- A source changes while a session is open: the copy refreshes at the next session start or `install`, not mid-session.
- A provider with no `repository` URL (for example a `path` source never pushed): citations of it fail the consumer's check (AC-9.7).
- Two machines: rendered copies hold the user name in real paths and exist only under each machine's home; no repo tracks them (AC-16.10).

## Requirements *(mandatory)*

### Functional Requirements

**Phase 0 (US1)**

- **FR-001**: Each of the fourteen contracts MUST be documented with owner, consumers, versioning rule and behaviour when missing or stale (AC-1.1).
- **FR-002**: Machine-checkable schemas MUST exist for `slots/v1`, `component/v1`, the public component list, the local component list and the lock (AC-1.2).
- **FR-003**: `slots/v1` MUST use `required`, `multiple`, `locations` (named parts such as `content`, `framework`) and allow `contract` to be a list; the old keys `count` and `mounts` MUST be rejected with a message naming the replacement (AC-1.3, AC-1.4).
- **FR-004**: `component/v1` MUST carry `name`, `version`, `slot`, `repository` (the provider's URL, used to generate citation targets), `provides` (contract, `index`, `exports`, optional `services`), `depends` (slot + contract major, runtimes, generated `docs`), the locations it supplies, `routes`, `hooks`, `variables`, `scope`, `idle-cost` (characters per target) (AC-1.2).
- **FR-005**: Readers MUST warn on unknown keys and skip only the component that uses an unsupported slot or major (AC-1.2, AC-5.8).
- **FR-006**: Contract versions MUST be pinned by major only; readers MUST accept the current and previous major (AC-5.5).
- **FR-007**: Constitution principle I MUST be amended to "one source, generated per platform" as version 2.0.0 (AC-1.5).
- **FR-008**: The architecture map MUST list the four components and their allowed edges, forbid knowledge → agentic-sdlc, knowledge → companies and contracts → any component, and the fitness check MUST fail on a new violation against a recorded baseline (AC-1.6).
- **FR-009**: A per-agent baseline of always-loaded size MUST be recorded in characters with method, tool version and date (AC-1.7).
- **FR-010**: The contracts MUST show the citation in its source form and its rendered form, for Mac and Windows, with the relative target (AC-1.8).
- **FR-011**: Phase 0 MUST NOT change any installed path or any installer behaviour (AC-1.9).
- **FR-012**: `repo-layout/v1` MUST be defined and checked in report mode against agent-config (AC-1.1).

**Phase 2 (US2 to US8)**

- **FR-013**: The agent home MUST be `~/.agent-config` (Mac, Linux) or `%USERPROFILE%\.agent-config` (Windows), moved by `AGENT_CONFIG_HOME`, stated on every run, confirmed by V on the first run and on a move, with nothing written before confirmation (AC-2.1 to AC-2.5).
- **FR-014**: The home MUST contain `core/`, `knowledge/`, `frameworks/<name>/`, `companies/` (links to source folders), `components/<name>/` (managed clones), `generated/` (every installer-written file and every rendered copy, rebuilt each install), `components.local.yaml`, `variables.local.yaml`, `components.lock` and `install-state.json` (AC-3.1, AC-6.2, AC-7.6).
- **FR-015**: Every file the installer places MUST be one of three classes, recorded with its hash in `install-state.json`: linked (the knowledge base; source edits show at once), rendered (a copy of a component that cites another, with real paths, read-only; built skills and agents are rendered after the build), generated (machine-specific files: routes, `global-variables.md`, Codex `AGENTS.md`, merged hooks) (AC-7.5, AC-7.6, AC-16.1).
- **FR-016**: The installer MUST run read → resolve → plan → apply → report; `plan` MUST write nothing under the home or any agent folder; exit codes MUST be 0 done, 10 needs input (with a needs report and no change), 1 failed, 2 usage error; `--json` MUST put one JSON document on standard output (AC-4.1 to AC-4.4, AC-7.4).
- **FR-017**: `depends.docs` MUST be generated from citations; a hand-written value that differs MUST fail the check and print the generated one (Edge Cases).
- **FR-018**: The needs report MUST list component needs before variable needs, each with the exact command that satisfies it (AC-4.1, AC-4.2).
- **FR-019**: The installer MUST read the public list and the local list and merge by name with the local entry winning; the local list and the variables file MUST never lie inside a tracked path (AC-3.2, AC-3.8).
- **FR-020**: A source adapter MUST exist for `git` (managed clone, lock holds SHA) and `path` (live link, lock holds `live`, `doctor` warns); each has check, acquire and version steps (AC-3.1 to AC-3.4).
- **FR-021**: A component MUST need nothing but a folder with a valid `component.yaml`; `init-component <path>` MUST write a valid starter and refuse to overwrite (AC-3.5, AC-3.6).
- **FR-022**: Resolution MUST reuse a filled slot, else take agent-config's default, else report a need; it MUST resolve recursively and check cycles, contract versions, cited docs against exports and slot counts; it MUST NOT fetch a source that only a component suggested (AC-4.5, AC-5.1 to AC-5.8).
- **FR-023**: A citation of another component MUST be written in a source repo as a Markdown link whose text is `{{AGENT_HOME}}/<location>/<path>`; classification is by the longest matching location prefix; a path under no location fails; a bare relative path is the component's own (AC-5.10).
- **FR-024**: Declared runtimes MUST be checked before apply (AC-5.9).
- **FR-025**: Variables MUST be declared in the `component.yaml` of the component whose docs use them (`AGENT_HOME`, `AGENT_CONFIG_REPO`, `LANGUAGE` in agent-config; `REFERENCE_REPOS_ROOT` in agentic-sdlc; `OTS_REPOS_ROOT` in agent-companies; none in the KB); values live in `variables.local.yaml`; `set NAME=value` stores them; a compact `global-variables.md` MUST be rendered into `generated/` with a row per variable of each enabled component; the core MUST define `{{AGENT_HOME}}` in one line (AC-6.1 to AC-6.6).
- **FR-026**: Apply MUST acquire into staging and switch only after every check passes; a failure keeps the previous links; a rerun with unchanged input MUST rewrite no identical file; anything replaced MUST first be backed up under `~/.agent-config-backups/<timestamp>/` (AC-7.1 to AC-7.3).
- **FR-027**: Shared folders MUST be linked per entry, never replaced as a whole (AC-12.4).
- **FR-028**: The commands `install`, `set`, `add`, `use`, `init-component`, `plan`, `doctor` and `uninstall` MUST exist; `add` appends a component to the local list, `use` overrides an existing component's source by name (assumption A-9) (AC-3.2, AC-5.7).
- **FR-029**: `doctor` MUST fail on the faults and warn on the conditions in AC-7.5 and be repeatable (AC-7.5, AC-7.7, AC-16.6).
- **FR-030**: `uninstall` MUST remove only what `install-state.json` records and still matches (read-only rendered files included), leaving edited files, `path` source folders and V's two local files (AC-7.6).
- **FR-031**: Compatibility links MUST keep every pre-move `~/.copilot/…` agent-home path resolving for one release, MUST NOT replace Copilot's own folders, and MUST be removed through `retired:` only when still the installer's own link (AC-8.1 to AC-8.3).
- **FR-032**: The 484 hard-coded `~/.copilot` lines MUST be classified and the agent-home ones converted to `{{AGENT_HOME}}` before the links are retired; a check MUST forbid new ones; the 445 existing `{{AGENT_HOME}}` lines MUST need no edit (AC-8.4, AC-8.5).
- **FR-033**: One install command per machine MUST work with the same steps on Mac and Windows (`install.sh`, `install.ps1`) (AC-2.1, AC-2.2).
- **FR-034**: Components MUST NOT be installed through a package manager; a package manager MAY be used inside a repo for that repo's own dev tooling (AC-3.1).
- **FR-035**: Until phase 5, the existing installers MUST keep wiring the agent folders, now pointing at the new home (AC-8.6).

**Phase 1, 3 to 8**

- **FR-036** (phase 1): The knowledge area MUST contain 0 mentions of `agentic-sdlc`, its "Used by" rule and backlink scan MUST be gone, no knowledge check may read a company folder, and the SDLC validator MUST take the knowledge root and adapter map as arguments (AC-9.1 to AC-9.4).
- **FR-037** (phase 3): Company content, company repo names and the company variable MUST live in the public `agent-companies` repo with its history; the core instructions and the variables source MUST name no company (AC-10.1 to AC-10.4, AC-10.6).
- **FR-038** (phase 4): Skills and agents MUST have one source each, built at install per target with verified fields, stamped, checked for stamp drift and budget-checked (AC-11.1 to AC-11.9).
- **FR-039** (phase 5): Routes, the two skill targets, merged hooks, registered services and the total budget MUST be installed as stated in AC-12.1 to AC-12.7, pointing at rendered copies; agent folders hold only pointers and discovered files.
- **FR-040**: The KB repo MUST pass its own checks alone, export its citable docs, and follow the in-storage link rules, with legacy docs warning only (AC-13.1 to AC-13.8).
- **FR-041**: The SDLC repo MUST be tagged, pinned by tag, and enabled per project (AC-14.1 to AC-14.4).
- **FR-042**: Phase 8 MUST change only mapping sources (AC-15.1 to AC-15.3).
- **FR-043**: Each phase MUST end with the repo checks green before and after, and install plus `doctor` passing on Mac and Windows.
- **FR-044** (phase 1 onward): Each consumer's validator MUST generate, with `--write`, the target of every cross-component citation as the GitHub address of the cited file in the provider's `repository`; it MUST fail on a missing or stale target and on a provider with no `repository` (AC-9.5 to AC-9.7).
- **FR-045** (phase 5): The installer MUST render every component whose files cite another (core, agentic-sdlc, agent-companies, built skills and agents) into `generated/<component>/`; in each copy a citation's link text MUST be the real absolute path on that machine and its target the relative path to the cited file; routes, instruction links and skill folders MUST point at the copies; the knowledge base MUST stay linked; a rendered file MUST hold 0 `{{AGENT_HOME}}` path placeholders apart from the allow-list; no repo may track a rendered copy (AC-16.1 to AC-16.3, AC-16.5, AC-16.10).
- **FR-046** (phase 5): Every rendered file MUST carry the generated-from line, `generated/index.md` MUST explain the mechanism once, and rendered files MUST be written read-only; `doctor` MUST report a copy that differs from a fresh render or is writable; a session-start hook MUST re-render a component whose source changed, keep the old copy on failure and never block the session (AC-16.4, AC-16.6 to AC-16.9).
- **FR-047** (phase 4): Skills and agents MUST be built at install and then rendered; build output MUST never be committed; each provider's CI MUST prove the build and the per-component budget (AC-11.1, AC-11.9, AC-16.10).
- **FR-048** (phase 1): The core's `{{VAR}}` rule MUST say to resolve from `global-variables.md` and to read the resolved file locally, never fetch it; the core MUST NOT contain a "read the link text" line (AC-9.8).
- **FR-049** (phase 3): The company KB MUST stay public; there MUST be no deny-list, privacy audit or history rewrite (AC-10.5).

### Key Entities

- **Motherboard**: agent-config in two parts: contracts (schemas, build tool, adapters, layout validator) and the composition root (installer, component lists, lock, renderer).
- **Component**: a folder with a valid `component.yaml`, provided by a repo or local folder.
- **Slot**: a named socket in `slots/v1` (name, contract(s), `required`, `multiple`, scope, `locations`).
- **Location**: a named part of a slot's mount (`content`, `framework`); `index.md` sits at the root of `content`.
- **Contract**: a versioned agreement `name/vN` between an owner and consumers.
- **Source**: where a component comes from: `git` (URL + ref), `path`, later `archive`.
- **Component list**: public (`components.yaml`, default components, name + source) or local (`components.local.yaml`, extras and overrides, never committed).
- **Lock**: per-source recorded version (commit SHA, `live`, later checksum).
- **Install state**: every link, rendered copy and generated file with its class and hash.
- **Needs report**: the exit-10 report listing what only V can supply.
- **Export**: a doc path a provider allows others to cite.
- **Citation**: a Markdown link from one component's file to another's. In a source repo its text is `{{AGENT_HOME}}/<location>/<path>` and its target a GitHub address generated from the provider's `repository`; in a rendered copy its text is the real absolute path and its target the relative path.
- **Rendered copy**: a read-only copy of a component's files under `generated/<component>/`, with citations rewritten; what agents load.
- **Generated-from line**: the first line of a rendered file, naming the source to edit.
- **Route**: a generated entry telling an agent which layer to read and when; it points at rendered copies.
- **Compatibility link**: a link at an old `~/.copilot/…` path pointing to its new place, kept for one release.
- **Idle cost**: characters a component adds to an agent's always-loaded text, per target.
- **Agent home**: `{{AGENT_HOME}}`, the neutral folder agent-config owns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

| Id | Goal | Measure and pass condition | Verified by |
|---|---|---|---|
| SC-001 | G1 | The KB repo's check command passes in a checkout containing only that repo | AC-13.1 |
| SC-002 | G2 | `{{AGENT_HOME}}/knowledge/index.md` and `{{AGENT_HOME}}/companies/index.md` resolve for Claude Code, Copilot CLI and Codex after install; 10 of 10 sampled old `~/.copilot/…` paths resolve to the same content during the release | AC-8.1, AC-8.6, AC-12.1 |
| SC-003 | G3 | Files edited outside `adapters/<name>/` to add a platform: ≥ 3 → 0 | AC-11.7 |
| SC-004 | G4 | Always-loaded characters per agent, measured on the rendered text (C-4), ≤ phase-0 baseline everywhere; outside SDLC projects, lower by the `sdlc-*` share (824 of 9,900 tokens for Claude Code) | AC-1.7, AC-12.6, AC-14.2 |
| SC-005 | G5 | Install steps on a new machine: one command, same on Mac and Windows | AC-2.1, AC-2.2 |
| SC-006 | G6 | Dropped at G2 (the company KB stays public); no criterion | none |
| SC-007 | G7 | Root entries: only the target set fixed at P4 (today: 25 plus `copilot/` with 11 subfolders) | AC-15.1 |
| SC-008 | G8 | Lines of the core instructions edited when the knowledge provider is swapped: 0 | AC-15.3, AC-5.1 |
| SC-009 | G9 | Hand-written per-platform agent files 36 → 0 (12 sources); pointer-only skill bodies → 0; built files tracked in any repo → 0 | AC-11.4, AC-11.9 |
| SC-010 | G10 | Every component declares `idle-cost`; per-component and total checks both exist and fail on excess | AC-11.6, AC-12.6 |
| SC-011 | G11 | Install and `doctor` pass with each non-core component as `git` and as `path` | AC-3.1, AC-3.2 |
| SC-012 | G12 | Checks that read another repo's files: ≥ 2 → 0 | AC-9.2, AC-9.4 |
| SC-013 | no regression | After each phase, repo checks green and the previous phase's acceptance scenarios still pass | FR-043 |
| SC-014 | safety | A rerun with unchanged input rewrites 0 files; a failed update leaves 0 components on a changed version | AC-7.1, AC-7.2, AC-16.7, AC-16.9 |
| SC-015 | G13 | After install: `{{AGENT_HOME}}` path placeholders in rendered files 0 (allow-list excepted); writable rendered files 0; rendered files without a generated-from line 0; `doctor` drift findings 0; rendered or built files tracked in a repo 0; cross-component citations with a missing or stale target 0 | AC-16.3, AC-16.4, AC-16.6, AC-16.10, AC-9.6 |

## Coverage of the G0 and G2 decisions

| Decision row | Where covered |
|---|---|
| Boundary | FR-008, AC-9.4, AC-13.3 (consumers check citations against exports; no repo's checks read another's files); SC-012 |
| Slots | FR-003, AC-1.3, AC-1.4, AC-5.7, AC-5.8 |
| Component lists | FR-019, AC-3.2, AC-3.8, AC-10.3 (the blueprint line that private sources appear only in the local list is not needed once the company KB is public) |
| Sources | FR-020, FR-021, AC-3.1 to AC-3.7 (`archive`: out of scope, below) |
| Dependencies | FR-022, FR-024, AC-4.1, AC-4.5, AC-5.1 to AC-5.9 |
| Exports | FR-022, AC-5.6, AC-13.2, AC-13.3 |
| "Used by" | FR-036, AC-9.2 |
| Variables (G2: read locally, never fetch) | FR-025, FR-048, AC-6.1 to AC-6.6, AC-9.8, AC-10.2 |
| KB paths | AC-13.4, AC-13.5 |
| Installer | FR-016, FR-018, FR-026, FR-028, AC-4.1 to AC-4.4, AC-7.1 to AC-7.7 |
| pnpm | FR-034 |
| Agent home | FR-013, AC-2.1 to AC-2.5 |
| Home layout | FR-014, AC-3.1, AC-6.2, AC-7.6 |
| Delivery (G2) | FR-015, FR-047, AC-7.5 (linked, rendered, generated classes); built at install, never committed: AC-11.1, AC-11.9, AC-16.10 |
| Agent folders | FR-035, FR-039, AC-8.2, AC-12.1, AC-12.3, AC-12.4 |
| Refinements for P3 | slot fields FR-003; `index.md` at `content` root FR-014, AC-1.4; citation form FR-023, AC-5.10; generated `depends.docs` FR-017; in-storage link rules AC-13.5; `provides.services` AC-12.7 |
| Transition | FR-031, FR-032, AC-8.1 to AC-8.5 |
| Company KB, public (G2) | FR-037, FR-049, AC-10.1 to AC-10.6; goal G6 dropped (SC-006) |
| Citations (G2) | FR-023, FR-044, AC-5.10, AC-9.5 to AC-9.7 |
| Rendering (G2) | FR-045, AC-16.1 to AC-16.3, AC-16.5, AC-12.1, AC-12.4, AC-12.6 |
| Rendered-copy guards, all three (G2) | FR-046, AC-16.4, AC-16.6 to AC-16.9, AC-7.5, AC-7.6 |
| Defaults: repo names, compatibility links (G2) | A-12, A-16 |
| Goal G13 | SC-015 |

## Out of Scope

| Item | Reason |
|---|---|
| `archive` sources | The blueprint says "later"; AC-3.7 fixes how they are refused now |
| Changing KB content or schemas, retrofitting legacy docs | Blueprint non-goal; constitution II |
| An MCP server for the KB; a database-only knowledge store | Blueprint non-goal; a new contract would be needed. Optional `provides.services` (AC-12.7) is the only hook |
| A router agent in front of prompts | Blueprint non-goal |
| Multi-user publishing, outside consumers | Blueprint assumption: V is the only user |
| Splitting agent-foundry or contracts into their own repos | Split test: no outside user yet / nothing uses the contracts without the installer |
| Rewriting agent-config's git history, a deny-list, a privacy audit | The company KB stays public (G2); G6 is dropped |
| Committing built output or rendered copies | Built and rendered at install (G2); AC-16.10 forbids it |
| Changing paths agents discover under `~/.claude`, `~/.codex`, `~/.copilot`, `~/.agents` | Reconciles the blueprint non-goal "no change to installed paths" with the home move: the agent-home paths change once, in phase 2, behind compatibility links; the agent-discovered paths never change |
| Measuring agent behaviour on Codex or Copilot (items marked unconfirmed in the blueprint) | Belongs to P4 with a cheap model; spec states outcomes only (AC-8.6, AC-12.1) |

## Assumptions

- **A-1** V is the only maintainer and user; no outside consumer pins these repos.
- **A-2** Node 18 or later is present on every machine (the tracker hook already requires it); the spec states it as a declared runtime, not a design.
- **A-3** The local lists and variable file live in the agent home, not under `~/.copilot`; the blueprint's contract table still shows the old path and is read as amended on 2026-11-13.
- **A-4** The contract table's component `mounts` field is read as "the locations of the slot that this component supplies, each with its folder" (the slot's `locations` replaced `mounts`); the plan fixes the field name.
- **A-5** Content repos follow `main`, recorded by SHA in the lock; agentic-sdlc pins a tag.
- **A-6** Nothing built or machine-dependent is committed: skills and agents are built at install, every citing component is rendered at install, and routes, Codex `AGENTS.md` and merged hooks are generated at install.
- **A-7** Characters are the budget unit; tokens are estimates.
- **A-8** A usage error exits 2, as in spec 021's interface catalog, so scripts can tell it from a failed check (exit 1).
- **A-9** `add <name> <source>` adds to the local list; `use <name> <source>` replaces the source of a name already known; both write only the local list.
- **A-10** A detected variable value is a proposal, never applied silently.
- **A-11** Uninstall keeps V's two local files and every `path` source folder.
- **A-12** "One release" means until the next tagged agent-config release after the one that adds the links (V's default at G2: compatibility links stay until the next tagged agent-config release).
- **A-13** Per-project enablement of agentic-sdlc uses links kept out of version control (blueprint open question 3 default); phase 7 may amend.
- **A-14** Whether Codex reads a linked `~/.codex/AGENTS.md` and `hooks.json` like real files, and how read permissions treat the linked home, are unconfirmed (P4); the spec requires only that Codex receives the current text.
- **A-15** Between phases the old installers keep working (FR-035); the exact order of the 484-line sorting relative to phase 2 is the plan's, but it precedes link retirement.
- **A-16** Repo names are `agent-knowledge`, `agent-companies` and `agentic-sdlc` (V's default at G2); renaming later changes only list entries.
- **A-17** `agent-companies` is public, so it may be listed in the public or the local list; a clone uses V's credentials if the host asks for them.
- **A-18** Unconfirmed, a P4 check on Codex with a cheap model: whether Codex has a session-start hook that can re-render (Claude Code and Copilot CLI have one, per the blueprint). Until confirmed, AC-16.8 requires the hook only for those two and `doctor` catches the rest.
- **A-19** Unconfirmed, a P4 check: whether VS Code's Markdown preview opens a relative `../x.md` target on click (its docs list relative links as valid but do not say they are clickable; `copilot/knowledge/documentation/markdown-link-targets-in-vscode.md`). The spec requires a valid relative target and a real-path text, not the click.
- **A-20** A rendered target is relative because VS Code resolves a target starting with `/` against the workspace root and a `C:\…` path is not a valid target; it is written with `/` separators and encoded spaces on every system. The link text keeps the system's own separators.
- **A-21** The allow-list for G13 holds only the core lines that name the placeholder itself (the one-line definition of `{{AGENT_HOME}}` and the `{{VAR}}` rule); the plan lists them by line.
- **A-22** Skill, agent and instruction files that need front matter on their first line keep it there; for them the generated-from line follows the front matter. The plan confirms per platform that the extra line is harmless (P4 check).
- **A-23** The provider's `repository` is a GitHub URL; other hosts are outside this feature.
- **A-24** Mentions of `{{AGENT_HOME}}/…` that are not Markdown links (code spans, prose) are either converted to citation links or rewritten by the renderer; the plan chooses, and AC-16.3 holds either way.
- **A-25** The three guards apply to rendered copies; generated-class files (routes, `global-variables.md`, Codex `AGENTS.md`, merged hooks) are protected by the hash check in `doctor` (AC-7.5).
- **A-26** The other unconfirmed items in the blueprint's assumptions are P4 checks on Codex and Copilot CLI with a cheap model, not spec criteria: Codex accepting Copilot-only skill fields, Copilot CLI applying `applyTo` to user instructions, VS Code's Local harness not reading `~/.copilot`, and whether a skill with `disable-model-invocation` costs nothing in Copilot's list.
- **A-27** From phase 5, `{{AGENT_HOME}}/companies/` and `{{AGENT_HOME}}/frameworks/<name>/` must show the rendered files of agent-companies and agentic-sdlc (the plan decides whether the path links to the copy or the copy sits there); `{{AGENT_HOME}}/knowledge/` links to the source because the knowledge base is not rendered. AC-10.3 needs only that `index.md` resolves.

## Clarifications for G2 (max 3, ranked by impact)

C-1 (company KB public), C-2 (repo names) and C-3 (compatibility-link length) are closed by V's G2 choices and now sit in A-16, A-12 and A-17. One new question remains.

1. **[NEEDS CLARIFICATION: C-4, the G4 ceiling after rendering.]** Rendering adds one generated-from line per rendered file and replaces the 14-character `{{AGENT_HOME}}` with a real path (29 characters for `/Users/vinh.doq/.agent-config`), so a rendered core can be longer than the phase-0 baseline even if no content grows. Options: A) measure the "≤ baseline" ceiling on the rendered text the agent receives, so any excess comes back to V (default; the honest measure) · B) measure on the source text and report the rendered growth separately (the ceiling then does not protect the agent's real cost) · Custom. Default: A.

## Self-check (SPEC rules)

- No implementation choices beyond the interface V sees (SPEC-1): the terms "git", "path", `--write` and the field names are interface; no language or library appears except the declared runtime.
- Every story has priority, rationale, an independent test and 5 to 10 scenarios with at least one failure case (SPEC-2, SPEC-3, SPEC-8); Story 16 is new.
- Every FR traces to a story; every story has an FR. Phases 1 and 3 to 8 are at outcome depth by design.
- One clarification marker (SPEC-7); assumptions A-1 to A-27 recorded (SPEC-6).
- Success criteria SC-001 to SC-015 give each live goal G1 to G13 a number and a check; G6 is dropped (SPEC-5, SPEC-11).
- Out of scope listed (SPEC-9); terms defined once (SPEC-10).
