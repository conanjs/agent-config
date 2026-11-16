# Requirements for the edge cases of the minimal installer (specs/022 T126): EDGE-1 unmanaged files in the home, EDGE-2 two machines,
# EDGE-3 an account that cannot create links, EDGE-4 an interrupted install, EDGE-5 a local entry that wins, EDGE-6 a component removed
# from the lists, EDGE-9 network down on a rerun, EDGE-10 one variable with two descriptions, EDGE-15 concurrent runs and the lock.
# (EDGE-7, 8, 11 to 14 belong to other tasks.) Written before the code: every scenario is @pending with the tasks that make it pass
# (T132 state and lock, T133 sources, T135 variables, T138 install, T139 doctor, T141 uninstall, T142 the test entry).
#
# Setup: tool "installer-edges" is the installer's test entry with the fixture folder "repo" as the agent-config checkout
# (AGENT_CONFIG_TEST_REPO, set by the runner of tool.ts) and path components "notes", "extras" and "notes-public" (also named
# notes) under "sources". The first install asks one question (home confirmation); the scripted terminal answers yes. A git source is
# listed by the path of its local bare repository. V's own list is `home/.agent-config/components.local.yaml`; the public list is
# `repo/components.yaml`. Fault steps come from the installer world; an exit code of 137 is a killed process.
#
# Text the installer must print: every message and exit code is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md.
# Used here: MG-01 and MG-02, MG-20 (override), MG-30 (the lock, its file and its rules), MG-32 (cannot fetch), MG-37 (variables check),
# MG-38 (install failed, with the cause on the next line), MG-39 (the doctor finding interrupted-install).
# The first install asks one question (home confirmation); a git source is listed as https://example.invalid/<name>.git (tool.ts maps it).
# Journal: `home/.agent-config/install-state.pending.json`. "Changing nothing" in EDGE-3 means: no link, no store, no install-state.json,
# no components.lock and no change in the agent folders (the lock file and an empty home folder may come and go).
# Killed runs and the lock (EDGE-4, M-12): a killed process leaves `install.lock` behind on purpose (no exit handler removes it), and the
# clock is fixed, so the leftover lock is fresh. The scenarios that run again after a kill move the clock 11 minutes forward first
# (the lock is then stale and taken over); one scenario stays 9 minutes after the kill and expects MG-30. `doctor` takes the same
# lock, because it replays the journal (restoreFromJournal runs under the lock, T139), so it needs the later clock too.

Feature: Edge cases of the minimal installer
  Unmanaged files stay, machines share nothing committed, failures change nothing, interrupted runs complete or restore, the local
  list wins, removed components go, a downed network does not break a rerun, and two runs never write at once.

  Background:
    Given the base fixture tree of "installer-edges"
    And a temporary home with the agent folders exists
    And a scripted terminal that answers:
      """
      yes
      """

  # ---- EDGE-1 ---------------------------------------------------------------------------------------

  @pending @T138 @T141 @T142
  Scenario: EDGE-1 Files in the home that belong to another tool stay through install and uninstall
    Given the file "home/.agent-config/my-notes.txt" contains:
      """
      not the installer's
      """
    And the file "home/.agent-config/scratch/draft.md" contains:
      """
      a draft
      """
    And the edge setup lists locally the path components "notes"
    When the tool runs with "install"
    Then it exits with 0
    And the file "home/.agent-config/my-notes.txt" contains exactly:
      """
      not the installer's
      """
    And the file "home/.agent-config/scratch/draft.md" contains exactly:
      """
      a draft
      """
    And the file "home/.agent-config/install-state.json" has no line containing "my-notes.txt"
    When the tool runs with "uninstall"
    Then it exits with 0
    And the file "home/.agent-config/my-notes.txt" contains exactly:
      """
      not the installer's
      """
    And "home/.agent-config/scratch/draft.md" exists

  # ---- EDGE-2 ---------------------------------------------------------------------------------------

  @pending @T135 @T138 @T140 @T142
  Scenario: EDGE-2 Install and set write nothing machine-specific into the checkout or the sources
    Given the edge setup lists locally the path components "notes,extras"
    And a snapshot of "repo" is taken
    And a snapshot of "sources" is taken
    When the tool runs with "install"
    And the tool runs with "set NOTES_ROOT=/notes"
    Then it exits with 0
    And since the snapshot, nothing under "repo" changed
    And since the snapshot, nothing under "sources" changed
    And the edge check finds no machine-specific text under "repo"
    And "home/.agent-config/components.lock" exists
    And "home/.agent-config/variables.local.yaml" exists

  @pending @T135 @T138 @T140 @T142 @posix
  Scenario: EDGE-2 A second home on the same account shares no list and no variable with the first
    Given the edge setup lists locally the path components "notes,extras"
    And the tool runs with "install"
    And the tool runs with "set NOTES_ROOT=/notes"
    And the agent home variable is "{root}/elsewhere"
    When the tool runs with "install"
    Then it exits with 0
    And "elsewhere/variables.local.yaml" does not exist
    And "elsewhere/components.local.yaml" does not exist
    And "elsewhere/companies/notes" does not exist
    And "home/.agent-config/companies/notes" exists

  # ---- EDGE-3 ---------------------------------------------------------------------------------------

  @pending @T132 @T138 @T142
  Scenario: EDGE-3 An account that cannot create links exits 1 naming the cause and changes nothing
    Given the edge setup lists locally the path components "notes"
    And the installer cannot create links
    And a snapshot of "home/.claude" is taken
    And a snapshot of "home/.copilot" is taken
    And a snapshot of "home/.codex" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: install failed: cannot create links"
    And "home/.agent-config/install-state.json" does not exist
    And "home/.agent-config/components.lock" does not exist
    And "home/.agent-config/store" does not exist
    And "home/.agent-config/companies" does not exist
    And "home/.agent-config/core" does not exist
    And since the snapshot, nothing under "home/.claude" changed
    And since the snapshot, nothing under "home/.copilot" changed
    And since the snapshot, nothing under "home/.codex" changed

  # ---- EDGE-4 ---------------------------------------------------------------------------------------

  @pending @T132 @T138 @T142
  Scenario: EDGE-4 A process killed between two link switches leaves a journal
    Given the edge setup lists locally the path components "notes"
    And the installer process is killed after link switch 1
    When the tool runs with "install"
    Then it exits with 137
    And "home/.agent-config/install-state.pending.json" exists
    And "home/.agent-config/install-state.json" does not exist

  @pending @T132 @T138 @T142
  Scenario: EDGE-4 The next install completes the interrupted one
    Given the edge setup lists locally the path components "notes"
    And the installer process is killed after link switch 1
    And the tool runs with "install"
    And the edge faults are cleared
    And the clock is fixed at "2026-11-20T09:25:03.000Z"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/install-state.pending.json" does not exist
    And "home/.agent-config/install-state.json" exists
    And the file "home/.agent-config/companies/notes/index.md" contains exactly:
      """
      # notes

      Notes of the local source.
      """
    And "home/.agent-config/core" exists
    And "home/.agent-config/tracker" exists

  @pending @T132 @T138 @T139 @T142
  Scenario: EDGE-4 Doctor reports the half-state, restores the previous state and removes the journal
    Given the edge setup lists locally the path components "notes"
    And the installer process is killed after link switch 1
    And the tool runs with "install"
    And the edge faults are cleared
    And the clock is fixed at "2026-11-20T09:25:03.000Z"
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "error: interrupted-install: {root}/home/.agent-config/install-state.pending.json: restored to the previous state"
    And "home/.agent-config/install-state.pending.json" does not exist
    And "home/.agent-config/core" does not exist
    And "home/.agent-config/companies/notes" does not exist

  @pending @T132 @T138 @T139 @T142
  Scenario: EDGE-4 Nine minutes after a kill the leftover lock still holds, so doctor exits 1 naming it and restores nothing
    Given the edge setup lists locally the path components "notes"
    And the installer process is killed after link switch 1
    And the tool runs with "install"
    And the edge faults are cleared
    And the clock is fixed at "2026-11-20T09:23:03.000Z"
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:14:03.000Z)"
    And "home/.agent-config/install-state.pending.json" exists

  @pending @T132 @T138 @T139 @T142
  Scenario: EDGE-4 After doctor restored the half-state, install completes cleanly
    Given the edge setup lists locally the path components "notes"
    And the installer process is killed after link switch 1
    And the tool runs with "install"
    And the edge faults are cleared
    And the clock is fixed at "2026-11-20T09:25:03.000Z"
    And the tool runs with "doctor"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/companies/notes/index.md" exists
    And "home/.agent-config/install-state.pending.json" does not exist

  # ---- EDGE-5 ---------------------------------------------------------------------------------------

  @pending @T131 @T138 @T142
  Scenario: EDGE-5 A local entry with the same name as a public entry wins and plan shows the override
    Given the edge setup lists publicly the path component "notes" from "notes-public"
    And the edge setup lists locally the path component "notes" from "notes"
    And the tool runs with "install"
    When the tool runs with "plan"
    Then it exits with 0
    And the output has the line "override: notes: local source {root}/sources/notes replaces public source {root}/sources/notes-public"
    And the file "home/.agent-config/companies/notes/index.md" contains exactly:
      """
      # notes

      Notes of the local source.
      """

  @pending @T131 @T138 @T142
  Scenario: EDGE-5 Without a local entry the public source is used and plan shows no override
    Given the edge setup lists publicly the path component "notes" from "notes-public"
    And the tool runs with "install"
    When the tool runs with "plan"
    Then it exits with 0
    And the report has no line starting with "override:"
    And the file "home/.agent-config/companies/notes/index.md" contains exactly:
      """
      # notes

      Notes of the public source.
      """

  # ---- EDGE-6 ---------------------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: EDGE-6 A path component removed from the lists loses its links and its folder is not touched
    Given the edge setup lists locally the path components "notes,extras"
    And the tool runs with "install"
    And a snapshot of "sources" is taken
    And the edge setup lists locally the path components "notes"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/companies/extras" does not exist
    And "home/.agent-config/companies/notes" exists
    And since the snapshot, nothing under "sources" changed

  @pending @T133 @T138 @T142
  Scenario: EDGE-6 A git component removed from the lists loses its links and its managed clone
    Given a local git source "gitnotes" with these files:
      | path                        | content                                                                                                                                                                                                                                                          |
      | component.yaml              | schema: component/v1\nname: gitnotes\nversion: 1.0.0\nslot: company-knowledge-storage\nscope: global\ncontracts:\n  pin: 1\nlocations:\n  content: companies\nprovides:\n  contracts: [company-kb/v1]\n  index: index.md\n  exports: [] |
      | index.md                    | # gitnotes                                                                                                                                                                                                                                                       |
      | companies/gitnotes/index.md | first version                                                                                                                                                                                                                                                    |
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: gitnotes
          source: { type: git, url: https://example.invalid/gitnotes.git, ref: main }
      """
    And the tool runs with "install"
    And "home/.agent-config/components/gitnotes" exists
    And the edge setup lists publicly the path components ""
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/components/gitnotes" does not exist
    And "home/.agent-config/companies/gitnotes" does not exist
    And "git-sources/gitnotes.git" exists

  # ---- EDGE-9 ---------------------------------------------------------------------------------------

  @pending @T133 @T138 @T142
  Scenario: EDGE-9 With the network down a rerun succeeds from the lock where no fetch is needed
    Given a local git source "gitnotes" with these files:
      | path                        | content                                                                                                                                                                                                                                                          |
      | component.yaml              | schema: component/v1\nname: gitnotes\nversion: 1.0.0\nslot: company-knowledge-storage\nscope: global\ncontracts:\n  pin: 1\nlocations:\n  content: companies\nprovides:\n  contracts: [company-kb/v1]\n  index: index.md\n  exports: [] |
      | index.md                    | # gitnotes                                                                                                                                                                                                                                                       |
      | companies/gitnotes/index.md | first version                                                                                                                                                                                                                                                    |
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: gitnotes
          source: { type: git, url: https://example.invalid/gitnotes.git, ref: main }
      """
    And the tool runs with "install"
    And fetching the component "gitnotes" fails
    When the tool runs with "install"
    Then it exits with 0 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: no-changes
      """

  @pending @T133 @T138 @T142
  Scenario: EDGE-9 With the network down an update that needs a fetch fails and keeps the previous link
    Given a local git source "gitnotes" with these files:
      | path                        | content                                                                                                                                                                                                                                                          |
      | component.yaml              | schema: component/v1\nname: gitnotes\nversion: 1.0.0\nslot: company-knowledge-storage\nscope: global\ncontracts:\n  pin: 1\nlocations:\n  content: companies\nprovides:\n  contracts: [company-kb/v1]\n  index: index.md\n  exports: [] |
      | index.md                    | # gitnotes                                                                                                                                                                                                                                                       |
      | companies/gitnotes/index.md | first version                                                                                                                                                                                                                                                    |
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: gitnotes
          source: { type: git, url: https://example.invalid/gitnotes.git, ref: main }
      """
    And the tool runs with "install"
    And the git source "gitnotes" gets a new commit that sets "companies/gitnotes/index.md" to "second version"
    And fetching the component "gitnotes" fails
    When the tool runs with "install --update gitnotes"
    Then it exits with 1
    And the output has the line "error: component gitnotes: cannot fetch git source https://example.invalid/gitnotes.git (ref main)"
    And the file "home/.agent-config/companies/gitnotes/index.md" contains exactly:
      """
      first version
      """

  # ---- EDGE-10 --------------------------------------------------------------------------------------

  @pending @T135 @T138 @T142
  Scenario: EDGE-10 Two components that describe one variable differently fail the install naming both
    Given the edge setup lists locally the path components "notes,extras"
    And in "sources/extras/component.yaml", `description: Folder of notes` becomes `description: Folder with notes`
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: check failed: variables: NOTES_ROOT: extras says \"Folder with notes\", notes says \"Folder of notes\""
    And "home/.agent-config/install-state.json" does not exist
    And "home/.agent-config/companies" does not exist

  @pending @T135 @T138 @T142
  Scenario: EDGE-10 Two components that describe one variable the same way install and list it once
    Given the edge setup lists locally the path components "notes,extras"
    When the tool runs with "install"
    Then it exits with 0
    And the file "home/.agent-config/generated/global-variables.md" has a line containing "NOTES_ROOT"

  # ---- EDGE-15 --------------------------------------------------------------------------------------

  @pending @T132 @T138 @T142 @posix
  Scenario: EDGE-15 A second install while another run holds a fresh lock exits 1 naming the lock and changes nothing
    Given the edge setup lists locally the path components "notes"
    And the tool runs with "install"
    And the edge setup lists locally the path components "notes,extras"
    And the edge lock was taken at "2026-11-20T09:14:03.000Z" by another run
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:14:03.000Z)"
    And "home/.agent-config/companies/extras" does not exist

  @pending @T132 @T138 @T142
  Scenario: EDGE-15 A lock older than the stale timeout is taken over and removed at the end of the run
    Given the edge setup lists locally the path components "notes"
    And the tool runs with "install"
    And the edge setup lists locally the path components "notes,extras"
    And the edge lock was taken at "2026-11-20T08:50:00.000Z" by another run
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/companies/extras" exists
    And "home/.agent-config/install.lock" does not exist

  @pending @T132 @T138 @T142
  Scenario: EDGE-15 A lock just inside the stale timeout still holds
    Given the edge setup lists locally the path components "notes"
    And the tool runs with "install"
    And the edge lock was taken at "2026-11-20T09:04:04.000Z" by another run
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:04:04.000Z)"

  @pending @T132 @T138 @T142
  Scenario: EDGE-15 A failing run still releases the lock
    Given the edge setup lists locally the path components "notes"
    And the installer cannot create links
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: install failed: cannot create links"
    And "home/.agent-config/install.lock" does not exist

  @pending @T132 @T138 @T141 @T142 @posix
  Scenario: EDGE-15 Uninstall while another run holds a fresh lock exits 1 and removes nothing
    Given the edge setup lists locally the path components "notes"
    And the tool runs with "install"
    And the edge lock was taken at "2026-11-20T09:14:03.000Z" by another run
    When the tool runs with "uninstall"
    Then it exits with 1
    And the output has the line "error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:14:03.000Z)"
    And "home/.agent-config/companies/notes" exists

  @pending @T132 @T138 @T142
  Scenario: EDGE-15 The re-render hook with a held lock does nothing, prints nothing and exits 0
    Given the edge setup lists locally the path components "notes"
    And the tool runs with "install"
    And the edge lock was taken at "2026-11-20T09:14:03.000Z" by another run
    And a snapshot of "home/.agent-config/generated" is taken
    When the tool runs with "rerender"
    Then it exits with 0 and prints nothing
    And since the snapshot, nothing under "home/.agent-config/generated" changed
