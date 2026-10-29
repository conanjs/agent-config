# Requirements for copilot/procedures/tools/validate-procedures.mjs, as executable scenarios (specs/004).
# Each scenario title starts with the rule it covers; the rules are the PR-n rows of copilot/procedures/procedure.schema.md.
#
# Change policy (constitution principle IV): a changed rule edits its scenario in the same commit as the validator;
# a new rule adds scenarios and every existing one keeps passing. Output text is compared exactly.
#
# Characterization tests: first written to pin what the validator did on 2026-10-29. Questionable behavior is listed
# in specs/004-procedures-validator-tests/research.md. A last-verified date of 2999-12-31 keeps the age check (PR-4)
# out of scenarios that are not about it; "(N days ago" stands for the day count, which changes daily.

Feature: Procedures validator
  The validator checks every *.procedure.md under a procedures folder against procedure.schema.md.
  It exits 1 when a check fails and 0 otherwise; warnings never fail the run.

  Background:
    Given the base fixture tree of "validate-procedures"

  Scenario: The base fixture tree passes with no warnings
    When the tool runs
    Then it passes with no warnings

  # ---- PR-1: front-matter ------------------------------------------------------------------------

  Scenario: PR-1 a procedure without front-matter fails and skips its other checks
    Given in "procedures/simple.procedure.md", `---\nschema: procedure/v1\nlast-updated: 2026-10-01\ndepends-on: []\n---\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-1  simple.procedure.md: no front-matter (needs schema: procedure/v1)
      """

  Scenario: PR-1 a schema other than procedure/v1 fails
    Given in "procedures/simple.procedure.md", `schema: procedure/v1` becomes `schema: procedure/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-1  simple.procedure.md: schema must be procedure/v1
      """

  Scenario: PR-1 a front-matter key the schema does not define fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on: []\nowner: me`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-1  simple.procedure.md: front-matter key "owner" is not defined (allowed: schema, last-updated, last-verified, depends-on, stack, inputs, allowed-paths)
      """

  Scenario: PR-1 a last-updated date not in YYYY-MM-DD form fails
    Given in "procedures/simple.procedure.md", `last-updated: 2026-10-01` becomes `last-updated: 1 Oct 2026`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-1  simple.procedure.md: last-updated must be YYYY-MM-DD
      """

  Scenario: PR-1 a last-verified date not in YYYY-MM-DD form fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on: []\nlast-verified: soon`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-1  simple.procedure.md: last-verified must be YYYY-MM-DD
      """

  # ---- PR-2: depends-on ----------------------------------------------------------------------------

  Scenario: PR-2 a missing depends-on fails and skips the later checks
    Given in "procedures/simple.procedure.md", `depends-on: []\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on missing (use [] when the procedure states no external tool behaviour)
      """

  Scenario: PR-2 a verified dependency passes
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs
    Then it passes with no warnings

  Scenario: PR-2 a dependency key the schema does not define fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `    repo: demo/cli` becomes `    repo: demo/cli\n    license: MIT`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on Demo CLI: unknown key "license"
      """

  Scenario: PR-2 a dependency without a source fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `    source: https://example.com/docs\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on Demo CLI: "source" missing
      """

  Scenario: PR-2 a dependency without a tool name fails and is named "(no tool)"
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `  - tool: Demo CLI\n    verified-against` becomes `  - verified-against`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on (no tool): "tool" missing
      """

  Scenario: PR-2 a source that is not a URL fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `source: https://example.com/docs` becomes `source: the docs`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on Demo CLI: source must be a URL
      """

  Scenario: PR-2 a repo that is not owner/name fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `repo: demo/cli` becomes `repo: https://github.com/demo/cli`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: depends-on Demo CLI: repo must be owner/name
      """

  Scenario: PR-2 a verified dependency without last-verified fails
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `last-verified: 2999-12-31\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-2  simple.procedure.md: a dependency has verified-against set, so last-verified is required
      """

  # ---- PR-4: freshness (warnings) ------------------------------------------------------------------

  Scenario: PR-4 an unverified dependency warns
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: unverified\n    source: https://example.com/docs`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  PR-4  simple.procedure.md: Demo CLI has never been verified against its source; verify and record the version
      PASS (1 warning(s))
      """

  Scenario: PR-4 a last-verified date older than 90 days warns
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `last-verified: 2999-12-31` becomes `last-verified: 2000-01-01`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  PR-4  simple.procedure.md: last verified 2000-01-01 (N days ago, > 90); re-check every depends-on source
      PASS (1 warning(s))
      """

  Scenario: PR-4 --max-age changes the age limit
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    And in "procedures/simple.procedure.md", `last-verified: 2999-12-31` becomes `last-verified: 2000-01-01`
    When the tool runs with "--max-age 1000000"
    Then it passes with no warnings

  # ---- PR-3: title and sections --------------------------------------------------------------------

  Scenario: PR-3 a title without "Procedure:" fails
    Given in "procedures/simple.procedure.md", `# Procedure: Simple` becomes `# Simple`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-3  simple.procedure.md: title must be "# Procedure: <name>"
      """

  Scenario: PR-3 a missing Steps section fails and lists the sections found
    Given in "procedures/simple.procedure.md", `## Steps` becomes `## How`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-3  simple.procedure.md: needs sections "## Steps", "## References", "## Related" (has: How, References, Related)
      """

  Scenario: PR-3 Related not last fails
    Given in "procedures/simple.procedure.md", `## Related\n- _None._` becomes `## Related\n- _None._\n\n## Notes\nMore.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-3  simple.procedure.md: order must be Steps … References → Related, with Related last
      """

  Scenario: PR-3 References before Steps fails
    Given in "procedures/simple.procedure.md", `## Steps\n1. Do the one thing.\n\n` becomes ``
    And in "procedures/simple.procedure.md", `## Related` becomes `## Steps\n1. Do the one thing.\n\n## Related`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-3  simple.procedure.md: order must be Steps … References → Related, with Related last
      """

  Scenario: PR-3 a dependency with no external source in References fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-3  demo-stack/add-thing.procedure.md: depends-on is not empty, so References needs the external sources
      """

  # ---- PR-7: stack procedures ----------------------------------------------------------------------

  Scenario: PR-7 a stack that differs from the folder fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `stack: demo-stack` becomes `stack: other`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: stack must be "demo-stack" (its folder)
      """

  Scenario: PR-7 an input that is not kebab-case fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `inputs: [name, module?]` becomes `inputs: [Name, module?]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        PR-7  demo-stack/add-thing.procedure.md: inputs must be a list of kebab-case names, a trailing ? for optional ([] if none)
        PR-7  demo-stack/add-thing.procedure.md: input "Name" is not described under **Inputs needed:** as **Name**
        PR-7  demo-stack/add-thing.procedure.md: allowed-paths src/{module}/{name}.ts uses {name}, which is not a declared input
      """

  Scenario: PR-7 an empty allowed-paths fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `allowed-paths: [src/{module}/{name}.ts]` becomes `allowed-paths: []`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: allowed-paths must be a non-empty list of repo-relative globs
      """

  Scenario: PR-7 an allowed path that leaves the component fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `allowed-paths: [src/{module}/{name}.ts]` becomes `allowed-paths: [../src/{name}.ts]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: allowed-paths must be a non-empty list of repo-relative globs
      """

  Scenario: PR-7 a stack procedure missing from its folder's index fails
    Given in "procedures/demo-stack/index.md", `- [add-thing.procedure.md](add-thing.procedure.md) — add one thing to a module.` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: not listed in demo-stack/index.md (the planner's catalog)
      """

  Scenario: PR-7 an input not described under Inputs needed fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `- **module** — the module folder; optional.` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: input "module" is not described under **Inputs needed:** as **module**
      """

  Scenario: PR-7 an allowed-paths placeholder that is not an input fails
    Given in "procedures/demo-stack/add-thing.procedure.md", `src/{module}/{name}.ts` becomes `src/{module}/{kind}.ts`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  demo-stack/add-thing.procedure.md: allowed-paths src/{module}/{kind}.ts uses {kind}, which is not a declared input
      """

  Scenario: PR-7 stack keys outside a stack folder fail
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on: []\nstack: demo-stack`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PR-7  simple.procedure.md: stack, inputs and allowed-paths belong only to procedures under procedures/<stack>/
      """

  # ---- PR-5: upstream drift (--upstream, warnings) -------------------------------------------------

  Scenario: PR-5 the same upstream version passes
    Given a local web server that answers:
      """
      /repos/demo/cli/releases/latest 200 {"tag_name":"v1.0.0"}
      """
    And in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs with "--upstream"
    Then it passes with no warnings

  Scenario: PR-5 a newer upstream release warns
    Given a local web server that answers:
      """
      /repos/demo/cli/releases/latest 200 {"tag_name":"v1.1.0"}
      """
    And in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  PR-5  simple.procedure.md: Demo CLI verified against v1.0.0, upstream latest is v1.1.0; re-verify the procedure
      PASS (1 warning(s))
      """

  Scenario: PR-5 an upstream error status warns
    Given a local web server that answers:
      """
      /repos/other/thing/releases/latest 200 {"tag_name":"v1.0.0"}
      """
    And in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  PR-5  simple.procedure.md: demo/cli latest release → HTTP 404
      PASS (1 warning(s))
      """

  Scenario: PR-5 an unreachable upstream warns
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  PR-5  simple.procedure.md: demo/cli → TypeError: fetch failed
      PASS (1 warning(s))
      """

  Scenario: PR-5 upstream is not asked without --upstream
    Given in "procedures/simple.procedure.md", `depends-on: []` becomes `depends-on:\n  - tool: Demo CLI\n    verified-against: v1.0.0\n    source: https://example.com/docs\n    repo: demo/cli\nlast-verified: 2999-12-31`
    When the tool runs
    Then it passes with no warnings

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every rule code the validator prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature

  Scenario: Every rule code the validator prints is a rule in the procedure schema
    Then every rule code the tool prints is a rule row in its schemas
