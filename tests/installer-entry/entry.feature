# Requirements for the entry scripts installers/install.sh (Mac, Linux) and installers/install.ps1 (Windows) (specs/022 T128;
# FR-033 one install command with the same steps on Mac and Windows; FR-035 the way back to the old installer; contracts/installer-cli.md
# "Entry points"). Written before the scripts (T144 bash, T145 PowerShell, with the legacy move T146) and @pending until then.
# How the scenarios run and what the fake node is: tests/installer-entry/tool.ts. A scenario without an OS tag runs on every OS: the
# same steps, the same text, the same exit codes (FR-033); only the legacy switch has its own spelling (--legacy, -Legacy).
#
# The behaviour the scripts must have (choices of this file where the spec does not fix it; the exit codes are those of installer-cli.md):
#   1. Find node: the variable NODE first (an empty NODE is unset); if NODE is set, only that node is looked at, with no fall back to
#      the PATH; else the first `node` on the PATH. The version is read by running `<node> --version` and compared as numbers:
#      24.12 or later (and below 25) is accepted; 24.11.9, 24.9.0, 22.x and 18.x are not.
#   2. Run `<node> <folder of the script>/core/main.ts <every argument, unchanged, in order>`; the exit code of that run is the
#      exit code of the script. Arguments, the folder of the script, the NODE path and AGENT_CONFIG_HOME may hold spaces.
#   3. No usable node: one line on standard error, nothing on standard output (no JSON, even with --json), exit 10, nothing changed: the
#      text MG-13 of the catalogue "Messages" in specs/022-repo-split/contracts/installer-cli.md, with "(none found)" when no node
#      starts and "(found <version>)" when a node reports an older version.
#   4. Legacy: the first argument --legacy (install.ps1: -Legacy) runs the old installer, `<folder of the script>/legacy/install.sh`
#      (legacy\install.ps1 on Windows), with the other arguments and returns its exit code; it needs no node and starts none.
#   Not covered here: uninstall.sh and uninstall.ps1 (T144 and T145 give them the same behaviour; their scenarios can reuse these steps).

Feature: The entry scripts find Node 24.12 or later and start the installer core
  One install command per machine: the script finds Node, runs main.ts, passes the exit code through, and keeps the way back to
  the old installer.

  Background:
    Given the base fixture tree of "installer-entry"
    And a temporary home with the agent folders exists

  # ---- Finding node -----------------------------------------------------------------------------------------

  @pending @T144 @T145
  Scenario: FR-033 The NODE variable is looked at first, before any node on the PATH
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "override" that reports "v24.12.0"
    And the entry script has a node in "pathbin" that reports "v24.13.1"
    And the entry script's NODE variable is the node in "override"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with "install"
    Then it exits with 0
    And the entry script's node in "override" was started with:
      """
      {root}/repo/installers/core/main.ts
      install
      """
    And the entry script's node in "pathbin" was never started

  @pending @T144 @T145
  Scenario: FR-033 Without NODE the first node on the PATH is used
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with "install"
    Then it exits with 0
    And the entry script's node in "pathbin" was started with:
      """
      {root}/repo/installers/core/main.ts
      install
      """

  @pending @T144 @T145
  Scenario Outline: FR-033 A node of version <version> is accepted
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "pathbin" that reports "<version>"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with "install"
    Then it exits with 0
    And the entry script's node in "pathbin" was started with:
      """
      {root}/repo/installers/core/main.ts
      install
      """

    Examples:
      | version   |
      | v24.12.0  |
      | v24.13.1  |
      | v24.100.0 |

  @pending @T144 @T145
  Scenario Outline: FR-033 A node of version <version> is refused with one line and exit 10
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "pathbin" that reports "<version>"
    And the entry script's PATH starts with the folder "pathbin"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      needs: Node 24.12 or later (found <version>). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.
      """
    And stdout is empty
    And the entry script's node in "pathbin" was never started
    And since the snapshot, nothing under "home" changed

    Examples:
      | version  |
      | v24.11.9 |
      | v24.9.0  |
      | v22.12.0 |
      | v18.20.4 |

  @pending @T144 @T145
  Scenario: FR-033 No node on the machine is one line, exit 10, no JSON and nothing changed
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's PATH holds the system commands and no node
    And a snapshot of "home" is taken
    When the tool runs with "install --json"
    Then it exits with 10 and prints:
      """
      needs: Node 24.12 or later (none found). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.
      """
    And stdout is empty
    And since the snapshot, nothing under "home" changed

  @pending @T144 @T145
  Scenario: FR-033 A NODE variable that names no node is not replaced by a node on the PATH
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's PATH starts with the folder "pathbin"
    And the entry script's NODE variable is "{root}/missing/node"
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      needs: Node 24.12 or later (none found). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.
      """
    And the entry script's node in "pathbin" was never started

  # ---- Passing the exit code and the arguments through ----------------------------------------------------------

  @pending @T144 @T145
  Scenario Outline: FR-033 The exit code <code> of the installer core is the exit code of the script
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's node in "pathbin" exits with <code>
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with "doctor --json"
    Then it exits with <code>
    And the entry script's node in "pathbin" was started with:
      """
      {root}/repo/installers/core/main.ts
      doctor
      --json
      """

    Examples:
      | code |
      | 0    |
      | 1    |
      | 2    |
      | 10   |

  @pending @T144 @T145
  Scenario: FR-033 A script folder, a NODE path, an argument and an agent home with a space all pass through unchanged
    Given the entry script has its own copy of the installers in "my repo/installers"
    And the entry script has a node in "node bin" that reports "v24.12.0"
    And the entry script's NODE variable is the node in "node bin"
    And the agent home variable is "{root}/my home/.agent-config"
    When the tool runs with arguments:
      """
      add
      my-notes
      {root}/my notes/folder
      """
    Then it exits with 0
    And the entry script's node in "node bin" was started with:
      """
      {root}/my repo/installers/core/main.ts
      add
      my-notes
      {root}/my notes/folder
      """
    And the entry script's node in "node bin" saw the agent home "{root}/my home/.agent-config"

  # ---- The way back: the old installer ------------------------------------------------------------------------------

  @posix @pending @T144
  Scenario: FR-035 install.sh --legacy runs the old installer with the other arguments and starts no node
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's legacy installer is a stub that prints its arguments
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with arguments:
      """
      --legacy
      two words
      """
    Then it exits with 0 and prints:
      """
      legacy installer ran
      arg: two words
      """
    And the entry script's node in "pathbin" was never started

  @windows @pending @T145
  Scenario: FR-035 (Windows) install.ps1 -Legacy runs the old installer with the other arguments and starts no node
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's legacy installer is a stub that prints its arguments
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with arguments:
      """
      -Legacy
      two words
      """
    Then it exits with 0 and prints:
      """
      legacy installer ran
      arg: two words
      """
    And the entry script's node in "pathbin" was never started

  @posix @pending @T144
  Scenario: FR-035 install.sh --legacy needs no node on the machine
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's legacy installer is a stub that prints its arguments
    And the entry script's PATH holds the system commands and no node
    When the tool runs with "--legacy"
    Then it exits with 0 and prints:
      """
      legacy installer ran
      """

  @windows @pending @T145
  Scenario: FR-035 (Windows) install.ps1 -Legacy needs no node on the machine
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's legacy installer is a stub that prints its arguments
    And the entry script's PATH holds the system commands and no node
    When the tool runs with "-Legacy"
    Then it exits with 0 and prints:
      """
      legacy installer ran
      """

  @pending @T144 @T145
  Scenario: FR-035 Without the legacy switch the old installer does not run
    Given the entry script has its own copy of the installers in "repo/installers"
    And the entry script's legacy installer is a stub that prints its arguments
    And the entry script has a node in "pathbin" that reports "v24.12.0"
    And the entry script's PATH starts with the folder "pathbin"
    When the tool runs with "install"
    Then it exits with 0
    And the output does not mention "legacy installer ran"
    And the entry script's node in "pathbin" was started with:
      """
      {root}/repo/installers/core/main.ts
      install
      """

  # ---- End to end ------------------------------------------------------------------------------------------------------

  @pending @T138 @T142 @T144 @T145
  Scenario: FR-033 The script of the repository starts the real installer core and returns its exit code
    Given a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the first output line ends with "(default, not confirmed)"
    And the output does not mention "needs: Node"
    And since the snapshot, nothing under "home" changed
    And "home/.agent-config" does not exist
