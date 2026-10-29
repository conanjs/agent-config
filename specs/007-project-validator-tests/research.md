# Research: Executable scenarios for the project validator

## Findings: behavior pinned as it is, for a decision

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | (all) | The printed codes (`ARCH`, `INT`, `SECRET`, `CONST`, `BP`, `DR`, `TASK`, `TREE`, `RULE`, `LINT`, `SCOPE`) are not rule ids; the store-D schemas list their checks without ids. | The same traceability gap fixed for the knowledge validator in specs/002. | A. Keep. B. Give each schema's checks ids and print them (recommended). |
| F-2 | DR a Decided by that is not a role or human is not caught today | The `Decided by` check never runs: its regex `^- \*\*Decided by:\*\*` has no `m` flag, so `^` only matches at the start of the record body. | **Bug.** A decision record decided by an unknown role passes. | B. Add the `m` flag; the scenario then expects the failure (recommended). |
| F-3 | TASK an empty refs is misread as the procedure field; TASK an invalid hot-path value is swallowed into refs | The continuation line is parsed by one regex with a lazy `refs` group and optional `procedure`/`hot-path` groups. When `refs` is empty or `hot-path` is not `yes`/`no`, the rest of the line becomes the refs path. | **Bug.** The author sees "refs path · procedure: demo/add-entity does not exist" instead of the real problem. | B. Split the line on ` · ` into `key: value` fields and check each (recommended). |
| F-4 | (same as F-3) | The `hot-path must be yes or no` check is unreachable, because the line pattern already rejects other values. | Dead code that looks like a guard. | Fixed by F-3's parser. |
| F-5 | ARCH a component decision that does not exist fails | A missing decision is reported twice: once where it is cited (§3 or §8) and once by a final loop over all architecture decision refs. | One problem, two lines. | B. Remove the final loop (recommended). |
| F-6 | LINT a lint config without a required entry fails | A requirement written with quotes in `lint-baseline` is printed with doubled quotes: `lacks ""no-deep-imports""`. | Noise in the message. | B. Strip one layer of quotes when printing. |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass | `pnpm test` on Node 24.22.1 | 90 project scenarios pass (373 in the suite) |
| Every check is guarded | Each of the 83 `fail(`/`warn(` calls replaced by a no-op in turn | 81 caught; the 2 survivors (lines 509 and 598) can never fire (F-2, F-4) |
