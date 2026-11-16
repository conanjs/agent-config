# Requirements for the variables of the installer (specs/022 US6, T123, security M-08 and M-18, DR-414). Written before the code: each
# scenario carries @pending and the tasks that make it pass (T135 variables, T137 rendering, T138 install, T140 set, T142 test entry).
#
# FIXTURE. {root}/repo is the agent-config clone (AGENT_CONFIG_TEST_REPO); its component.yaml declares no variable unless a scenario
# edits it. Path components under {root}/home/src, all in the framework slot: vars-a (ALPHA_ROOT, BETA_NAME, GAMMA_DIR, none required),
# vars-b (DELTA_HOME), vars-off (OFF_ONLY, listed by no scenario that expects it), vars-detect (REF_ROOT, required, detect dir-exists
# ~/ws/ref) and bad-detect (a detect of kind command, which the schema refuses: CM-7).
#
# FILES AND TEXT. Every message and exit code is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md: MG-01 and
# MG-02 (first two lines), MG-08 (the variables need and its proposal), MG-17 (set stored a value), MG-21 (a skipped component),
# MG-36 (the set refusals; the secret check comes before the declared check).
#   {root}/home/.agent-config/variables.local.yaml   schema: variables-local/v1, a `values:` map, written by `set` with this exact text
#       schema: variables-local/v1
#       values:
#         NAME: value
#   {root}/home/.agent-config/generated/global-variables.md   one table, header line "| Variable | Value | Description | Declared by |"
#       (VR-1), AGENT_HOME first (value: the home, description "Folder of the agent home", declared by "agent-config"), then the
#       variables of the enabled components, components by name, each in declaration order; no row of a component that is not enabled.
#       {root}/home/.agent-config/global-variables.md links to it.
#   A value in the old ~/.copilot/global-variables.md (a table row "| `{{NAME}}` | <value> | ... |", value other than "<SETUP REQUIRED>")
#   is the proposal of a declared variable that has no value (DR-414); the old file is copied into the backup folder at the first
#   install that replaces it. Nothing is written by a run that exits 10.

Feature: Variables are declared by the component that uses them
  Each component declares the variables its docs use; V sets values once; the installer renders one compact variables file.

  Background:
    Given the base fixture tree of "installer-variables"
    And a temporary home with the agent folders exists
    And the variable home is confirmed

  # ---- AC-6.1: set -------------------------------------------------------------------------------------

  @pending @T135 @T137 @T138 @T140 @T142
  Scenario: AC-6.1 set stores the value in V's private file and the next install renders it
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: LANGUAGE\n    description: Language the agents answer in`
    When the tool runs with "set LANGUAGE=English"
    Then it exits with 0 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: done
      stored LANGUAGE in {root}/home/.agent-config/variables.local.yaml
      """
    And the file "home/.agent-config/variables.local.yaml" contains exactly:
      """
      schema: variables-local/v1
      values:
        LANGUAGE: English
      """
    When the tool runs with "install"
    Then it exits with 0
    And the variable table in "home/.agent-config/generated/global-variables.md" has exactly these rows:
      """
      | AGENT_HOME | {root}/home/.agent-config | Folder of the agent home | agent-config |
      | LANGUAGE | English | Language the agents answer in | agent-config |
      """

  # ---- AC-6.1 and M-08: secrets are refused ------------------------------------------------------------

  @pending @T135 @T140 @T142
  Scenario Outline: M-08 set refuses the secret-like name <name> and stores nothing
    Given a snapshot of "home" is taken
    When the tool runs with "set <name>=anything"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: refused to store <name>: the name contains <word>; variables are public values that every agent reads (M-08)
      """
    And since the snapshot, nothing under "home" changed

    Examples:
      | name          | word     |
      | GITHUB_TOKEN  | TOKEN    |
      | CLIENT_SECRET | SECRET   |
      | DB_PASSWORD   | PASSWORD |
      | MY_APIKEY     | APIKEY   |
      | MY_API_KEY    | API_KEY  |

  @pending @T135 @T140 @T142
  Scenario Outline: M-08 set refuses a value that starts with <prefix> and never prints it
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: LANGUAGE\n    description: Language the agents answer in`
    And a snapshot of "home" is taken
    When the tool runs with "set LANGUAGE=<prefix>0000FAKE"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: refused to store LANGUAGE: the value starts with <prefix>; variables are public values that every agent reads (M-08)
      """
    And the variable output has no line containing "0000FAKE"
    And since the snapshot, nothing under "home" changed

    Examples:
      | prefix      |
      | ghp_        |
      | github_pat_ |
      | sk-         |
      | AKIA        |
      | xox         |

  # ---- AC-6.2: the rendered file holds the union -------------------------------------------------------

  @pending @T135 @T137 @T138 @T142
  Scenario: AC-6.2 Two enabled components that declare 3 and 1 variables give exactly 4 rows plus AGENT_HOME, and none for a disabled component
    Given the variable local list holds the path components "vars-a, vars-b"
    And the variable value file holds:
      """
      ALPHA_ROOT: /data/alpha
      BETA_NAME: beta
      GAMMA_DIR: /data/gamma
      DELTA_HOME: /data/delta
      """
    When the tool runs with "install"
    Then it exits with 0
    And the variable table in "home/.agent-config/generated/global-variables.md" has exactly these rows:
      """
      | AGENT_HOME | {root}/home/.agent-config | Folder of the agent home | agent-config |
      | ALPHA_ROOT | /data/alpha | Folder of alpha files | vars-a |
      | BETA_NAME | beta | Name of beta | vars-a |
      | GAMMA_DIR | /data/gamma | Folder of gamma files | vars-a |
      | DELTA_HOME | /data/delta | Home of delta | vars-b |
      """
    And the variable table in "home/.agent-config/generated/global-variables.md" has no row for "OFF_ONLY"
    And "home/.agent-config/global-variables.md" exists

  # ---- AC-6.3: an undeclared name ----------------------------------------------------------------------

  @pending @T135 @T140 @T142
  Scenario: AC-6.3 set of a name no enabled component declares exits 1 and lists the closest declared names
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: LANGUAGE\n    description: Language the agents answer in`
    And the variable local list holds the path components "vars-a"
    And a snapshot of "home" is taken
    When the tool runs with "set LANGAUGE=English"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: LANGAUGE is not declared by any enabled component
      closest declared names: LANGUAGE
      """
    And since the snapshot, nothing under "home" changed

  @pending @T135 @T140 @T142
  Scenario: AC-6.3 A name declared only by a component that is not enabled is refused too
    Given the variable local list holds the path components "vars-a"
    And a snapshot of "home" is taken
    When the tool runs with "set OFF_ONLY=x"
    Then it exits with 1
    And the variable output has a line starting with "error: OFF_ONLY is not declared by any enabled component"
    And since the snapshot, nothing under "home" changed

  # ---- AC-6.4: detect is a proposal --------------------------------------------------------------------

  @pending @T135 @T137 @T138 @T142
  Scenario: AC-6.4 A detected folder is shown as a proposal, nothing is stored and nothing is rendered
    Given the variable local list holds the path components "vars-detect"
    And the folder "home/ws/ref" exists
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. variables: REF_ROOT
         Folder of references (declared by vars-detect)
         satisfy: set REF_ROOT=<value>
         proposal: ~/ws/ref
      """
    And since the snapshot, nothing under "home" changed
    And "home/.agent-config/variables.local.yaml" does not exist

  @pending @T135 @T137 @T138 @T140 @T142
  Scenario: AC-6.4 The proposal is used only after V runs set
    Given the variable local list holds the path components "vars-detect"
    And the folder "home/ws/ref" exists
    When the tool runs with "set REF_ROOT=~/ws/ref"
    Then it exits with 0
    When the tool runs with "install"
    Then it exits with 0
    And the variable table in "home/.agent-config/generated/global-variables.md" has exactly these rows:
      """
      | AGENT_HOME | {root}/home/.agent-config | Folder of the agent home | agent-config |
      | REF_ROOT | ~/ws/ref | Folder of references | vars-detect |
      """

  @pending @T135 @T138 @T142
  Scenario: AC-6.4 A detect that finds nothing gives a need with no proposal line
    Given the variable local list holds the path components "vars-detect"
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. variables: REF_ROOT
         Folder of references (declared by vars-detect)
         satisfy: set REF_ROOT=<value>
      """

  # ---- M-18: a detect never runs a command -------------------------------------------------------------

  @pending @T131 @T135 @T138 @T142
  Scenario: M-18 A detect rule of kind command is refused and no command runs
    Given the variable local list holds the path components "bad-detect, vars-a"
    And the variable value file holds:
      """
      ALPHA_ROOT: /data/alpha
      """
    When the tool runs with "install"
    Then it exits with 0
    And the variable output has a line starting with "warning: component bad-detect is skipped: component.yaml is invalid"
    And "home/marker-bad-detect" does not exist
    And the variable table in "home/.agent-config/generated/global-variables.md" has no row for "REF_ROOT"

  # ---- AC-6.6: a changed value rewrites only the rendered file -----------------------------------------

  @pending @T135 @T137 @T138 @T140 @T142
  Scenario: AC-6.6 A changed value changes the rendered file and leaves the linked sources untouched
    Given the variable local list holds the path components "vars-a"
    And the variable value file holds:
      """
      ALPHA_ROOT: /data/alpha
      BETA_NAME: beta
      GAMMA_DIR: /data/gamma
      """
    And the tool runs with "install"
    And a snapshot of "home/src" is taken
    And a snapshot of "home/.agent-config/frameworks" is taken
    When the tool runs with "set BETA_NAME=bravo"
    And the tool runs with "install"
    Then it exits with 0
    And the variable table in "home/.agent-config/generated/global-variables.md" has exactly these rows:
      """
      | AGENT_HOME | {root}/home/.agent-config | Folder of the agent home | agent-config |
      | ALPHA_ROOT | /data/alpha | Folder of alpha files | vars-a |
      | BETA_NAME | bravo | Name of beta | vars-a |
      | GAMMA_DIR | /data/gamma | Folder of gamma files | vars-a |
      """
    And since the snapshot, nothing under "home/src" changed
    And since the snapshot, nothing under "home/.agent-config/frameworks" changed

  # ---- DR-414: the old values are offered ---------------------------------------------------------------

  @pending @T135 @T137 @T138 @T140 @T142
  Scenario: DR-414 Values of the old variables file are offered as proposals, a placeholder is not, and the old file is backed up after set
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: AGENT_CONFIG_REPO\n    description: Folder of the agent-config clone\n    required: true\n  - name: LANGUAGE\n    description: Language the agents answer in\n    required: true`
    And the file "home/.copilot/global-variables.md" contains:
      """
      | Variable | Value | Notes |
      |---|---|---|
      | `{{AGENT_HOME}}` | `~/.copilot` | Deployed config root. |
      | `{{AGENT_CONFIG_REPO}}` | `<SETUP REQUIRED>` | Clone of agent-config. |
      | `{{LANGUAGE}}` | English | Default language. |
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. variables: AGENT_CONFIG_REPO
         Folder of the agent-config clone (declared by agent-config)
         satisfy: set AGENT_CONFIG_REPO=<value>
      2. variables: LANGUAGE
         Language the agents answer in (declared by agent-config)
         satisfy: set LANGUAGE=<value>
         proposal: English
      """
    And since the snapshot, nothing under "home" changed
    When the tool runs with "set LANGUAGE=English"
    And the tool runs with "set AGENT_CONFIG_REPO=/work/agent-config"
    And the tool runs with "install"
    Then it exits with 0
    And a backup under "home/.agent-config-backups" holds a file named "global-variables.md" with the line "| `{{LANGUAGE}}` | English | Default language. |"
