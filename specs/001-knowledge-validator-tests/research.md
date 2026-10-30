# Research: Executable scenarios for the knowledge validator

## DR-001: How the scenarios are written and run
- **Tree path:** none (test tooling has no framework tree; options compared directly)
- **Criteria:** The validators run on plain Node ≥ 18 and the repo has no `package.json` (constitution, FR-007). The scenarios must be readable without code (US2). `node:test` is built into Node, and `node --test` takes glob patterns as arguments ([Node.js test runner docs](https://nodejs.org/api/test.html#running-tests-from-the-command-line)).
- **Options considered:** A. Gherkin feature file, read by a small runner of our own on `node:test` | B. Cucumber.js with the same feature file | C. Scenarios as a data table inside a `node:test` file | D. Snapshot files (`t.assert.snapshot`)
- **Chosen:** A — the scenarios stay in standard Gherkin, and nothing needs installing.
- **Rejected:** B — needs `npm install` and a `package.json` in a repo whose tools have no dependencies; it is the upgrade path if the Gherkin subset ever gets too small, because the feature file would not change; C — readable only as code, which leaves US2 unmet; D — the expected output moves to a separate generated file, so a reviewer cannot read the requirement next to its steps, and regenerating snapshots invites blind updates.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G3 (2026-10-29)
- **Superseded by:** DR-003 in `specs/003-cucumber-runner/research.md` (V chose option B, Cucumber.js with pnpm, 2026-10-29)

## DR-002: Where the scenarios and fixtures live
- **Tree path:** none
- **Criteria:** `copilot/frameworks/` is linked into `~/.copilot/` by `mapping.yaml`, so anything placed there is installed on every machine. The real validator must never read the fixtures (spec, Edge cases).
- **Options considered:** A. `tests/<tool>/` at the repo root | B. `copilot/frameworks/knowledge/tools/test/`, next to the tool
- **Chosen:** A — tests are not installed, and the repo root is where JavaScript projects keep them.
- **Rejected:** B — it would install the fixtures and runner into `~/.copilot/frameworks/` on every machine.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G3 (2026-10-29)

## Findings: behavior pinned as it is, for a decision

These scenarios record what the validator did on 2026-10-29. The items below look questionable. They are **not** changed here (FR-008); each needs its own spec if V decides to change it.

**Outcome:** V chose to fix all four ("Fix all of them", 2026-10-29), each with the recommended option (B for F-1, F-2, F-4; A for F-3). Done in `specs/002-knowledge-validator-findings/`.

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | IDX a subtopic with its own subfolder fails | A subtopic index with a subfolder gets two failures: "subfolders nest at most one level deep" and "subfolder … not listed in Subtopics". | The second failure asks the author to list a subfolder that the first failure says must not exist. | A. Keep both lines. B. Report only the nesting failure for a subtopic. |
| F-2 | KB-8 a paragraph directly under its heading is not compared | The repeated-paragraph check splits text on blank lines and skips chunks that start with `#`. A paragraph with no blank line after its heading joins the heading's chunk, so it is never compared. | A repeated paragraph slips through when it sits right under a heading. | A. Keep it (the check is a heuristic warning). B. Drop heading lines before splitting into paragraphs. |
| F-3 | (all) | The validator prints `VS` for the rule the schema calls `KD-9`, and `KD-4` where `_system.md` also has `KB-4` for the same Used by check. `FM`, `HEAD`, `REF` and `IDX` are printed but have no rule id in any schema; `FM-KEYS` is named in `_system.md` but not as a rule row. | A reader cannot go from an output line to the written rule, which is the traceability gap this feature exists to close. | A. The validator prints the schema ids (`KD-9`, …) and the schemas gain rows for FM, HEAD, REF, IDX: changes output, so it is a new spec that edits these scenarios (recommended). B. Keep the codes and add a code → rule table to the feature file header. |
| F-4 | VS ✅ marks inside a fenced code block are counted as claims | The claim count is taken from the body with only the Verification status and References sections removed, so a ✅ quoted inside a code block counts as a claim. Found when a knowledge doc quoted a scenario containing ✅. | A doc that quotes ✅ in code gets a false VS warning, and its author is pushed to write a wrong count. | A. Keep it. B. Count claims outside fenced blocks only (recommended). |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass on the current validator | `node --test 'tests/**/*.test.mjs'` on Node 24.22.1 | 69 of 69 pass (68 scenarios, 1 coverage check) in about 2.6 s |
| Every check is guarded (SC-002) | A one-off script replaced each `fail(`/`warn(` call in the validator with a no-op, one at a time, and ran the scenarios | 61 call sites, all 61 caught by at least one failing scenario; the validator was restored unchanged |
| `node --test <folder>` | Ran `node --test tests/` on Node 24.22.1 | It fails with `Cannot find module '…/tests'`: the documented arguments are glob patterns, not folders. `check-docs.sh` passes the test files found by `find`, which does not depend on glob support |
