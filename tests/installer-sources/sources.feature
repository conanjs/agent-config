# Requirements for the component sources and the two lists (specs/022 Story 3, T120). Written before the code (installer
# core T129 to T146, test entry T142; the local-file check scripts/check-local-files.ts, T150) and @pending until then.
#
# How the scenarios run: tests/installer-sources/tool.ts. The installer runs through the test entry on a throwaway home;
# {root}/repo is the agent-config folder with a public list (components.yaml, empty unless a scenario writes it) and core's
# manifest; a git source named N is the local bare repository {root}/git-sources/N.git, which a list names as
# https://example.invalid/N.git (git maps that prefix to the local folder). The home is confirmed once, by a scripted terminal
# answering yes in the Background (Story 2). The components of the scenarios fill the slots knowledge-storage and framework.
#
# Text the code must match: every message and exit code is in the catalogue "Messages" of specs/022-repo-split/contracts/installer-cli.md.
# Used here: MG-14 (component lines), MG-15 (updated), MG-16 (wrote), MG-21 (a skipped component: a warning, exit 0), MG-29 (tag moved),
# MG-31 (path folder missing), MG-32 (cannot fetch), MG-33 (init-component refuses), MG-39 (the doctor findings manifest-missing,
# path-source-missing and not-version-controlled), MG-40 (the local-file check script: one line per file, exit 1; or "ok: ...", exit 0).
# A skipped component makes `install` exit 0 and `doctor` exit 1; a component that is "required by another" cannot be named from
# the data model (the slot of an archive entry is unknown without a manifest), so that half of AC-3.7 is not tested here.
# The lock is {home}/.agent-config/components.lock (JSON): components.<name>.resolved is {commit} or {live: true, path}.
# A component is linked at its slot mount: knowledge-storage content at {home}/.agent-config/knowledge.

Feature: Components come from git or a local folder, listed in two files
  A component is a git repository or a local folder. Both work the same; a plain install stays on the locked commit.

  Background:
    Given the base fixture tree of "installer-sources"
    And a temporary home with the agent folders exists
    And a scripted terminal that answers:
      """
      yes
      """

  # ---- AC-3.1 -------------------------------------------------------------------------------------------

  @pending @T131 @T133 @T138 @T142 @T147
  Scenario: AC-3.1 A git entry gets a managed clone at the commit its ref resolves to, and the slot location is linked
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the source output has the component line for "agent-knowledge" on ref "main" at the head of its git source
    And the source clone "home/.agent-config/components/agent-knowledge" is at the head of the git source "agent-knowledge"
    And the source lock commit of "agent-knowledge" is the head of its git source
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """

  @pending @T133 @T138 @T142
  Scenario: AC-3.1 A later plain install never moves a git source to a newer commit
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And the tool runs with "install"
    And the source lock commit of "agent-knowledge" is noted
    And the git source "agent-knowledge" gets a new commit that sets "index.md" to "# newer"
    When the tool runs with "install"
    Then it exits with 0
    And the source output has the component line for "agent-knowledge" at the noted commit
    And the source lock commit of "agent-knowledge" is the noted one
    And the source clone "home/.agent-config/components/agent-knowledge" is at the noted commit of "agent-knowledge"
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """

  # ---- AC-3.2 -------------------------------------------------------------------------------------------

  @pending @T131 @T133 @T138 @T142
  Scenario: AC-3.2 A local path entry wins, links live with no copy, and the lock records live
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And the source component "agent-knowledge" for the slot "knowledge-storage" is a folder "work/agent-knowledge"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/work/agent-knowledge }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "component agent-knowledge: path {root}/work/agent-knowledge (live)"
    And the source link "home/.agent-config/knowledge" resolves to the folder "work/agent-knowledge"
    And the source lock records "agent-knowledge" as a live link to "{root}/work/agent-knowledge"
    And "home/.agent-config/components/agent-knowledge" does not exist
    Given the file "work/agent-knowledge/index.md" contains:
      """
      # edited in place
      """
    Then the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # edited in place
      """

  @pending @T131 @T133 @T138 @T139 @T142
  Scenario: AC-3.2 Doctor warns that a path source is not version-controlled and still exits 0
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a folder "work/agent-knowledge"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/work/agent-knowledge }
      """
    And the tool runs with "install"
    When the tool runs with "doctor"
    Then it exits with 0
    And the output has the line "warning: not-version-controlled: agent-knowledge: {root}/work/agent-knowledge is not in a git repository (not version-controlled)"

  # ---- AC-3.3 -------------------------------------------------------------------------------------------

  @pending @T131 @T133 @T138 @T139 @T142
  Scenario: AC-3.3 A path source whose folder is missing exits 1, names the folder and leaves earlier links alone
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And the tool runs with "install"
    And the source link "home/.agent-config/knowledge" is noted
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/missing }
      """
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: component agent-knowledge: path source folder {root}/missing does not exist"
    And the source link "home/.agent-config/knowledge" still resolves to the noted target

  @pending @T131 @T133 @T139 @T142
  Scenario: AC-3.3 Doctor fails with the same message for a missing path folder
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/missing }
      """
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "error: path-source-missing: agent-knowledge: path source folder {root}/missing does not exist"

  # ---- AC-3.4 -------------------------------------------------------------------------------------------

  @pending @T133 @T138 @T142
  Scenario: AC-3.4 A git source that cannot be fetched keeps the previous version linked and exits 1
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And the tool runs with "install"
    And the source lock commit of "agent-knowledge" is noted
    And the source link "home/.agent-config/knowledge" is noted
    And the git source "agent-knowledge" gets a new commit that sets "index.md" to "# newer"
    And fetching the component "agent-knowledge" fails
    When the tool runs with "install --update"
    Then it exits with 1
    And the output has the line "error: component agent-knowledge: cannot fetch git source https://example.invalid/agent-knowledge.git (ref main)"
    And the source link "home/.agent-config/knowledge" still resolves to the noted target
    And the source lock commit of "agent-knowledge" is the noted one
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """

  @pending @T133 @T138 @T142
  Scenario: AC-3.4 A source that no longer exists is the same failure, with the previous version linked
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And the tool runs with "install"
    And the source link "home/.agent-config/knowledge" is noted
    And the source bare repository of "agent-knowledge" is deleted
    When the tool runs with "install --update"
    Then it exits with 1
    And the output has the line "error: component agent-knowledge: cannot fetch git source https://example.invalid/agent-knowledge.git (ref main)"
    And the source link "home/.agent-config/knowledge" still resolves to the noted target

  @pending @T133 @T138 @T142
  Scenario: AC-3.4 A first install from a source that cannot be fetched links nothing
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    And fetching the component "agent-knowledge" fails
    When the tool runs with "install"
    Then it exits with 1
    And the output has the line "error: component agent-knowledge: cannot fetch git source https://example.invalid/agent-knowledge.git (ref main)"
    And "home/.agent-config/knowledge" does not exist

  # ---- AC-3.5 -------------------------------------------------------------------------------------------

  @pending @T131 @T138 @T139 @T142
  Scenario: AC-3.5 A folder without component.yaml is skipped, doctor fails, and every other component still installs
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a folder "work/agent-knowledge"
    And the file "work/notes/readme.md" contains:
      """
      just notes
      """
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/work/agent-knowledge }
        - name: notes
          source: { type: path, path: {root}/work/notes }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "warning: component notes is skipped: no component.yaml in {root}/work/notes"
    And the output has the line "component agent-knowledge: path {root}/work/agent-knowledge (live)"
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """
    When the tool runs with "doctor"
    Then it exits with 1
    And the output has the line "error: manifest-missing: notes: no component.yaml in {root}/work/notes"

  # ---- AC-3.6 -------------------------------------------------------------------------------------------

  @pending @T140 @T142
  Scenario: AC-3.6 init-component writes a starter component.yaml that passes the schema check
    Given the folder "work/x" exists
    When the tool runs with "init-component {root}/work/x"
    Then it exits with 0 and prints:
      """
      wrote {root}/work/x/component.yaml
      """
    And the file "work/x/component.yaml" has the line "schema: component/v1"
    And the source starter "work/x/component.yaml" passes the schema check
    And "home/.agent-config" does not exist

  @pending @T140 @T142
  Scenario: AC-3.6 init-component refuses to overwrite a manifest, changes nothing and says why
    Given the file "work/x/component.yaml" contains:
      """
      keep me
      """
    And a snapshot of "work" is taken
    When the tool runs with "init-component {root}/work/x"
    Then it exits with 1 and prints:
      """
      error: {root}/work/x/component.yaml already exists; init-component never overwrites a manifest
      """
    And since the snapshot, nothing under "work" changed

  # ---- AC-3.7 -------------------------------------------------------------------------------------------

  @pending @T131 @T133 @T138 @T142
  Scenario: AC-3.7 An archive source is skipped with the exact text and nothing is fetched
    Given the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: my-archive
          source: { type: archive, url: 'https://example.invalid/n.tgz', sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "warning: component my-archive is skipped: source type archive not supported in this release"
    And "home/.agent-config/components/my-archive" does not exist

  # ---- AC-3.8 (the check of the local files; tool installer-local-files) ------------------------------------

  @pending @T150
  Scenario: AC-3.8 A tracked components.local.yaml fails the check, naming the file
    Given the base fixture tree of "installer-local-files"
    And the file "repo/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components: []
      """
    And "repo" is a git repository with everything committed
    When the tool runs with "{root}/repo"
    Then it exits with 1 and prints:
      """
      error: components.local.yaml is tracked by git
      """

  @pending @T150
  Scenario: AC-3.8 A staged variables.local.yaml in a subfolder fails the check, naming the file
    Given the base fixture tree of "installer-local-files"
    And "repo" is a git repository with everything committed
    And the file "repo/sub/variables.local.yaml" contains:
      """
      schema: variables-local/v1
      """
    And the source repo stages "sub/variables.local.yaml"
    When the tool runs with "{root}/repo"
    Then it exits with 1 and prints:
      """
      error: sub/variables.local.yaml is staged for commit
      """

  @pending @T150
  Scenario: AC-3.8 A local file that is neither tracked nor staged passes the check
    Given the base fixture tree of "installer-local-files"
    And "repo" is a git repository with everything committed
    And the file "repo/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components: []
      """
    When the tool runs with "{root}/repo"
    Then it exits with 0 and prints:
      """
      ok: no local file is tracked or staged
      """

  @pending @T131 @T133 @T138 @T142
  Scenario: AC-3.8 A local list that holds a path source leaves the public list unchanged
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a folder "work/agent-knowledge"
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/work/agent-knowledge }
      """
    And a snapshot of "repo" is taken
    When the tool runs with "install"
    Then it exits with 0
    And since the snapshot, nothing under "repo" changed
    And "home/.agent-config/components.local.yaml" exists

  # ---- AC-3.9 -------------------------------------------------------------------------------------------

  Rule: install --update advances git sources and prints the commit range

    Background:
      Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
      And the source component "agentic-sdlc" for the slot "framework" is a git source
      And the file "repo/components.yaml" contains:
        """
        schema: components-list/v1
        local: false
        components:
          - name: agent-knowledge
            source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
          - name: agentic-sdlc
            source: { type: git, url: https://example.invalid/agentic-sdlc.git, ref: main }
        """
      And the tool runs with "install"
      And the source lock commit of "agent-knowledge" is noted
      And the source lock commit of "agentic-sdlc" is noted
      And the git source "agent-knowledge" gets a new commit that sets "index.md" to "# knowledge two"
      And the git source "agentic-sdlc" gets a new commit that sets "index.md" to "# sdlc two"

    @pending @T133 @T138 @T142
    Scenario: AC-3.9 install --update advances every git source and prints each commit range
      When the tool runs with "install --update"
      Then it exits with 0
      And the source output has the update line for "agent-knowledge" from the noted commit to the head of its git source
      And the source output has the update line for "agentic-sdlc" from the noted commit to the head of its git source
      And the source lock commit of "agent-knowledge" is the head of its git source
      And the source lock commit of "agentic-sdlc" is the head of its git source
      And the file "home/.agent-config/knowledge/index.md" contains exactly:
        """
        # knowledge two
        """

    @pending @T133 @T138 @T142
    Scenario: AC-3.9 install --update with a name advances that source only
      When the tool runs with "install --update agentic-sdlc"
      Then it exits with 0
      And the source output has the update line for "agentic-sdlc" from the noted commit to the head of its git source
      And the output does not mention "updated agent-knowledge:"
      And the source lock commit of "agentic-sdlc" is the head of its git source
      And the source lock commit of "agent-knowledge" is the noted one

    @pending @T133 @T138 @T142
    Scenario: AC-3.9 The same run without --update advances nothing
      When the tool runs with "install"
      Then it exits with 0
      And the output does not mention "updated "
      And the source lock commit of "agent-knowledge" is the noted one
      And the source lock commit of "agentic-sdlc" is the noted one

  # ---- AC-3.10 --------------------------------------------------------------------------------------------

  @pending @T133 @T138 @T142
  Scenario: AC-3.10 A locked tag that now resolves to another commit exits 1 with tag moved and changes nothing
    Given the source component "agent-knowledge" for the slot "knowledge-storage" is a git source
    And the git source "agent-knowledge" is tagged "v1.0.0"
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: v1.0.0 }
      """
    And the tool runs with "install"
    And the source lock commit of "agent-knowledge" is noted
    And the source link "home/.agent-config/knowledge" is noted
    And the git source "agent-knowledge" gets a new commit that sets "index.md" to "# moved"
    And the source tag "v1.0.0" of "agent-knowledge" is moved to the newest commit
    When the tool runs with "install"
    Then it exits with 1
    And the source output says the tag "v1.0.0" of "agent-knowledge" moved from the noted commit to the head of its git source
    And the source lock commit of "agent-knowledge" is the noted one
    And the source link "home/.agent-config/knowledge" still resolves to the noted target
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """

  # ---- SC-011: the same component as git and as path ---------------------------------------------------------

  @pending @T131 @T133 @T138 @T139 @T142
  Scenario Outline: SC-011 The same component installs and passes doctor as a <kind> source
    Given the source component "agent-knowledge" is listed as a "<kind>" source
    When the tool runs with "install"
    Then it exits with 0
    And the file "home/.agent-config/knowledge/index.md" contains exactly:
      """
      # agent-knowledge
      """
    When the tool runs with "doctor"
    Then it exits with 0

    Examples:
      | kind |
      | git  |
      | path |

  # ---- FR-034: no package manager ---------------------------------------------------------------------------

  @posix @pending @T133 @T138 @T142
  Scenario: FR-034 A path component with a package.json is installed without any package manager
    Given the source package managers on the PATH only leave a mark
    And the source component "agent-knowledge" for the slot "knowledge-storage" is a folder "work/agent-knowledge"
    And the file "work/agent-knowledge/package.json" contains:
      """
      {"name":"agent-knowledge","scripts":{"postinstall":"node -e \"require('fs').writeFileSync('ran-postinstall','x')\""}}
      """
    And the file "home/.agent-config/components.local.yaml" contains:
      """
      schema: components-list/v1
      local: true
      components:
        - name: agent-knowledge
          source: { type: path, path: {root}/work/agent-knowledge }
      """
    When the tool runs with "install"
    Then it exits with 0
    And "package-manager-ran" does not exist
    And "work/agent-knowledge/ran-postinstall" does not exist
    And "work/agent-knowledge/node_modules" does not exist

  @posix @pending @T133 @T138 @T142
  Scenario: FR-034 A git component with a package.json is cloned without any package manager
    Given the source package managers on the PATH only leave a mark
    And the source component "agent-knowledge" for the slot "knowledge-storage" is a git source with a package.json that installs by script
    And the file "repo/components.yaml" contains:
      """
      schema: components-list/v1
      local: false
      components:
        - name: agent-knowledge
          source: { type: git, url: https://example.invalid/agent-knowledge.git, ref: main }
      """
    When the tool runs with "install"
    Then it exits with 0
    And "package-manager-ran" does not exist
    And "home/.agent-config/components/agent-knowledge/ran-postinstall" does not exist
    And "home/.agent-config/components/agent-knowledge/node_modules" does not exist
