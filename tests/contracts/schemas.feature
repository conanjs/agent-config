# Requirements for the schema check contracts/tools/check-schemas.ts (specs/022 T045; acceptance criteria AC-1.2 to AC-1.4,
# FR-004, FR-005, and P4-23 from the plan). The command line, the output lines and the exit codes are described at the top
# of tests/contracts/tool.ts. Scenarios of the real shipped files read them from the repository root; all other scenarios
# start from the small valid files in tests/contracts/fixtures/base and change one thing.
#
# Shipped files the scenarios assume (T058 to T061 must create exactly these names; the slots instance is contracts/slots.yaml):
#   contracts/slots/v1/examples/valid/slots.yaml
#   contracts/component/v1/examples/valid/component.yaml
#   contracts/components-list/v1/examples/valid/components.yaml          (the public list, local: false)
#   contracts/components-list/v1/examples/valid/components.local.yaml    (the local list, local: true)
#   contracts/components-lock/v1/examples/valid/components.lock          (JSON on disk)
#
# Written before the code: @pending marks a scenario that cannot pass yet, and the tags @T0nn name the tasks that make it
# pass. The task that turns a scenario green removes its @pending tag (see tests/contracts/tool.ts).

Feature: Schema check of the contract files
  The check reads a contract file with the tolerant reader: unknown keys warn, old keys and unsafe values fail naming the
  field, and the shipped examples pass.

  Background:
    Given the base fixture tree of "contracts"

  # ---- AC-1.2 ----------------------------------------------------------------------------------------

  @pending @T054 @T055 @T058 @T059 @T060 @T061 @T078
  Scenario: AC-1.2 The five shipped valid example files pass
    When the tool runs with arguments:
      """
      contracts/slots/v1/examples/valid/slots.yaml
      contracts/component/v1/examples/valid/component.yaml
      contracts/components-list/v1/examples/valid/components.yaml
      contracts/components-list/v1/examples/valid/components.local.yaml
      contracts/components-lock/v1/examples/valid/components.lock
      """
    Then it exits with 0
    And the check output has exactly 5 lines containing ": ok"
    And the check output has no line containing "error"
    And the check output has no line containing "warning"

  @pending @T054 @T055 @T078
  Scenario: AC-1.2 The five valid fixture files pass with no warnings, so the failures below come from the one change each makes
    When the tool runs with arguments:
      """
      {root}/slots.yaml
      {root}/component.yaml
      {root}/components.yaml
      {root}/components.local.yaml
      {root}/components.lock
      """
    Then it exits with 0
    And the check output has exactly 5 lines containing ": ok"
    And the check output has no line containing "warning"
    And the check output has no line containing "error"

  @pending @T054 @T055 @T059 @T078
  Scenario: AC-1.2 A copy of the component example with an extra key colour: blue passes with exactly one warning naming the key
    Given the repo's "contracts/component/v1/examples/valid" folder is copied to "shipped"
    And in "shipped/component.yaml", `schema: component/v1` becomes `schema: component/v1\ncolour: blue`
    When the tool runs with "{root}/shipped/component.yaml"
    Then it exits with 0
    And the check output has exactly 1 line containing "warning"
    And the check output has a line containing "warning" and "colour"
    And the check output has no line containing "error"

  @pending @T054 @T055 @T078
  Scenario: AC-1.2 An extra key colour: blue in the fixture component passes with exactly one warning naming the key
    Given in "component.yaml", `schema: component/v1` becomes `schema: component/v1\ncolour: blue`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 0
    And the check output has exactly 1 line containing "warning"
    And the check output has a line containing "warning" and "colour"

  # Negatives of FR-004 and FR-005 (M-03): each unsafe value fails and the message names the field.
  @pending @T054 @T055 @T078
  Scenario Outline: AC-1.2 A component with <case> fails, naming the field <field>
    Given in "component.yaml", `<old>` becomes `<new>`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "<field>"
    And the check output has no line containing ": ok"

    Examples:
      | case                    | field               | old                    | new                         |
      | a bad component id      | name                | name: agentic-sdlc     | name: Bad_Name              |
      | an id of 65 characters  | name                | name: agentic-sdlc     | name: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa |
      | a .. segment in a path  | locations.framework | framework: .           | framework: ../escape        |
      | a drive letter in a path | locations.framework | framework: .           | framework: "C:/Users/x"     |
      | a backslash in a path   | locations.framework | framework: .           | framework: 'a\\b'           |
      | a NUL character in a path | locations.framework | framework: .           | framework: "a\0b"           |
      | an absolute path | locations.framework | framework: . | framework: /etc/passwd |
      | a .. segment in provides.index | provides.index | index: index.md | index: ../index.md |
      | a backslash in provides.index | provides.index | index: index.md | index: 'a\\b.md' |
      | an absolute route read path | routes | read: frameworks/agentic-sdlc/index.md | read: /etc/passwd |

  @pending @T054 @T055 @T078
  Scenario: AC-1.2 A route id that is not a valid id fails, naming the field
    Given in "component.yaml", `- id: agentic-sdlc` becomes `- id: Not Valid`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "routes"

  # P4-23 (plan, A-23): the provider's repository is a GitHub address with no user-info part (M-07).
  @pending @T054 @T055 @T059 @T078
  Scenario: P4-23 A repository URL that is not a GitHub address fails, naming the field and the host rule
    Given in "component.yaml", `https://github.com/conanjs/agentic-sdlc` becomes `https://gitlab.com/conanjs/agentic-sdlc`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "repository"
    And the check output has a line containing "repository" and "github.com"

  @pending @T054 @T055 @T059 @T078
  Scenario: P4-23 A host that only starts with github.com fails, naming the field and the host rule
    Given in "component.yaml", `https://github.com/conanjs/agentic-sdlc` becomes `https://github.com.evil.example/x/y`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "repository"
    And the check output has a line containing "repository" and "github.com"

  @pending @T054 @T055 @T059 @T078
  Scenario: P4-23 A GitHub repository address passes
    Given in "component.yaml", `https://github.com/conanjs/agentic-sdlc` becomes `https://github.com/other-owner/other-repo`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 0
    And the check output has a line containing ": ok"

  @pending @T054 @T055 @T059 @T078
  Scenario: P4-23 A GitHub address with a user name and password in it fails (M-07), naming the field
    Given in "component.yaml", `https://github.com/conanjs/agentic-sdlc` becomes `https://user:secret@github.com/conanjs/agentic-sdlc`
    When the tool runs with "{root}/component.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "repository"
    And the check output has no line containing "secret"

  # ---- AC-1.3 ----------------------------------------------------------------------------------------

  @pending @T054 @T055 @T078
  Scenario: AC-1.3 A slots file that still uses count fails, naming the key and its replacement
    Given in "slots.yaml", `name: knowledge-storage` becomes `name: knowledge-storage\n    count: 0..1`
    When the tool runs with "{root}/slots.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "`count` is now `required` + `multiple`"

  @pending @T054 @T055 @T078
  Scenario: AC-1.3 A slots file that still uses mounts fails, naming the key and its replacement
    Given in "slots.yaml", `locations:` becomes `mounts:`
    When the tool runs with "{root}/slots.yaml"
    Then it exits with 1
    And the check output has a line containing "error" and "`mounts` is now `locations`"

  # ---- AC-1.4 ----------------------------------------------------------------------------------------

  Scenario: AC-1.4 In the shipped slots file knowledge-storage is optional and single, with knowledge-provider/v1
    Then the slot "knowledge-storage" of "contracts/slots.yaml" has "required" equal to "false"
    And the slot "knowledge-storage" of "contracts/slots.yaml" has "multiple" equal to "false"
    And the slot "knowledge-storage" of "contracts/slots.yaml" has "contract" equal to "\"knowledge-provider/v1\""

  # Spec AC-1.4 says company-knowledge-storage has contract company-kb/v1 alone, but specs/022-repo-split/contracts/slots-v1.md
  # (the sketch) gives the list [company-kb/v1, knowledge-provider/v1]. The two disagree. Until the spec is aligned this
  # scenario accepts either: it checks only that the slot offers company-kb/v1.
  Scenario: AC-1.4 In the shipped slots file company-knowledge-storage is optional and multiple, and offers company-kb/v1
    Then the slot "company-knowledge-storage" of "contracts/slots.yaml" has "required" equal to "false"
    And the slot "company-knowledge-storage" of "contracts/slots.yaml" has "multiple" equal to "true"
    And the slot "company-knowledge-storage" of "contracts/slots.yaml" offers the contract "company-kb/v1"

  Scenario: AC-1.4 In the shipped slots file framework is optional and multiple, per project, with framework/v1
    Then the slot "framework" of "contracts/slots.yaml" has "required" equal to "false"
    And the slot "framework" of "contracts/slots.yaml" has "multiple" equal to "true"
    And the slot "framework" of "contracts/slots.yaml" has "scope" equal to "\"per-project\""
    And the slot "framework" of "contracts/slots.yaml" has "contract" equal to "\"framework/v1\""

  Scenario: AC-1.4 The shipped slots file has the reserved core slot and the three starting slots
    Then the slots file "contracts/slots.yaml" has the slot "core"
    And the slots file "contracts/slots.yaml" has the slot "knowledge-storage"
    And the slots file "contracts/slots.yaml" has the slot "company-knowledge-storage"
    And the slots file "contracts/slots.yaml" has the slot "framework"

  @pending @T054 @T055 @T058 @T078
  Scenario: AC-1.4 The shipped slots file passes the schema check
    When the tool runs with "contracts/slots.yaml"
    Then it exits with 0
    And the check output has a line containing ": ok"

  @pending @T054 @T055 @T078
  Scenario: AC-1.4 A slot whose contract is a list of two contracts validates
    Given in "slots.yaml", `contract: knowledge-provider/v1` becomes `contract: [knowledge-provider/v1, company-kb/v1]`
    When the tool runs with "{root}/slots.yaml"
    Then it exits with 0
    And the check output has no line containing "error"
    And the check output has no line containing "warning"
