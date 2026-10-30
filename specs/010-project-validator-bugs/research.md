# Research: Fix the two project-validator bugs

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | The 3 pinned-as-found scenarios rewritten to the correct behavior, 3 added; run against the old validator | 4 failed (as intended), 2 passed |
| After the fix | `pnpm test` on Node 24.22.2 | 389 of 389 pass; no other scenario changed |
| Every check is guarded | Each of the 83 `fail(`/`warn(` calls replaced by a no-op in turn | 83 of 83 caught (was 81) |
| git's stderr (US3) | Scenario changed first (red), then git run with `stdio: ['ignore', 'pipe', 'pipe']` and its first stderr line in the message | green locally (Apple Git 2.50.1); the CI run on `ubuntu-latest` is the second git version |
| Real projects | The fixed validator on the typescript-node reference repo (`feat/v4.1-comments`, `test/script-scenarios`, `layout/layer-first`) | 3 failures on each: DR-002, DR-003, DR-004 say `Decided by: owner (V)`, which the decision-record schema does not allow (`<role id \| human>`). The old bug hid them since spec 001. Fixed in the reference repo as `human` |
