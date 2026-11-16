# Characterization of copilot/frameworks/agentic-sdlc/tools/validate.mjs around specs/022 phase 1 (QB-3).
# They first pinned what the validator did with the folder names it wrote into its own code: the knowledge folder
# (<repo>/copilot/knowledge), the adapter folders and the skills folder, and a citation that did not resolve was a
# warning. T099 made the knowledge root and the adapter map arguments (--knowledge, --adapters) and an unresolved
# citation a failure, and rewrote those scenarios in the same change: they now pin the argument-driven behaviour.
# Scenarios that need a folder under another name are in validate-sdlc.feature (the AC-9.3 scenarios).

Feature: SDLC validator, the folders it hard-codes
  The validator looks for the cited docs at the knowledge root it is given, and for the role wrappers and the
  skills at the paths of the adapter map it is given; it names no folder of its own.

  Background:
    Given the base fixture tree of "validate-sdlc"

  # ---- the knowledge root ----------------------------------------------------------------------

  Scenario: QB-3 the knowledge root is the argument: a root without the cited docs fails every citation
    Given the folder "repo/library" exists
    When the tool runs with "--knowledge {root}/repo/library"
    Then it exits with 1 and prints:
      """
      FAIL (3)
        SRC  foundations/code/demo.md DEM-1: Source knowledge/demo/doc.md does not exist
        STACK  stacks/demo: Reference topic path does not exist: knowledge/demo/doc.md
        SRC  paradigms/demo-paradigm.md PDM-demo-paradigm-R1: Source knowledge/demo/doc.md does not exist
      """

  Scenario: QB-3 the knowledge root is the argument: a Source with the AGENT_HOME prefix resolves to the same folder
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| llm | knowledge/demo/doc.md |` becomes `| llm | {{AGENT_HOME}}/knowledge/demo/doc.md |`
    When the tool runs
    Then it passes with no warnings

  Scenario: QB-3 the knowledge root is the argument: without --knowledge and --adapters nothing else is guessed
    Given the folder "repo/copilot/knowledge" is removed
    And the folder "repo/skills" is removed
    When the tool runs with "--no-knowledge --no-adapters"
    Then it exits with 0 and prints:
      """
        warn  SRC  no --knowledge; cited docs are not checked (pass --knowledge <knowledge root>)
        warn  WRAP  no --adapters; wrapper and skill checks skipped (pass --adapters <adapter map file>)
      PASS (2 warning(s))
      """

  # ---- what an unresolved citation prints ------------------------------------------------------

  Scenario: QB-3 an unresolved Reference topic (kept by T099) is already a failure that names the stack and the path
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `| Demo doc | knowledge/demo/doc.md |` becomes `| Demo doc | knowledge/demo/gone.md |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: Reference topic path does not exist: knowledge/demo/gone.md
      """

  # ---- the adapter map -------------------------------------------------------------------------

  Scenario: QB-3 the wrappers are read at the paths of the adapter map, not at fixed folders
    Given the folder "repo/copilot/agents" is renamed to "repo/wrappers-gh"
    And the folder "repo/claude/agents" is renamed to "repo/wrappers-cl"
    And the folder "repo/codex/agents" is renamed to "repo/wrappers-cx"
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        WRAP  missing wrapper copilot/agents/sdlc-engineering.agent.md
        WRAP  missing wrapper claude/agents/sdlc-engineering.md
        WRAP  missing wrapper codex/agents/sdlc-engineering.toml
      """

  Scenario: QB-3 a wrapper with a plain .md name must list its preset skill, wherever the map puts it
    Given the folder "repo/claude/agents" is renamed to "repo/other/agents"
    And in "repo/other/agents/sdlc-engineering.md", `  - sdlc-engineering-preset` becomes `  - other-skill`
    And the file "repo/adapters.json" contains:
      """
      {
        "copilot": "copilot/agents/sdlc-{id}.agent.md",
        "claude": "other/agents/sdlc-{id}.md",
        "codex": "codex/agents/sdlc-{id}.toml",
        "skills": "skills"
      }
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  other/agents/sdlc-engineering.md: skills must list sdlc-engineering-preset
      """

  Scenario: QB-3 every .toml file in the folder of a mapped Codex wrapper is checked for TOML escapes
    Given the file "repo/codex/agents/extra.toml" contains:
      """
      name = "extra"
      description = "C:\Users"
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  codex/agents/extra.toml: line 2: "\U" is not a TOML escape, so Codex ignores this file (put Windows paths in a '''…''' string)
      """

  # ---- the skills folder -----------------------------------------------------------------------

  Scenario: QB-3 a missing preset skill is named under the mapped skills folder
    Given the folder "repo/skills/sdlc-engineering-preset" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  missing skills/sdlc-engineering-preset/SKILL.md
      """

  Scenario: QB-3 any folder named sdlc-stack-* or sdlc-paradigm-* under the skills folder must match a stack or paradigm
    Given the folder "repo/skills/sdlc-paradigm-other" exists
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  skills/sdlc-paradigm-other has no matching paradigm
      """
