# Research: Run the tool scenarios with Cucumber.js

## DR-003: How the scenarios are run
- **Tree path:** none (test tooling has no framework tree; options compared directly)
- **Criteria:** V asked for an official, standard runner installed with pnpm. Cucumber.js is the Cucumber project's own JavaScript implementation of Gherkin. Version 13.3.0 (2026-10-05) declares Node `22 || 24 || >=26` ([package.json at v13.3.0](https://github.com/cucumber/cucumber-js/blob/v13.3.0/package.json)) and reads `cucumber.mjs` with `paths`, `import`, `format`, `strict`, `parallel` ([configuration docs](https://github.com/cucumber/cucumber-js/blob/main/docs/configuration.md)).
- **Options considered:** A. Keep the home-made runner on `node:test` | B. Cucumber.js with pnpm | C. Another Gherkin runner on top of Vitest or Jest
- **Chosen:** B — the official runner, full Gherkin, strict by default, parallel workers; the feature files did not change.
- **Rejected:** A — V asked for a standard tool, and the runner was code to maintain; C — adds a general test framework plus a plugin, when no unit tests exist here to share it with.
- **Confidence:** high
- **Supersedes:** DR-001 (`specs/001-knowledge-validator-tests/research.md`)
- **Decided by:** human (V) · **Approved at:** G3 (2026-10-29)

## DR-004: How CI installs pnpm
- **Tree path:** none
- **Criteria:** The typescript-node stack's CI template, used by the reference repo, runs `corepack enable && pnpm install --frozen-lockfile` and takes the pnpm version from `packageManager`.
- **Options considered:** A. corepack, as the stack template does | B. `pnpm/action-setup` (v6.1.0, pinned by SHA)
- **Chosen:** A — one way of installing pnpm across this repo and the reference repo, with no extra action to pin and update.
- **Rejected:** B — a second third-party action to keep pinned, for the same result.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (2026-10-29)

## Verification

| What | How | Result |
|---|---|---|
| The 001/002 scenarios under Cucumber | `pnpm test` on Node 24.22.1 | 71 of 71 pass in about 1 s (4 workers) |
| An undefined step fails the run | A scratch feature with `When something nobody defined`, run with `cucumber.js` | exit 1 |
| Foundry validator in `check-docs.sh` | Ran it on the repo | `agent-foundry: 0 failure(s), 0 warning(s)` |
