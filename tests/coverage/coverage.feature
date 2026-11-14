# Requirements for scripts/check-ac-coverage.ts (specs/022 T052, written before the tool, which T083 builds).
# Covers QB-1 (every acceptance criterion of a delivered phase has a scenario whose title starts with its id) and QB-2
# (an id that cannot be automated sits on one exemption list with a reason and a manual replacement).
# Fixture: a spec.md with two stories (phase 0: AC-1.1, AC-1.2, AC-1.10; phase 2: AC-2.1, AC-2.2, plus A-19),
# one feature file (written by the Background, because a .feature file under fixtures/ would run as a real test),
# and tests/coverage/exemptions.yaml with entries for AC-2.2 and A-19. The tool takes
# --delivered <phase list>; an AC belongs to the phase of its story's heading "(Phase N)".
#
# `ac-exemptions/v1` (tests/coverage/exemptions.yaml): `schema: ac-exemptions/v1` and `exemptions:`, a list of entries with
#   id (required; an id in spec.md: an AC, an A- or an SC- id), reason (required, not empty), replacement (required, not empty:
#   the manual check that stands in) and automated-part (optional text: what a test does cover).
#
# Output contract the scenarios pin (T083 may change a message only together with this file):
#   QB-1 <id> has no scenario (phase <n>)                        exit 1
#   QB-2 exemption <id> has no reason                            exit 1
#   QB-2 exemption <id> has no manual replacement                exit 1
#   QB-2 exemption <id> is not an id in spec.md                  exit 1
#   check-ac-coverage: <n> of <n> delivered ids covered or exempt   exit 0
# Pending: scenarios carry @pending and the tasks that make them pass (tests/support/pending.ts).
# Not covered here: the EDGE-<n> ids of T083, whose phase the spec does not state.

@T083
Feature: Acceptance-criterion coverage check
  The check reads the ids in spec.md and the scenario titles, and fails on an uncovered id of a delivered phase.

  Background:
    Given the base fixture tree of "coverage"
    And the file "tests/demo/demo.feature" contains:
      """
      Feature: Synthetic scenarios

        Scenario: AC-1.1 The first behaviour
          Given a step

        Scenario: AC-1.2 The second behaviour
          Given a step

        Scenario: AC-1.10 The tenth behaviour
          Given a step

        Scenario: AC-2.1 The later behaviour
          Given a step
      """

  Scenario: QB-1 Every acceptance criterion of a delivered phase has a scenario
    When the tool runs with "--delivered 0"
    Then it exits with 0
    And the output has the line "check-ac-coverage: 3 of 3 delivered ids covered or exempt"

  Scenario: QB-1 An acceptance criterion with no scenario fails and is named with its phase
    Given in "tests/demo/demo.feature", `Scenario: AC-1.2 The second behaviour` becomes `Scenario: The second behaviour`
    When the tool runs with "--delivered 0"
    Then it exits with 1
    And the output has the line "QB-1 AC-1.2 has no scenario (phase 0)"

  Scenario: QB-1 A scenario that only mentions an id in the middle of its title does not cover it
    Given in "tests/demo/demo.feature", `Scenario: AC-1.2 The second behaviour` becomes `Scenario: The second behaviour, see AC-1.2`
    When the tool runs with "--delivered 0"
    Then it exits with 1
    And the output has the line "QB-1 AC-1.2 has no scenario (phase 0)"

  Scenario: QB-1 A scenario for AC-1.1 does not cover AC-1.10
    Given in "tests/demo/demo.feature", `Scenario: AC-1.10 The tenth behaviour` becomes `Scenario: AC-1.1 A second scenario for the first`
    When the tool runs with "--delivered 0"
    Then it exits with 1
    And the output has the line "QB-1 AC-1.10 has no scenario (phase 0)"

  Scenario: QB-1 An uncovered acceptance criterion of a phase not yet delivered does not fail
    Given in "tests/demo/demo.feature", `Scenario: AC-2.1 The later behaviour` becomes `Scenario: The later behaviour`
    When the tool runs with "--delivered 0"
    Then it exits with 0

  Scenario: QB-1 The same uncovered acceptance criterion fails once its phase is delivered
    Given in "tests/demo/demo.feature", `Scenario: AC-2.1 The later behaviour` becomes `Scenario: The later behaviour`
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-1 AC-2.1 has no scenario (phase 2)"

  Scenario: QB-2 An exempt id with no scenario passes once its phase is delivered
    When the tool runs with "--delivered 0,2"
    Then it exits with 0
    And the output has the line "check-ac-coverage: 5 of 5 delivered ids covered or exempt"

  Scenario: QB-2 Removing an id from the exemption list makes it a failure
    Given in "tests/coverage/exemptions.yaml", `  - id: AC-2.2\n    reason: Only a person on a real account can see this.\n    replacement: Check by hand once per phase.\n    automated-part: none\n` becomes ``
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-1 AC-2.2 has no scenario (phase 2)"

  Scenario: QB-2 An exemption with no reason is rejected
    Given in "tests/coverage/exemptions.yaml", `    reason: Only a person on a real account can see this.\n` becomes ``
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-2 exemption AC-2.2 has no reason"

  Scenario: QB-2 An exemption with an empty reason is rejected
    Given in "tests/coverage/exemptions.yaml", `reason: Only a person on a real account can see this.` becomes `reason: ""`
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-2 exemption AC-2.2 has no reason"

  Scenario: QB-2 An exemption with no manual replacement is rejected
    Given in "tests/coverage/exemptions.yaml", `    replacement: Check by hand once per phase.\n` becomes ``
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-2 exemption AC-2.2 has no manual replacement"

  Scenario: QB-2 An exemption naming an id that is not in spec.md is rejected
    Given in "tests/coverage/exemptions.yaml", `id: A-19` becomes `id: A-99`
    When the tool runs with "--delivered 0,2"
    Then it exits with 1
    And the output has the line "QB-2 exemption A-99 is not an id in spec.md"

  Scenario: QB-2 An invalid exemption is rejected even when its phase is not delivered
    Given in "tests/coverage/exemptions.yaml", `    replacement: Check by hand once per phase.\n` becomes ``
    When the tool runs with "--delivered 0"
    Then it exits with 1
    And the output has the line "QB-2 exemption AC-2.2 has no manual replacement"

  @pending @T038 @T045 @T047 @T048 @T049 @T050 @T051 @T052 @T053
  Scenario: QB-1 Every acceptance criterion of phase 0 in the real spec has a scenario or a valid exemption
    When the tool runs with "real --delivered 0"
    Then it exits with 0
