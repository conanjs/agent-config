# Requirements for the dependency resolution of the installer (specs/022 US5, T122). Written before the code: each scenario carries
# @pending and the tasks that make it pass (T134 resolver, T138 install, T133 git source, T142 the test entry).
#
# FIXTURE. {root}/repo is the agent-config clone the installer reads (AGENT_CONFIG_TEST_REPO): component.yaml (slot core),
# components.yaml (the public default list, empty unless a scenario writes it) and contracts/slots.yaml with the slots core,
# knowledge-storage (one provider, mount knowledge), company-knowledge-storage (many, mount companies) and framework (many, mount
# frameworks/<name>). The components are path sources under {root}/home/src: kb-a, kb-b (providers of knowledge-provider/v1 with the
# export knowledge/a/b.md), kb-v2 (offers v2 only), kb-both (v1 and v2), sdlc-x (a framework that requires knowledge-provider/v1 and
# cites knowledge/a/b.md in docs/guide.md) and sdlc-y (a framework with no dependency). Every list entry is installed (AC-3.1); a
# slot filled by an entry of either list is "filled". A path source is linked live: its location is a symlink to the folder
# (an absolute target), for example {root}/home/.agent-config/knowledge to {root}/home/src/kb-a/content.
# https://example.invalid/<name>.git stands for the local bare git source <name> (see tool.ts).
#
# TEXT. Every message and exit code is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md: MG-01 and MG-02 (first
# two lines), MG-06 (the components need), MG-21 (a skipped component, a warning, exit 0), MG-24 to MG-28 (the failures of resolution,
# exit 1). A failed run changes nothing and leaves the previous links.

Feature: Dependencies resolve by slot, not by repository name
  A component names the slot and the contract it needs; the installer finds the provider, in either list, and checks versions and exports.

  Background:
    Given the base fixture tree of "installer-resolution"
    And a temporary home with the agent folders exists
    And the resolver home is confirmed

  # ---- AC-5.1, AC-5.2, AC-5.3: where a provider comes from -------------------------------------------

  @pending @T133 @T134 @T138 @T142
  Scenario: AC-5.1 A slot that is already filled is reused and nothing new is fetched
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
        - { name: sdlc-x, source: { type: path, path: '{root}/home/src/sdlc-x' } }
      """
    And the tool runs with "install"
    And fetching the component "kb-g" fails
    And a snapshot of "home/.agent-config" is taken
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "status: no-changes"
    And since the snapshot, nothing under "home/.agent-config" changed

  @pending @T134 @T138 @T142
  Scenario: AC-5.2 An empty slot is filled by the default list
    Given the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - { name: kb-a, source: { type: path, path: '{root}/home/src/kb-a' } }
      """
    And the resolver local list holds the path components "sdlc-x"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/knowledge" is a symlink to "home/src/kb-a/content"
    And "home/.agent-config/frameworks/sdlc-x/index.md" exists

  @pending @T134 @T138 @T142
  Scenario: AC-5.3 In a chain consumer, A, B the provider B is resolved before A is accepted
    Given the file "home/src/co-kb/component.yaml" contains:
      """
      schema: component/v1
      name: co-kb
      version: 1.0.0
      slot: company-knowledge-storage
      contracts:
        pin: 1
      locations:
        content: content
      provides:
        contracts: [company-kb/v1]
        index: index.md
        exports: []
      depends:
        slots:
          - slot: knowledge-storage
            contract: knowledge-provider/v1
            required: true
            docs: []
      """
    And the file "home/src/co-kb/content/index.md" contains:
      """
      # co-kb
      """
    And the file "home/src/sdlc-z/component.yaml" contains:
      """
      schema: component/v1
      name: sdlc-z
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
      depends:
        slots:
          - slot: company-knowledge-storage
            contract: company-kb/v1
            required: true
            docs: []
      """
    And the file "home/src/sdlc-z/index.md" contains:
      """
      # sdlc-z
      """
    And the resolver local list holds the path components "sdlc-z, co-kb, kb-a"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/knowledge/index.md" exists
    And "home/.agent-config/companies/co-kb" exists
    And "home/.agent-config/frameworks/sdlc-z/index.md" exists

  @pending @T134 @T138 @T142
  Scenario: AC-5.3 When B of the chain is missing the need names B's slot and neither consumer nor A is installed
    Given the file "home/src/co-kb/component.yaml" contains:
      """
      schema: component/v1
      name: co-kb
      version: 1.0.0
      slot: company-knowledge-storage
      contracts:
        pin: 1
      locations:
        content: content
      provides:
        contracts: [company-kb/v1]
        index: index.md
        exports: []
      depends:
        slots:
          - slot: knowledge-storage
            contract: knowledge-provider/v1
            required: true
            docs: []
      """
    And the file "home/src/co-kb/content/index.md" contains:
      """
      # co-kb
      """
    And the resolver local list holds the path components "co-kb"
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

  # ---- AC-5.4: cycles ---------------------------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.4 A cycle exits 1, prints the cycle in order and changes nothing
    Given the file "home/src/cyc-a/component.yaml" contains:
      """
      schema: component/v1
      name: cyc-a
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
      depends:
        slots:
          - slot: company-knowledge-storage
            contract: company-kb/v1
            required: true
            docs: []
      """
    And the file "home/src/cyc-b/component.yaml" contains:
      """
      schema: component/v1
      name: cyc-b
      version: 1.0.0
      slot: company-knowledge-storage
      contracts:
        pin: 1
      locations:
        content: .
      provides:
        contracts: [company-kb/v1]
        index: index.md
        exports: []
      depends:
        slots:
          - slot: framework
            contract: framework/v1
            required: true
            docs: []
      """
    And the resolver local list holds the path components "cyc-b, cyc-a"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: dependency cycle: cyc-a -> cyc-b -> cyc-a
      """
    And since the snapshot, nothing under "home" changed

  # ---- AC-5.5: contract majors ------------------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.5 A provider that offers only v2 fails the consumer for v1, names both versions and installs nothing
    Given the resolver local list holds the path components "kb-v2, sdlc-x"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: sdlc-x needs knowledge-provider/v1 from slot knowledge-storage, but kb-v2 offers knowledge-provider/v2
      """
    And since the snapshot, nothing under "home" changed

  @pending @T134 @T138 @T142
  Scenario: AC-5.5 A provider that offers v1 and v2 installs the consumer
    Given the resolver local list holds the path components "kb-both, sdlc-x"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/knowledge/index.md" exists
    And "home/.agent-config/frameworks/sdlc-x/index.md" exists

  # ---- AC-5.6: cited docs must be exported ------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.6 A citation the provider does not export exits 1 naming the consumer file, the citation and the provider
    Given in "home/src/sdlc-x/docs/guide.md", `knowledge/a/b.md` becomes `knowledge/a/c.md`
    And in "home/src/sdlc-x/component.yaml", `docs: [knowledge/a/b.md]` becomes `docs: [knowledge/a/c.md]`
    And the resolver local list holds the path components "kb-a, sdlc-x"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: sdlc-x: docs/guide.md cites knowledge/a/c.md, which kb-a does not export
      """
    And since the snapshot, nothing under "home" changed

  # ---- AC-5.7: one provider or many -------------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.7 A second provider for a one-provider slot exits 1 naming both and the command that picks one
    Given the resolver local list holds the path components "kb-a, kb-b"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: slot knowledge-storage allows one provider but kb-a and kb-b both fill it; pick one with: use <name> <source>
      """
    And since the snapshot, nothing under "home" changed

  @pending @T134 @T138 @T142
  Scenario: AC-5.7 A slot that takes many accepts both, each in its own location
    Given the resolver local list holds the path components "kb-a, sdlc-x, sdlc-y"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/frameworks/sdlc-x/index.md" exists
    And "home/.agent-config/frameworks/sdlc-y/index.md" exists

  # ---- AC-5.8: an unknown slot skips only that component ----------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.8 A component naming an unknown slot is skipped with a warning and the others install
    Given the file "home/src/odd/component.yaml" contains:
      """
      schema: component/v1
      name: odd
      version: 1.0.0
      slot: no-such-slot
      contracts:
        pin: 1
      locations:
        content: .
      provides:
        contracts: []
        exports: []
      """
    And the resolver local list holds the path components "odd, kb-a"
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "warning: component odd is skipped: slot no-such-slot is not in slots/v1"
    And "home/.agent-config/knowledge/index.md" exists
    And "home/.agent-config/odd" does not exist

  # ---- AC-5.9: the runtime -----------------------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: AC-5.9 A runtime older than the component needs exits 1 naming the requirement, the found version and the component
    Given in "home/src/sdlc-x/component.yaml", `docs: [knowledge/a/b.md]` becomes `docs: [knowledge/a/b.md]\n  runtime:\n    node: '>=24.12'`
    And the resolver local list holds the path components "kb-a, sdlc-x"
    And the node version command reports "v24.11.0"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 1 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: failed
      error: component sdlc-x needs node >=24.12, found 24.11.0
      """
    And since the snapshot, nothing under "home" changed

  @pending @T134 @T138 @T142
  Scenario: AC-5.9 A runtime that meets the requirement installs
    Given in "home/src/sdlc-x/component.yaml", `docs: [knowledge/a/b.md]` becomes `docs: [knowledge/a/b.md]\n  runtime:\n    node: '>=24.12'`
    And the resolver local list holds the path components "kb-a, sdlc-x"
    And the node version command reports "v24.12.0"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/frameworks/sdlc-x/index.md" exists

  # ---- SC-008: a provider is swappable -----------------------------------------------------------------

  @pending @T134 @T138 @T142
  Scenario: SC-008 Swapping provider A for provider B leaves the consumer's files byte identical
    Given the resolver local list holds the path components "kb-a, sdlc-x"
    And the tool runs with "install"
    And a snapshot of "home/src/sdlc-x" is taken
    And a snapshot of "home/.agent-config/frameworks" is taken
    And the resolver local list holds the path components "kb-b, sdlc-x"
    When the tool runs with "install"
    Then it exits with 0
    And "home/.agent-config/knowledge" is a symlink to "home/src/kb-b/content"
    And since the snapshot, nothing under "home/src/sdlc-x" changed
    And since the snapshot, nothing under "home/.agent-config/frameworks" changed
