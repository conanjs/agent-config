# Requirements for tests/support/tools.ts (specs/022 T043): the scenario support that the new tools' features share.
# A stand-in tool, bin/probe.mjs in the fixture, writes into HOME or prints fixed text, so each helper is observed
# from outside: a temporary home per scenario, a tree snapshot for "write nothing" scenarios, an exact text compare
# that ignores timestamps, and a runner for a script file.

Feature: Shared scenario support for the new tools
  Scenarios of the new tools get a temporary home, can prove that a run changed nothing, and can compare output exactly.

  Background:
    Given the base fixture tree of "tools-support"

  Scenario: T043-1 A tool runs with HOME set to the scenario's temporary home, never the real one
    Given a temporary home exists
    When the tool runs with "home"
    Then it exits with 0 and prints:
      """
      home={root}/home
      """

  Scenario: T043-2 os.homedir() in the tool is the temporary home too, on every OS
    Given a temporary home exists
    When the tool runs with "homedir"
    Then it exits with 0 and prints:
      """
      homedir={root}/home
      """

  Scenario: T043-3 A tool gets the arguments after its name and its exit code is reported
    When the tool runs with "args one two"
    Then it exits with 0 and prints:
      """
      one|two
      """

  Scenario: T043-4 A non-zero exit code of the tool is reported as it is
    When the tool runs with "fail"
    Then it exits with 3

  Scenario: T043-5 A shell script runs with bash
    When the tool runs with "sh a b"
    Then it exits with 0 and prints:
      """
      bash probe: a b
      """

  Scenario: T043-6 A run that writes nothing leaves the tree identical to its snapshot
    Given the file "home/old.txt" contains:
      """
      one
      """
    And a snapshot of "home" is taken
    When the tool runs with "read"
    Then since the snapshot, nothing under "home" changed

  Scenario: T043-7 A new file is reported as added
    Given a temporary home exists
    And a snapshot of "home" is taken
    When the tool runs with "write"
    Then since the snapshot, "home" has these changes:
      """
      added new.txt
      """

  Scenario: T043-8 A rewritten file is reported as changed
    Given the file "home/old.txt" contains:
      """
      one
      """
    And a snapshot of "home" is taken
    When the tool runs with "edit"
    Then since the snapshot, "home" has these changes:
      """
      changed old.txt
      """

  @posix
  Scenario: T043-9 A file whose mode alone changes is reported as changed
    Given the file "home/old.txt" contains:
      """
      one
      """
    And a snapshot of "home" is taken
    When the tool runs with "chmod"
    Then since the snapshot, "home" has these changes:
      """
      changed old.txt
      """

  Scenario: T043-10 A deleted file is reported as removed
    Given the file "home/old.txt" contains:
      """
      one
      """
    And a snapshot of "home" is taken
    When the tool runs with "remove"
    Then since the snapshot, "home" has these changes:
      """
      removed old.txt
      """

  Scenario: T043-11 A link that points elsewhere is reported as changed
    Given the folder "home/a" exists
    And the folder "home/b" exists
    And "home/link" already links to "home/a"
    And a snapshot of "home" is taken
    And the file "home/link" is removed
    And "home/link" already links to "home/b"
    Then since the snapshot, "home" has these changes:
      """
      changed link
      """

  Scenario: T043-12 Output is compared exactly, with the backup stamp and the ISO date-time written as <timestamp>
    When the tool runs with "stamp"
    Then the output equals, ignoring timestamps:
      """
      Backed up to <timestamp> at <timestamp>
      """

  Scenario: T043-13 Output that differs in any other character does not match
    When the tool runs with "stamp"
    Then the output differs from this, ignoring timestamps:
      """
      Backed up to <timestamp> at <timestamp>!
      """
