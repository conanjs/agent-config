# Requirements for Story 7: re-running is safe, failures keep the old state, and V can inspect and undo (specs/022 T124, AC-7.1 to AC-7.7,
# FR-026, FR-029, FR-030, M-10, TR-4). Written before the installer: every scenario is @pending with the tasks that make it pass
# (T132 state, T138 install and plan, T139 doctor, T140 set, add and use, T141 uninstall, T142 the test entry and main).
# The tool is the installer's test entry, started by the installer world (tests/support/installer-world.ts) with a throwaway home.
#
# Setup used by every scenario. The folder "repo" of the fixture is the agent-config checkout (core slot and the public list
# `repo/components.yaml`); "sources/notes" and "sources/extras" are path components of the slot company-knowledge-storage. The test
# entry reads the checkout folder from AGENT_CONFIG_TEST_REPO (the runner of tool.ts sets it to {root}/repo). The first install asks
# one question (home confirmation) and the scripted terminal answers yes; later runs ask nothing. A git source is listed by the path
# of its local bare repository; the test composition must accept that.
#
# Text the installer must print: every message and exit code is in the catalogue "Messages" of
# specs/022-repo-split/contracts/installer-cli.md. Used here: MG-01 and MG-02 (the first two lines; an install with nothing to do prints
# "status: no-changes"), MG-18 (backup), MG-19 (left), MG-37 (a check of the staged trees failed: schema and exports), MG-39 (the doctor
# findings and their check ids, "error: <check>: <item>: <detail>" with exit 1 and "warning: ..." with exit 0).
# Not covered here, because the code arrives in phase 5 (task T209 and Story 12 and 16 scenarios): the doctor faults of a rendered
# copy that differs from a fresh render, a writable rendered file, a citation that no longer resolves, a merged hook whose command
# does not resolve, and the warnings of an absent agent and of degraded Windows links.
# The backup folder is named by the fixed clock: 20261120091403; the backup-manifest.json lists items with original, backup, kind, hash.

Feature: Re-running is safe, failures keep the old state, and V can inspect and undo
  Running install again changes nothing, a failing update keeps the previous links, anything replaced is backed up first, plan
  shows what apply will do, doctor names each fault, and uninstall removes only what the installer recorded.

  Background:
    Given the base fixture tree of "installer-safety"
    And a temporary home with the agent folders exists
    And a scripted terminal that answers:
      """
      yes
      """
    And the safety list names the path components "notes,extras"

  # ---- AC-7.1 ---------------------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-7.1 A second install with nothing changed reports no changes and rewrites no file
    When the tool runs with "install"
    Then it exits with 0
    Given the mtimes under "home" are set back to 2001
    When the tool runs with "install"
    Then it exits with 0 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: no-changes
      """
    And no mtime under "home" changed, apart from the run logs

  @pending @T138 @T142
  Scenario: AC-7.1 The json report of a second install says no-changes with exit 0
    Given the tool runs with "install"
    When the tool runs with "install --json"
    Then it exits with 0
    And the report field "status" is "no-changes"
    And the report field "exit" is "0"

  @pending @T138 @T142
  Scenario: AC-7.1 A change in one source rewrites only what that change needs
    Given the tool runs with "install"
    And the mtimes under "home" are set back to 2001
    And in "sources/notes/component.yaml", `version: 1.0.0` becomes `version: 1.1.0`
    When the tool runs with "install"
    Then it exits with 0
    And the report has no line starting with "status: no-changes"
    And the mtime of "home/.agent-config/companies/extras" is still 2001

  # ---- AC-7.2 ---------------------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario Outline: AC-7.2 A new version that fails the <check> check keeps the previous links and names the check
    Given the tool runs with "install"
    And the links under "home" are recorded
    And <change>
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "<message>"
    And the links under "home" are as recorded
    And the file "home/.agent-config/companies/notes/index.md" contains exactly:
      """
      # notes

      Notes of the local source.
      """

    Examples:
      | check   | change                                                                                                          | message                                      |
      | schema  | in "sources/notes/component.yaml", `schema: component/v1` becomes `schema: component/v9`                          | error: check failed: schema: notes: component.yaml is not a valid component/v1 manifest |
      | exports | in "sources/notes/component.yaml", `exports: []` becomes `exports: [companies/missing.md]`                         | error: check failed: exports: notes: exported path companies/missing.md does not exist |

  @pending @T138 @T142
  Scenario: AC-7.2 A failed install never writes components.lock or install-state.json
    Given the tool runs with "install"
    And the file "home/.agent-config/components.lock" is remembered
    And the file "home/.agent-config/install-state.json" is remembered
    And in "sources/notes/component.yaml", `schema: component/v1` becomes `schema: component/v9`
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: check failed: schema: notes: component.yaml is not a valid component/v1 manifest"
    And the file "home/.agent-config/components.lock" is as remembered
    And the file "home/.agent-config/install-state.json" is as remembered

  # DR-418 option A (research.md): a component that fails a check goes back to its previous version; the others switch in the same apply.
  # Both components are path sources, so their links are live; the visible change of the passing one is its edited file.
  @pending @T134 @T138 @T142
  Scenario: AC-7.2 One path component fails its schema check, the other component's change is still applied
    Given the tool runs with "install"
    And the links under "home" are recorded
    And in "sources/notes/component.yaml", `schema: component/v1` becomes `schema: component/v9`
    And in "sources/extras/component.yaml", `version: 1.0.0` becomes `version: 1.1.0`
    And in "sources/extras/companies/extras/index.md", `Extras of the local source.` becomes `Extras of the new version.`
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: check failed: schema: notes: component.yaml is not a valid component/v1 manifest"
    And the links under "home" are as recorded
    And the file "home/.agent-config/companies/notes/index.md" contains exactly:
      """
      # notes

      Notes of the local source.
      """
    And the file "home/.agent-config/companies/extras/index.md" contains exactly:
      """
      # extras

      Extras of the new version.
      """

  @pending @T138 @T142 @T133
  Scenario: AC-7.2 A git component whose new commit fails its schema stays on the commit it had
    Given a local git source "gitnotes" with these files:
      | path                        | content                                                                                                                                                                                        |
      | component.yaml              | schema: component/v1\nname: gitnotes\nversion: 1.0.0\nslot: company-knowledge-storage\nscope: global\ncontracts:\n  pin: 1\nlocations:\n  content: companies\nprovides:\n  contracts: [company-kb/v1]\n  index: index.md\n  exports: [] |
      | index.md                    | # gitnotes                                                                                                                                                                                      |
      | companies/gitnotes/index.md | first version                                                                                                                                                                                  |
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: gitnotes
          source: { type: git, url: https://example.invalid/gitnotes.git, ref: main }
      """
    And the tool runs with "install"
    And the git source "gitnotes" gets a new commit that sets "component.yaml" to "schema: component/v9"
    And the links under "home" are recorded
    When the tool runs with "install --update gitnotes"
    Then it exits with 1
    And the output has the line "error: check failed: schema: gitnotes: component.yaml is not a valid component/v1 manifest"
    And the links under "home" are as recorded
    And the file "home/.agent-config/companies/gitnotes/index.md" contains exactly:
      """
      first version
      """

  # ---- AC-7.3 ---------------------------------------------------------------------------------------

  @pending @T132 @T136 @T138 @T142
  Scenario: AC-7.3 A real folder where a link goes is copied to the backups folder first and the report names the backup
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    When the tool runs with "install"
    Then it exits with 0
    And "home/.copilot/patterns" is a symlink to "home/.agent-config/patterns"
    And the backup "20261120091403" lists "home/.copilot/patterns" as a folder
    And the backup "20261120091403" holds the copy "home/.copilot/patterns" of "home/.copilot/patterns/mine.md" with the text "mine"
    And the output has the line "backup: {root}/home/.agent-config-backups/20261120091403"

  @pending @T132 @T136 @T138 @T142 @windows
  Scenario: AC-7.3 (Windows) The backup is under the user profile and the report names it
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    When the tool runs with "install"
    Then it exits with 0
    And the backup "20261120091403" lists "home/.copilot/patterns" as a folder
    And the output has the line "backup: {root}\home\.agent-config-backups\20261120091403"

  @pending @T132 @T138 @T142
  Scenario: AC-7.3 An install that replaces nothing makes no backup folder
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config-backups" does not exist
    And the report has no line starting with "backup:"

  @pending @T132 @T138 @T142 @posix
  Scenario: AC-7.3 The home, the backups folder and every backup are readable by their owner only
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    When the tool runs with "install"
    Then it exits with 0
    And the mode of "home/.agent-config" is "700"
    And the owner-only modes hold under "home/.agent-config-backups"

  @pending @T132 @T138 @T142 @windows
  Scenario: AC-7.3 (Windows) The home and the backups folder grant only the user's own access list, with inheritance off
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    When the tool runs with "install"
    Then it exits with 0
    And the access list of "home/.agent-config" grants no other user and is not inherited
    And the access list of "home/.agent-config-backups" grants no other user and is not inherited

  @pending @T132 @T138 @T139 @T142 @posix
  Scenario: AC-7.3 Doctor warns when the backups folder is readable by others, and exits 0
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    And the mode of "home/.agent-config-backups" is set to "755"
    When the tool runs with "doctor"
    Then it exits with 0
    And the output has the line "warning: permissions: {root}/home/.agent-config-backups: readable by others"

  @pending @T132 @T138 @T140 @T142
  Scenario Outline: AC-7.3 <command> backs up the local file it rewrites before it rewrites it
    Given the tool runs with "install"
    And the safety file "home/.agent-config/<file>" is written with "<prior>"
    And the file "home/.agent-config/<file>" is remembered
    When the tool runs with "<command>"
    Then it exits with 0
    And the backup "20261120091403" holds the remembered file "home/.agent-config/<file>"

    Examples:
      | command                                  | file                  | prior                                                                                              |
      | set NOTES_ROOT=/notes                    | variables.local.yaml  | schema: variables-local/v1\\nvalues:\\n  NOTES_ROOT: /old                                               |
      | add kb {root}/sources/kb                 | components.local.yaml | schema: components-list/v1\\nlocal: true\\ncomponents: []                                          |
      | use notes {root}/sources/notes-public    | components.local.yaml | schema: components-list/v1\\nlocal: true\\ncomponents: []                                          |

  # ---- AC-7.4 ---------------------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-7.4 Plan on a first run, before the home is confirmed, writes nothing
    Given a snapshot of "home" is taken
    When the tool runs with "plan"
    Then it exits with 10
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-7.4 Plan on an installed home writes nothing under the home or any agent folder
    Given the tool runs with "install"
    And the safety list names the path components "notes,extras,kb"
    And a snapshot of "home" is taken
    When the tool runs with "plan"
    Then it exits with 0
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-7.4 (TR-4) The links and generated files that plan lists are exactly the ones apply then changes
    Given the tool runs with "install"
    And the safety list names the path components "notes,extras,kb"
    And a snapshot of "home" is taken
    And the tool runs with "plan --json"
    And the report is remembered
    When the tool runs with "install"
    Then it exits with 0
    And the remembered plan lists the links and generated files changed since the snapshot of "home"

  # ---- AC-7.5 ---------------------------------------------------------------------------------------

  @pending @T138 @T139 @T142
  Scenario: AC-7.5 Doctor on a healthy install exits 0 and prints no fault
    Given the tool runs with "install"
    When the tool runs with "doctor"
    Then it exits with 0
    And the report has no line starting with "error: "

  @pending @T138 @T139 @T142
  Scenario Outline: AC-7.5 Doctor exits 1 and names the item when <fault>
    Given the tool runs with "install"
    And <change>
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "<finding>"

    Examples:
      | fault                                      | change                                                                                           | finding                                                                                                |
      | a link target is gone                      | the folder "sources/notes/companies/notes" is removed                                            | error: link-target-gone: {root}/home/.agent-config/companies/notes: the link target is gone             |
      | a generated file differs from the state    | the safety file "home/.agent-config/generated/global-variables.md" gets the extra line "edited"| error: hash-differs: {root}/home/.agent-config/generated/global-variables.md: differs from install-state.json |
      | a lock entry has no source                 | the safety list names the path components "notes"                                                | error: lock-no-source: extras: components.lock lists it but no list does                                |
      | a component has no valid manifest          | in "sources/notes/component.yaml", `schema: component/v1` becomes `schema: component/v9`            | error: manifest-invalid: notes: component.yaml is not a valid component/v1 manifest                      |
      | a required variable has no value           | in "sources/notes/component.yaml", `description: Folder of notes` becomes `description: Folder of notes\\n    required: true` | error: variable-missing: NOTES_ROOT: required by notes and has no value |
      | a path source is missing                   | the folder "sources/extras" is removed                                                           | error: path-source-missing: extras: path source folder {root}/sources/extras does not exist                                |
      | a link inside a path source leaves its root | "sources/notes/companies/notes/escape" already links to "home"                                    | error: symlink-escape: {root}/sources/notes/companies/notes/escape: leaves the component root           |

  @pending @T136 @T138 @T139 @T142 @posix
  Scenario: AC-7.5 Doctor exits 0 and warns of a path source outside version control and of a compatibility link
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    When the tool runs with "doctor"
    Then it exits with 0
    And the output has the line "warning: not-version-controlled: notes: {root}/sources/notes is not in a git repository (not version-controlled)"
    And the output has the line "warning: compat-link: {root}/home/.copilot/patterns: compatibility link still present"

  @pending @T138 @T139 @T142 @posix
  Scenario: AC-7.5 Doctor exits 0 and warns when an agent file names an old agent-home path
    Given the tool runs with "install"
    And the safety file "home/.claude/CLAUDE.md" gets the extra line "Read ~/.copilot/knowledge/index.md"
    When the tool runs with "doctor"
    Then it exits with 0
    And the output has the line "warning: old-agent-home-path: {root}/home/.claude/CLAUDE.md: names ~/.copilot/knowledge"

  @pending @T138 @T139 @T142
  Scenario: AC-7.5 Doctor prints the count and total size of the backups
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    When the tool runs with "doctor"
    Then the report has a line starting with "warning: backups: 1 backup, "

  # ---- AC-7.6 ---------------------------------------------------------------------------------------

  @pending @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall removes every recorded link and generated file and keeps the path sources and the local files
    Given the tool runs with "install"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components: []
      """
    And the file "home/.agent-config/variables.local.yaml" contains:
      """
      schema: variables-local/v1
      values: {}
      """
    When the tool runs with "uninstall"
    Then it exits with 0
    And "home/.agent-config/companies/notes" does not exist
    And "home/.agent-config/core" does not exist
    And "home/.agent-config/global-variables.md" does not exist
    And "home/.agent-config/generated/global-variables.md" does not exist
    And "sources/notes/companies/notes/index.md" exists
    And "sources/extras/companies/extras/index.md" exists
    And "repo/index.md" exists
    And "home/.agent-config/components.local.yaml" exists
    And "home/.agent-config/variables.local.yaml" exists

  @pending @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall leaves a generated file the user edited, lists it, and removes the rest
    Given the tool runs with "install"
    And the file "home/.agent-config/generated/global-variables.md" contains:
      """
      my own table
      """
    When the tool runs with "uninstall"
    Then it exits with 0
    And the output has the line "left: {root}/home/.agent-config/generated/global-variables.md: edited since install"
    And the file "home/.agent-config/generated/global-variables.md" contains exactly:
      """
      my own table
      """
    And "home/.agent-config/companies/notes" does not exist

  @pending @T132 @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall keeps the backups
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    When the tool runs with "uninstall"
    Then it exits with 0
    And "home/.agent-config-backups/20261120091403/backup-manifest.json" exists

  @pending @T132 @T136 @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall with restore puts back what the install replaced
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    When the tool runs with "uninstall --restore"
    Then it exits with 0
    And "home/.copilot/patterns" is a real file or folder, not a symlink
    And the file "home/.copilot/patterns/mine.md" contains exactly:
      """
      mine
      """

  @pending @T132 @T136 @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall with restore uses the newest backup manifest only and leaves what it does not list
    Given the file "home/.copilot/patterns/mine.md" contains:
      """
      mine
      """
    And the tool runs with "install"
    And the clock is fixed at "2026-11-21T09:14:03.000Z"
    And the file "home/.copilot/references" is removed
    And the file "home/.copilot/references/other.md" contains:
      """
      other
      """
    And the tool runs with "install"
    When the tool runs with "uninstall --restore"
    Then it exits with 0
    And the file "home/.copilot/references/other.md" contains exactly:
      """
      other
      """
    And "home/.copilot/patterns" does not exist

  @pending @T138 @T141 @T142
  Scenario: AC-7.6 Uninstall on a home that was never installed changes nothing and exits 0
    Given a snapshot of "home" is taken
    When the tool runs with "uninstall"
    Then it exits with 0
    And since the snapshot, nothing under "home" changed

  # ---- AC-7.7 ---------------------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-7.7 Plan run twice in a row prints the same report
    Given the tool runs with "install"
    Then it exits with 0
    Given the safety list names the path components "notes,extras,kb"
    And the tool runs with "plan"
    Then it exits with 0
    Given the report is remembered
    When the tool runs with "plan"
    Then it exits with 0
    And the report equals the remembered report

  @pending @T138 @T142
  Scenario: AC-7.7 Plan --json run twice in a row prints the same report
    Given the tool runs with "install"
    Then it exits with 0
    Given the safety list names the path components "notes,extras,kb"
    And the tool runs with "plan --json"
    Then it exits with 0
    Given the report is remembered
    When the tool runs with "plan --json"
    Then it exits with 0
    And the report equals the remembered report

  @pending @T138 @T139 @T142
  Scenario: AC-7.7 Doctor run twice in a row prints the same report
    Given the tool runs with "install"
    Then it exits with 0
    Given the tool runs with "doctor"
    Then it exits with 0
    Given the report is remembered
    When the tool runs with "doctor"
    Then it exits with 0
    And the report equals the remembered report

  @pending @T138 @T139 @T142
  Scenario: AC-7.7 Doctor run twice in a row prints the same report when it has a fault
    Given the tool runs with "install"
    Then it exits with 0
    Given the folder "sources/extras" is removed
    And the tool runs with "doctor"
    Then it exits with 1
    Given the report is remembered
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "error: path-source-missing: extras: path source folder {root}/sources/extras does not exist"
    And the report equals the remembered report
