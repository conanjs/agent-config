# Specs: agent-config's own changes

One folder per change, made with Spec Kit (`copilot/procedures/spec-driven-development.procedure.md`) under `.specify/memory/constitution.md`. Design notes written before Spec Kit was adopted stay in `proposals/` (legacy, not retrofitted).

## Index

| Spec | What it changed | Status | Open findings |
|---|---|---|---|
| [001](001-knowledge-validator-tests/) | Knowledge validator pinned as Gherkin scenarios (characterization tests) | Done | none (F-1 … F-4 fixed by 002) |
| [002](002-knowledge-validator-findings/) | Knowledge validator prints rule ids; F-1 … F-4 fixed | Done | none |
| [003](003-cucumber-runner/) | Scenarios run by Cucumber.js via pnpm; shared step library | Done | none |
| [004](004-procedures-validator-tests/) | Procedures validator scenarios; `--upstream` reads `GITHUB_API_URL` | Done | F-1, F-2 |
| [005](005-foundry-validator-tests/) | Agent Foundry validator scenarios | Done | F-1 … F-4 |
| [006](006-sdlc-validator-tests/) | agentic-sdlc framework validator scenarios; `GITHUB_API_URL` | Done | F-1 … F-5 |
| [007](007-project-validator-tests/) | Project validator scenarios, incl. the git-based `--task` scope check | Done | F-1, F-5, F-6 (F-2 … F-4 fixed by 010) |
| [008](008-installer-tests/) | Bash installer scenarios | Done | F-1 … F-3 |
| [009](009-navigation-map/) | Navigation map (option B) and a new coordinator role, covering agent-config and the reference repos | Clarified, ready to plan | — |
| [010](010-project-validator-bugs/) | Project validator: `Decided by` checked; continuation line read field by field | Done | none |

## Open findings, by kind

Each finding is pinned by a scenario as it is today; fixing one is its own spec that edits that scenario first.

| Kind | Findings | Recommended |
|---|---|---|
| **Traceability: printed codes are not rule ids** | 005/F-1 (foundry), 006/F-1 (framework), 007/F-1 (project) — fix before or with 009, whose registry names each kind's validator checks | One spec per validator, as 002 did for knowledge: give each schema's checks ids and print them |
| **Misleading or duplicated messages** | 005/F-2 two lines for one missing key; 005/F-3 a duplicate id names one file; 006/F-2 a role without an id cascades into "undefined"; 006/F-4 tag shown without brackets; 006/F-5 repeated ids; 007/F-5 a missing decision reported twice; 007/F-6 doubled quotes | One clean-up spec per validator |
| **Weak or silent checks** | 004/F-1 PR-3 accepts any URL; 004/F-2 `--max-age abc` silently disables PR-4; 006/F-3 a missing rule Source only warns (dead `needSource`); 008/F-3 a missing mapping source leaves a dangling symlink | Decide each: fail, or keep as a warning |
| **Coverage gaps** | 008/F-1 the PowerShell installers need a Windows runner; 008/F-2 the README promises Linux, but `linux/install.sh` is a stub | A `windows-latest` CI job; make Linux run the macOS body |
| **Consistency** | 005/F-4 the foundry validator's output format differs from the other three | With 005/F-1 |
