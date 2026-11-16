# Requirements for the sorting check of hard-coded ~/.copilot lines (specs/022 T125, AC-8.4, FR-032): `node scripts/check-copilot-paths.ts
# [--list] [--root <folder>]` (task T149). The scenarios run it on a small fixture folder with no installer, so there is no Background.
# Output and exit codes are MG-40 of the catalogue "Messages" in specs/022-repo-split/contracts/installer-cli.md and are fixed in the header of compat.feature (the sorting check paragraph); in short: it classifies every line that
# names ~/.copilot as copilot-own (a path under an entry of `own:` in scripts/copilot-paths.yaml) or agent-home, prints
#   copilot paths: <n> lines in <f> files (agent-home <a>, copilot-own <o>), baseline agent-home <b>
# (always "files", also for one), and exits 1 with `new agent-home line: <file>:<line>: <text>` for a file whose agent-home count exceeds
# its recorded count. The fixture holds docs/a.md (1 agent-home line, line 3), docs/b.md (2 copilot-own lines) and docs/c.md (placeholder only).

Feature: The sorting check classifies every hard-coded ~/.copilot line
  Each line that names ~/.copilot is agent-home content or a Copilot-own path on a named allow-list, and a new agent-home line fails.

  @T149
  Scenario: AC-8.4 The sorting check classifies every line that names ~/.copilot and passes at the baseline
    Given the base fixture tree of "installer-compat-sorting"
    When the tool runs with "--root {root}"
    Then it exits with 0 and prints:
      """
      copilot paths: 3 lines in 2 files (agent-home 1, copilot-own 2), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 The listing shows the class of each line, and the totals count each of them
    Given the base fixture tree of "installer-compat-sorting"
    When the tool runs with "--list --root {root}"
    Then it exits with 0 and prints:
      """
      agent-home docs/a.md:3
      copilot-own docs/b.md:1
      copilot-own docs/b.md:2
      copilot paths: 3 lines in 2 files (agent-home 1, copilot-own 2), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 A new hard-coded agent-home line fails the check and names its file and line
    Given the base fixture tree of "installer-compat-sorting"
    And the file "docs/d.md" contains:
      """
      first line
      Use ~/.copilot/patterns/x.md here
      """
    When the tool runs with "--root {root}"
    Then it exits with 1 and prints:
      """
      new agent-home line: docs/d.md:2: Use ~/.copilot/patterns/x.md here
      copilot paths: 4 lines in 3 files (agent-home 2, copilot-own 2), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 A line that names an own path and an agent-home path counts as agent-home and fails when new
    Given the base fixture tree of "installer-compat-sorting"
    And the file "docs/e.md" contains:
      """
      ~/.copilot/hooks and ~/.copilot/knowledge
      """
    When the tool runs with "--root {root}"
    Then it exits with 1 and prints:
      """
      new agent-home line: docs/e.md:1: ~/.copilot/hooks and ~/.copilot/knowledge
      copilot paths: 4 lines in 3 files (agent-home 2, copilot-own 2), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 A new line on a Copilot-own path passes
    Given the base fixture tree of "installer-compat-sorting"
    And the file "docs/f.md" contains:
      """
      Prompts live in ~/.copilot/prompts/x.md
      """
    When the tool runs with "--root {root}"
    Then it exits with 0 and prints:
      """
      copilot paths: 4 lines in 3 files (agent-home 1, copilot-own 3), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 A line converted to the placeholder leaves the count and the check passes
    Given the base fixture tree of "installer-compat-sorting"
    And in "docs/a.md", `Read ~/.copilot/knowledge/index.md first.` becomes `Read {{AGENT_HOME}}/knowledge/index.md first.`
    When the tool runs with "--root {root}"
    Then it exits with 0 and prints:
      """
      copilot paths: 2 lines in 1 files (agent-home 0, copilot-own 2), baseline agent-home 1
      """

  @T149
  Scenario: AC-8.4 The check passes on the repository itself and fails no line
    When the sorting check runs on the repository
    Then it exits with 0
    And the report has no line starting with "new agent-home line"

