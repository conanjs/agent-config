# Requirements for Story 8: running sessions and old paths keep working during the move (specs/022 T125, AC-8.1 to AC-8.6, FR-031, FR-032,
# FR-035, M-14). Written before the code: every scenario is @pending with the tasks that make it pass (T136 compatibility links and
# retired, T138 install, T142 the test entry, T149 the sorting check).
#
# Installer scenarios use the tool "installer-compat": the test entry of the installer, with the fixture folder "repo" as the
# agent-config checkout (AGENT_CONFIG_TEST_REPO, set by the runner of tool.ts), path components "notes", "extras" and "kb" (a
# knowledge-storage stand-in) under "sources", and one scripted answer (yes) for the home confirmation of the first run.
# Sorting scenarios use the tool "installer-compat-sorting": `node scripts/check-copilot-paths.ts [--list] --root <folder>`.
#
# What the code must do and print (chosen here where the spec leaves it open; the printed lines "retired:", "left:" and "kept:" are MG-19
# and the sorting check lines are MG-40 of the catalogue "Messages" in specs/022-repo-split/contracts/installer-cli.md):
#   Compatibility links: for every agent-home folder (atlas, companies, frameworks, knowledge, patterns, procedures, references,
#     tracker) a link ~/.copilot/<name> to {{AGENT_HOME}}/<name>; ~/.copilot/global-variables.md to {{AGENT_HOME}}/global-variables.md;
#     and ~/.copilot/instructions/core.instructions.md to {{AGENT_HOME}}/instructions/core.instructions.md INSIDE Copilot's own
#     instructions folder. Copilot's own folders ~/.copilot/instructions, hooks and agents stay real folders; they are not replaced,
#     and a missing one is not created.
#   retired: a release lists its retired links in the checkout file `compat.yaml`:
#       schema: compat-links/v1
#       retired:
#         - ~/.copilot/patterns
#     and install prints one line per listed link:
#       retired: <path>                                                  the installer's own link was removed
#       left: <path>: not the installer's own link                       a real file, or a link to another target, stays
#       kept: <path>: used by a hook command                             a hook command in an agent settings file names the path
#   The sorting check (T149): scans every file under --root (default: the repository) except its record file scripts/copilot-paths.yaml,
#     and classifies each line that names ~/.copilot as copilot-own (it names a path under an entry of `own:` in the record) or
#     agent-home (anything else, also a line that names both). A line with {{AGENT_HOME}} and no ~/.copilot is not counted.
#     `--list` prints one line per classified line, sorted by file and line: `agent-home <file>:<line>` or `copilot-own <file>:<line>`.
#     Every run ends with   copilot paths: <n> lines in <f> files (agent-home <a>, copilot-own <o>), baseline agent-home <b>
#     where <b> is the sum of `agent-home-lines` in the record. A new agent-home line is a file whose agent-home count exceeds its
#     recorded count: for each, the line `new agent-home line: <file>:<line>: <text>` comes first, and the exit code is 1. Else 0.
# The 484 lines, 131 files and the 445 {{AGENT_HOME}} lines are numbers of the real repository on 2026-11-11; the scenarios on the
# fixtures fix the behaviour, and the last scenario of AC-8.4 runs the check on the repository itself.

Feature: Running sessions and old paths keep working during the move
  After install the pre-move ~/.copilot paths show the same files as the new home, Copilot's own folders are left alone, a retired
  link goes only when it is the installer's own and unused, and no text an agent loads changes.

  Background:
    Given the base fixture tree of "installer-compat"
    And a temporary home with the agent folders exists
    And a scripted terminal that answers:
      """
      yes
      """
    And the old path setup lists the path components "notes,extras,kb"

  # ---- AC-8.1 ---------------------------------------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario Outline: AC-8.1 The old path <old> shows the same file as the new home
    Given the tool runs with "install"
    Then the old path "home/.copilot/<old>" shows the same file as "home/.agent-config/<old>"

    Examples:
      | old                           |
      | knowledge/index.md            |
      | companies/notes/index.md      |
      | frameworks/agent-foundry/index.md |
      | patterns/index.md             |
      | references/index.md           |
      | procedures/index.md           |
      | instructions/core.instructions.md |
      | global-variables.md           |
      | atlas/index.md                |
      | tracker/index.md              |

  @pending @T136 @T138 @T142
  Scenario: AC-8.1 A source edit shows at the old path and the new path at once
    Given the tool runs with "install"
    And the file "repo/patterns/index.md" contains:
      """
      edited after install
      """
    Then the file "home/.copilot/patterns/index.md" contains exactly:
      """
      edited after install
      """
    And the file "home/.agent-config/patterns/index.md" contains exactly:
      """
      edited after install
      """

  @pending @T136 @T138 @T142
  Scenario: AC-8.1 A second install keeps every old path in place
    Given the tool runs with "install"
    When the tool runs with "install"
    Then it exits with 0 and prints:
      """
      agent home: {root}/home/.agent-config (recorded, confirmed)
      status: no-changes
      """
    And the old path "home/.copilot/knowledge/index.md" shows the same file as "home/.agent-config/knowledge/index.md"

  # ---- AC-8.2 ---------------------------------------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario: AC-8.2 Copilot's own instructions, hooks and agents folders stay real folders with their files
    Given the file "home/.copilot/instructions/mine.instructions.md" contains:
      """
      my instruction
      """
    And the file "home/.copilot/hooks/keep.json" contains:
      """
      {}
      """
    And the file "home/.copilot/agents/mine.agent.md" contains:
      """
      my agent
      """
    And a snapshot of "home/.copilot/hooks" is taken
    And a snapshot of "home/.copilot/agents" is taken
    When the tool runs with "install"
    Then it exits with 0
    And "home/.copilot/instructions" is a real file or folder, not a symlink
    And "home/.copilot/hooks" is a real file or folder, not a symlink
    And "home/.copilot/agents" is a real file or folder, not a symlink
    And the file "home/.copilot/instructions/mine.instructions.md" contains exactly:
      """
      my instruction
      """
    And since the snapshot, nothing under "home/.copilot/hooks" changed
    And since the snapshot, nothing under "home/.copilot/agents" changed
    And "home/.agent-config-backups" does not exist

  @pending @T136 @T138 @T142
  Scenario: AC-8.2 Copilot folders that do not exist are not created by the compatibility links
    When the tool runs with "install"
    Then it exits with 0
    And "home/.copilot/hooks" does not exist
    And "home/.copilot/agents" does not exist

  # ---- AC-8.3 ---------------------------------------------------------------------------------------

  @pending @T136 @T138 @T142 @posix
  Scenario: AC-8.3 A retired compatibility link that is still the installer's own is removed
    Given the tool runs with "install"
    And the file "repo/compat.yaml" contains:
      """
      schema: compat-links/v1
      retired:
        - ~/.copilot/patterns
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "retired: {root}/home/.copilot/patterns"
    And "home/.copilot/patterns" does not exist
    And "home/.agent-config/patterns/index.md" exists
    And the old path "home/.copilot/knowledge/index.md" shows the same file as "home/.agent-config/knowledge/index.md"

  @pending @T136 @T138 @T142 @posix
  Scenario: AC-8.3 A real file at a retired path is left and reported
    Given the tool runs with "install"
    And the file "home/.copilot/patterns" is removed
    And the file "home/.copilot/patterns" contains:
      """
      my own file
      """
    And the file "repo/compat.yaml" contains:
      """
      schema: compat-links/v1
      retired:
        - ~/.copilot/patterns
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "left: {root}/home/.copilot/patterns: not the installer's own link"
    And the file "home/.copilot/patterns" contains exactly:
      """
      my own file
      """

  @pending @T136 @T138 @T142 @posix
  Scenario: AC-8.3 A link that now points elsewhere is not the installer's own and is left and reported
    Given the tool runs with "install"
    And the file "home/.copilot/patterns" is removed
    And the folder "elsewhere" exists
    And "home/.copilot/patterns" already links to "elsewhere"
    And the file "repo/compat.yaml" contains:
      """
      schema: compat-links/v1
      retired:
        - ~/.copilot/patterns
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "left: {root}/home/.copilot/patterns: not the installer's own link"
    And "home/.copilot/patterns" is a symlink to "elsewhere"

  @pending @T136 @T138 @T142 @posix
  Scenario: AC-8.3 A retired link that a hook command still uses is kept and reported (M-14)
    Given the tool runs with "install"
    And the file "home/.claude/settings.json" contains:
      """
      {"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"bash ~/.copilot/patterns/guard.sh"}]}]}}
      """
    And the file "repo/compat.yaml" contains:
      """
      schema: compat-links/v1
      retired:
        - ~/.copilot/patterns
      """
    When the tool runs with "install"
    Then it exits with 0
    And the output has the line "kept: {root}/home/.copilot/patterns: used by a hook command"
    And "home/.copilot/patterns/index.md" exists

  # ---- AC-8.5 ---------------------------------------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario: AC-8.5 Install edits none of the lines that hold the agent-home placeholder, and each still resolves
    Given the placeholder lines under "repo" and "sources" are recorded
    When the tool runs with "install"
    Then it exits with 0
    And the placeholder lines under "repo" and "sources" are byte identical to the record
    And every placeholder in "home/.agent-config/instructions/core.instructions.md" resolves under the agent home
    And every placeholder in "home/.agent-config/knowledge/index.md" resolves under the agent home

  @pending @T136 @T138 @T142
  Scenario: AC-8.5 A second install and an update keep the placeholder lines byte identical
    Given the placeholder lines under "repo" and "sources" are recorded
    And the tool runs with "install"
    When the tool runs with "install --update"
    Then it exits with 0
    And the placeholder lines under "repo" and "sources" are byte identical to the record
    And the file "home/.copilot/instructions/core.instructions.md" has the line "See {{AGENT_HOME}}/patterns/index.md and {{AGENT_HOME}}/knowledge/index.md."

  # ---- AC-8.6 ---------------------------------------------------------------------------------------

  @pending @T136 @T138 @T142
  Scenario: AC-8.6 The text Claude Code, Copilot CLI and Codex would receive has the same hash after install
    Given the old path setup wires the three agent entry files as the old installer did
    And the agent text hashes are recorded
    When the tool runs with "install"
    Then it exits with 0
    And the agent text hashes are unchanged

  @pending @T136 @T138 @T142
  Scenario: AC-8.6 The hashes stay the same after a second install
    Given the old path setup wires the three agent entry files as the old installer did
    And the agent text hashes are recorded
    And the tool runs with "install"
    When the tool runs with "install"
    Then it exits with 0
    And the agent text hashes are unchanged

  @pending @T136 @T138 @T142
  Scenario: AC-8.6 A change of the core text changes the hash of every agent, so the compare can fail
    Given the old path setup wires the three agent entry files as the old installer did
    And the agent text hashes are recorded
    And the file "repo/instructions/core.instructions.md" contains:
      """
      A changed core text.
      """
    When the tool runs with "install"
    Then it exits with 0
    And the agent text hash of every agent has changed
