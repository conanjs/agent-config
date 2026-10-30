# Research: Executable scenarios for the procedures validator

## DR-005: How `--upstream` is tested
- **Tree path:** none
- **Criteria:** PR-5 called `https://api.github.com` directly, so a scenario could only test it against the live API. GitHub Actions sets `GITHUB_API_URL` to the REST API base URL ([Variables reference](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)), which is also how GitHub Enterprise Server runners reach their own API.
- **Options considered:** A. Read `GITHUB_API_URL`, default `https://api.github.com` | B. A test-only flag such as `--api-url` | C. Leave PR-5 untested
- **Chosen:** A — the standard variable, useful outside tests too (Enterprise), and no new flag.
- **Rejected:** B — a flag only tests use; C — PR-5 would stay the one unguarded check.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G3 (2026-10-29)

## Findings: behavior pinned as it is, for a decision

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | PR-3 a dependency with no external source in References fails | PR-3 passes when References holds any `http(s)://` link, even one unrelated to the dependencies. | The schema asks References to list the external sources of `depends-on`; one unrelated link satisfies the check. | A. Keep it. B. Require each dependency's `source` URL in References (recommended). |
| F-2 | (none) | `--max-age abc` gives `NaN`, so the age comparison is always false and PR-4 age warnings silently stop. | A typo turns the check off without saying so. | A. Keep it. B. Fail with a usage message when `--max-age` is not a positive number (recommended). |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass | `pnpm test` on Node 24.22.1 | 37 procedures scenarios pass (108 in the suite) |
| Every check is guarded | Each of the 27 `fail(`/`warn(` calls replaced by a no-op in turn, scenarios run | 27 of 27 caught |
| `GITHUB_API_URL` | PR-5 scenarios against a local server | newer release warns; 404 warns; unreachable warns; same version passes |
