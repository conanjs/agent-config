# Requirements for the negative security scenarios of the installer (specs/022 T127, decisions/security.md M-01 to M-18). Written before
# the code: each scenario carries @pending and the tasks that make it pass (T131 manifests, T132 state, T133 sources, T135 variables,
# T136 privileged set, T138 install, T140 add, T141 uninstall, T142 test entry). Each scenario is named by its mitigation id first.
#
# FIXTURE. As tests/installer-resolution/resolve.feature: {root}/repo is the agent-config clone (AGENT_CONFIG_TEST_REPO), path components
# live under {root}/home/src: kb-a (knowledge provider), sdlc-x (framework that needs it), sdlc-y and ok-fw (frameworks with no
# dependency), trav (a framework whose manifest has a hook, a route and every path field), scripty (a framework whose folder holds
# package.json, build.mjs, install.sh and Makefile that write {root}/home/marker-scripty if anything runs them).
# https://example.invalid/<name>.git is the local bare git source <name>. The report format, "error: ..." and "warning: ..." lines are
# those of tests/installer-consent/needs.feature. Skipping a component is a warning and the run goes on (exit 0).
#
# TEXT. Every message and exit code is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md: MG-10 (the terminal
# line), MG-21 and MG-22 (a skipped component, submodules: warnings, exit 0), MG-23 (a list that fails its schema), MG-29 (tag moved),
# MG-30 (the lock and its file), MG-34 and MG-35 (credentials, dash, scheme and name refusals of add and of lists).
# install-log.jsonl: one JSON line per run with time (the clock's instant), command, exit, components [{name, source, commit_before,
# commit_after}] and approved_privileged; a path source has commit_before null on its first run and commit_after "live"; no variable
# values. At 1 MiB the file becomes install-log.jsonl.1 (an older .1 is dropped) and a fresh install-log.jsonl starts.
# Permissions (POSIX): the home, the backups folder and every backup folder 0700, every file in them 0600.
# Not covered here, because the world has no way to make it happen: the git fetch timeout of M-05 (needs a fault "fetch hangs"), and
# the Windows access lists of M-10 (the Windows runner and the by-hand step of the plan). M-18 for a detect rule is in
# tests/installer-variables/variables.feature; the build half of M-18 comes with the build in phase 4.

Feature: Hostile input and unattended runs cannot make the installer do harm
  Each scenario tries one way to turn a component, a source or a run into a loss, and shows the installer refuses it.

  Background:
    Given the base fixture tree of "installer-security"
    And a temporary home with the agent folders exists
    And the security home is confirmed

  # ---- M-01: privileged entries need consent -----------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario: M-01 a new privileged entry exits 10 and writes nothing
    Given in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the security local list holds the path components "kb-a, sdlc-x"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "1. privileged: hook guard (claude-code, pre-tool)"
    And since the snapshot, nothing under "home" changed
    And the security approved privileged set is "none"

  @pending @T136 @T138 @T142
  Scenario: M-01 a changed privileged entry exits 10 and writes nothing
    Given in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the security local list holds the path components "kb-a, sdlc-x"
    And a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    And in "home/src/sdlc-x/component.yaml", `guard.mjs` becomes `guard-v2.mjs`
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "   node {{AGENT_HOME}}/core/tools/guard-v2.mjs"
    And since the snapshot, nothing under "home" changed

  @pending @T136 @T138 @T142
  Scenario: M-01 a changed service needs approval again and writes nothing
    Given in "home/src/kb-a/component.yaml", `services: []` becomes `services:\n    - { kind: mcp, name: kb-search, command: node, args: [tools/kb-search.mjs] }`
    And the security local list holds the path components "kb-a"
    And a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    And in "home/src/kb-a/component.yaml", `kb-search.mjs` becomes `kb-search-v2.mjs`
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "   node tools/kb-search-v2.mjs"
    And since the snapshot, nothing under "home" changed

  @pending @T136 @T138 @T142
  Scenario: M-01 the re-render hook never changes the approved privileged set
    Given in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the security local list holds the path components "kb-a, sdlc-x"
    And a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    And the security approved privileged set is remembered
    And in "home/src/sdlc-x/component.yaml", `guard.mjs` becomes `guard-v2.mjs`
    When the tool runs with "rerender"
    Then it exits with 0
    And the security approved privileged set is the one remembered
    When the tool runs with "install"
    Then it exits with 10
    And the output has the line "   node {{AGENT_HOME}}/core/tools/guard-v2.mjs"

  # ---- M-02: install stays on the lock -----------------------------------------------------------------

  @pending @T133 @T138 @T142
  Scenario: M-02 a tag that moved exits 1 naming the component, the tag and both commits, and changes nothing
    Given a local git source "kb-g" with these files:
      | path             | content                                                                                                                                                                                                                                                                |
      | component.yaml   | schema: component/v1\nname: kb-g\nversion: 1.0.0\nslot: knowledge-storage\nrepository: https://github.com/example/kb-g\ncontracts:\n  pin: 1\nlocations:\n  content: content\nprovides:\n  contracts: [knowledge-provider/v1]\n  index: index.md\n  exports: [knowledge/a/b.md] |
      | content/index.md | hello                                                                                                                                                                                                                                                                  |
      | content/a/b.md   | b                                                                                                                                                                                                                                                                      |
    And the git source "kb-g" is tagged "v1.0.0"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-g, source: { type: git, url: 'https://example.invalid/kb-g.git', ref: v1.0.0 } }
      """
    And the tool runs with "install"
    And the git source "kb-g" gets a new commit that sets "content/a/b.md" to "two"
    And the security tag "v1.0.0" of the git source "kb-g" is moved to the newest commit
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the security output has a line matching "^error: tag moved: component kb-g, tag v1\.0\.0, locked [0-9a-f]{40}, now [0-9a-f]{40}$"
    And the security output names the newest commit of the git source "kb-g"
    And since the snapshot, nothing under "home" changed

  @pending @T133 @T138 @T142
  Scenario: M-02 a branch that advanced does not move an install that has a lock
    Given a local git source "kb-g" with these files:
      | path             | content                                                                                                                                                                                                                                                                |
      | component.yaml   | schema: component/v1\nname: kb-g\nversion: 1.0.0\nslot: knowledge-storage\nrepository: https://github.com/example/kb-g\ncontracts:\n  pin: 1\nlocations:\n  content: content\nprovides:\n  contracts: [knowledge-provider/v1]\n  index: index.md\n  exports: [knowledge/a/b.md] |
      | content/index.md | hello                                                                                                                                                                                                                                                                  |
      | content/a/b.md   | b                                                                                                                                                                                                                                                                      |
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-g, source: { type: git, url: 'https://example.invalid/kb-g.git', ref: main } }
      """
    And the tool runs with "install"
    And the git source "kb-g" gets a new commit that sets "content/a/b.md" to "two"
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "status: no-changes"
    And the file "home/.agent-config/knowledge/a/b.md" contains exactly:
      """
      b
      """

  # ---- M-03: names and paths are allow-listed and contained --------------------------------------------

  @pending @T131 @T138 @T142
  Scenario Outline: M-03 a <field> that escapes or breaks the rules skips only that component and writes nothing outside the home
    Given in "home/src/trav/component.yaml", `<from>` becomes `<to>`
    And the security local list holds the path components "trav, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And the security output has a line starting with "warning: component trav is skipped: component.yaml is invalid"
    And "home/.agent-config/frameworks/ok-fw/index.md" exists
    And "home/.agent-config/frameworks/trav" does not exist
    And "outside" does not exist
    And "home/outside" does not exist
    And "home/secret.md" does not exist

    Examples:
      | field         | from                           | to                         |
      | name          | name: trav                     | name: ../trav              |
      | location      | framework: .                   | framework: ../../outside   |
      | index         | index: index.md                | index: ../index.md         |
      | export        | exports: [framework/guide.md]  | exports: [../secret.md]    |
      | skills folder | skills: skills/                | skills: /etc/skills        |
      | agents folder | agents: agents/                | agents: 'C:agents'         |
      | route read    | read: frameworks/trav/index.md | read: '..\index.md'        |
      | path with NUL | index: index.md                | index: "a\0b"              |
      | hook id       | id: trav-hook                  | id: Trav_Hook              |
      | route id      | id: trav-route                 | id: ../route               |

  @pending @T131 @T138 @T142
  Scenario: M-03 a list entry named with a traversal fails the list and writes nothing
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: ../evil, source: { type: path, path: '{root}/home/src/ok-fw' } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the security output has a line starting with "error: {root}/home/.agent-config/components.local.yaml is invalid"
    And since the snapshot, nothing under "home" changed

  @pending @T131 @T140 @T142
  Scenario Outline: M-03 add refuses the name <name> and writes nothing
    Given a snapshot of "home" is taken
    When the tool runs with "add <name> {root}/home/src/ok-fw"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: component name <name> is not valid: use lowercase letters, digits and hyphens, at most 64 (M-03)
      """
    And since the snapshot, nothing under "home" changed

    Examples:
      | name    |
      | ../evil |
      | a/b     |
      | Evil    |

  @pending @T132 @T138 @T141 @T142
  Scenario: M-03 uninstall removes the link and never the folder it points to
    Given the security local list holds the path components "kb-a"
    And the tool runs with "install"
    And "home/.agent-config/knowledge/index.md" exists
    When the tool runs with "uninstall"
    Then it exits with 0
    And "home/.agent-config/knowledge" does not exist
    And "home/src/kb-a/content/index.md" exists
    And "home/src/kb-a/component.yaml" exists

  # ---- M-04: no symlink escape --------------------------------------------------------------------------

  @posix @pending @T133 @T138 @T142
  Scenario: M-04 a symlink in a git clone becomes a plain file that holds the target text
    Given a local git source "kb-g" with these files:
      | path             | content                                                                                                                                                                                                                                                                |
      | component.yaml   | schema: component/v1\nname: kb-g\nversion: 1.0.0\nslot: knowledge-storage\nrepository: https://github.com/example/kb-g\ncontracts:\n  pin: 1\nlocations:\n  content: content\nprovides:\n  contracts: [knowledge-provider/v1]\n  index: index.md\n  exports: [knowledge/a/b.md] |
      | content/index.md | hello                                                                                                                                                                                                                                                                  |
      | content/a/b.md   | b                                                                                                                                                                                                                                                                      |
    And the security git source "kb-g" commits a symlink "content/a/link.md" to "/etc/hostname"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-g, source: { type: git, url: 'https://example.invalid/kb-g.git', ref: main } }
      """
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/components/kb-g/content/a/link.md" is a real file or folder, not a symlink
    And the security file "home/.agent-config/components/kb-g/content/a/link.md" holds exactly the text "/etc/hostname"

  @posix @pending @T131 @T138 @T142
  Scenario: M-04 a link that leaves the component root skips that component and copies nothing from its target
    Given the file "home/secret/key.txt" contains:
      """
      TOPSECRET-FAKE
      """
    And the file "home/src/linky/component.yaml" contains:
      """
      schema: component/v1
      name: linky
      version: 1.0.0
      slot: framework
      scope: per-project
      contracts:
        pin: 1
      locations:
        framework: .
      provides:
        contracts: [framework/v1]
        index: index.md
        exports: []
      """
    And the file "home/src/linky/index.md" contains:
      """
      # linky
      """
    And the security link "home/src/linky/docs/key.md" points to "home/secret/key.txt"
    And the security local list holds the path components "linky, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And the security output has a line starting with "warning: component linky is skipped: symlink docs/key.md leaves the component root"
    And "home/.agent-config/frameworks/ok-fw/index.md" exists
    And "home/.agent-config/frameworks/linky" does not exist
    And the security tree "home/.agent-config" holds no file containing "TOPSECRET-FAKE"

  # ---- M-05: safe git invocation ------------------------------------------------------------------------

  @pending @T131 @T133 @T138 @T142
  Scenario Outline: M-05 a list entry with <what> fails the list and starts no git
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: evil, source: { type: git, url: '<url>', ref: <ref> } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the security output has a line starting with "error: {root}/home/.agent-config/components.local.yaml is invalid"
    And "home/marker" does not exist
    And since the snapshot, nothing under "home" changed

    Examples:
      | what                                | url                              | ref  |
      | a url that starts with a dash       | -oProxyCommand=touch-marker      | main |
      | a ref that starts with a dash       | https://example.invalid/x.git    | -x   |
      | an ext transport                    | ext::sh -c touch% marker         | main |
      | a file transport                    | file:///tmp/x.git                | main |
      | an ssh host that starts with a dash | ssh://-oProxyCommand=touch/x.git | main |

  @pending @T131 @T133 @T140 @T142
  Scenario: M-05 add refuses a source that starts with a dash
    Given a snapshot of "home" is taken
    When the tool runs with "add evil -oProxyCommand=x"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: refused to add evil: a source cannot start with a dash (M-05)
      """
    And since the snapshot, nothing under "home" changed

  @pending @T131 @T133 @T140 @T142
  Scenario Outline: M-05 add refuses the source <source>
    Given a snapshot of "home" is taken
    When the tool runs with "add evil <source>"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: refused to add evil: the source must be an https or ssh git address or an absolute folder (M-05)
      """
    And since the snapshot, nothing under "home" changed

    Examples:
      | source            |
      | ext::sh           |
      | file:///tmp/x.git |
      | relative/folder   |

  @pending @T133 @T138 @T142
  Scenario: M-05 a component with submodules installs, the submodules are ignored and the run warns
    Given a local git source "kb-g" with these files:
      | path             | content                                                                                                                                                                                                                                                                |
      | component.yaml   | schema: component/v1\nname: kb-g\nversion: 1.0.0\nslot: knowledge-storage\nrepository: https://github.com/example/kb-g\ncontracts:\n  pin: 1\nlocations:\n  content: content\nprovides:\n  contracts: [knowledge-provider/v1]\n  index: index.md\n  exports: [knowledge/a/b.md] |
      | content/index.md | hello                                                                                                                                                                                                                                                                  |
      | content/a/b.md   | b                                                                                                                                                                                                                                                                      |
      | .gitmodules      | [submodule "x"]\n  path = x\n  url = https://example.invalid/x.git                                                                                                                                                                                                      |
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-g, source: { type: git, url: 'https://example.invalid/kb-g.git', ref: main } }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "warning: component kb-g has submodules; they are ignored"
    And "home/.agent-config/knowledge/index.md" exists
    And "home/.agent-config/components/kb-g/x" does not exist

  # ---- M-07: no credentials in sources ------------------------------------------------------------------

  @pending @T131 @T138 @T142
  Scenario: M-07 a source URL with credentials fails naming the component only and never prints them
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - { name: kb-g, source: { type: git, url: 'https://vinh:s3cr3t-fake@example.invalid/kb-g.git', ref: main } }
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: component kb-g has a source URL with credentials; keep credentials in git's credential helper or ssh-agent (M-07)
      """
    And the security output has no line containing "s3cr3t-fake"
    And the security output has no line containing "vinh:"
    And since the snapshot, nothing under "home" changed

  @pending @T131 @T140 @T142
  Scenario: M-07 add refuses a source URL with credentials, stores nothing and prints none
    Given a snapshot of "home" is taken
    When the tool runs with "add kb-g https://vinh:s3cr3t-fake@example.invalid/kb-g.git"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: refused to add kb-g: the source URL has credentials; keep credentials in git's credential helper or ssh-agent (M-07)
      """
    And since the snapshot, nothing under "home" changed

  @pending @T131 @T138 @T142
  Scenario: M-07 a token in the query part of a suggested source is never printed
    Given in "home/src/sdlc-x/component.yaml", `required: true` becomes `required: true\n      suggest:\n        source: { type: git, url: 'https://example.invalid/kb-g.git?token=SECRETQUERY', ref: main }`
    And the security local list holds the path components "sdlc-x"
    When the tool runs with "install --json"
    Then the security output has no line containing "SECRETQUERY"
    And stderr is ""

  # ---- M-10: private files stay private -----------------------------------------------------------------

  @posix @pending @T132 @T138 @T142
  Scenario: M-10 the home and the files the installer writes are owner-only
    Given the security local list holds the path components "kb-a"
    When the tool runs with "install"
    Then it exits with 0
    And the security mode of "home/.agent-config" is "700"
    And the security mode of "home/.agent-config/install-state.json" is "600"
    And the security mode of "home/.agent-config/components.lock" is "600"
    And the security mode of "home/.agent-config/install-log.jsonl" is "600"

  @posix @pending @T132 @T135 @T140 @T142
  Scenario: M-10 the backups folder and every backup are owner-only
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: LANGUAGE\n    description: Language the agents answer in`
    And the file "home/.agent-config/variables.local.yaml" contains:
      """
      schema: variables-local/v1
      values:
        LANGUAGE: Vietnamese
      """
    When the tool runs with "set LANGUAGE=English"
    Then it exits with 0
    And the security mode of "home/.agent-config-backups" is "700"
    And the security backups under "home/.agent-config-backups" are owner-only

  # ---- M-11: reports are data, and consent is V's --------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario: M-11 a yes on standard input does not approve privileged changes
    Given in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the security local list holds the path components "kb-a, sdlc-x"
    And a snapshot of "home" is taken
    When the tool runs with "install" and this on stdin:
      """
      yes
      """
    Then it exits with 10
    And the output has the line "   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted"
    And the security approved privileged set is "none"
    And since the snapshot, nothing under "home" changed

  @pending @T136 @T138 @T142
  Scenario: M-11 environment variables do not approve privileged changes
    Given in "home/src/sdlc-x/component.yaml", `hooks: []` becomes `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: node {{AGENT_HOME}}/core/tools/guard.mjs\n    matcher: null`
    And the security local list holds the path components "kb-a, sdlc-x"
    And the security approval variables are set
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the security approved privileged set is "none"
    And since the snapshot, nothing under "home" changed

  @pending @T138 @T142
  Scenario: M-11 neither standard input nor environment variables confirm the home
    Given the file "home/.agent-config/install-state.json" is removed
    And the security approval variables are set
    And a snapshot of "home" is taken
    When the tool runs with "install" and this on stdin:
      """
      yes
      """
    Then it exits with 10
    And the output has the line "   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted"
    And "home/.agent-config/install-state.json" does not exist
    And since the snapshot, nothing under "home" changed

  # ---- M-12: one writer at a time -----------------------------------------------------------------------

  @pending @T132 @T138 @T142
  Scenario: M-12 a second install exits 1 naming the lock held by a fresh run, and changes nothing
    Given the security local list holds the path components "kb-a"
    And the security lock file is held by "install" since "2026-11-20T09:10:00.000Z"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:10:00.000Z)
      """
    And since the snapshot, nothing under "home" changed

  @pending @T132 @T141 @T142
  Scenario: M-12 uninstall takes the same lock
    Given the security local list holds the path components "kb-a"
    And the security lock file is held by "install" since "2026-11-20T09:10:00.000Z"
    And a snapshot of "home" is taken
    When the tool runs with "uninstall"
    Then it exits with 1
    And the output has the line "error: another run holds the lock {root}/home/.agent-config/install.lock (install, started 2026-11-20T09:10:00.000Z)"
    And since the snapshot, nothing under "home" changed

  @pending @T132 @T138 @T142
  Scenario: M-12 the re-render hook only tries the lock, skips and exits 0
    Given the security local list holds the path components "kb-a"
    And the security lock file is held by "install" since "2026-11-20T09:10:00.000Z"
    And a snapshot of "home" is taken
    When the tool runs with "rerender"
    Then it exits with 0
    And since the snapshot, nothing under "home" changed

  @pending @T132 @T138 @T142
  Scenario: M-12 a lock older than ten minutes is stale and taken over, and the lock is released at the end
    Given the security local list holds the path components "kb-a"
    And the security lock file is held by "install" since "2026-11-20T08:00:00.000Z"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/knowledge/index.md" exists
    And "home/.agent-config/install.lock" does not exist

  # ---- M-16: the install log ----------------------------------------------------------------------------

  @pending @T132 @T138 @T142
  Scenario: M-16 a run appends one line with the time, command, exit and the component's source and commits
    Given the security local list holds the path components "kb-a"
    When the tool runs with "install"
    Then it exits with 0
    And the security file "home/.agent-config/install-log.jsonl" has 1 lines
    And the security last log line is for the command "install" with exit 0 at "2026-11-20T09:14:03.000Z"
    And the security last log line lists the component "kb-a" from "{root}/home/src/kb-a" going from "none" to "live"

  @pending @T132 @T138 @T142
  Scenario: M-16 the log is append-only, one line per run, even when nothing changed
    Given the security local list holds the path components "kb-a"
    And the tool runs with "install"
    When the tool runs with "install"
    Then the security file "home/.agent-config/install-log.jsonl" has 2 lines

  @pending @T132 @T135 @T138 @T140 @T142
  Scenario: M-16 the log holds no variable value
    Given in "repo/component.yaml", `variables: []` becomes `variables:\n  - name: LANGUAGE\n    description: Language the agents answer in`
    And the security local list holds the path components "kb-a"
    And the tool runs with "set LANGUAGE=value-for-the-log-test"
    When the tool runs with "install"
    Then it exits with 0
    And the security tree "home/.agent-config/install-log.jsonl" holds no file containing "value-for-the-log-test"

  @pending @T132 @T138 @T142
  Scenario: M-16 a log over 1 MiB is rotated to one previous file and a fresh log starts
    Given the security local list holds the path components "kb-a"
    And the file "home/.agent-config/install-log.jsonl.1" contains:
      """
      {"marker":"older than the previous file"}
      """
    And the file "home/.agent-config/install-log.jsonl" contains:
      """
      {"marker":"the file that will rotate"}
      """
    And 600000 lines are appended to "home/.agent-config/install-log.jsonl"
    When the tool runs with "install"
    Then it exits with 0
    And the file "home/.agent-config/install-log.jsonl.1" has the line "{\"marker\":\"the file that will rotate\"}"
    And the file "home/.agent-config/install-log.jsonl.1" has no line containing "older than the previous file"
    And the security file "home/.agent-config/install-log.jsonl" has 1 lines

  # ---- M-17: hostile YAML ---------------------------------------------------------------------------------

  @pending @T131 @T138 @T142
  Scenario: M-17 a manifest with a custom tag is skipped and the others install
    Given in "home/src/sdlc-y/component.yaml", `version: 1.0.0` becomes `version: !custom 1.0.0`
    And the security local list holds the path components "sdlc-y, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And the security output has a line starting with "warning: component sdlc-y is skipped: component.yaml is invalid"
    And the security output has a line containing "a tag is not allowed"
    And "home/.agent-config/frameworks/ok-fw/index.md" exists

  @pending @T131 @T138 @T142
  Scenario: M-17 a manifest with aliases is skipped, so a billion-laughs file is never expanded
    Given the file "home/src/sdlc-y/component.yaml" contains:
      """
      schema: component/v1
      name: sdlc-y
      version: 1.0.0
      slot: framework
      scope: per-project
      contracts:
        pin: 1
      locations:
        framework: .
      provides:
        contracts: [framework/v1]
        index: index.md
        exports: []
      l0: &l0 [x, x, x, x, x, x, x, x, x]
      l1: &l1 [*l0, *l0, *l0, *l0, *l0, *l0, *l0, *l0, *l0]
      l2: &l2 [*l1, *l1, *l1, *l1, *l1, *l1, *l1, *l1, *l1]
      l3: &l3 [*l2, *l2, *l2, *l2, *l2, *l2, *l2, *l2, *l2]
      l4: &l4 [*l3, *l3, *l3, *l3, *l3, *l3, *l3, *l3, *l3]
      l5: &l5 [*l4, *l4, *l4, *l4, *l4, *l4, *l4, *l4, *l4]
      l6: &l6 [*l5, *l5, *l5, *l5, *l5, *l5, *l5, *l5, *l5]
      l7: &l7 [*l6, *l6, *l6, *l6, *l6, *l6, *l6, *l6, *l6]
      l8: &l8 [*l7, *l7, *l7, *l7, *l7, *l7, *l7, *l7, *l7]
      """
    And the security local list holds the path components "sdlc-y, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And the security output has a line starting with "warning: component sdlc-y is skipped: component.yaml is invalid"
    And the security output has a line containing "aliases (*name) are not allowed"
    And "home/.agent-config/frameworks/ok-fw/index.md" exists

  @pending @T131 @T138 @T142
  Scenario: M-17 a manifest over 256 KiB is skipped without being parsed
    Given the security file "home/src/sdlc-y/component.yaml" grows to 300000 bytes with comment lines
    And the security local list holds the path components "sdlc-y, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And the security output has a line starting with "warning: component sdlc-y is skipped: component.yaml is invalid"
    And the security output has a line containing "byte limit"
    And "home/.agent-config/frameworks/ok-fw/index.md" exists

  @pending @T131 @T138 @T142
  Scenario: M-17 a list with a custom tag fails as a whole and changes nothing
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components: !custom []
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1
    And the security output has a line starting with "error: {root}/home/.agent-config/components.local.yaml is invalid"
    And the security output has a line containing "a tag is not allowed"
    And since the snapshot, nothing under "home" changed

  # ---- M-18: no component code runs at install ------------------------------------------------------------

  @pending @T133 @T138 @T142
  Scenario: M-18 install runs no script of a component, whatever its folder holds
    Given the security local list holds the path components "scripty, ok-fw"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/frameworks/scripty/index.md" exists
    And "home/marker-scripty" does not exist
