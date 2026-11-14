# Phase 0 exit report (T089)

Spec: FR-043 ("each phase MUST end with the repo checks green before and after, and install plus `doctor` passing on Mac and Windows") and SC-013 ("after each phase, repo checks green and the previous phase's acceptance scenarios still pass").
Measured on commit 7946a50, macOS 26.1 on an Apple M2, Node 24.22.1, 2026-11-14. Nothing was fixed while writing this report.

## Criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `scripts/check-docs.sh` green | pass | `scripts/check-docs.sh; echo $?` printed `0`; last lines `811 scenarios (810 passed, 1 skipped)` |
| 2 | Golden plans unchanged, Mac and Linux | pass | `tests/installers/golden/posix/` last changed in c525693 (T036, the recording); `git diff b721101 HEAD -- installers mapping.yaml` shows only `installers/eslint.config.mjs`; scenarios "AC-1.9 The Mac plan equals the golden file darwin.txt" and "...Linux plan equals the golden file linux.txt" pass |
| 3 | Golden plan, Windows | open | `tests/installers/golden.feature:44` is `@windows @pending @T037 @T038`; it needs `golden/windows/windows.txt` from the Windows runner artifact (`golden-plan-windows`) |
| 4 | AC-1.1 to AC-1.9 scenarios pass | pass on Mac | `cucumber-js --format json`, scenarios whose title starts with the id, all passed, none failed or skipped: AC-1.1 22, AC-1.2 18, AC-1.3 2, AC-1.4 6, AC-1.5 6, AC-1.6 17, AC-1.7 33, AC-1.8 8, AC-1.9 4 (AC-1.9 has one more, the Windows scenario, which Mac leaves out by its tag) |
| 5 | Exempt ids among AC-1.1 to AC-1.9 | none | `grep "id: AC-1\." tests/coverage/exemptions.yaml` finds nothing; the exempt ids are AC-8.6, SC-002, AC-12.1, AC-14.2, AC-16.8, AC-2.2, AC-7.3, AC-12.3 and A-19 (and the others listed in the file), all of later phases |
| 6 | `docs/baselines/always-loaded.json` has method, tool version, date | pass | each of the three agents carries `"method"`, `"tool_version": "1"`, `"date": "2026-11-14"` and `"commit"`; `node contracts/tools/check-schemas.ts docs/baselines/always-loaded.json` printed `docs/baselines/always-loaded.json: ok` |
| 7 | Coverage check passes | pass | `node scripts/check-ac-coverage.ts --root . --delivered 0` printed `check-ac-coverage: 9 of 9 delivered ids covered or exempt` |
| 8 | Fitness check at its baseline | pass | `node scripts/check-fitness.ts --root .` printed `check-fitness: counts equal the baseline` |
| 9 | Mutation proof of each new check (QB-7) | pass | `research.md`, section "QB-7 mutation proof (T087)": 16 mutations, each caught |
| 10 | Test run time within budget (QB-6) | pass on Mac | constitution "Test run time": unit layer median 2.2 s of 60 s, scenario layer median 29.4 s of 3 min |
| 11 | Install and `doctor` on Mac | pass, nothing installed changed | phase 0 changes no installed path: item 2; the new `doctor` does not exist before phase 2 |
| 12 | Install and `doctor` on Windows | open | needs the `installer (windows)` job |

## Open items for V or the CI runner

1. Make the matrix jobs `installer (macos)` and `installer (windows)` required checks on main (a human step in the repository settings, from phase 2 as `installer.yml` says).
2. T037 and the Windows leg of T038: run `installer.yml` once, take the artifact `golden-plan-windows`, commit it as `tests/installers/golden/windows/windows.txt`, then remove `@pending @T037 @T038` from `tests/installers/golden.feature:44`.
3. T044: the Windows probes of `copilot/knowledge/js-runtime/windows-home-links-and-modes.md` (home from `USERPROFILE`, symbolic link and junction without elevation, rename over a directory link, read-only attribute) were not run; the doc lists the five checks for the runner.
4. The Linux and Windows run times of the constitution table ("to be measured on the CI runner (T085)").
5. Checked: the three pinned SHAs in `installer.yml` match their tags on GitHub (`git ls-remote --tags`, 2026-11-14): `actions/upload-artifact` v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9`, `actions/checkout` v7.0.1 `3d3c42e5…`, `actions/setup-node` v7.1.0 `949feb24…`. Closed.
6. The pending guard also needs the tasks listed on `tests/coverage/coverage.feature:120` ticked before that scenario is un-pended (T038 included).
