# Requirements for copilot/frameworks/agentic-sdlc/tools/validate.mjs, as executable scenarios (specs/006).
# Each scenario title starts with the check code the validator prints. These codes are not yet rule ids in the
# framework schemas (specs/006-sdlc-validator-tests/research.md, finding F-1).
#
# Change policy (constitution principle IV): a changed check edits its scenario in the same commit as the validator;
# a new check adds scenarios and every existing one keeps passing. Output text is compared exactly.
#
# Characterization tests: first written to pin what the validator did on 2026-10-29. Dates in 2999 keep the
# 90-day reference check out of scenarios that are not about it. The fixture is a miniature framework with two
# roles, one tree, one foundation, one stack (framework, paradigm overlay, reference pin), one paradigm and the
# agent-config wrappers and skills around them.

Feature: Agentic SDLC framework validator
  The validator checks the framework files against the Checks tables of its schemas, and the role wrappers and
  skills in the agent-config repo. It exits 1 when a check fails; warnings never fail the run.

  Background:
    Given the base fixture tree of "validate-sdlc"

  Scenario: The base fixture tree passes with no warnings
    When the tool runs
    Then it passes with no warnings

  Scenario: CONV a missing conventions.md stops the run
    Given the file "repo/copilot/frameworks/agentic-sdlc/conventions.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      conventions.md not found at {root}/repo/copilot/frameworks/agentic-sdlc/conventions.md
      """

  Scenario: CONV a roles block that cannot be parsed fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `roles:\n` becomes `roles: []\n`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        CONV  conventions.md has no parsable "roles:" YAML block (one flow-mapping per line)
        TREE  trees/stack.tree.md: owner engineering is not a role in conventions.md §1
      """

  Scenario: CONV a role entry without an id fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `  - { id: orchestrator, tag:` becomes `  - { tag:`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (6)
        CONV  role entry without id
        ROLE  agents/orchestrator.md: id orchestrator ≠ conventions undefined
        WRAP  missing wrapper copilot/agents/sdlc-undefined.agent.md
        WRAP  missing wrapper claude/agents/sdlc-undefined.md
        WRAP  missing wrapper codex/agents/sdlc-undefined.toml
        SKILL  missing skills/sdlc-undefined-preset/SKILL.md
      """

  Scenario: CONV a duplicate role id fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `{ id: orchestrator,` becomes `{ id: engineering,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        CONV  duplicate role id engineering
        ROLE  agents/orchestrator.md: id orchestrator ≠ conventions engineering
      """

  Scenario: CONV a profile dimension without an id fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `  - { id: paradigm, required_for` becomes `  - { required_for`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONV  profile dimension without id
      """

  Scenario: CONV a duplicate profile dimension fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `{ id: paradigm, required_for` becomes `{ id: stack, required_for`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONV  duplicate profile dimension stack
      """

  Scenario: CONV a dimension whose tree has no tree file fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `tree: TS,` becomes `tree: XX,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONV  dimension stack: tree XX has no trees/*.tree.md with that prefix
      """

  Scenario: CONV a dimension whose folder does not exist fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `folder: paradigms/,` becomes `folder: styles/,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONV  dimension paradigm: folder styles/ does not exist
      """

  Scenario: TREE a schema other than tree/v2 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `schema: tree/v2` becomes `schema: tree/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md: front-matter schema must be tree/v2 (got tree/v1)
      """

  Scenario: TREE a missing front-matter key fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `feeds: the stack per component\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md: front-matter feeds missing
      """

  Scenario: TREE a prefix that is not 2-5 capital letters fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `prefix: TS` becomes `prefix: Ts`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (4)
        TREE  trees/stack.tree.md: prefix Ts must be 2-5 capital letters
        TREE  trees/stack.tree.md: node TS-Q1 does not use prefix Ts
        TREE  trees/stack.tree.md: node TS-Q2 does not use prefix Ts
        CONV  dimension stack: tree TS has no trees/*.tree.md with that prefix
      """

  Scenario: TREE a prefix used by two trees fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/trees/other.tree.md" contains:
      """
      ---
      schema: tree/v2
      last-updated: 2026-10-01
      prefix: TS
      owner: engineering
      phases: [P4]
      feeds: nothing
      ---

      # Other (TS)
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  prefix TS used by trees/stack.tree.md and trees/other.tree.md
      """

  Scenario: TREE an owner that is not a role fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `owner: engineering` becomes `owner: qa`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md: owner qa is not a role in conventions.md §1
      """

  Scenario: TREE a node without Default fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `- **Default:** NO.\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md TS-Q1: missing "- **Default:**"
      """

  Scenario: TREE a node without Escalate when fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `- **Escalate when:** two stacks are found.` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md TS-Q2: missing "- **Escalate when:**"
      """

  Scenario: TREE a node that does not use the tree prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `### TS-Q2 — Is there existing code?` becomes `### TX-Q2 — Is there existing code?`
    And in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `  - NO → TS-Q2` becomes `  - NO → stop`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  trees/stack.tree.md: node TX-Q2 does not use prefix TS
      """

  Scenario: TREE a node defined twice fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `### TS-Q2 — Is there existing code?` becomes `### TS-Q1 — Is there existing code?`
    And in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `  - NO → TS-Q2` becomes `  - NO → stop`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  node TS-Q1 defined twice
      """

  Scenario: TREE a branch to a node that is not defined fails
    Given in "repo/copilot/frameworks/agentic-sdlc/trees/stack.tree.md", `  - NO → TS-Q2` becomes `  - NO → TS-Q9`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TREE  trees/stack.tree.md TS-Q1: branch target TS-Q9 is not defined
        CITE  trees/stack.tree.md cites TS-Q9, which no tree defines
      """

  Scenario: IDS a rule prefix claimed by two files fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `rule-prefix: DMO` becomes `rule-prefix: DEM`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDS  rule-prefix DEM used by stacks/demo/idioms.md and foundations/code/demo.md
      """

  Scenario: RULE a rule id that does not match the prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| DEM-2 |` becomes `| DEMO-2 |`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  CITE  stacks/demo/index.md cites DEM-2, which no rule table defines
      FAIL (1)
        RULE  foundations/code/demo.md: rule id DEMO-2 does not match /^DEM-\d+$/
      """

  Scenario: RULE a rule id defined twice fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| DEM-2 | Keep files formatted.` becomes `| DEM-1 | Keep files formatted.`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  IDIOM  stacks/demo: 2 foundation rule(s) enforced by lint/typecheck/test have no Enforcement/Foundation-mapping row: DEM-1, DEM-1
        warn  CITE  stacks/demo/index.md cites DEM-2, which no rule table defines
      FAIL (1)
        RULE  foundations/code/demo.md: rule id DEM-1 already defined in foundations/code/demo.md
      """

  Scenario: RULE an empty Holds when cell fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| DEM-1 | Write clear code. | It reads clearly. |` becomes `| DEM-1 | Write clear code. |  |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        RULE  foundations/code/demo.md DEM-1: column "Holds when" missing or empty
      """

  Scenario: RULE an Enforced by value outside lint|typecheck|test|script|llm fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| A cryptic name. | llm |` becomes `| A cryptic name. | review |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        RULE  foundations/code/demo.md DEM-1: Enforced by "review" is not one of lint|typecheck|test|script|llm
      """

  Scenario: RULE a rule table without a Source column fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| Id | Rule | Holds when | Typical violation | Enforced by | Source |\n|---|---|---|---|---|---|` becomes `| Id | Rule | Holds when | Typical violation | Enforced by |\n|---|---|---|---|---|`
    And in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", ` | knowledge/demo/doc.md |` becomes ` |`
    And in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| lint | — |` becomes `| lint |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        RULE  foundations/code/demo.md DEM-1: Source column missing
        RULE  foundations/code/demo.md DEM-2: Source column missing
      """

  Scenario: RULE a Rules section without a rule table fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| Id | Rule | Holds when` becomes `| Key | Rule | Holds when`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  CITE  agents/engineering.md cites DEM-1, which no rule table defines
        warn  CITE  foundations/code/demo.md cites DEM-1, which no rule table defines
        warn  CITE  foundations/code/demo.md cites DEM-2, which no rule table defines
        warn  CITE  stacks/demo/index.md cites DEM-2, which no rule table defines
      FAIL (1)
        RULE  foundations/code/demo.md: "## Rules" has no rule table (Id | Rule | Holds when | Typical violation | Enforced by | Source)
      """

  Scenario: SRC a Source that does not exist warns
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `| llm | knowledge/demo/doc.md |` becomes `| llm | knowledge/demo/gone.md |`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  SRC  foundations/code/demo.md DEM-1: Source knowledge/demo/gone.md does not exist
      PASS (1 warning(s))
      """

  Scenario: SRC a stale Source warns
    Given in "repo/copilot/knowledge/demo/doc.md", `status: verified` becomes `status: stale`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  SRC  foundations/code/demo.md DEM-1: Source is stale: knowledge/demo/doc.md
        warn  SRC  paradigms/demo-paradigm.md PDM-demo-paradigm-R1: Source is stale: knowledge/demo/doc.md
      PASS (2 warning(s))
      """

  Scenario: SRC a Source that is a synthesized deep dive warns
    Given in "repo/copilot/knowledge/demo/doc.md", `schema: knowledge-doc/v1` becomes `schema: deep-dive/v1\nsynthesized-into: [demo/derived.md]`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  SRC  foundations/code/demo.md DEM-1: Source is a deep dive that has been synthesized; cite the derived doc
        warn  SRC  paradigms/demo-paradigm.md PDM-demo-paradigm-R1: Source is a deep dive that has been synthesized; cite the derived doc
      PASS (2 warning(s))
      """

  Scenario: FND a schema other than foundation/v2 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `schema: foundation/v2` becomes `schema: foundation/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/code/demo.md: schema must be foundation/v2 (got foundation/v1)
      """

  Scenario: FND a foundation outside a subject folder fails
    Given the folder "repo/copilot/frameworks/agentic-sdlc/foundations/misc" exists
    And the file "repo/copilot/frameworks/agentic-sdlc/foundations/misc/extra.md" contains:
      """
      ---
      schema: foundation/v2
      last-updated: 2026-10-01
      rule-prefix: XTR
      subject: misc
      ---

      # Extra

      ## Rules

      | Id | Rule | Holds when | Typical violation | Enforced by | Source |
      |---|---|---|---|---|---|
      | XTR-1 | One. | Two. | Three. | llm | — |

      ## Interpreting

      ## Tensions

      ## References

      ## Related
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/misc/extra.md: folder misc is not a subject (code, design, quality, delivery, review)
      """

  Scenario: FND a subject that differs from the folder fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `subject: code` becomes `subject: design`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/code/demo.md: subject design does not match folder code
      """

  Scenario: FND a foundation without rule-prefix fails and skips its rules
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `rule-prefix: DEM\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/code/demo.md: rule-prefix missing
      """

  Scenario: FND a missing section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `## Tensions\nNone.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/code/demo.md: section "## Tensions" missing
      """

  Scenario: FND sections out of order fail
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `## Interpreting\nNothing more.\n\n## Tensions\nNone.` becomes `## Tensions\nNone.\n\n## Interpreting\nNothing more.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FND  foundations/code/demo.md: sections out of order (Rules → Interpreting → Tensions → References → Related)
      """

  Scenario: STACK a stack folder without index.md fails and is skipped
    Given the file "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: missing index.md
      """

  Scenario: STACK a schema other than stack/v2 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `schema: stack/v2` becomes `schema: stack/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo/index.md: schema must be stack/v2
      """

  Scenario: STACK an id that differs from the folder fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `id: demo\n` becomes `id: other\n`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo/index.md: id other does not match folder
      """

  Scenario: STACK a missing front-matter key fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `detect-by: [demo.lock]\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo/index.md: front-matter detect-by missing
      """

  Scenario: STACK an empty slot fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `| `cmd.audit` | `demo audit` |` becomes `| `cmd.audit` |  |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: slot cmd.audit missing or empty
      """

  Scenario: STACK frameworks that differ from the files on disk fail
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `frameworks: [web]` becomes `frameworks: [web, cli]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: frameworks [web,cli] ≠ files on disk [web]
      """

  Scenario: STACK paradigms that differ from the overlay files fail
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `paradigms: [demo-paradigm]` becomes `paradigms: [demo-paradigm, other]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        STACK  stacks/demo: paradigms [demo-paradigm,other] ≠ overlay files on disk [demo-paradigm]
        STACK  stacks/demo: paradigm other has no paradigms/other.md
      """

  Scenario: STACK a Reference topic path that does not exist fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `| Demo doc | knowledge/demo/doc.md |` becomes `| Demo doc | knowledge/demo/gone.md |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: Reference topic path does not exist: knowledge/demo/gone.md
      """

  Scenario: STACK a Reference topic with an unknown schema warns
    Given in "repo/copilot/knowledge/demo/doc.md", `schema: knowledge-doc/v1` becomes `schema: note/v1`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  STACK  stacks/demo: Reference topic knowledge/demo/doc.md has unknown schema note/v1
      PASS (1 warning(s))
      """

  Scenario: STACK a stack without idioms.md fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: missing idioms.md
      """

  Scenario: REF an in-tree reference project fails
    Given the folder "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference" exists
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference/: in-tree reference projects were replaced by stack-reference pointers (reference.md); move the code to its own repo
      """

  Scenario: REF a schema other than stack-reference/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `schema: stack-reference/v1` becomes `schema: stack-reference/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: schema must be stack-reference/v1
      """

  Scenario: REF a stack that differs from the folder fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `stack: demo\n` becomes `stack: other\n`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: stack other does not match folder
      """

  Scenario: REF a repo that is not owner/name fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `repo: demo-org/demo-reference` becomes `repo: demo-reference`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: repo must be owner/name
      """

  Scenario: REF a missing pinned tag fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `pinned: v1.0.0\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: pinned (the release tag) missing
      """

  Scenario: REF a commit that is not a full SHA fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `commit: 0123456789abcdef0123456789abcdef01234567` becomes `commit: 0123456`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: commit must be a full 40-character SHA (a tag can move)
      """

  Scenario: REF a verified value that is not a date fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `verified: 2999-12-31\nvariants` becomes `verified: soon\nvariants`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: verified must be a YYYY-MM-DD date
      """

  Scenario: REF a verified date older than 90 days warns
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `verified: 2999-12-31\nvariants` becomes `verified: 2000-01-01\nvariants`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  REF  stacks/demo/reference.md: verified 2000-01-01, more than 90 days ago; re-run the reference's checks at the pin and update verified
      PASS (1 warning(s))
      """

  Scenario: REF a missing section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `## File map\nsrc/\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: section "## File map" missing
      """

  Scenario: REF How to fetch without the pinned commit fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `git checkout 0123456789abcdef0123456789abcdef01234567 (feature-first)` becomes `git checkout main (feature-first)`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: How to fetch must check out the pinned commit 0123456789abcdef0123456789abcdef01234567
      """

  Scenario: REF variants without a layout fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `layout: feature-first\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: layout (feature-first or layer-first) is required when variants are listed
      """

  Scenario: REF variants without a Which layout section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `## Which layout\nFeature-first by default.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: section "## Which layout" missing (required with variants)
      """

  Scenario: REF a variant without a branch fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `branch: layout/layer-first, ` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: variant layer-first lacks branch
      """

  Scenario: REF a variant commit that is not a full SHA fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `commit: 89abcdef0123456789abcdef0123456789abcdef,` becomes `commit: 89abcde,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: variant layer-first commit must be a full 40-character SHA
      """

  Scenario: REF How to fetch without a variant commit fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `or 89abcdef0123456789abcdef0123456789abcdef (layer-first)` becomes `or the branch (layer-first)`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: How to fetch must also check out variant layer-first's commit 89abcdef0123456789abcdef0123456789abcdef
      """

  Scenario: REF a variant verified value that is not a date fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/reference.md", `verified: 2999-12-31 }` becomes `verified: soon }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  stacks/demo/reference.md: variant layer-first verified must be a YYYY-MM-DD date
      """

  Scenario: IDIOM a schema other than stack-idioms/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `schema: stack-idioms/v1` becomes `schema: stack-idioms/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md: schema must be stack-idioms/v1
      """

  Scenario: IDIOM a stack that differs from the folder fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `stack: demo\n` becomes `stack: other\n`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md: stack other does not match folder
      """

  Scenario: IDIOM a missing idiom section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `## idiom.logging\nStructured.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md: section "## idiom.logging" missing
      """

  Scenario: IDIOM a rule id defined twice fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `| DMO-2 | Avoid copies` becomes `| DMO-1 | Avoid copies`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md: rule id DMO-1 duplicated
      """

  Scenario: IDIOM an invalid Enforced by fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `| Return errors as values. | lint |` becomes `| Return errors as values. | review |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md DMO-1: invalid Enforced by "review"
      """

  Scenario: IDIOM a runtime & performance rule without Source warns
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `| llm | knowledge/demo/doc.md |` becomes `| llm | — |`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  IDIOM  stacks/demo/idioms.md DMO-2: runtime & performance rule has no Source (knowledge seeding is phase 3)
      PASS (1 warning(s))
      """

  Scenario: IDIOM an idioms file without rule-prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/idioms.md", `rule-prefix: DMO\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDIOM  stacks/demo/idioms.md: rule-prefix missing
      """

  Scenario: IDIOM a lint-enforced foundation rule with no mapping row warns
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `| DEM-2 | `demotool check` |` becomes `| — | — |`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  IDIOM  stacks/demo: 1 foundation rule(s) enforced by lint/typecheck/test have no Enforcement/Foundation-mapping row: DEM-2
      PASS (1 warning(s))
      """

  Scenario: FW a schema other than stack-framework/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `schema: stack-framework/v1` becomes `schema: stack-framework/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FW  stacks/demo/frameworks/web.md: schema must be stack-framework/v1
      """

  Scenario: FW front-matter that names another framework fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `framework: web` becomes `framework: api`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FW  stacks/demo/frameworks/web.md: stack/framework front-matter must be demo/web
      """

  Scenario: FW a framework without rule-prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `rule-prefix: WEB\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FW  stacks/demo/frameworks/web.md: rule-prefix missing
      """

  Scenario: FW a rule id with another prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `| WEB-1 |` becomes `| WBX-1 |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FW  stacks/demo/frameworks/web.md: rule id WBX-1 does not use prefix WEB
      """

  Scenario: FW a rule id already defined elsewhere fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `| WEB-1 |` becomes `| DEM-1 |`
    And in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/frameworks/web.md", `rule-prefix: WEB` becomes `rule-prefix: DEM`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        IDS  rule-prefix DEM used by stacks/demo/frameworks/web.md and foundations/code/demo.md
        FW  stacks/demo/frameworks/web.md: rule id DEM-1 duplicated
      """

  Scenario: PDM a schema other than paradigm/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `schema: paradigm/v1` becomes `schema: paradigm/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: schema must be paradigm/v1 (got paradigm/v2)
      """

  Scenario: PDM an id that differs from the file name fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `id: demo-paradigm` becomes `id: other`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: id other does not match file name
      """

  Scenario: PDM a version that is not a major number fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `version: 1` becomes `version: 1.2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        PDM  paradigms/demo-paradigm.md: version must be a major number
        PDM  stacks/demo/paradigms/demo-paradigm.md: front-matter must be stack: demo, paradigm: demo-paradigm@1.2
      """

  Scenario: PDM a missing section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `## Escape hatches\nNone.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: section "## Escape hatches" missing
      """

  Scenario: PDM a section out of order fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `## Core idea\nText.\n\n## Use when\nText.` becomes `## Use when\nText.\n\n## Core idea\nText.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: section "## Use when" out of order
      """

  Scenario: PDM supports for an unknown stack fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `supports: [demo]` becomes `supports: [demo, other]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: supports unknown stack other
      """

  Scenario: PDM a supported stack without an overlay fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/stacks/demo/paradigms/demo-paradigm.md" is removed
    And in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/index.md", `paradigms: [demo-paradigm]` becomes `paradigms: []`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  paradigms/demo-paradigm.md: supports demo but stacks/demo/paradigms/demo-paradigm.md is missing
      """

  Scenario: PDM an overlay schema other than stack-paradigm/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/paradigms/demo-paradigm.md", `schema: stack-paradigm/v1` becomes `schema: stack-paradigm/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  stacks/demo/paradigms/demo-paradigm.md: schema must be stack-paradigm/v1
      """

  Scenario: PDM an overlay that names another version fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/paradigms/demo-paradigm.md", `paradigm: demo-paradigm@1` becomes `paradigm: demo-paradigm@2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  stacks/demo/paradigms/demo-paradigm.md: front-matter must be stack: demo, paradigm: demo-paradigm@1
      """

  Scenario: PDM an overlay missing a section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/paradigms/demo-paradigm.md", `## Counter-example\nA mutable thing.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  stacks/demo/paradigms/demo-paradigm.md: section "## Counter-example" missing
      """

  Scenario: PDM a test-enforced rule without an Enforcement row fails
    Given in "repo/copilot/frameworks/agentic-sdlc/stacks/demo/paradigms/demo-paradigm.md", `| PDM-demo-paradigm-R1 | test |` becomes `| — | — |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  stacks/demo/paradigms/demo-paradigm.md: PDM-demo-paradigm-R1 is enforced by test but has no Enforcement row
      """

  Scenario: PDM an overlay for a stack the paradigm does not support fails
    Given in "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md", `supports: [demo]` becomes `supports: []`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        PDM  stacks/demo/paradigms/demo-paradigm.md exists but paradigms/demo-paradigm.md does not list demo in supports
      """

  Scenario: STACK a listed paradigm without a paradigm file fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/paradigms/demo-paradigm.md" is removed
    And the folder "repo/skills/sdlc-paradigm-demo-paradigm" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        STACK  stacks/demo: paradigm demo-paradigm has no paradigms/demo-paradigm.md
      """

  Scenario: ROLE a role file that does not exist fails
    Given in "repo/copilot/frameworks/agentic-sdlc/conventions.md", `file: agents/orchestrator.md` becomes `file: agents/lead.md`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  role orchestrator: agents/lead.md missing
      """

  Scenario: ROLE a schema other than agent-role/v2 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `schema: agent-role/v2` becomes `schema: agent-role/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: schema must be agent-role/v2
      """

  Scenario: ROLE an id that differs from conventions fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `id: engineering` becomes `id: eng`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: id eng ≠ conventions engineering
      """

  Scenario: ROLE a tag that differs from conventions fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `tag: "[Eng]"` becomes `tag: "[Dev]"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: tag Dev ≠ conventions [Eng]
      """

  Scenario: ROLE a missing section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `## Standalone use\nRun on request.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: section "## Standalone use" missing
      """

  Scenario: ROLE a Preset entry outside foundations fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `| foundations/code/demo.md | The demo rules |` becomes `| stacks/demo/index.md | The demo rules |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ROLE  agents/engineering.md: Preset entry stacks/demo/index.md is not under foundations/
        SKILL  skills/sdlc-engineering-preset: list [foundations/code/demo.md] ≠ agents/engineering.md Preset [stacks/demo/index.md]
      """

  Scenario: ROLE a Preset entry that does not exist fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `| foundations/code/demo.md | The demo rules |` becomes `| foundations/code/gone.md | The demo rules |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ROLE  agents/engineering.md: Preset entry foundations/code/gone.md does not exist
        SKILL  skills/sdlc-engineering-preset: list [foundations/code/demo.md] ≠ agents/engineering.md Preset [foundations/code/gone.md]
      """

  Scenario: ROLE a rubric id without the rubric prefix fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `| ENG-R1 |` becomes `| ENGR-1 |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: rubric id ENGR-1 does not use rubric-prefix ENG
      """

  Scenario: ROLE a duplicate rubric id fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `| ENG-R1 | Code follows DEM-1 | llm | major |` becomes `| ENG-R1 | Code follows DEM-1 | llm | major |\n| ENG-R1 | Again | llm | minor |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md: rubric id ENG-R1 duplicated
      """

  Scenario: ROLE a rubric row with an invalid Enforced by fails
    Given in "repo/copilot/frameworks/agentic-sdlc/agents/engineering.md", `| Code follows DEM-1 | llm |` becomes `| Code follows DEM-1 | review |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ROLE  agents/engineering.md ENG-R1: invalid Enforced by "review"
      """

  Scenario: CITE a tree node that no tree defines fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `Nothing more.` becomes `See TS-Q7.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CITE  foundations/code/demo.md cites TS-Q7, which no tree defines
      """

  Scenario: CITE a rule id that no rule table defines warns
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `Nothing more.` becomes `See DEM-9.`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  CITE  foundations/code/demo.md cites DEM-9, which no rule table defines
      PASS (1 warning(s))
      """

  Scenario: V6 a stack tool named outside stacks/ fails
    Given in "repo/copilot/frameworks/agentic-sdlc/foundations/code/demo.md", `Nothing more.` becomes `Run demotool.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        V6  foundations/code/demo.md:18 names stack-specific tool(s): demotool
      """

  Scenario: INDEX a schema other than framework-index/v1 fails
    Given in "repo/copilot/frameworks/agentic-sdlc/index.md", `schema: framework-index/v1` becomes `schema: index/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md: schema must be framework-index/v1
      """

  Scenario: INDEX a missing numbered section fails
    Given in "repo/copilot/frameworks/agentic-sdlc/index.md", `## 7. Section 7\nText.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md: section "## 7. …" missing
      """

  Scenario: INDEX numbered sections out of order fail
    Given in "repo/copilot/frameworks/agentic-sdlc/index.md", `## 2. Section 2` becomes `## 9. Section 2`
    And in "repo/copilot/frameworks/agentic-sdlc/index.md", `## 9. Section 9` becomes `## 2. Section 9`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md: numbered sections out of order
      """

  Scenario: INDEX an index that does not end with References and Related fails
    Given in "repo/copilot/frameworks/agentic-sdlc/index.md", `## Related` becomes `## See also`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md: must end with ## References, ## Related
      """

  Scenario: INDEX a relative link that does not resolve fails
    Given in "repo/copilot/frameworks/agentic-sdlc/index.md", `[conventions](conventions.md)` becomes `[conventions](conventions-old.md)`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md: link conventions-old.md does not resolve
      """

  Scenario: INDEX a missing index.md fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/index.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INDEX  index.md missing
      """

  Scenario: SCHEMA a registry entry whose schema file does not exist fails
    Given the file "repo/copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SCHEMA  _system.md §4 lists foundation.schema.md, which does not exist
      """

  Scenario: WRAP a missing wrapper fails
    Given the file "repo/codex/agents/sdlc-engineering.toml" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  missing wrapper codex/agents/sdlc-engineering.toml
      """

  Scenario: WRAP a wrapper with another name fails
    Given in "repo/copilot/agents/sdlc-engineering.agent.md", `name: sdlc-engineering` becomes `name: engineering`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  copilot/agents/sdlc-engineering.agent.md: name must be sdlc-engineering
      """

  Scenario: WRAP a wrapper body that does not follow the template fails
    Given in "repo/claude/agents/sdlc-engineering.md", `Never launch other agents.` becomes `Launch helpers when useful.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  claude/agents/sdlc-engineering.md: body does not match the role-wrapper template
      """

  Scenario: WRAP a Copilot wrapper that is not user-invocable fails
    Given in "repo/copilot/agents/sdlc-engineering.agent.md", `user-invocable: true` becomes `user-invocable: false`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  copilot/agents/sdlc-engineering.agent.md: user-invocable must be true
      """

  Scenario: WRAP a Claude wrapper without its preset skill fails
    Given in "repo/claude/agents/sdlc-engineering.md", `  - sdlc-engineering-preset` becomes `  - other-skill`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        WRAP  claude/agents/sdlc-engineering.md: skills must list sdlc-engineering-preset
      """

  Scenario: WRAP without the agent-config repo the wrapper checks are skipped with a warning
    Given the folder "repo/skills" is removed
    When the tool runs with "--no-repo"
    Then it exits with 0 and prints:
      """
        warn  WRAP  agent-config repo not found; wrapper and skill checks skipped (pass --repo <path>)
      PASS (1 warning(s))
      """

  Scenario: SKILL a missing preset skill fails
    Given the folder "repo/skills/sdlc-engineering-preset" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  missing skills/sdlc-engineering-preset/SKILL.md
      """

  Scenario: SKILL a preset skill list that differs from the role fails
    Given in "repo/skills/sdlc-engineering-preset/SKILL.md", `1. `~/.copilot/frameworks/agentic-sdlc/foundations/code/demo.md`` becomes `1. `~/.copilot/frameworks/agentic-sdlc/foundations/code/other.md``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  skills/sdlc-engineering-preset: list [foundations/code/other.md] ≠ agents/engineering.md Preset [foundations/code/demo.md]
      """

  Scenario: SKILL a missing stack skill fails
    Given the folder "repo/skills/sdlc-stack-demo" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  missing skills/sdlc-stack-demo/SKILL.md
      """

  Scenario: SKILL a missing paradigm skill fails
    Given the folder "repo/skills/sdlc-paradigm-demo-paradigm" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  missing skills/sdlc-paradigm-demo-paradigm/SKILL.md
      """

  Scenario: SKILL a stack skill with no matching stack fails
    Given the folder "repo/skills/sdlc-stack-other" exists
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  skills/sdlc-stack-other has no matching stack
      """

  Scenario: SKILL a v1 skill that should be removed fails
    Given the folder "repo/skills/sdlc-engineering-principles" exists
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SKILL  skills/sdlc-engineering-principles is a v1 skill; remove it
      """

  Scenario: REF the same latest tag upstream passes
    Given a local web server that answers:
      """
      /repos/demo-org/demo-reference/tags?per_page=100 200 [{"name":"v1.0.0"},{"name":"v0.9.0"}]
      """
    When the tool runs with "--upstream"
    Then it passes with no warnings

  Scenario: REF a newer tag upstream warns
    Given a local web server that answers:
      """
      /repos/demo-org/demo-reference/tags?per_page=100 200 [{"name":"v1.0.0"},{"name":"v1.10.0"},{"name":"v1.2.0"},{"name":"nightly"}]
      """
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  REF  stacks/demo/reference.md: pinned v1.0.0, the reference repo's latest tag is v1.10.0; review it and bump pinned/commit/verified
      PASS (1 warning(s))
      """

  Scenario: REF an upstream error status warns
    Given a local web server that answers:
      """
      /repos/other/thing/tags?per_page=100 200 []
      """
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  REF  stacks/demo/reference.md: demo-org/demo-reference tags → HTTP 404
      PASS (1 warning(s))
      """

  Scenario: REF an unreachable upstream warns
    When the tool runs with "--upstream"
    Then it exits with 0 and prints:
      """
        warn  REF  stacks/demo/reference.md: demo-org/demo-reference → TypeError: fetch failed
      PASS (1 warning(s))
      """

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every check code the validator prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature
