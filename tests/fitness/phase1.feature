# Requirements for the phase 1 end state of scripts/check-fitness.ts (specs/022 T096; T113 builds it after the doc edits T102 to T112).
# Covers AC-9.1 and FR-036 (the knowledge area holds no mention of the agentic-sdlc component, on for good) and the measure behind SC-012
# (the checks that read another area count 0). tests/fitness/fitness.feature keeps the baseline rules; this file adds a hard zero.
#
# What "on for good" means here: docs/baselines/fitness.json gains a top-level key
#   "hard-zero": ["knowledge-to-agentic-sdlc-lines", "knowledge-to-agentic-sdlc-files", "checks-reading-other-areas"]
# Each name must be a count of the baseline file. A listed count that measures above 0 fails whatever the baseline records, so lowering
# nothing and raising a baseline by hand cannot turn the check off; only deleting the name from the list does, and the real-tree scenarios
# below pin that the list holds the three names and the three recorded counts are 0. core-to-agentic-sdlc-lines and core-to-companies-lines
# are not listed (they go to 0 in later phases); they keep the baseline rule.
# Output contract (T113 may change a message only together with this file; the existing FIT-1 to FIT-5 lines stay as they are):
#   FIT-6 <count name> must be 0, found <n>                     a hard-zero count above 0, exit 1 (printed besides FIT-2 when the baseline rose too)
#   check-fitness: counts equal the baseline                    as before, when no count is off
#   check-fitness: <k> hard-zero counts are 0                   printed after it when the list holds k names and all measure 0
#   docs/baselines/fitness.json: hard-zero names "<name>", which is not a count      a listed name the baseline has no count for, exit 1
# What counts as a mention of the framework (decision of the orchestrator for T096): the knowledge component's mention of agentic-sdlc is the
# regular expression  agentic-sdlc(?!-reference)  : the plain word, `frameworks/agentic-sdlc/...` paths and `agentic-sdlc` followed by
# anything but "-reference" count; the separate GitHub repository agentic-sdlc-reference-typescript-node (and
# proposals/agentic-sdlc-reference-*.md) that knowledge docs cite as evidence does NOT count and stays. T113 writes it in copilot/atlas/atlas.yaml
# as  mention-in: { knowledge: 'agentic-sdlc(?!-reference)' }  on the agentic-sdlc component. The fixture below sets the same key.
# The real-tree scenarios carry the tasks that make them true; a scenario with several tasks stays pending until all are ticked.

Feature: Knowledge mentions of agentic-sdlc are a hard zero
  The knowledge area has 0 mentions of the agentic-sdlc framework, and one new mention fails.

  Background:
    Given the base fixture tree of "fitness"
    And in "copilot/atlas/atlas.yaml", `mention: "agentic-sdlc" }` becomes `mention: "agentic-sdlc", mention-in: { knowledge: 'agentic-sdlc(?!-reference)' } }`
    And the file "knowledge/a.md" contains:
      """
      Roles are described elsewhere.
      """
    And the file "knowledge/b.md" contains:
      """
      A neutral line.
      """
    And the file "knowledge/check-docs.mjs" contains:
      """
      const nothing = 'here';
      """
    And the file "docs/baselines/fitness.json" contains:
      """
      {
        "counts": {
          "knowledge-to-agentic-sdlc-lines": 0,
          "knowledge-to-agentic-sdlc-files": 0,
          "core-to-agentic-sdlc-lines": 1,
          "core-to-companies-lines": 1,
          "checks-reading-other-areas": 0
        },
        "hard-zero": ["knowledge-to-agentic-sdlc-lines", "knowledge-to-agentic-sdlc-files", "checks-reading-other-areas"],
        "method": "lines mentioning the component, counted per owning folder",
        "tool_version": "1",
        "date": "2026-11-14"
      }
      """

  @T113
  Scenario: AC-9.1 A tree with no knowledge mention passes and says the hard-zero counts are 0
    When the tool runs
    Then it exits with 0
    And the output has the line "check-fitness: counts equal the baseline"
    And the output has the line "check-fitness: 3 hard-zero counts are 0"

  @T113
  Scenario: AC-9.1 A single new mention of agentic-sdlc in a knowledge doc fails
    Given in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nSee the agentic-sdlc roles.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-6 knowledge-to-agentic-sdlc-lines must be 0, found 1"
    And the output has the line "FIT-6 knowledge-to-agentic-sdlc-files must be 0, found 1"

  @T113
  Scenario: AC-9.1 A path under frameworks/agentic-sdlc counts as a mention
    Given in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nRead {{AGENT_HOME}}/frameworks/agentic-sdlc/index.md first.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-6 knowledge-to-agentic-sdlc-lines must be 0, found 1"

  @T113
  Scenario: AC-9.1 A line citing the reference repository is not a mention and does not fail
    Given in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nEvidence: https://github.com/conanjs/agentic-sdlc-reference-typescript-node and proposals/agentic-sdlc-reference-v2.md.`
    When the tool runs
    Then it exits with 0
    And the output has the line "check-fitness: 3 hard-zero counts are 0"

  @T113
  Scenario: AC-9.1 Raising the baseline by hand does not turn the check off
    Given in "docs/baselines/fitness.json", `"knowledge-to-agentic-sdlc-lines": 0,` becomes `"knowledge-to-agentic-sdlc-lines": 5,`
    And in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nSee the agentic-sdlc roles.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-6 knowledge-to-agentic-sdlc-lines must be 0, found 1"

  @T113
  Scenario: SC-012 A check that reads another area's files fails
    Given the file "knowledge/check-more.mjs" contains:
      """
      const other = 'companies/index.md';
      """
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-6 checks-reading-other-areas must be 0, found 1"

  @T113
  Scenario: AC-9.1 A count outside the hard-zero list keeps the baseline rule
    Given in "core/core.md", `A neutral line.` becomes `A neutral line.\nAnother mention of agentic-sdlc.`
    And in "knowledge/b.md", `A neutral line.` becomes `A neutral line.\nSee the agentic-sdlc roles.`
    When the tool runs
    Then it exits with 1
    And the output has the line "FIT-2 core-to-agentic-sdlc-lines rose from 1 to 2"
    And the output has the line "FIT-6 knowledge-to-agentic-sdlc-lines must be 0, found 1"
    And the output has no line "FIT-6 core-to-agentic-sdlc-lines must be 0, found 2"

  @T113
  Scenario: AC-9.1 A hard-zero name that is not a count fails and names it
    Given in "docs/baselines/fitness.json", `"checks-reading-other-areas"]` becomes `"checks-reading-other-areas", "no-such-count"]`
    When the tool runs
    Then it exits with 1
    And the output has the line "docs/baselines/fitness.json: hard-zero names \"no-such-count\", which is not a count"

  # The real tree. The hard zero is switched on by T113 after the doc edits T102 to T112 and the validator edit T097.

  @T113
  Scenario: AC-9.1 The real baseline lists the three hard-zero counts and records them as 0
    Then the real JSON file "docs/baselines/fitness.json" lists "knowledge-to-agentic-sdlc-lines" under "hard-zero"
    And the real JSON file "docs/baselines/fitness.json" lists "knowledge-to-agentic-sdlc-files" under "hard-zero"
    And the real JSON file "docs/baselines/fitness.json" lists "checks-reading-other-areas" under "hard-zero"
    And in the real JSON file "docs/baselines/fitness.json", "counts.knowledge-to-agentic-sdlc-lines" is 0
    And in the real JSON file "docs/baselines/fitness.json", "counts.knowledge-to-agentic-sdlc-files" is 0
    And in the real JSON file "docs/baselines/fitness.json", "counts.checks-reading-other-areas" is 0

  @T113
  Scenario: AC-9.1 The real atlas does not count the reference repository as a mention
    Then the real file "copilot/atlas/atlas.yaml" has a line containing "agentic-sdlc(?!-reference)"

  @T097 @T102 @T103 @T104 @T105 @T106 @T107 @T108 @T109 @T110 @T111 @T112 @T113
  Scenario: AC-9.1 SC-012 The real tree passes with every hard-zero count at 0
    When the tool runs with "real"
    Then it exits with 0
    And the output has the line "check-fitness: 3 hard-zero counts are 0"

  Scenario Outline: AC-9.1 The knowledge docs of <folder> hold no mention of the agentic-sdlc framework
    Then the real folder "<folder>" has no markdown line matching "agentic-sdlc(?!-reference)"

    @T102
    Examples:
      | folder                                           |
      | copilot/knowledge/software-design/design-principles |

    @T103
    Examples:
      | folder                                              |
      | copilot/knowledge/software-design/architecture-styles |

    @T104
    Examples:
      | folder                                    |
      | copilot/knowledge/software-design/oop     |

    @T105
    Examples:
      | folder                                                 |
      | copilot/knowledge/software-design/functional-modeling  |

    @T106
    Examples:
      | folder                                    |
      | copilot/knowledge/software-design/ddd     |

    @T107
    Examples:
      | folder                         |
      | copilot/knowledge/js-runtime   |

    @T108
    Examples:
      | folder                         |
      | copilot/knowledge/ai-agents    |

    @T109
    Examples:
      | folder                              |
      | copilot/knowledge/error-handling    |

    @T110
    Examples:
      | folder                                 |
      | copilot/knowledge/documentation        |
      | copilot/knowledge/code-documentation   |

    @T111
    Examples:
      | folder                             |
      | copilot/knowledge/concurrency      |
      | copilot/knowledge/testing          |
      | copilot/knowledge/operations       |
      | copilot/knowledge/web-apis         |
      | copilot/knowledge/versioning       |

    @T112
    Examples:
      | folder                            |
      | copilot/frameworks/knowledge      |
      | copilot/frameworks/company-kb     |

  Scenario Outline: AC-9.1 The files directly in <folder> hold no mention of the agentic-sdlc framework
    Then the markdown files directly in the real folder "<folder>" have no line matching "agentic-sdlc(?!-reference)"

    @T106
    Examples:
      | folder                         |
      | copilot/knowledge/software-design |

    @T111
    Examples:
      | folder            |
      | copilot/knowledge |
