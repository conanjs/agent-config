# Requirements for copilot/frameworks/agent-foundry/tools/validate-foundry.mjs, as executable scenarios (specs/005).
# Each scenario title starts with the check code the validator prints. These codes are not yet rule ids in the
# foundry schemas (specs/005-foundry-validator-tests/research.md, finding F-1).
#
# Change policy (constitution principle IV): a changed check edits its scenario in the same commit as the validator;
# a new check adds scenarios and every existing one keeps passing. Output text is compared exactly.
#
# Characterization tests: first written to pin what the validator did on 2026-10-29. Dates in 2999 keep the
# expiry warnings out of scenarios that are not about them.

Feature: Agent Foundry validator
  The validator checks floors, charters, trees and lens folders (lessons, waivers, zone maps).
  It prints FAIL and WARN lines, then a summary; it exits 1 when any check fails.

  Background:
    Given the base fixture tree of "validate-foundry"

  Scenario: The base fixture tree passes with no warnings
    When the tool runs
    Then it passes with no warnings

  Scenario: RULES a missing rules root warns, and rule ids are not checked
    Given the folder "rules" is removed
    When the tool runs
    Then it exits with 0 and prints:
      """
      WARN RULES: rules root not found at {root}/rules; rule-id existence not checked

      agent-foundry: 0 failure(s), 1 warning(s); 6 markdown files, 1 floors, 0 rule ids loaded
      """

  Scenario: FM a markdown file without a schema fails
    Given in "foundry/floors.md", `schema: floors/v1\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FM: floors.md: missing front-matter "schema"

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: FM a markdown file without last-updated fails
    Given in "foundry/floors.md", `last-updated: 2026-10-01\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FM: floors.md: missing front-matter "last-updated"

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: FLOOR a missing floors.md fails
    Given the file "foundry/floors.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FLOOR: floors.md missing

      agent-foundry: 1 failure(s), 0 warning(s); 5 markdown files, 0 floors, 3 rule ids loaded
      """

  Scenario: FLOOR a floor whose rule does not exist fails
    Given in "foundry/floors.md", `| SAFE-1 | Harm` becomes `| SAFE-9 | Harm`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FLOOR: floors.md: rule SAFE-9 does not exist in {root}/rules

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: FLOOR a floor without a reason fails
    Given in "foundry/floors.md", `| SAFE-1 | Harm lands outside the team |` becomes `| SAFE-1 |  |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FLOOR: floors.md: SAFE-1 has no reason

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: FLOOR a floors table with no rows fails
    Given in "foundry/floors.md", `| SAFE-1 | Harm lands outside the team | security |\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL FLOOR: floors.md: no floors listed

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 0 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a schema other than charter/v1 fails
    Given in "foundry/charters/reviewer.charter.md", `schema: charter/v1` becomes `schema: charter/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: schema must be charter/v1

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER an id that differs from the file name fails
    Given in "foundry/charters/reviewer.charter.md", `id: reviewer` becomes `id: checker`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: id "checker" must equal file name "reviewer"

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER an unknown autonomy fails
    Given in "foundry/charters/reviewer.charter.md", `autonomy: suggest-only` becomes `autonomy: approve`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: autonomy must be one of suggest-only|comment|request-changes

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a missing section fails
    Given in "foundry/charters/reviewer.charter.md", `## Eval\n- accuracy\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: section "## Eval" missing

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a reviewing agent that may approve or merge fails
    Given in "foundry/charters/reviewer.charter.md", `- Approve or merge → a human.` becomes `- Rewrite the change.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: a reviewing agent's "Does NOT do" must include approving and merging

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a rubric id without the rubric prefix fails
    Given in "foundry/charters/reviewer.charter.md", `| REV-R1 |` becomes `| RV-R1 |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: rubric id RV-R1 must start with REV-R

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a duplicate rubric id fails
    Given in "foundry/charters/reviewer.charter.md", `| REV-R2 |` becomes `| REV-R1 |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: duplicate rubric id REV-R1

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a rubric rule that does not exist fails
    Given in "foundry/charters/reviewer.charter.md", `| DEMO-1 | llm |` becomes `| DEMO-9 | llm |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md REV-R1: rule DEMO-9 does not exist

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a floor rule below blocker fails
    Given in "foundry/charters/reviewer.charter.md", `| SAFE-1 | llm | blocker |` becomes `| SAFE-1 | llm | major |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md REV-R2: floor rule SAFE-1 must be blocker

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: CHARTER a decision-flow tree that does not exist fails
    Given in "foundry/charters/reviewer.charter.md", ``trees/review.tree.md`` becomes ``trees/missing.tree.md``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL CHARTER: charters/reviewer.charter.md: tree trees/missing.tree.md does not exist

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: TREE a schema other than tree/v2 fails
    Given in "foundry/trees/review.tree.md", `schema: tree/v2` becomes `schema: tree/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL TREE: trees/review.tree.md: schema must be tree/v2

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: TREE a missing front-matter key fails
    Given in "foundry/trees/review.tree.md", `feeds: the review note\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL TREE: trees/review.tree.md: front-matter "feeds" missing

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: TREE a tree with no nodes fails
    Given in "foundry/trees/review.tree.md", `### RVW-Q1 — Is the change small enough to review?` becomes `Is the change small enough to review?`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL TREE: trees/review.tree.md: no nodes

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: TREE a node without Default fails
    Given in "foundry/trees/review.tree.md", `- **Default:** YES.\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL TREE: trees/review.tree.md RVW-Q1: missing Default

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: TREE a node without Escalate when fails
    Given in "foundry/trees/review.tree.md", `- **Escalate when:** it touches a floor.` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL TREE: trees/review.tree.md RVW-Q1: missing Escalate when

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON a missing key fails
    Given in "foundry/lens/lessons/LS-1.md", `confidence: medium\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: "confidence" missing
      FAIL LESSON: lens/lessons/LS-1.md: confidence must be high|medium|low

      agent-foundry: 2 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an id not shaped LS-<n> fails
    Given in "foundry/lens/lessons/LS-1.md", `id: LS-1` becomes `id: L1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: id must look like LS-<n>

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an unknown status fails
    Given in "foundry/lens/lessons/LS-1.md", `status: active` becomes `status: done`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: status must be candidate|active|contested|retired|rejected

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an unknown polarity fails
    Given in "foundry/lens/lessons/LS-1.md", `polarity: prefer` becomes `polarity: like`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: polarity must be prefer|avoid|accept

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an unknown confidence fails
    Given in "foundry/lens/lessons/LS-1.md", `confidence: medium` becomes `confidence: sure`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: confidence must be high|medium|low

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON a scope without team:, repo: or path: fails
    Given in "foundry/lens/lessons/LS-1.md", `scope: team:demo` becomes `scope: demo`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: scope must start with team:, repo: or path:

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an expires date not in YYYY-MM-DD form fails
    Given in "foundry/lens/lessons/LS-1.md", `expires: 2999-12-31` becomes `expires: never`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: expires must be YYYY-MM-DD

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an active lesson past its expiry warns
    Given in "foundry/lens/lessons/LS-1.md", `expires: 2999-12-31` becomes `expires: 2000-01-01`
    When the tool runs
    Then it exits with 0 and prints:
      """
      WARN LESSON: lens/lessons/LS-1.md: active but expired on 2000-01-01; retire or reconfirm

      agent-foundry: 0 failure(s), 1 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON a lesson with neither adjusts nor adds-check fails
    Given in "foundry/lens/lessons/LS-1.md", `adjusts: "DEMO-1: major -> minor"\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: needs "adjusts" or "adds-check"

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an adjusts value in another shape fails
    Given in "foundry/lens/lessons/LS-1.md", `"DEMO-1: major -> minor"` becomes `"DEMO-1 to minor"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: adjusts must look like RULE-1: major -> minor

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON adjusting a floor rule fails
    Given in "foundry/lens/lessons/LS-1.md", `"DEMO-1: major -> minor"` becomes `"SAFE-1: major -> minor"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: adjusts floor rule SAFE-1

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON adjusting a rule that does not exist fails
    Given in "foundry/lens/lessons/LS-1.md", `"DEMO-1: major -> minor"` becomes `"DEMO-9: major -> minor"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: rule DEMO-9 does not exist

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON a severity change of more than one step fails
    Given in "foundry/lens/lessons/LS-1.md", `"DEMO-1: major -> minor"` becomes `"DEMO-1: blocker -> minor"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: severity must move exactly one step (blocker -> minor)

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON an active lesson with fewer than 3 evidence lines fails
    Given in "foundry/lens/lessons/LS-1.md", `- PR 3: accepted.\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: active lesson needs at least 3 evidence lines (has 2)

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: LESSON a duplicate id in one lens fails
    Given the file "foundry/lens/lessons/LS-1-copy.md" contains:
      """
      ---
      schema: lesson/v1
      last-updated: 2026-10-01
      id: LS-1
      status: candidate
      scope: team:demo
      polarity: prefer
      adds-check: something
      confidence: low
      expires: 2999-12-31
      supersedes: none
      ---

      # LS-1 again
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL LESSON: lens/lessons/LS-1.md: duplicate id LS-1

      agent-foundry: 1 failure(s), 0 warning(s); 7 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER a missing key fails
    Given in "foundry/lens/waivers/WV-1.md", `owner: demo\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: "owner" missing

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER an id not shaped WV-<n> fails
    Given in "foundry/lens/waivers/WV-1.md", `id: WV-1` becomes `id: W1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: id must look like WV-<n>

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER waiving a floor rule fails
    Given in "foundry/lens/waivers/WV-1.md", `rule: DEMO-2` becomes `rule: SAFE-1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: waives floor rule SAFE-1

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER waiving a rule that does not exist fails
    Given in "foundry/lens/waivers/WV-1.md", `rule: DEMO-2` becomes `rule: DEMO-9`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: rule DEMO-9 does not exist

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER a scope that is not path:<glob> fails
    Given in "foundry/lens/waivers/WV-1.md", `scope: path:src/legacy/**` becomes `scope: team:demo`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: scope must be path:<glob>

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER an unknown zone fails
    Given in "foundry/lens/waivers/WV-1.md", `zone: owned` becomes `zone: mine`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: zone must be owned|adopted|foreign

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER a review-by date not in YYYY-MM-DD form fails
    Given in "foundry/lens/waivers/WV-1.md", `review-by: 2999-12-31` becomes `review-by: later`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL WAIVER: lens/waivers/WV-1.md: review-by must be YYYY-MM-DD

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: WAIVER a review-by date that has passed warns
    Given in "foundry/lens/waivers/WV-1.md", `review-by: 2999-12-31` becomes `review-by: 2000-01-01`
    When the tool runs
    Then it exits with 0 and prints:
      """
      WARN WAIVER: lens/waivers/WV-1.md: review-by 2000-01-01 has passed; finding returns

      agent-foundry: 0 failure(s), 1 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: ZONES a zone map without team fails
    Given in "foundry/lens/zones.md", `team: demo\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL ZONES: lens/zones.md: "team" missing

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: ZONES an unknown zone fails
    Given in "foundry/lens/zones.md", `| src/** | owned |` becomes `| src/** | mine |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL ZONES: lens/zones.md: zone "mine" for src/** must be owned|adopted|foreign

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: ZONES a foreign path owned by the team itself fails
    Given in "foundry/lens/zones.md", `| foreign | other-team |` becomes `| foreign | demo |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL ZONES: lens/zones.md: foreign path vendor/** must have an owner other than demo

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  Scenario: ZONES an adopted path without a reason fails
    Given in "foundry/lens/zones.md", `| adopted | demo | known debt |` becomes `| adopted | demo |  |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL ZONES: lens/zones.md: adopted path src/old.ts needs a reason

      agent-foundry: 1 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded
      """

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every check code the validator prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature
