# Requirements for the needs report, the exit codes and the consent of the installer (specs/022 US4, T121). Scenarios are written
# before the code: each carries @pending and the tasks that make it pass (T138 install and plan, T142 the test entry and main.ts).
#
# THE TEXT. Every message, its exit code and its JSON field is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md
# (ids MG-01 to MG-40); this file quotes it and fixes nothing of its own. Used here: MG-01 and MG-02 (the first two lines of every run),
# MG-03 to MG-10 (the need blocks and the terminal line), MG-11 (the questions of the scripted terminal), MG-12 (usage error, exit 2)
# and MG-23 (a list that fails its schema). The installer reads the default list, the core manifest and slots from AGENT_CONFIG_TEST_REPO
# ({root}/repo here). An unconfirmed home is one with no recorded home in install-state.json. A path source stands as "commit: live".

Feature: The installer stops and asks instead of guessing
  When the installer needs something only V can give, it prints everything it needs in one report, changes nothing and exits 10.

  Background:
    Given the base fixture tree of "installer-consent"
    And a temporary home with the agent folders exists

  # ---- AC-4.1 and AC-4.2: components needs, then variables needs --------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.1 A slot nobody fills is a components need with the command, and nothing changes
    Given the consent home is confirmed
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. components: slot knowledge-storage
         contract knowledge-provider/v1, no provider
         satisfy: add <name> <source>
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.2 A variable with no value is a variables need with its description and component, and nothing changes
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `variables: []` becomes `variables:\n  - name: SDLC_LANGUAGE\n    description: Language the agents write documents in\n    required: true`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. variables: SDLC_LANGUAGE
         Language the agents write documents in (declared by sdlc-x)
         satisfy: set SDLC_LANGUAGE=<value>
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.2 Components needs are always reported before variables needs
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `variables: []` becomes `variables:\n  - name: SDLC_LANGUAGE\n    description: Language the agents write documents in\n    required: true`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. components: slot knowledge-storage
         contract knowledge-provider/v1, no provider
         satisfy: add <name> <source>
      2. variables: SDLC_LANGUAGE
         Language the agents write documents in (declared by sdlc-x)
         satisfy: set SDLC_LANGUAGE=<value>
      """

  # ---- AC-4.3: the json document ----------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.3 With --json standard output is one document with the status, the exit code and the needs, and standard error is empty
    Given the consent home is confirmed
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    When the tool runs with "install --json"
    Then it exits with 10
    And the consent report on standard output is this JSON:
      """
      {
        "schema": "install-report/v1",
        "command": "install",
        "status": "needs-input",
        "exit": 10,
        "home": { "path": "{root}/home/.agent-config", "confirmed": true, "source": "recorded" },
        "needs": [
          {
            "kind": "components",
            "item": "slot knowledge-storage",
            "detail": "contract knowledge-provider/v1, no provider",
            "satisfy": "add <name> <source>"
          }
        ],
        "changes": [],
        "findings": [],
        "backup": null
      }
      """
    And stderr is ""

  @pending @T138 @T142
  Scenario: AC-4.3 The json needs keep the order components, then variables
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `variables: []` becomes `variables:\n  - name: SDLC_LANGUAGE\n    description: Language the agents write documents in\n    required: true`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    When the tool runs with "install --json"
    Then the consent report lists the needs in the order "components, variables"
    And stderr is ""

  # ---- AC-4.4: exit codes -----------------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.4 A successful run exits 0, and the same run again exits 0 with no changes
    Given the consent home is confirmed
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "status: done"
    And "home/.agent-config/knowledge/index.md" exists
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "status: no-changes"

  @pending @T138 @T142
  Scenario: AC-4.4 A failed check exits 1 and names the list that failed
    Given the consent home is confirmed
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: yes
      components: []
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the consent output has a line starting with "error: {root}/home/.agent-config/components.local.yaml is invalid"
    And since the snapshot, nothing under "home" changed

  @pending @T142
  Scenario Outline: AC-4.4 <what> exits 2 with one usage line on standard error and nothing on standard output
    Given the consent home is confirmed
    And a snapshot of "home" is taken
    When the tool runs with "<arguments>"
    Then it exits with 2
    And stdout is empty
    And stderr is "usage: agent-config <command> [options]; commands: install, plan, doctor, set, add, use, init-component, uninstall"
    And since the snapshot, nothing under "home" changed

    Examples:
      | what               | arguments            |
      | An unknown command | frobnicate           |
      | An unknown flag    | install --frobnicate |

  # ---- AC-4.5: a suggestion is data, never a ready command --------------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.5 A suggested source is labelled unverified, is never a ready command, and nothing is fetched from it
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `required: true` becomes `required: true\n      suggest:\n        source: { type: git, url: 'https://example.invalid/kb-g.git', ref: main }`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a local git source "kb-g" with these files:
      | path      | content |
      | index.md  | hello   |
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. components: slot knowledge-storage
         contract knowledge-provider/v1, no provider
         satisfy: add <name> <source>
         suggested by sdlc-x, unverified: https://example.invalid/kb-g.git
      """
    And the consent output has no line containing "add kb-g"
    And the consent output has no line containing "add https"
    And "home/.agent-config/components" does not exist
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.5 In the json the suggestion carries its component, verified false and the source
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `required: true` becomes `required: true\n      suggest:\n        source: { type: git, url: 'https://example.invalid/kb-g.git', ref: main }`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    When the tool runs with "install --json"
    Then the consent report has this need at position 1:
      """
      {
        "kind": "components",
        "item": "slot knowledge-storage",
        "detail": "contract knowledge-provider/v1, no provider",
        "satisfy": "add <name> <source>",
        "suggested": { "by": "sdlc-x", "verified": false, "source": "https://example.invalid/kb-g.git" }
      }
      """

  # ---- AC-4.6: privileged changes ---------------------------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.6 A new hook is a privileged need listed in full with its component and commit, and nothing is written
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. privileged: hook guard (claude-code, pre-tool)
         node {{AGENT_HOME}}/core/tools/guard.mjs
         matcher: all tools
         component: sdlc-x, commit: live
         satisfy: install (interactive) and approve
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.6 A new route is a privileged need listed in full
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `routes: []` becomes `routes:\n  - id: guide\n    when: The project has a .specify folder\n    read: frameworks/sdlc-x/index.md`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. privileged: route guide
         when: The project has a .specify folder; read: frameworks/sdlc-x/index.md
         component: sdlc-x, commit: live
         satisfy: install (interactive) and approve
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.6 A new service is a privileged need listed in full
    Given the consent home is confirmed
    And in "home/src/kb-a/component.yaml", `services: []` becomes `services:\n    - { kind: mcp, name: kb-search, command: node, args: [tools/kb-search.mjs] }`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. privileged: service kb-search (mcp)
         node ["tools/kb-search.mjs"]
         component: kb-a, commit: live
         satisfy: install (interactive) and approve
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.6 Approving at an interactive terminal records the set, and the same set needs no second approval
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a scripted terminal that answers:
      """
      yes
      """
    When the tool runs with "install"
    Then it exits with 0
    And the consent state records an approved privileged set
    Given no terminal is attached
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "status: no-changes"

  @pending @T138 @T142
  Scenario: AC-4.6 A hook changed after approval is a new need again
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    And in "home/src/sdlc-x/component.yaml", `guard.mjs` becomes `guard-v2.mjs`
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: needs-input
      1. privileged: hook guard (claude-code, pre-tool)
         node {{AGENT_HOME}}/core/tools/guard-v2.mjs
         matcher: all tools
         component: sdlc-x, commit: live
         satisfy: install (interactive) and approve
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.6 Answering no at the terminal approves nothing, writes nothing and exits 10
    Given the consent home is confirmed
    And in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And a scripted terminal that answers:
      """
      no
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "status: needs-input"
    And the consent state records no approved privileged set
    And since the snapshot, nothing under "home" changed

  # ---- AC-4.7: consent needs an interactive terminal --------------------------------------------------

  @pending @T138 @T142
  Scenario: AC-4.7 An unconfirmed home with no terminal exits 10, says a terminal is needed and writes nothing
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (default, not confirmed)
      status: needs-input
      1. home: {root}/home/.agent-config
         confirm the agent home
         satisfy: install (interactive) and answer yes
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.7 A yes on standard input with no terminal is not a confirmation
    And a snapshot of "home" is taken
    When the tool runs with "install" and this on stdin:
      """
      yes
      """
    Then it exits with 10
    And the output has the line "   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted"
    And "home/.agent-config/install-state.json" does not exist
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.7 A yes at an interactive terminal confirms the home and the install goes on
    Given a scripted terminal that answers:
      """
      yes
      """
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "agent home: {root}/home/.agent-config (default, confirmed)"
    And "home/.agent-config/install-state.json" exists
    And "home/.agent-config/knowledge/index.md" exists

  @pending @T138 @T142
  Scenario: AC-4.7 An answer other than yes leaves the home unconfirmed
    Given a scripted terminal that answers:
      """
      maybe
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "status: needs-input"
    And "home/.agent-config/install-state.json" does not exist
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: AC-4.7 With a json report and no terminal the home need is still one document and standard error is empty
    When the tool runs with "install --json"
    Then it exits with 10
    And the consent report has this need at position 1:
      """
      {
        "kind": "home",
        "item": "{root}/home/.agent-config",
        "detail": "confirm the agent home",
        "satisfy": "install (interactive) and answer yes",
        "terminal": "needed"
      }
      """
    And stderr is ""
