# Requirements for the dry-run baseline, `build.ts budget --baseline` (specs/022 T050, written before the tool, which
# T075 builds, and before the swap rules of contracts/lib that T075 uses). Covers AC-1.7 and the swap rule table of
# decisions/qa.md section 5.1. Fixture: a small repository with mapping.yaml, claude/CLAUDE.md, two instruction files
# and three skills (two named sdlc-*).
#
# What the tool is asked to do, as the scenarios pin it (T075 may change a flag or field only together with this file):
#   budget --baseline [--agent-home <path>] [--platform darwin|win32|linux]   prints one JSON report on stdout, writes nothing
#   budget --baseline --out <file>                                            writes the same report to the file (this is what
#                                                                             build-v1.md means by "writes the baseline record";
#                                                                             T079 records docs/baselines/always-loaded.json this way)
#   budget --baseline --render <file> [...same flags]                         prints that file as rendered, in memory
#   --allow-list <file>                                                       one literal line per row; such a line is kept as written
# File arguments (--render, --allow-list, --out) resolve against --root. The tool reads git only through `git rev-parse`,
# so a snapshot of the whole fixture, .git included, stays equal; the purity scenarios snapshot ".".
# Report: agents.<claude-code|copilot-cli|codex>.{characters, tokens_estimate, agent_home_lines, method, tool_version,
# node_version, date, commit}; agents.claude-code also {skill_list_characters, skill_list_sdlc_characters}.
# Files an agent loads at session start, read from mapping.yaml: Claude Code = ~/.claude/CLAUDE.md and the files it
# imports with @path; Copilot CLI = every file under ~/.copilot/instructions; Codex = ~/.codex/AGENTS.md.
# Skill list figure = for each skill, the characters of its name plus its description.
# A missing field of a recorded baseline file is not found by `build.ts`: it is the T069 baseline schema (`schema: build/v1`
# in the file, key to be fixed by T069) checked by `contracts/tools/check-schemas.ts <file>`, whose output is
# `<file>: error: <field>: <message>` and exit 1 (see tests/contracts/tool.ts). Those scenarios also name T069 and T078.
# Pending: scenarios carry @pending and the tasks that make them pass (tests/support/pending.ts).

@pending @T075 @T077
Feature: Always-loaded baseline, dry run
  The baseline is measured on the text as it would look rendered, in memory, and records how it was measured.

  Background:
    Given the base fixture tree of "baseline"

  Scenario: AC-1.7 The dry run writes nothing
    Given "." is a git repository with everything committed
    And a temporary home exists
    And a snapshot of "." is taken
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then it exits with 0
    And since the snapshot, nothing under "." changed

  Scenario: AC-1.7 The report holds the size, the token estimate and the home-line count for each of the three agents
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then it exits with 0
    And the baseline report has the number "agents.claude-code.characters"
    And the baseline report has the number "agents.copilot-cli.characters"
    And the baseline report has the number "agents.codex.characters"
    And the baseline report has the number "agents.claude-code.tokens_estimate"
    And the baseline report has the number "agents.copilot-cli.tokens_estimate"
    And the baseline report has the number "agents.codex.tokens_estimate"
    And the baseline report has the number "agents.claude-code.agent_home_lines"
    And the baseline report has the number "agents.copilot-cli.agent_home_lines"
    And the baseline report has the number "agents.codex.agent_home_lines"

  Scenario: AC-1.7 The token figure is only ever named as an estimate
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then the baseline report has no field "agents.claude-code.tokens"
    And the baseline report has the number "agents.claude-code.tokens_estimate"

  Scenario: AC-1.7 Each agent's record states the method, the tool version, the Node version, the date and the commit
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then the baseline report has the text "agents.claude-code.method"
    And the baseline report has the text "agents.claude-code.tool_version"
    And the baseline report has the text "agents.claude-code.node_version"
    And the baseline report has the text "agents.claude-code.date"
    And the baseline report field "agents.claude-code.commit" is a 40-digit commit id
    And the baseline report has the text "agents.codex.method"
    And the baseline report has the text "agents.copilot-cli.date"

  Scenario: AC-1.7 The count of AGENT_HOME lines is taken from the files each agent loads at session start
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then the baseline report field "agents.claude-code.agent_home_lines" is 3
    And the baseline report field "agents.copilot-cli.agent_home_lines" is 3
    And the baseline report field "agents.codex.agent_home_lines" is 2

  Scenario: AC-1.7 The Claude Code skill list figure comes with its sdlc share
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then the baseline report field "agents.claude-code.skill_list_characters" is 36
    And the baseline report field "agents.claude-code.skill_list_sdlc_characters" is 22
    And the baseline report has no field "agents.codex.skill_list_characters"

  Scenario: AC-1.7 The size is measured on the rendered text, so it is larger than the 149 characters written
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config"
    Then the baseline report field "agents.codex.characters" is more than 149

  Scenario: AC-1.7 The dry run with --out writes the same report to the file named, relative to the root
    Given "." is a git repository with everything committed
    When the tool runs with "budget --baseline --agent-home /Users/v/.agent-config --out docs/baselines/new.json"
    Then it exits with 0
    And "docs/baselines/new.json" exists
    And the file "docs/baselines/new.json" has a line containing "claude-code"

  @T069 @T078
  Scenario: AC-1.7 A baseline file that holds every field passes the schema check
    When the tool runs with "check-schemas {root}/docs/baselines/always-loaded.json"
    Then it exits with 0

  @T069 @T078
  Scenario Outline: AC-1.7 A baseline file without <field> of <agent> fails the schema check and names it
    Given in "docs/baselines/always-loaded.json", `      <line>\n` becomes ``
    When the tool runs with "check-schemas {root}/docs/baselines/always-loaded.json"
    Then it exits with 1
    And the output has a line starting with "{root}/docs/baselines/always-loaded.json: error: agents.<agent>.<field>:"

    Examples:
      | agent       | field                      | line                                                          |
      | claude-code | characters                 | "characters": 400,                                            |
      | claude-code | tokens_estimate            | "tokens_estimate": 100,                                       |
      | claude-code | agent_home_lines           | "agent_home_lines": 3,                                        |
      | claude-code | method                     | "method": "dry run, rendered in memory, Unicode code points", |
      | claude-code | tool_version               | "tool_version": "1",                                          |
      | claude-code | node_version               | "node_version": "24.12.0",                                    |
      | claude-code | date                       | "date": "2026-11-14",                                         |
      | claude-code | commit                     | "commit": "0123456789abcdef0123456789abcdef01234567",         |
      | claude-code | skill_list_characters      | "skill_list_characters": 36,                                  |
      | claude-code | skill_list_sdlc_characters | "skill_list_sdlc_characters": 22,                             |
      | copilot-cli | commit                     | "commit": "fedcba9876543210fedcba9876543210fedcba98",         |

  @T069 @T078
  Scenario: AC-1.7 A baseline file without one of the three agents fails the schema check and names it
    Given in "docs/baselines/always-loaded.json", `"codex": {` becomes `"codex-removed": {`
    When the tool runs with "check-schemas {root}/docs/baselines/always-loaded.json"
    Then it exits with 1
    And the output has a line starting with "{root}/docs/baselines/always-loaded.json: error: agents.codex:"

  # ---- The swap rule table (decisions/qa.md 5.1). The platform is an input, so the Windows rows run on every OS. ----

  Scenario: AC-1.7 Swap rule, Mac: the placeholder becomes the real path
    Given the file "copilot/instructions/x.md" contains:
      """
      Read {{AGENT_HOME}}/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then it exits with 0
    And line 2 of the output is "Read /Users/v/.agent-config/knowledge/x.md first."

  Scenario: AC-1.7 Swap rule, Windows: the real path keeps the system's separators
    Given the file "copilot/instructions/x.md" contains:
      """
      Read {{AGENT_HOME}}/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      C:\Users\v\.agent-config
      --platform
      win32
      """
    Then it exits with 0
    And line 2 of the output is "Read C:\Users\v\.agent-config\knowledge\x.md first."

  Scenario: AC-1.7 Swap rule, spaces: the link text shows the real path and the relative target stays valid
    Given the file "copilot/instructions/x.md" contains:
      """
      See [{{AGENT_HOME}}/knowledge/x.md](../../knowledge/x.md).
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/Vinh Do/.agent-config
      --platform
      darwin
      """
    Then it exits with 0
    And line 2 of the output is "See [/Users/Vinh Do/.agent-config/knowledge/x.md](../../knowledge/x.md)."

  Scenario: AC-1.7 Swap rule, non-ASCII: the user name survives and a second run prints the same bytes
    Given the file "copilot/instructions/x.md" contains:
      """
      Read {{AGENT_HOME}}/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/Vinh Đỗ/.agent-config
      --platform
      darwin
      """
    Then it exits with 0
    And line 2 of the output is "Read /Users/Vinh Đỗ/.agent-config/knowledge/x.md first."
    Given the output is remembered
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/Vinh Đỗ/.agent-config
      --platform
      darwin
      """
    Then the output equals the remembered output

  Scenario: AC-1.7 Swap rule, tilde copilot path: an agent-home path written ~/.copilot is swapped
    Given the file "copilot/instructions/x.md" contains:
      """
      Read ~/.copilot/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then line 2 of the output is "Read /Users/v/.agent-config/knowledge/x.md first."

  Scenario: AC-1.7 Swap rule, Copilot's own path: a line on the allow-list stays as written
    Given the file "allow.txt" contains:
      """
      Copilot reads ~/.copilot/instructions/core.instructions.md itself.
      """
    And the file "copilot/instructions/x.md" contains:
      """
      Copilot reads ~/.copilot/instructions/core.instructions.md itself.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      --allow-list
      allow.txt
      """
    Then line 2 of the output is "Copilot reads ~/.copilot/instructions/core.instructions.md itself."

  Scenario: AC-1.7 Swap rule, Copilot's own path: the same line without the allow-list is swapped
    Given the file "copilot/instructions/x.md" contains:
      """
      Copilot reads ~/.copilot/instructions/core.instructions.md itself.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then line 2 of the output is "Copilot reads /Users/v/.agent-config/instructions/core.instructions.md itself."

  Scenario: AC-1.7 Swap rule, allow-list: a listed line keeps its placeholder, the same text elsewhere is swapped
    Given the file "allow.txt" contains:
      """
      The home is {{AGENT_HOME}}.
      """
    And the file "copilot/instructions/x.md" contains:
      """
      The home is {{AGENT_HOME}}.
      Read {{AGENT_HOME}}/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      --allow-list
      allow.txt
      """
    Then line 2 of the output is "The home is {{AGENT_HOME}}."
    And line 3 of the output is "Read /Users/v/.agent-config/knowledge/x.md first."

  Scenario: AC-1.7 Swap rule, generated-from line: with no front matter it is the first line
    Given the file "copilot/instructions/x.md" contains:
      """
      First line of the source.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then line 1 of the output contains "copilot/instructions/x.md"
    And line 2 of the output is "First line of the source."

  Scenario: AC-1.7 Swap rule, generated-from line: with front matter it follows the closing line of the front matter
    Given the file "copilot/instructions/x.md" contains:
      """
      ---
      applyTo: "**"
      ---
      First line of the source.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then line 1 of the output is "---"
    And line 2 of the output is "applyTo: \"**\""
    And line 3 of the output is "---"
    And line 4 of the output contains "copilot/instructions/x.md"
    And line 5 of the output is "First line of the source."

  Scenario: AC-1.7 Swap rule, idempotence: the same input gives byte-identical output twice
    Given the file "copilot/instructions/x.md" contains:
      """
      Read {{AGENT_HOME}}/knowledge/x.md first.
      """
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then it exits with 0
    And line 2 of the output is "Read /Users/v/.agent-config/knowledge/x.md first."
    Given the output is remembered
    And the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/x.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then the output equals the remembered output

  Scenario: AC-1.7 Swap rule, dry-run purity: rendering a file writes nothing
    Given "." is a git repository with everything committed
    And a temporary home exists
    And a snapshot of "." is taken
    When the tool runs with arguments:
      """
      budget
      --baseline
      --render
      copilot/instructions/core.instructions.md
      --agent-home
      /Users/v/.agent-config
      --platform
      darwin
      """
    Then it exits with 0
    And since the snapshot, nothing under "." changed
