# Requirements for the layout subcommand of contracts/tools/build.ts (specs/022 T051, written before the tool, which
# T076 and T077 build). Covers FR-012: repo-layout/v1 is checked in report mode against agent-config, so findings are
# listed and never fatal there; outside report mode a finding is fatal (the contract is blocking in each new repo).
# Fixture: a repository that has every required entry of repo-layout/v1.
#
# Flags: `layout [--report] [--repo <name>] --root <dir>`. --report lists findings and exits 0; without it a finding exits 1.
# --repo <name> names the repository for its exceptions (agent-config); --root is the folder to check.
# The generated-from line is written by the render rules of T057 (contracts/lib/render-rules.ts); its text is the one of
# AC-16.4 and rendered-copy-v1.md: Generated from `<source path>`; edit that file, not this copy. The forbidden-rule
# scenarios use it and must change together with that function.
#
# Output contract the scenarios pin (T076 may change a message only together with this file):
#   finding: missing required entry <path>      one line per finding
#   finding: tracked file starts with the generated-from line: <path>   (AC-16.10)
#   repo-layout: no findings                    nothing to report
#   repo-layout: <n> findings (report mode)     report mode, exit 0 always
# Pending: scenarios carry @pending and the tasks that make them pass (tests/support/pending.ts).

@pending @T076 @T077
Feature: Repo layout check
  The check compares a repository's root with the required entries of repo-layout/v1.

  Background:
    Given the base fixture tree of "repo-layout"

  Scenario: FR-012 A repository with every required entry has no findings
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "repo-layout: no findings"

  Scenario: FR-012 A missing required file is reported and is not fatal in report mode
    Given the file "CHANGELOG.md" is removed
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "finding: missing required entry CHANGELOG.md"
    And the output has the line "repo-layout: 1 findings (report mode)"

  Scenario: FR-012 A missing required folder is reported and is not fatal in report mode
    Given the folder "tools" is removed
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "finding: missing required entry tools/"

  Scenario: FR-012 Every violation is listed, not only the first
    Given the file "README.md" is removed
    And the file "AGENTS.md" is removed
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "finding: missing required entry README.md"
    And the output has the line "finding: missing required entry AGENTS.md"
    And the output has the line "repo-layout: 2 findings (report mode)"

  Scenario: FR-012 Outside report mode the same violation is fatal
    Given the file "CHANGELOG.md" is removed
    When the tool runs
    Then it exits with 1
    And the output has the line "finding: missing required entry CHANGELOG.md"

  Scenario: FR-012 In agent-config, scripts/check-docs.sh stands in for scripts/check.sh
    Given the file "scripts/check.sh" is removed
    And the file "scripts/check-docs.sh" contains:
      """
      synthetic
      """
    When the tool runs with "--report --repo agent-config"
    Then it exits with 0
    And the output has the line "repo-layout: no findings"

  Scenario: FR-012 The same stand-in is not accepted for another repository
    Given the file "scripts/check.sh" is removed
    And the file "scripts/check-docs.sh" contains:
      """
      synthetic
      """
    When the tool runs with "--report --repo other-repo"
    Then it exits with 0
    And the output has the line "finding: missing required entry scripts/check.sh"

  Scenario: FR-012 A tracked file whose first line is the generated-from line is a finding, and not fatal in report mode
    Given the file "docs/copy.md" contains:
      """
      Generated from `docs/source.md`; edit that file, not this copy.
      Some text.
      """
    And "." is a git repository with everything committed
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "finding: tracked file starts with the generated-from line: docs/copy.md"

  Scenario: FR-012 The same file left untracked is not a finding
    Given "." is a git repository with everything committed
    And the file "docs/copy.md" contains:
      """
      Generated from `docs/source.md`; edit that file, not this copy.
      Some text.
      """
    When the tool runs with "--report"
    Then it exits with 0
    And the output has the line "repo-layout: no findings"

  Scenario: FR-012 In report mode on agent-config itself the check exits 0 and lists findings
    When the tool runs with "--report --repo agent-config real"
    Then it exits with 0
    And the output has a line starting with "finding: missing required entry"
