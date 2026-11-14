# Requirements for scripts/check-fitness.ts (specs/022 T049, written before the tool, which T081 builds).
# Covers AC-1.6 and FR-008: the architecture map forbids three edges, and the counts of mentions that cross a boundary
# today are recorded as a baseline that may fall but never rise. Fixture: a small tree with five components,
# copilot/atlas/atlas.yaml (components, component-edges, forbidden-edges) and docs/baselines/fitness.json (the counts).
#
# Keys of the atlas that T080 adopts as they are in this fixture: `components` (id, paths, mention), `component-edges`
# and `forbidden-edges`. They sit beside the kind-level `edges:` of the real atlas and do not replace it.
# What is counted: a mention line is a line of a `.md` file under a component's paths that contains another component's
# `mention` text; a check is a `check-*.mjs` file under a component's paths that contains another component's `mention`
# text, counted once per file ("the checks that read another area's files"). The two counts never share a file.
#
# Output contract the scenarios pin (T081 may change a message only together with this file). FIT-n are this check's
# message codes; the fitness function of plan.md and decisions/system-architecture.md section 7 each implements:
#   FIT-1 forbidden edge <from> -> <to>             a declared edge the map forbids, exit 1                      (FF-2, forbidden edges)
#   FIT-2 <count name> rose from <baseline> to <now>   a count above its baseline, exit 1                          (FF-2 for the knowledge counts and the checks
#                                                                                                                   count, FF-1 for core-to-agentic-sdlc and core-to-companies)
#   FIT-3 baseline file missing: <relative path>    exit 1                                                       (a guard, no fitness function of its own)
#   check-fitness: counts equal the baseline        exit 0, every count equals its baseline
#   a count below its baseline passes with exit 0; a usage error (unknown flag, no --root value) exits 2.
# Pending: scenarios carry @pending and the tasks that make them pass (tests/support/pending.ts).

@pending @T081
Feature: Architecture fitness check
  The check fails on an edge the architecture map forbids and on any count of crossing mentions that rises.

  Background:
    Given the base fixture tree of "fitness"

  Scenario: AC-1.6 The fixture as it stands passes with every count equal to its baseline
    When the tool runs
    Then it exits with 0
    And the output has the line "check-fitness: counts equal the baseline"

  Scenario: AC-1.6 An added edge from knowledge to agentic-sdlc fails and names the edge
    Given in "copilot/atlas/atlas.yaml", `- { from: core, to: knowledge }` becomes `- { from: core, to: knowledge }\n  - { from: knowledge, to: agentic-sdlc }`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-1 forbidden edge knowledge -> agentic-sdlc"

  Scenario: AC-1.6 An added edge from knowledge to companies fails and names the edge
    Given in "copilot/atlas/atlas.yaml", `- { from: core, to: knowledge }` becomes `- { from: core, to: knowledge }\n  - { from: knowledge, to: companies }`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-1 forbidden edge knowledge -> companies"

  Scenario Outline: AC-1.6 An added edge from contracts to <target> fails and names the edge
    Given in "copilot/atlas/atlas.yaml", `- { from: core, to: knowledge }` becomes `- { from: core, to: knowledge }\n  - { from: contracts, to: <target> }`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-1 forbidden edge contracts -> <target>"

    Examples:
      | target       |
      | core         |
      | knowledge    |
      | companies    |
      | agentic-sdlc |

  Scenario: AC-1.6 An allowed edge that is not forbidden still passes
    Given in "copilot/atlas/atlas.yaml", `- { from: core, to: knowledge }` becomes `- { from: core, to: knowledge }\n  - { from: core, to: agentic-sdlc }`
    When the tool runs
    Then it exits with 0

  Scenario: AC-1.6 One more mention line from knowledge to agentic-sdlc is a rise and fails
    Given in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nAnother mention of agentic-sdlc.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 knowledge-to-agentic-sdlc-lines rose from 3 to 4"

  Scenario: AC-1.6 One more file that mentions agentic-sdlc is a rise and fails
    Given the file "knowledge/c.md" contains:
      """
      The first mention of agentic-sdlc in a new file.
      """
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 knowledge-to-agentic-sdlc-files rose from 2 to 3"

  Scenario: AC-1.6 One more mention from core to agentic-sdlc is a rise and fails
    Given in "core/core.md", `A neutral line.` becomes `A neutral line.\nAnother mention of agentic-sdlc.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 core-to-agentic-sdlc-lines rose from 1 to 2"

  Scenario: AC-1.6 One more mention from core to companies is a rise and fails
    Given in "core/core.md", `A neutral line.` becomes `A neutral line.\nAnother look at companies/ here.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 core-to-companies-lines rose from 1 to 2"

  Scenario: AC-1.6 One more check that reads another area's files is a rise and fails
    Given the file "knowledge/check-more.mjs" contains:
      """
      const other = 'companies/index.md';
      """
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 checks-reading-other-areas rose from 1 to 2"

  Scenario: AC-1.6 An unknown flag is a usage error and exits 2
    When the tool runs with "--no-such-flag"
    Then it exits with 2

  Scenario: AC-1.6 A count that fell below its baseline passes, because the check fails only on a rise
    Given in "knowledge/a.md", `Stacks live in agentic-sdlc too.` becomes `Stacks live elsewhere.`
    When the tool runs
    Then it exits with 0

  Scenario: AC-1.6 A missing baseline file fails and names the file
    Given the file "docs/baselines/fitness.json" is removed
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-3 baseline file missing: docs/baselines/fitness.json"

  @T080 @T082
  Scenario: AC-1.6 The real tree has counts equal to the recorded baseline
    When the tool runs with "real"
    Then it exits with 0
    And the output has the line "check-fitness: counts equal the baseline"
