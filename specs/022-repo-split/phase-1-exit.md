# Phase 1 exit report (T116)

Spec: FR-043 ("each phase MUST end with the repo checks green before and after, and install plus `doctor` passing") and SC-013 ("after each phase, repo checks green and the previous phase's acceptance scenarios still pass"); plan.md phase 1 exit row.
Measured on the uncommitted phase 1 work tree on top of b1f4315, macOS, Node 24.22.1, 2026-11-16. Nothing was fixed while writing this report.

## Criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `scripts/check-docs.sh` green | pass | exit `0`; `894 scenarios (873 passed, 21 skipped)`; the 21 skipped are `@pending` |
| 2 | Same suite with the pending scenarios run (`RUN_PENDING=1`) | pass | `894 scenarios (894 passed)`, so the phase 1 real-tree scenarios that carry `@pending` (T097, T102 to T113) also pass |
| 3 | Fitness count is 0 and on for good (AC-9.1, SC-012) | pass | `node scripts/check-fitness.ts --root .` prints `counts equal the baseline` and `3 hard-zero counts are 0`; `docs/baselines/fitness.json` lists the three counts under `hard-zero` and records 0 (was 117 lines, 72 files, 1 check); the mutation proof (research.md, T115) shows the check fails when switched off in the code, in the baseline, or when one mention is added |
| 4 | AC-9.1 to AC-9.8 scenarios pass | pass | scenarios whose title names the id, all passed, none failed: AC-9.1 29, AC-9.2 4, AC-9.3 5, AC-9.4 3, AC-9.5 3, AC-9.6 4, AC-9.7 1, AC-9.8 8; also AC-6.5 8, AC-4.8 8, SC-012 2 (the AC-9.8, AC-6.5 and AC-4.8 outline rows count once per title) |
| 5 | Phase 0 scenarios pass unchanged (QB-5) | pass | no phase 0 feature file differs from b1f4315: `git diff b1f4315 --stat -- tests/installers tests/fitness/fitness.feature tests/coverage tests/contracts tests/baseline tests/repo-layout tests/support tests/atlas` is empty. Changes to older tests, each with its reason, below |
| 6 | Install difference empty | pass | `git diff b1f4315 --stat -- installers mapping.yaml tests/installers` is empty; the scenarios "AC-1.9 The Mac plan equals the golden file darwin.txt" and "...Linux plan equals the golden file linux.txt" pass. The installed set of links is unchanged; the content behind two links changes by design: the core instructions (T101) and the knowledge docs (T102 to T112) |
| 7 | Coverage check | pass | `node scripts/check-ac-coverage.ts --root . --delivered 0,1` prints `17 of 17 delivered ids covered or exempt`. `check-docs.sh` still passes `--delivered 0`; see open item 1 |
| 8 | Mutation proof of each new check (QB-7) | pass | research.md, "QB-7 mutation proof, phase 1 (T115)": 19 mutations, each caught, `check-docs.sh` exit 1 each time |
| 9 | Install and `doctor` on Mac and Windows | n/a | phase 1 changes no installer; `doctor` does not exist before phase 2; the Windows golden is still open from phase 0 |

## Changes to tests that existed before phase 1 (QB-5)

| File | Change | Reason |
|---|---|---|
| `tests/validate-knowledge/validate-knowledge.feature` | 4 KD-4 scenarios and 1 KB-2 scenario deleted; the KD-1 message shows `Used by?`; 7 AC-9.2 and AC-9.4 scenarios added | the Used by rule, the backlink scan and the deny-list check no longer exist (T097) |
| `tests/validate-knowledge/tool.mjs` | no longer passes `--sdlc` and `--companies`; drops the test-only `--only-knowledge` | the validator takes neither argument any more |
| `tests/validate-sdlc/validate-sdlc.feature` | scenario "SRC a Source that does not exist warns" removed (now AC-9.3 fails); "WRAP without the agent-config repo..." rewritten for `--adapters`; usage-error and AC-9.3 scenarios added | T099: the knowledge root and the adapter map are arguments, an unresolved citation fails |
| `tests/validate-sdlc/tool.mjs`, `fixtures/base/repo/adapters.json` | passes `--knowledge` and `--adapters` by default | same |
| `scripts/check-docs.test.ts` | `stepLine('contracts/tools/build.ts')` became `'... layout'`; 3 tests added | a second `build.ts` line exists now |
| `contracts/tools/build.test.ts` | the "not a subcommand" example uses `build`; the help text no longer lists `cite` as not built | `cite` is built (T100) |
| `scripts/check-fitness.test.ts` | 3 tests added | `hard-zero` (T113) |

## Phase 1 end value of the core text (AC-8.6)

`copilot/instructions/core.instructions.md`, 4698 characters (4511 at the end of phase 0, +187 for the three lines of T101).

| Point | sha256 |
|---|---|
| End of phase 0 (b1f4315) | `f99360bee4f19d3c29fcf775b1b1f1e82474dc8f0a82b9097ae894230ae6a87a` |
| End of phase 1 (this tree) | `55e4011442b2817c2af3961bd2a047a4084e93b81e97c8dec34efb943b270c1e` |

The difference is allowed because phase 1's pull request names the core change that caused it: T101 (the `{{AGENT_HOME}}` definition line, "read the resolved file on this machine and never fetch it", the line on `add`, `use` and approvals). Phase 2 compares its own hash with the phase 1 value; it is a hash of the file bytes, so the phase 2 move must keep the bytes.

## Open items

1. `scripts/check-docs.sh` runs `check-ac-coverage.ts --delivered 0`; the AC-9.x ids are only checked when it is `0,1`.
2. When T097 and T102 to T113 are ticked in tasks.md, remove the `@pending` tags from `tests/fitness/phase1.feature`, or the pending guard fails the run.
3. Stale text: `copilot/atlas/atlas.yaml:182` and the generated `copilot/atlas/index.md:139` still say the doc's Used by is checked by `validate-knowledge.mjs KD-4`.
4. Four deep dives now print DD-4 "re-synthesize" warnings because their `last-updated` moved to 2026-11-14.
5. Knowledge docs still point into the framework without the word `agentic-sdlc` (for example `foundations/design/module-boundaries.md` in `screaming-architecture-deep-dive.md:113` and `clean-architecture-deep-dive.md:780`, `stacks/typescript-node/idioms.md` in `subpath-imports.md:17`, `foundations/code/comments.md` in `doc-comments.md:17`); the count does not see them.
