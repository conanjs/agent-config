# Requirements for the contracts index and the worked citation examples (specs/022 T047; AC-1.1 and AC-1.8).
# The index is contracts/index.md (T074): a Markdown table with the columns Contract, Owner, Consumers, Versioning rule
# and Missing or stale, one row for each of the fifteen contracts of AC-1.1 (the component lists and the lock share one
# row). contracts/tools/check-schemas.ts, given a file named index.md, checks that every row has all four fields filled
# and that all fifteen rows are there (output lines: see tests/contracts/tool.ts). The worked examples are in the
# README.md of contracts/knowledge-provider/v1 (T062) and contracts/rendered-copy/v1 (T064).
#
# AC-1.8: T062 and T064 must write each rendered form as a Markdown link on one line, [text](target), in the README itself;
# a table cell that shows the text and the target apart does not satisfy the scenarios.
#
# Written before the code: @pending marks a scenario that cannot pass yet; the task that makes it pass removes the tag.

Feature: Contracts index and worked examples
  V can look up each of the fifteen contracts and see who owns it, who uses it, how it is versioned and what happens
  when it is missing or stale; the citation examples show both forms on Mac and Windows.

  Background:
    Given the base fixture tree of "contracts"

  # ---- AC-1.1 ----------------------------------------------------------------------------------------

  @pending @T074
  Scenario Outline: AC-1.1 The shipped index has a row for the contract <contract>
    Then the repository file "contracts/index.md" has a line matching "^\| <contract>\b"

    Examples:
      | contract           |
      | slots/v1           |
      | component/v1       |
      | knowledge-provider/v1 |
      | company-kb/v1      |
      | framework/v1       |
      | rendered-copy/v1   |
      | routes/v1          |
      | skill-source/v1    |
      | agent-source/v1    |
      | adapter-fields/v1  |
      | build/v1           |
      | repo-layout/v1     |
      | hooks/v1           |
      | variables/v1       |

  @pending @T074
  Scenario: AC-1.1 The shipped index has one shared row for the component list and the lock
    Then the repository file "contracts/index.md" has a line matching "^\| components-list/v1\b.*components-lock/v1"

  @pending @T054 @T055 @T074 @T078
  Scenario: AC-1.1 The shipped index has fifteen entries, each with owner, consumers, versioning rule and missing or stale behaviour
    When the tool runs with "contracts/index.md"
    Then it exits with 0
    And the check output has a line containing ": ok (15 contracts)"
    And the check output has no line containing "error"

  @pending @T054 @T078
  Scenario: AC-1.1 The fixture index with fifteen complete entries passes, so the failures below come from the one change each makes
    When the tool runs with "{root}/index.md"
    Then it exits with 0
    And the check output has a line containing ": ok (15 contracts)"

  @pending @T054 @T078
  Scenario Outline: AC-1.1 An index entry with no <field> fails, naming the contract and the field
    Given in "index.md", `<cell>` becomes ` `
    When the tool runs with "{root}/index.md"
    Then it exits with 1
    And the check output has a line containing "error" and "<contract>"
    And the check output has a line containing "<contract>" and "<field>"

    Examples:
      | field               | contract           | cell                 |
      | Owner               | routes/v1          | owner-routes         |
      | Consumers           | slots/v1           | consumers-slots      |
      | Versioning rule     | hooks/v1           | rule-hooks           |
      | Missing or stale    | build/v1           | stale-build          |

  @pending @T054 @T078
  Scenario: AC-1.1 An index with only fourteen entries fails, naming the contract that is missing
    Given in "index.md", `\n| variables/v1 | owner-variables | consumers-variables | rule-variables | stale-variables |` becomes ``
    When the tool runs with "{root}/index.md"
    Then it exits with 1
    And the check output has a line containing "error" and "variables/v1"

  # ---- AC-1.8 ----------------------------------------------------------------------------------------
  # One citation of x.md, in a copy at generated/<component>/foo.md, shown in the source form and in the rendered form
  # on Mac and on Windows; the rendered target is the relative path ../../knowledge/x.md on both.

  @pending @T062 @T064
  Scenario Outline: AC-1.8 The worked example in <file> shows <form>
    Then the repository file "<file>" has a line containing "<text>"

    Examples:
      | file                                      | form                                | text |
      | contracts/knowledge-provider/v1/README.md | the source form                     | [{{AGENT_HOME}}/knowledge/x.md](https://github.com/ |
      | contracts/knowledge-provider/v1/README.md | the rendered form on Mac            | [/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md) |
      | contracts/knowledge-provider/v1/README.md | the rendered form on Windows        | [C:\\Users\\v\\.agent-config\\knowledge\\x.md](../../knowledge/x.md) |
      | contracts/knowledge-provider/v1/README.md | the copy it is rendered into        | generated/<component>/foo.md |
      | contracts/rendered-copy/v1/README.md      | the source form                     | [{{AGENT_HOME}}/knowledge/x.md](https://github.com/ |
      | contracts/rendered-copy/v1/README.md      | the rendered form on Mac            | [/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md) |
      | contracts/rendered-copy/v1/README.md      | the rendered form on Windows        | [C:\\Users\\v\\.agent-config\\knowledge\\x.md](../../knowledge/x.md) |
      | contracts/rendered-copy/v1/README.md      | the copy it is rendered into        | generated/<component>/foo.md |
