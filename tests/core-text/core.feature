# Requirements for the text of the core instructions (specs/022 T095; T101 edits copilot/instructions/core.instructions.md).
# Covers AC-9.8 (the {{VAR}} rule), AC-6.5 (one line defines {{AGENT_HOME}}, no other variable is defined) and AC-4.8 (one line on
# approvals from a needs report). The tool under test is a small oracle written with these scenarios: tests/core-text/check-core.ts
# (`--file <path> [--only var|home|approval]`, rules in its header). T101 changes the core file only; it need not change the oracle.
# What the oracle reads as each rule (T101 must write the lines so):
#   {{VAR}} rule: the one line that holds the text {{VAR}} names global-variables.md, and says "read the resolved file on this machine"
#     and "never fetch" (any case). No other line has the word "fetch". No line has "link text", "link's text" or "text of the link".
#   AGENT_HOME definition: a line that starts, after an optional list marker, with {{AGENT_HOME}} (backticks allowed) followed by
#     "is", "means", "=" or ":" . Exactly one such line. A line that starts so with any other {{NAME}} is a second definition and is forbidden.
#   Approval line: exactly one line with "never run", `add`, `use` (backticks), "needs report" (any case) and "approval in chat".
# Output: `core: ...` per finding then `core-text: <n> findings`, exit 1; `core-text: ok`, exit 0.
# The scenarios on the stand-in file (no tag) check the oracle itself and pass today; the scenarios on the real file are pending T101.

Feature: Core instruction text
  The core says how placeholders are resolved, defines one variable, and names the approval rule, and nothing else on those subjects.

  Scenario: The oracle accepts a stand-in core file that meets every rule
    Given the base fixture tree of "core-text"
    When the tool runs
    Then it exits with 0
    And the output has the line "core-text: ok"

  Scenario Outline: AC-9.8 AC-6.5 AC-4.8 A forbidden line, once added, fails and is the only finding
    Given the base fixture tree of "core-text"
    And in "core.instructions.md", `- A neutral closing line.` becomes `- A neutral closing line.\n<added>`
    When the tool runs
    Then it exits with 1
    And the output has the line "<finding>"
    And the output has the line "core-text: 1 findings"

    Examples:
      | added                                                                  | finding                                                                                                                      |
      | - When a doc cites a path, read the link text, not the target.         | core: forbidden line (reads link text instead of the target): - When a doc cites a path, read the link text, not the target. |
      | - The text of the link is the path to read.                            | core: forbidden line (reads link text instead of the target): - The text of the link is the path to read.                    |
      | - If the resolved file is missing, fetch it from GitHub.               | core: forbidden line (fetches a file): - If the resolved file is missing, fetch it from GitHub.                              |
      | - `{{AGENT_HOME}}` means the home folder.                              | core: {{AGENT_HOME}} is defined by 2 lines, expected 1                                                                       |
      | - `{{LANGUAGE}}` is the language agents write in.                      | core: forbidden line (defines {{LANGUAGE}}): - `{{LANGUAGE}}` is the language agents write in.                               |
      | - Agents never run `add`, `use` or a needs report approval without V's approval in chat. | core: 2 lines say agents never run add, use or an approval from a NEEDS report without V's approval in chat, expected 1 |

  Scenario: The oracle names a missing rule
    Given the base fixture tree of "core-text"
    And in "core.instructions.md", `read the resolved file on this machine and never fetch it; ` becomes ``
    When the tool runs
    Then it exits with 1
    And the output has the line "core: the {{VAR}} rule must say to read the resolved file on this machine"
    And the output has the line "core: the {{VAR}} rule must say to never fetch the file"

  Scenario: AC-9.8 The real {{VAR}} rule reads the resolved file on this machine, never fetches, and no line reads link text
    Given the base fixture tree of "core-text"
    When the tool runs with "real --only var"
    Then it exits with 0
    And the output has the line "core-text: ok"

  Scenario: AC-6.5 The real core defines {{AGENT_HOME}} in one line and no other variable
    Given the base fixture tree of "core-text"
    When the tool runs with "real --only home"
    Then it exits with 0
    And the output has the line "core-text: ok"

  Scenario: AC-4.8 The real core has one line on approvals from a needs report
    Given the base fixture tree of "core-text"
    When the tool runs with "real --only approval"
    Then it exits with 0
    And the output has the line "core-text: ok"

  Scenario: AC-9.8 AC-6.5 AC-4.8 The real core meets every rule together
    Given the base fixture tree of "core-text"
    When the tool runs with "real"
    Then it exits with 0
    And the output has the line "core-text: ok"
