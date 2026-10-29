# Research: Executable scenarios for the Agent Foundry validator

## Findings: behavior pinned as it is, for a decision

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | (all) | The validator prints check codes (`FM`, `FLOOR`, `CHARTER`, `TREE`, `LESSON`, `WAIVER`, `ZONES`, `RULES`) that are not rule ids: the foundry schemas list their checks in "Checks" tables without ids. | The same traceability gap as knowledge finding F-3 (fixed in specs/002): an output line cannot be traced to a written rule. | A. Keep. B. Give each schema's checks ids (e.g. `CH-1`, `LS-1` … per schema) and print them, as specs/002 did (recommended). |
| F-2 | LESSON a missing key fails | A missing `confidence` (also `status`, `polarity`) prints two lines: `"confidence" missing` and `confidence must be high|medium|low`. | One problem, two messages; the second is noise. | A. Keep. B. Skip the value check when the key is missing (recommended). |
| F-3 | LESSON a duplicate id in one lens fails | The duplicate message names only the second file, not the one that already holds the id. | The author has to search for the other file. | A. Keep. B. Name both files (recommended). |
| F-4 | (all) | Output format differs from the other three validators: `FAIL CODE: msg` and a summary last, instead of a header, `  CODE  msg` lines and `PASS`/`FAIL (n)`. | Readers and tools (hooks, CI logs) see two formats. | A. Keep. B. Use the shared format (recommended, with F-1). |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass | `pnpm test` on Node 24.22.1 | 51 foundry scenarios pass (159 in the suite) |
| Every check is guarded | Each of the 49 `fail(`/`warn(` calls replaced by a no-op in turn | 49 of 49 caught |
