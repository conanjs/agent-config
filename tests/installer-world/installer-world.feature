# Requirements for the scenario world of the installer (specs/022 T117) and its fault adapter (T118).
# The installer does not exist yet, so a stand-in, tests/installer-world/stand-in.ts, reads the same test settings as the real
# test entry will and drives small ports through the fault adapter; each piece is observed from outside. The code is
# tests/support/installer-world.ts, installer-test-settings.ts, fault-adapters.ts and seam-guard.ts. The later installer features
# (T119 to T128) use these steps and register their own tool with `installerRunner('tests/support/installer-test-main.ts')`.
#
# T117 scenarios: a temporary home with the agent folders, local bare git repositories, the fixed clock, the scripted terminal,
# the replaceable node version command, exact text compare. T118 scenarios: each fault fails the one operation it names and
# nothing else; the production tiers cannot reach the fault adapter. Scenario T118-10 is written first and made to pass by the
# CompositionRoot task.

Feature: Scenario world and fault adapter of the installer
  Installer scenarios run on a throwaway home with no network, no real clock and no real terminal, and can make one
  operation fail on purpose without ever faking a success.

  Background:
    Given the base fixture tree of "installer-world"

  # ---- T117: the world --------------------------------------------------------------------------------

  Scenario: T117-1 The temporary home holds the agent folders and nothing the installer creates
    Given a temporary home with the agent folders exists
    Then "home/.claude" exists
    And "home/.copilot" exists
    And "home/.codex" exists
    And "home/.agents/skills" exists
    And "home/.agent-config" does not exist
    And "home/.agent-config-backups" does not exist

  @posix
  Scenario: T117-2 The installer runs with HOME set to the temporary home and no agent home variable
    Given a temporary home with the agent folders exists
    When the tool runs with "env"
    Then it exits with 0 and prints:
      """
      home={root}/home
      agent-config-home=
      terminal=absent
      faults=0
      """

  @windows
  Scenario: T117-2 (Windows) The installer runs with HOME set to the temporary home and no agent home variable
    Given a temporary home with the agent folders exists
    When the tool runs with "env"
    Then it exits with 0 and prints:
      """
      home={root}\home
      agent-config-home=
      terminal=absent
      faults=0
      """

  @posix
  Scenario: T117-3 A scenario can set the agent home variable
    Given the agent home variable is "{root}/elsewhere"
    When the tool runs with "env"
    Then the output has the line "agent-config-home={root}/elsewhere"

  Scenario: T117-4 A local bare git repository is a git source that clones with no network
    Given a local git source "core" with these files:
      | path           | content               |
      | component.yaml | name: core\nversion: 1 |
      | docs/a.md      | hello                 |
    When the tool runs with "clone {root}/git-sources/core.git {root}/clone/core"
    Then it exits with 0
    And the folder "clone/core" is a clone of the git source "core"
    And the file "clone/core/component.yaml" contains exactly:
      """
      name: core
      version: 1
      """

  Scenario: T117-5 A new commit and a tag reach the clone, and the clone sees the newest commit
    Given a local git source "core" with these files:
      | path      | content |
      | docs/a.md | one     |
    And the git source "core" is tagged "v1.0.0"
    And the git source "core" gets a new commit that sets "docs/a.md" to "two"
    When the tool runs with "clone {root}/git-sources/core.git {root}/clone/core"
    Then the folder "clone/core" is a clone of the git source "core"
    And the git source "core" has the tag "v1.0.0"
    And the tag "v1.0.0" of the git source "core" is not the newest commit
    And the file "clone/core/docs/a.md" contains exactly:
      """
      two
      """

  Scenario: T117-6 The same files give the same commit id, other files another
    Given a local git source "core" with these files:
      | path | content |
      | a.md | same    |
    And a local git source "core-copy" with these files:
      | path | content |
      | a.md | same    |
    And a local git source "other" with these files:
      | path | content   |
      | a.md | different |
    Then the git source "core-copy" is at the same commit as "core"
    And the git source "other" is not at the same commit as "core"

  Scenario: T117-7 The clock stands at a fixed instant unless a scenario moves it
    When the tool runs with "now"
    Then it exits with 0 and prints:
      """
      now=2026-11-20T09:14:03.000Z
      stamp=20261120091403
      """

  Scenario: T117-8 A scenario can move the clock
    Given the clock is fixed at "2027-01-02T03:04:05.000Z"
    When the tool runs with "now"
    Then it exits with 0 and prints:
      """
      now=2027-01-02T03:04:05.000Z
      stamp=20270102030405
      """

  Scenario: T117-9 No terminal is attached by default, so a question cannot be answered
    When the tool runs with "terminal Confirm?"
    Then it exits with 1
    And the output has the line "interactive=false"
    And the output has the line "no terminal is attached: \"Confirm?\" must not be asked"

  Scenario: T117-10 A scripted terminal answers in order, and never invents an answer
    Given a scripted terminal that answers:
      """
      yes
      no
      """
    When the tool runs with arguments:
      """
      terminal
      Confirm home?
      Approve hook?
      Anything else?
      """
    Then it exits with 1
    And the output has the line "interactive=true"
    And the output has the line "Confirm home? -> yes"
    And the output has the line "Approve hook? -> no"
    And the output has the line "the scripted terminal has no answer for question 3: \"Anything else?\""

  Scenario: T117-11 The node version command reports the version a scenario gives it
    Given the node version command reports "v23.9.0"
    When the tool runs with "node-version"
    Then it exits with 0 and prints:
      """
      node=v23.9.0
      """

  Scenario: T117-12 Output is compared exactly, with the fixed clock's stamp and date-time written as <timestamp>
    When the tool runs with "report"
    Then the output equals, ignoring timestamps:
      """
      Backed up to <timestamp> at <timestamp>
      """
    And the output has the line "Backed up to 20261120091403 at 2026-11-20T09:14:03.000Z"

  # ---- T118: the fault adapter ------------------------------------------------------------------------

  Scenario: T118-1 Failing write number 2 fails that write only, and the run stops there
    Given a temporary home with the agent folders exists
    And the installer fails write number 2
    When the tool runs with "write a.txt b.txt c.txt"
    Then it exits with 1 and prints:
      """
      a.txt: done
      b.txt: failed: EIO injected
      """
    And "home/out/a.txt" exists
    And "home/out/b.txt" does not exist
    And "home/out/c.txt" does not exist

  Scenario: T118-2 A fault the run never reaches changes nothing
    Given the installer fails write number 4
    When the tool runs with "write a.txt b.txt c.txt"
    Then it exits with 0 and prints:
      """
      a.txt: done
      b.txt: done
      c.txt: done
      """

  Scenario: T118-3 With links not permitted every link creation fails and a read still works
    Given the installer cannot create links
    And the file "home/out/a.link" contains:
      """
      somewhere
      """
    When the tool runs with "link b c"
    Then it exits with 1 and prints:
      """
      b: failed: EPERM injected
      """
    And "home/out/b.link" does not exist
    When the tool runs with "link-read a"
    Then it exits with 0 and prints:
      """
      read somewhere
      """

  Scenario: T118-4 Without the fault a link is created
    When the tool runs with "link b"
    Then it exits with 0 and prints:
      """
      b: done
      """
    And "home/out/b.link" exists

  Scenario: T118-5 A fetch fails for the named component only
    Given a local git source "core" with these files:
      | path | content |
      | a.md | one     |
    And a local git source "agentic-sdlc" with these files:
      | path | content |
      | a.md | two     |
    And fetching the component "core" fails
    When the tool runs with "fetch core agentic-sdlc"
    Then it exits with 1 and prints:
      """
      core: failed: FETCH_FAILED injected
      agentic-sdlc: fetched
      """
    And "home/out/core" does not exist
    And "home/out/agentic-sdlc/a.md" exists

  Scenario: T118-6 The process is killed between two link switches, and the first switch stays done
    Given the installer process is killed after link switch 1
    When the tool runs with "switch 3"
    Then it exits with 137
    And "home/out/switch-1" exists
    And "home/out/switch-2" does not exist
    And "home/out/switch-3" does not exist

  Scenario: T118-7 A kill planned after a switch that never happens does not fire
    Given the installer process is killed after link switch 5
    When the tool runs with "switch 3"
    Then it exits with 0
    And "home/out/switch-3" exists

  Scenario: T118-8 The faults are written as text in one environment variable
    When the tool runs with "faults fail-write:3,fail-write-at:install-state.json,links-denied:junction,fetch-fails:core,kill-after-switch:2,kill-at:before-commit"
    Then it exits with 0 and prints:
      """
      {"kind":"fail-nth-write","n":3}
      {"kind":"fail-write-at","suffix":"install-state.json"}
      {"kind":"links-not-permitted","linkKind":"junction"}
      {"kind":"fetch-fails","component":"core"}
      {"kind":"kill","point":"after-switch","n":2}
      {"kind":"kill","point":"before-commit"}
      """

  Scenario: T118-9 An unknown fault is refused
    When the tool runs with "faults succeed-always"
    Then it exits with 1
    And the output has the line "unknown fault \"succeed-always\" (known: fail-write:<n>, fail-write-at:<suffix>, links-denied[:symlink|:junction], fetch-fails:<component>, kill-at:<before-first-switch|after-switch:<k>|mid-switch:<k>|before-commit>, kill-after-switch:<k>)"

  @pending @T142
  Scenario: T118-10 The production entry ignores every test variable
    Given the base fixture tree of "installer-production"
    And a temporary home with the agent folders exists
    And the installer fails write number 1
    And the installer cannot create links
    And the installer process is killed after link switch 1
    When the tool runs with "install"
    Then it exits with 10
    And the output does not mention "injected fault"

  Scenario: T118-18 A write is failed by its path, whatever number it is
    Given the installer fails the write of "install-state.json"
    When the tool runs with "commit"
    Then it exits with 1 and prints:
      """
      install-state.json: failed: EIO injected
      """
    And "home/out/install-state.json" does not exist

  Scenario: T118-19 Links not permitted can be limited to one kind
    Given the installer cannot create symlinks
    When the tool runs with "link-kind junction j"
    Then it exits with 0 and prints:
      """
      j: done
      """
    When the tool runs with "link-kind symlink s"
    Then it exits with 1 and prints:
      """
      s: failed: EPERM injected
      """

  Scenario: T118-20 The process is killed before the first switch, so no switch happened
    Given the installer process is killed at "before-first-switch"
    When the tool runs with "switch 2"
    Then it exits with 137
    And "home/out/switch-1" does not exist

  Scenario: T118-21 The process is killed after the last switch, a point an alias cannot name differently
    Given the installer process is killed at "after-switch:2"
    When the tool runs with "switch 2"
    Then it exits with 137
    And "home/out/switch-2" exists

  Scenario: T118-22 The process is killed between the removal and the creation of a composed switch
    Given the file "home/out/1.link" contains:
      """
      old
      """
    And the installer process is killed at "mid-switch:1"
    When the tool runs with "switch-composed 2"
    Then it exits with 137
    And "home/out/1.link" does not exist

  Scenario: T118-23 The process is killed before the commit of install-state.json
    Given the installer process is killed at "before-commit"
    When the tool runs with "commit"
    Then it exits with 137
    And "home/out/install-state.json.tmp" exists
    And "home/out/install-state.json" does not exist

  Scenario: T118-24 The same scenario can run again without faults after a failed run
    Given the installer process is killed at "before-commit"
    When the tool runs with "commit"
    Then it exits with 137
    Given the installer runs without faults from now on
    When the tool runs with "commit"
    Then it exits with 0
    And "home/out/install-state.json" exists

  Scenario: T117-13 The clock can move between two runs
    When the tool runs with "now"
    Then the output has the line "stamp=20261120091403"
    Given the clock is fixed at "2027-01-02T03:04:05.000Z"
    When the tool runs with "now"
    Then the output has the line "stamp=20270102030405"

  Scenario: T117-14 The git version command reports the version a scenario gives it
    Given the git version command reports "git version 2.50.1"
    When the tool runs with "git-version"
    Then it exits with 0 and prints:
      """
      git=git version 2.50.1
      """

  @pending @T142 @T133
  Scenario: T118-17 The production entry refuses a git source that is a local path
    Given the base fixture tree of "installer-production"
    And a temporary home with the agent folders exists
    And a local git source "core" with these files:
      | path           | content    |
      | component.yaml | name: core |
    When the tool runs with "add core {root}/git-sources/core.git"
    Then it exits with 1
    And "home/.agent-config/store" does not exist

  # ---- T118: the production tiers cannot reach the fault adapter ---------------------------------------

  Scenario: T118-11 The production tiers of this repository name no test seam
    Then the production tiers of the repository name no test seam

  Scenario: T118-12 A production file that imports the fault adapter is reported
    Given the file "installers/core/src/CompositionRoot.ts" contains:
      """
      import { createFaultInjector } from '../../../tests/support/fault-adapters.ts';
      """
    When the tool runs with "seam-scan installers"
    Then it exits with 1 and prints:
      """
      installers/core/src/CompositionRoot.ts:1: imports a path under tests/
      installers/core/src/CompositionRoot.ts:1: names a ../tests/ path
      installers/core/src/CompositionRoot.ts:1: names a test support file
      """

  Scenario: T118-13 A production file that reads a test variable is reported
    Given the file "installers/core/src/CompositionRoot.ts" contains:
      """
      const faults = process.env['AGENT_CONFIG_TEST_FAULT'];
      """
    When the tool runs with "seam-scan installers"
    Then it exits with 1 and prints:
      """
      installers/core/src/CompositionRoot.ts:1: names a test environment variable
      """

  Scenario: T118-14 A computed import in a production file is reported
    Given the file "installers/core/main.ts" contains:
      """
      const adapters = await import(process.argv[2]);
      """
    When the tool runs with "seam-scan installers"
    Then it exits with 1 and prints:
      """
      installers/core/main.ts:1: imports a computed path
      """

  Scenario: T118-15 A production tree with only literal imports of its own files has no leak
    Given the file "installers/core/main.ts" contains:
      """
      import { composeInstaller } from './src/CompositionRoot.ts';
      const later = await import('./src/later.ts');
      """
    When the tool runs with "seam-scan installers"
    Then it exits with 0 and prints:
      """
      no leaks
      """

  Scenario: T118-16 A unit test next to production code may use the test support
    Given the file "installers/core/src/CompositionRoot.test.ts" contains:
      """
      import { createFaultInjector } from '../../../tests/support/fault-adapters.ts';
      """
    When the tool runs with "seam-scan installers"
    Then it exits with 0 and prints:
      """
      no leaks
      """
