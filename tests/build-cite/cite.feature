# Requirements for the cite subcommand of contracts/tools/build.ts (specs/022 T094, written before the tool, which T100 builds).
# Covers AC-9.5 to AC-9.7, AC-5.10, EDGE-7, EDGE-13, FR-017 and FR-044: a consumer repository runs the shared build tool on its own files;
# each citation of another component gets a generated GitHub target, and depends.docs is generated from the citations.
#
# Command line (contracts/build/v1 and build-v1.md; this file pins what they leave open):
#   node contracts/tools/build.ts cite [--write] --root <dir> --slots <slots.yaml> --provider <component.yaml> [--provider <component.yaml> ...]
#   --root      the consumer repository (default: the current folder); --slots and every --provider path resolve against it
#               unless absolute. A path to a component.yaml only; a URL is out of scope here.
#   --write     writes the missing or stale targets and depends.slots[].docs; without it nothing is written
#   Exit: 0 ok, 1 a finding, 2 a usage error (an unknown option, no --provider, no --slots).
# What is read: every .md file under --root (not node_modules or .git, paths printed with "/"), in path order; and <root>/component.yaml
#   for depends.slots. A citation is a Markdown link `[<text>](<target>)` whose text starts with {{AGENT_HOME}}/ and has no <name>
#   placeholder segment. A bare relative text, a placeholder text such as {{AGENT_HOME}}/companies/<co>/x.md, and a web address as text
#   are not citations: they are neither checked nor changed (AC-5.10, A-24). A citation with no target is written `[text]()`.
# Classification is by contracts/lib/citations.ts (longest slot location mount of --slots). The provider of a citation is the --provider
#   whose component.yaml `slot` is the citation's slot. The target is
#     <repository>/blob/main/<folder>/<path>
#   where <repository> is the provider's `repository`, <folder> is its `locations.<location name>` (omitted when it is "."), and <path> is
#   the rest of the citation; each path segment is percent-encoded as encodeURIComponent does (a space is %20, é is %C3%A9). The branch is main.
#   Example: {{AGENT_HOME}}/knowledge/x.md with provider locations.content "." gives https://github.com/conanjs/agent-knowledge/blob/main/x.md
# depends.docs (FR-017): for each entry of depends.slots in <root>/component.yaml, docs is the sorted, de-duplicated list of the citation
#   texts of that entry's slot, each without the {{AGENT_HOME}}/ prefix (the mount stays: knowledge/x.md, patterns/p.md); [] when none.
#   --write rewrites the value as a one-line flow list: `docs: [a, b]`.
#
# Messages the scenarios pin (T100 may change one only together with this file). <file> is the path of the citing file below --root:
#   <file>: error: citation "<text>" has no target, expected <target>
#   <file>: error: citation "<text>" has target <actual>, expected <target>
#   <file>: error: citation "<text>": the path "<path>" is under no slot location        (the message of the classifier)
#   <file>: error: citation "<text>": provider <name> has no repository (<provider file as passed>)       (AC-9.7, EDGE-13)
#   <file>: error: citation "<text>": no --provider fills slot <slot>
#   component.yaml: error: depends.slots <slot> docs is [<written>], generated value is [<generated>]
#   build.ts cite: unknown option <flag>    a usage error, exit 2
#   cite: <n> findings                    last line when there is any finding; exit 1
#   cite: <n> citations ok                nothing to report, without --write
#   cite: <n> citations ok, <m> written   with --write: <m> counts the targets and docs lists changed; 0 on a second run; exit 0
# With --write a finding that no write can fix (no repository, no provider, under no location) is still reported, exit 1, and nothing it
# concerns is written.

Feature: Build cite
  A consumer's citations of another component get a generated target, checked on every run.

  Background:
    Given the base fixture tree of "build-cite"

  Scenario: AC-9.5 A citation with no target gets the GitHub address of the cited file in the provider's repository
    Given in "foo.md", `x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)` becomes `x.md]()`
    When the tool runs with "--write"
    Then it exits with 0
    And the output has the line "cite: 2 citations ok, 1 written"
    And the file "foo.md" contains exactly:
      """
      # Foo

      See [{{AGENT_HOME}}/knowledge/x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md).
      Pattern: [{{AGENT_HOME}}/patterns/p.md](https://github.com/conanjs/agent-config/blob/main/copilot/patterns/p.md).
      Own file: [docs/own.md](docs/own.md).
      Placeholder: [{{AGENT_HOME}}/companies/<co>/x.md](companies/co/x.md).
      Web: [the site](https://example.com).
      """

  Scenario: AC-9.5 A second write changes nothing, byte for byte
    Given in "foo.md", `x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)` becomes `x.md]()`
    And in "component.yaml", `docs: [knowledge/x.md]` becomes `docs: [knowledge/old.md]`
    When the tool runs with "--write"
    And a snapshot of "." is taken
    And the tool runs with "--write"
    Then it exits with 0
    And the output has the line "cite: 2 citations ok, 0 written"
    And since the snapshot, nothing under "." changed

  Scenario: AC-9.5 Without --write a consistent tree passes and nothing is written
    Given a snapshot of "." is taken
    When the tool runs
    Then it exits with 0
    And the output has the line "cite: 2 citations ok"
    And since the snapshot, nothing under "." changed

  Scenario: AC-9.6 A missing target fails without --write and names the file, the citation and the expected target
    Given in "foo.md", `x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)` becomes `x.md]()`
    And a snapshot of "." is taken
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\" has no target, expected https://github.com/conanjs/agent-knowledge/blob/main/x.md"
    And the output has the line "cite: 1 findings"
    And since the snapshot, nothing under "." changed

  Scenario: AC-9.6 A target that differs because the provider's repository changed fails and names both addresses
    Given in "providers/knowledge/component.yaml", `repository: https://github.com/conanjs/agent-knowledge` becomes `repository: https://github.com/conanjs/agent-knowledge-v2`
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\" has target https://github.com/conanjs/agent-knowledge/blob/main/x.md, expected https://github.com/conanjs/agent-knowledge-v2/blob/main/x.md"

  Scenario: AC-9.6 A write replaces a stale target
    Given in "providers/knowledge/component.yaml", `repository: https://github.com/conanjs/agent-knowledge` becomes `repository: https://github.com/conanjs/agent-knowledge-v2`
    When the tool runs with "--write"
    Then it exits with 0
    And the output has the line "cite: 2 citations ok, 1 written"
    And the file "foo.md" has the line "See [{{AGENT_HOME}}/knowledge/x.md](https://github.com/conanjs/agent-knowledge-v2/blob/main/x.md)."

  Scenario: AC-9.6 Every citing file is reported, in path order, not only the first
    Given in "foo.md", `x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)` becomes `x.md]()`
    And the file "docs/bar.md" contains:
      """
      Bar cites [{{AGENT_HOME}}/knowledge/x.md]().
      """
    When the tool runs
    Then it exits with 1
    And the output has the line "docs/bar.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\" has no target, expected https://github.com/conanjs/agent-knowledge/blob/main/x.md"
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\" has no target, expected https://github.com/conanjs/agent-knowledge/blob/main/x.md"
    And the output has the line "cite: 2 findings"

  Scenario: AC-9.7 A provider whose component.yaml has no repository fails and names the provider and the citing file
    Given in "providers/knowledge/component.yaml", `repository: https://github.com/conanjs/agent-knowledge` becomes `# no repository`
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\": provider agent-knowledge has no repository (providers/knowledge/component.yaml)"

  Scenario: EDGE-13 A provider never pushed writes nothing, even with --write
    Given in "providers/knowledge/component.yaml", `repository: https://github.com/conanjs/agent-knowledge` becomes `# no repository`
    And in "foo.md", `x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)` becomes `x.md]()`
    When the tool runs with "--write"
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/knowledge/x.md\": provider agent-knowledge has no repository (providers/knowledge/component.yaml)"
    And the file "foo.md" has a line containing "See [{{AGENT_HOME}}/knowledge/x.md]()."

  Scenario: AC-5.10 The longest matching location classifies a citation, so a framework path uses the framework folder
    Given in "foo.md", `Own file:` becomes `See [{{AGENT_HOME}}/frameworks/knowledge/index.md](). Own file:`
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/frameworks/knowledge/index.md\" has no target, expected https://github.com/conanjs/agent-knowledge/blob/main/fw/index.md"

  Scenario: AC-5.10 A path under no slot location fails and names the path
    Given in "foo.md", `Own file:` becomes `See [{{AGENT_HOME}}/unknown/x.md](). Own file:`
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/unknown/x.md\": the path \"unknown/x.md\" is under no slot location"

  Scenario: AC-5.10 A bare relative path and a placeholder path are not citations and are left alone
    Given a snapshot of "." is taken
    When the tool runs with "--write"
    Then it exits with 0
    And the output has the line "cite: 2 citations ok, 0 written"
    And since the snapshot, nothing under "." changed

  Scenario: AC-5.10 A citation of a slot no --provider fills fails and names the slot
    Given in "foo.md", `Own file:` becomes `See [{{AGENT_HOME}}/companies/ots/index.md](). Own file:`
    When the tool runs
    Then it exits with 1
    And the output has the line "foo.md: error: citation \"{{AGENT_HOME}}/companies/ots/index.md\": no --provider fills slot company-knowledge-storage"

  Scenario Outline: AC-5.10 The target of the path <path> is percent-encoded segment by segment
    Given the file "foo.md" contains:
      """
      [{{AGENT_HOME}}/knowledge/<path>]()
      """
    When the tool runs with "--write"
    Then it exits with 0
    And the file "foo.md" has the line "[{{AGENT_HOME}}/knowledge/<path>](https://github.com/conanjs/agent-knowledge/blob/main/<encoded>)"

    Examples:
      | path             | encoded                                |
      | x.md             | x.md                                   |
      | notes/a b.md     | notes/a%20b.md                         |
      | café/résumé.md   | caf%C3%A9/r%C3%A9sum%C3%A9.md          |
      | 日本語/メモ.md   | %E6%97%A5%E6%9C%AC%E8%AA%9E/%E3%83%A1%E3%83%A2.md |

  Scenario: EDGE-7 A hand-written depends.docs that disagrees fails and prints the generated value
    Given in "component.yaml", `docs: [knowledge/x.md]` becomes `docs: [knowledge/old.md]`
    When the tool runs
    Then it exits with 1
    And the output has the line "component.yaml: error: depends.slots knowledge-storage docs is [knowledge/old.md], generated value is [knowledge/x.md]"

  Scenario: FR-017 A write generates depends.docs from the citations and a following check passes
    Given in "component.yaml", `docs: [knowledge/x.md]` becomes `docs: []`
    When the tool runs with "--write"
    Then it exits with 0
    And the file "component.yaml" has a line containing "docs: [knowledge/x.md]"
    When the tool runs
    Then it exits with 0
    And the output has the line "cite: 2 citations ok"

  Scenario: FR-017 Several cited docs are written sorted, without duplicates
    Given the file "docs/bar.md" contains:
      """
      [{{AGENT_HOME}}/knowledge/b.md]() [{{AGENT_HOME}}/knowledge/a.md]() [{{AGENT_HOME}}/knowledge/a.md]()
      """
    When the tool runs with "--write"
    Then it exits with 0
    And the file "component.yaml" has a line containing "docs: [knowledge/a.md, knowledge/b.md, knowledge/x.md]"

  Scenario: A usage error exits 2
    When the tool runs with "--no-such-flag"
    Then it exits with 2
    And the output has the line "build.ts cite: unknown option --no-such-flag"
