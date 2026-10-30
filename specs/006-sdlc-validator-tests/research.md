# Research: Executable scenarios for the agentic-sdlc framework validator

`--upstream` uses `GITHUB_API_URL` for the same reasons as the procedures validator: `specs/004-procedures-validator-tests/research.md`, DR-005.

## Findings: behavior pinned as it is, for a decision

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | (all) | The printed check codes (`CONV`, `TREE`, `IDS`, `RULE`, `SRC`, `FND`, `STACK`, `REF`, `IDIOM`, `FW`, `PDM`, `ROLE`, `CITE`, `V6`, `INDEX`, `SCHEMA`, `WRAP`, `SKILL`) are not rule ids; the framework schemas list their checks in "Checks" tables without ids. | The traceability gap fixed for the knowledge validator in specs/002. | A. Keep. B. Give each schema's checks ids and print them (recommended). |
| F-2 | CONV a role entry without an id fails | A role with no id also produces `ROLE … ≠ conventions undefined`, three `missing wrapper …/sdlc-undefined…` and `missing skills/sdlc-undefined-preset`. | Five follow-on errors about a role called "undefined" hide the one real problem. | A. Keep. B. Drop roles without an id after reporting them (recommended). |
| F-3 | SRC a Source that does not exist warns | A rule whose `Source` path does not exist only warns: `checkRules` has a `needSource` switch that would fail, but no caller turns it on. | A dead branch; a broken citation never fails the build. | A. Remove the switch and keep the warning. B. Fail for foundations and paradigms (recommended; the repo has no such case today). |
| F-4 | ROLE a tag that differs from conventions fails | The message shows `tag Dev ≠ conventions [Eng]`: the front-matter parser turns `"[Dev]"` into a list. | The message hides the brackets the author wrote. | A. Keep. B. Print the raw value (recommended). |
| F-5 | RULE a rule id defined twice fails | The follow-on warning lists `DEM-1, DEM-1`. | Duplicate ids repeated in the list. | A. Keep. B. List each id once. |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass | `pnpm test` on Node 24.22.1 | 124 agentic-sdlc scenarios pass (283 in the suite) |
| Every check is guarded | Each of the 120 `fail(`/`warn(` calls replaced by a no-op in turn | 120 of 120 caught |
