# Requirements for copilot/frameworks/knowledge/tools/validate-knowledge.mjs, as executable scenarios (specs/001).
# Each scenario title starts with the rule code it covers. The rules themselves are defined in
# copilot/frameworks/knowledge/schemas/ (knowledge-doc, deep-dive, topic-index, _system).
# Not every printed code is a schema rule id yet: VS is KD-9, and FM, FM-KEYS, HEAD, REF and IDX have
# no rule row (specs/001-knowledge-validator-tests/research.md, finding F-3).
#
# Change policy (constitution principle IV):
# - A rule changes: change its scenario in the same commit as the validator.
# - A rule is added: add scenarios; every existing scenario keeps passing unchanged.
# - The output text of a check is part of the requirement: scenarios compare it exactly.
#
# These scenarios were first written as characterization tests: they pin what the validator did on
# 2026-10-29. Behavior that looked questionable is listed in specs/001-knowledge-validator-tests/research.md.

Feature: Knowledge validator
  The validator checks the v1 docs in a knowledge tree against the knowledge framework schemas.
  It exits 1 when a check fails and 0 otherwise; warnings never fail the run.
  Paths in the output are relative to the knowledge root.

  Background:
    Given the base fixture tree

  # ---- baseline --------------------------------------------------------------------------------

  Scenario: The base fixture tree passes with no warnings
    When the validator runs
    Then it passes with no warnings

  # ---- knowledge-doc: sections and front matter ------------------------------------------------

  Scenario: KD-1 an unknown section fails and names the expected order
    Given in "knowledge/demo/concept.md", `## Edge cases` becomes `## Corner cases`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-1  demo/concept.md: unexpected or out-of-order section "## Corner cases" (expected order: Summary → Problem → Mental model → How it works → Worked example → Edge cases → Trade-offs? → Case studies? → Takeaways → Used by → Verification status → References → Related)
      """

  Scenario: KD-1 a missing required section fails
    Given in "knowledge/demo/concept.md", `## Related\n- _None yet._` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-1  demo/concept.md: missing section(s) "## Related"
      """

  Scenario: FM-KEYS a front-matter key the schema does not define fails
    Given in "knowledge/demo/concept.md", `tags: [fixture]` becomes `tags: [fixture]\nowner: me`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM-KEYS  demo/concept.md: front-matter key "owner" is not defined by knowledge-doc/v1 (allowed: schema, type, topic, status, applies-to, last-verified, last-updated, tags, derived-from)
      """

  Scenario: FM a missing required front-matter key fails
    Given in "knowledge/demo/concept.md", `applies-to: ["any"]\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM  demo/concept.md: front-matter "applies-to" missing
      """

  Scenario: FM an unknown status fails, and the index row no longer matches
    Given in "knowledge/demo/concept.md", `status: verified` becomes `status: done`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        FM  demo/concept.md: status "done" not one of draft|verified|stale
        IDX  demo/index.md: concept.md Status "verified" ≠ "done"
      """

  Scenario: FM applies-to that is not a list fails
    Given in "knowledge/demo/concept.md", `applies-to: ["any"]` becomes `applies-to: any`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM  demo/concept.md: applies-to must be a list
      """

  Scenario: FM a last-updated date not in YYYY-MM-DD form fails
    Given in "knowledge/demo/concept.md", `last-updated: 2026-10-01` becomes `last-updated: 1 Oct 2026`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM  demo/concept.md: last-updated must be YYYY-MM-DD
      """

  Scenario: FM a topic that differs from the doc's folder fails
    Given in "knowledge/demo/concept.md", `topic: demo` becomes `topic: other`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM  demo/concept.md: topic "other" ≠ folder "demo"
      """

  Scenario: FM an unknown doc type fails and skips the doc's other checks
    Given in "knowledge/demo/concept.md", `type: concept` becomes `type: essay`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        FM  demo/concept.md: type "essay" not one of concept|how-to|reference|case-study
        IDX  demo/index.md: concept.md Type "concept" ≠ "essay"
      """

  Scenario: KD-2 a verified doc without last-verified fails
    Given in "knowledge/demo/concept.md", `last-verified: 2026-10-01\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-2  demo/concept.md: status verified needs last-verified (YYYY-MM-DD)
      """

  Scenario: KD-2 a verified doc with an unverified claim fails, and VS warns about the count
    Given in "knowledge/demo/concept.md", `## Edge cases\nNone.` becomes `## Edge cases\nNone. ⚠️ unverified`
    When the validator runs
    Then it exits with 1 and prints:
      """
        warn  VS  demo/concept.md: Verification status says 1 ✅ / 0 ⚠️ but body has 1 / 1
      FAIL (1)
        KD-2  demo/concept.md: status verified but contains "⚠️ unverified" claims
      """

  Scenario: KD-6 a concept doc over 400 lines warns
    Given 400 lines are appended to "knowledge/demo/concept.md"
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  KD-6  demo/concept.md: 450 lines (> ~400); split or move to a deep dive
      PASS (1 warning(s))
      """

  # ---- Summary head, title and tail sections (knowledge docs and deep dives) --------------------

  Scenario: HEAD a Summary without TL;DR fails
    Given in "knowledge/demo/concept.md", `**TL;DR:**` becomes `**Summary:**`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        HEAD  demo/concept.md: Summary lacks **TL;DR:**
      """

  Scenario: HEAD a Summary without Use this when fails
    Given in "knowledge/demo/concept.md", `**Use this when:**` becomes `**When:**`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        HEAD  demo/concept.md: Summary lacks **Use this when:**
      """

  Scenario: HEAD a doc without a "# Title" line fails
    Given in "knowledge/demo/concept.md", `# Demo concept` becomes `Demo concept`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        HEAD  demo/concept.md: no "# Title"
      """

  Scenario: REF a References section with no entries fails
    Given in "knowledge/demo/deep-dive.md", `## References\n- ` becomes `## References\nSee `
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  demo/deep-dive.md: References has no entries
      """

  Scenario: REF a Related section with no entries fails
    Given in "knowledge/demo/deep-dive.md", `## Related\n- ` becomes `## Related\nSee `
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  demo/deep-dive.md: Related is empty (use "- _None yet._")
      """

  Scenario: REF a footnote with no References entry fails
    Given in "knowledge/demo/concept.md", `✅ [^1]` becomes `✅ [^2]`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        REF  demo/concept.md: footnote [^2] is used but no References entry carries it
      """

  # ---- VS: the Verification status line -------------------------------------------------------

  Scenario: VS a missing Verification status line fails
    Given in "knowledge/demo/concept.md", `- Verified: 1 claim (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-01` becomes `- Checked.`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        VS  demo/concept.md: Verification status line missing ("- Verified: n claims (✅) · Unverified: n claims (⚠️) · Last verified: date")
      """

  Scenario: VS a count that differs from the ✅ marks in the body warns
    Given in "knowledge/demo/concept.md", `Verified: 1 claim (✅)` becomes `Verified: 2 claims (✅)`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  VS  demo/concept.md: Verification status says 2 ✅ / 0 ⚠️ but body has 1 / 0
      PASS (1 warning(s))
      """

  Scenario: VS ✅ marks inside a fenced code block are counted as claims
    # Recorded as found: research.md, finding F-4.
    Given in "knowledge/demo/concept.md", `## Worked example\n` becomes `## Worked example\n```text\nok ✅\n```\n`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  VS  demo/concept.md: Verification status says 1 ✅ / 0 ⚠️ but body has 2 / 0
      PASS (1 warning(s))
      """

  Scenario: VS a status line in another wording fails
    Given in "knowledge/demo/concept.md", `- Verified: 1 claim (✅)` becomes `- Verified: 1 claim ✅`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        VS  demo/concept.md: Verification status line must read exactly "- Verified: n claims (✅) · Unverified: n claims (⚠️) · Last verified: YYYY-MM-DD"
      """

  Scenario: VS a wrong singular or plural fails
    Given in "knowledge/demo/concept.md", `Verified: 1 claim (✅)` becomes `Verified: 1 claims (✅)`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        VS  demo/concept.md: write "1 claim" and "0 claims"
      """

  Scenario: VS a date that differs from last-verified fails
    Given in "knowledge/demo/concept.md", `Last verified: 2026-10-01` becomes `Last verified: 2026-10-02`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        VS  demo/concept.md: Verification status says last verified 2026-10-02, front-matter says 2026-10-01
      """

  # ---- KD-4: Used by matches the rules that cite the doc --------------------------------------

  Scenario: KD-4 a Used by section with neither a table nor the placeholder fails
    Given in "knowledge/demo/concept.md", `| Where | Id / path | How |\n|---|---|---|\n| foundation rule | DEMO-1 | Source: |` becomes `- See the rules.`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        KD-4  demo/concept.md: Used by has no table and no "_Not cited by any rule yet._"
        KD-4  demo/concept.md: cited by DEMO-1 (Source) but not listed in Used by
      """

  Scenario: KD-4 a rule that cites the doc but is missing from Used by fails
    Given in "knowledge/demo/concept.md", `| Where | Id / path | How |\n|---|---|---|\n| foundation rule | DEMO-1 | Source: |` becomes `- _Not cited by any rule yet._`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-4  demo/concept.md: cited by DEMO-1 (Source) but not listed in Used by
      """

  Scenario: KD-4 a rule listed in Used by that does not cite the doc fails
    Given in "agentic-sdlc/foundations/demo.md", `knowledge/demo/concept.md` becomes `none`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-4  demo/concept.md: Used by lists DEMO-1, but that rule's Source does not cite this doc
      """

  Scenario: KD-4 a missing agentic-sdlc root warns, and every listed rule then fails
    Given the folder "agentic-sdlc" is removed
    When the validator runs
    Then it exits with 1 and prints:
      """
        warn  KD-4  agentic-sdlc root not found at {root}/agentic-sdlc; Used by not checked
      FAIL (1)
        KD-4  demo/concept.md: Used by lists DEMO-1, but that rule's Source does not cite this doc
      """

  # ---- KD-7, DD-1, DD-3, DD-4: deep dives and the docs synthesized from them -------------------

  Scenario: KD-7 derived-from a doc that does not exist fails
    Given in "knowledge/demo/concept.md", `derived-from: [demo/deep-dive.md]` becomes `derived-from: [demo/gone.md]`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        KD-7  demo/concept.md: derived-from demo/gone.md does not exist
        DD-3  demo/deep-dive.md: demo/concept.md has no derived-from pointing back here
      """

  Scenario: KD-7 derived-from a deep dive that does not list the doc fails
    Given in "knowledge/demo/deep-dive.md", `synthesized-into:\n  - path: demo/concept.md\n    on: 2026-10-01` becomes `synthesized-into: []`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KD-7  demo/concept.md: derived-from demo/deep-dive.md, but its synthesized-into does not list this doc
      """

  Scenario: DD-1 a deep dive without synthesized-into fails
    Given in "knowledge/demo/deep-dive.md", `synthesized-into:\n  - path: demo/concept.md\n    on: 2026-10-01\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        KD-7  demo/concept.md: derived-from demo/deep-dive.md, but its synthesized-into does not list this doc
        DD-1  demo/deep-dive.md: front-matter "synthesized-into" missing (use [] until synthesized)
      """

  Scenario: DD-1 a deep dive that does not start with Summary fails
    Given in "knowledge/demo/deep-dive.md", `## Summary` becomes `## Overview`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DD-1  demo/deep-dive.md: first section must be "## Summary"
      """

  Scenario: DD-1 a deep dive that does not end with References and Related fails
    Given in "knowledge/demo/deep-dive.md", `## Related` becomes `## See also`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DD-1  demo/deep-dive.md: last sections must be "## References", "## Related"
      """

  Scenario: DD-1 a deep dive Summary without Depth fails
    Given in "knowledge/demo/deep-dive.md", `**Depth:** fixture only.\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DD-1  demo/deep-dive.md: Summary lacks **Depth:**
      """

  Scenario: FM a verified deep dive without last-verified fails
    Given in "knowledge/demo/deep-dive.md", `last-verified: 2026-10-01\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        FM  demo/deep-dive.md: status verified needs last-verified (YYYY-MM-DD)
      """

  Scenario: DD-3 synthesized into a doc that does not exist fails
    Given in "knowledge/demo/deep-dive.md", `path: demo/concept.md` becomes `path: demo/gone.md`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        KD-7  demo/concept.md: derived-from demo/deep-dive.md, but its synthesized-into does not list this doc
        DD-3  demo/deep-dive.md: synthesized-into demo/gone.md does not exist
      """

  Scenario: DD-3 synthesized into a doc with no derived-from back fails
    Given in "knowledge/demo/concept.md", `derived-from: [demo/deep-dive.md]\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DD-3  demo/deep-dive.md: demo/concept.md has no derived-from pointing back here
      """

  Scenario: DD-4 a deep dive updated after its synthesis warns
    Given in "knowledge/demo/deep-dive.md", `last-updated: 2026-10-01` becomes `last-updated: 2026-10-05`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  DD-4  demo/deep-dive.md: updated 2026-10-05 after synthesis into demo/concept.md (2026-10-01); re-synthesize
      PASS (1 warning(s))
      """

  # ---- IDX: topic indexes ---------------------------------------------------------------------

  Scenario: IDX a topic index not named index.md fails
    Given the file "knowledge/demo/other.md" contains:
      """
      ---
      schema: topic-index/v1
      kind: topic
      topic: demo
      last-updated: 2026-10-01
      ---

      # Other
      """
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/other.md: topic-index/v1 must be named index.md
      """

  Scenario: IDX an unknown kind fails
    Given in "knowledge/demo/index.md", `kind: topic` becomes `kind: chapter`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: kind "chapter" not root|topic|subtopic
      """

  Scenario: IDX a kind that does not match the index's location fails
    Given in "knowledge/demo/index.md", `kind: topic` becomes `kind: root`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        IDX  demo/index.md: kind root does not match location
        IDX  demo/index.md: root index needs "## Topics"
      """

  Scenario: IDX a topic that differs from the index's folder fails
    Given in "knowledge/demo/index.md", `topic: demo` becomes `topic: misc`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: topic "misc" ≠ folder path "demo"
      """

  Scenario: IDX an index without last-updated fails
    Given in "knowledge/demo/index.md", `last-updated: 2026-10-01\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: last-updated missing
      """

  Scenario: IDX an index that does not end with References and Related fails
    Given in "knowledge/demo/index.md", `## Related` becomes `## See also`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: must end with "## References", "## Related"
      """

  Scenario: IDX a root index without Topics fails, and its folders are then unlisted
    Given in "knowledge/index.md", `## Topics` becomes `## Areas`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        IDX  index.md: root index needs "## Topics"
        IDX  index.md: topic folder "demo" not listed in Topics
      """

  Scenario: IDX a topic folder missing from the root Topics table fails
    Given in "knowledge/index.md", `| [demo/](demo/index.md) | One doc of each kind | 2 |\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  index.md: topic folder "demo" not listed in Topics
      """

  Scenario: IDX a root Topics row for a folder that does not exist fails
    Given in "knowledge/index.md", `| [demo/](demo/index.md) | One doc of each kind | 2 |` becomes `| [demo/](demo/index.md) | One doc of each kind | 2 |\n| [gone/](gone/index.md) | Missing | 0 |`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  index.md: Topics lists "gone", which does not exist
      """

  Scenario: IDX a topic index without Docs fails, and its docs are then unlisted
    Given in "knowledge/demo/index.md", `## Docs` becomes `## Pages`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        IDX  demo/index.md: "## Docs" missing
        IDX  demo/index.md: v1 doc concept.md has no Docs row
        IDX  demo/index.md: v1 doc deep-dive.md has no Docs row
      """

  Scenario: IDX a Docs row for a file that does not exist fails
    Given in "knowledge/demo/index.md", `| [deep-dive.md](deep-dive.md) | deep-dive | A valid deep dive. | verified |` becomes `| [deep-dive.md](deep-dive.md) | deep-dive | A valid deep dive. | verified |\n| [gone.md](gone.md) | concept | Missing. | draft |`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: Docs lists gone.md, which does not exist
      """

  Scenario: IDX a doc listed twice in Docs fails
    Given in "knowledge/demo/index.md", `| [concept.md](concept.md) | concept | A valid concept doc. | verified |` becomes `| [concept.md](concept.md) | concept | A valid concept doc. | verified |\n| [concept.md](concept.md) | concept | Again. | verified |`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: concept.md listed twice
      """

  Scenario: IDX a legacy doc whose Docs Type is not "legacy" fails
    Given the file "knowledge/demo/old.md" contains:
      """
      # Old notes

      Written before the knowledge framework; no schema.
      """
    And in "knowledge/demo/index.md", `| [concept.md](concept.md)` becomes `| [old.md](old.md) | concept | Old notes. | — |\n| [concept.md](concept.md)`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: old.md is a legacy doc; Type must be "legacy"
      """

  Scenario: IDX a Docs Type that differs from the doc's type fails
    Given in "knowledge/demo/index.md", `| [concept.md](concept.md) | concept |` becomes `| [concept.md](concept.md) | how-to |`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: concept.md Type "how-to" ≠ "concept"
      """

  Scenario: IDX a Docs Status that differs from the doc's status fails
    Given in "knowledge/demo/index.md", `| A valid concept doc. | verified |` becomes `| A valid concept doc. | draft |`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: concept.md Status "draft" ≠ "verified"
      """

  Scenario: IDX a v1 doc with no Docs row fails
    Given in "knowledge/demo/index.md", `| [deep-dive.md](deep-dive.md) | deep-dive | A valid deep dive. | verified |\n` becomes ``
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: v1 doc deep-dive.md has no Docs row
      """

  Scenario: IDX a subfolder missing from Subtopics fails
    Given the folder "knowledge/demo/extra" exists
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md: subfolder "extra" not listed in Subtopics
      """

  Scenario: IDX a subtopic with its own subfolder fails
    # The second line asks a subtopic to list a subfolder it may not have: research.md, finding F-1.
    Given the file "knowledge/demo/sub/index.md" contains:
      """
      ---
      schema: topic-index/v1
      kind: subtopic
      topic: demo/sub
      last-updated: 2026-10-01
      ---

      # Sub

      ## Docs
      | Doc | Type | Summary | Status |
      |---|---|---|---|

      ## References
      - _None._

      ## Related
      - _None yet._
      """
    And the folder "knowledge/demo/sub/deeper" exists
    And in "knowledge/demo/index.md", `## References` becomes `## Subtopics\n| Subtopic | Summary |\n|---|---|\n| [sub/](sub/index.md) | Nested. |\n\n## References`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        IDX  demo/sub/index.md: subfolders nest at most one level deep
        IDX  demo/sub/index.md: subfolder "deeper" not listed in Subtopics
      """

  Scenario: IDX a folder holding v1 docs without a topic index fails
    Given the file "knowledge/demo/index.md" is removed
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        IDX  demo/index.md (topic-index/v1) is required: folder holds or contains v1 docs
      """

  # ---- KB: knowledge-base hygiene ---------------------------------------------------------------

  Scenario: KB-2 a company or repo name from the Company KB fails
    Given in "knowledge/demo/concept.md", `Scenarios need a known good doc.` becomes `Scenarios need a known good doc, like the one in widget-api.`
    When the validator runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KB-2  demo/concept.md: company-specific name "widget-api" in store B
      """

  Scenario: KB-7 a paragraph that opens with a bare Yes warns
    Given in "knowledge/demo/concept.md", `Scenarios need a known good doc.` becomes `**Yes.** Scenarios need a known good doc.`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  KB-7  demo/concept.md: "**Yes." — paragraph opens with a bare "Yes"/"No" answer; state the question it answers
      PASS (1 warning(s))
      """

  Scenario: KB-7 a reference to the conversation warns
    Given in "knowledge/demo/concept.md", `Scenarios need a known good doc.` becomes `As we discussed, scenarios need a known good doc.`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  KB-7  demo/concept.md: "As we discussed" — refers to a conversation the reader cannot see
      PASS (1 warning(s))
      """

  Scenario: KB-8 a long paragraph repeated in one doc warns
    Given in "knowledge/demo/deep-dive.md", `Free-form text.` becomes `Free-form text.\n\nA paragraph long enough for the repeated-paragraph check, which ignores anything shorter than one hundred and twenty characters.\n\nA paragraph long enough for the repeated-paragraph check, which ignores anything shorter than one hundred and twenty characters.`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  KB-8  demo/deep-dive.md: paragraph repeated: "A paragraph long enough for the repeated-paragraph check, which ignore…"
      PASS (1 warning(s))
      """

  Scenario: KB-8 a paragraph directly under its heading is not compared
    # Recorded as found: research.md, finding F-2.
    Given in "knowledge/demo/deep-dive.md", `Free-form text.` becomes `A paragraph long enough for the repeated-paragraph check, which ignores anything shorter than one hundred and twenty characters.\n\nA paragraph long enough for the repeated-paragraph check, which ignores anything shorter than one hundred and twenty characters.`
    When the validator runs
    Then it passes with no warnings

  Scenario: KB-8 the same fenced block of 5 or more lines in two docs warns
    Given in "knowledge/demo/concept.md", `Change one line, run the validator, read the one new line it prints.` becomes `Change one line.\n\n```\none\ntwo\nthree\nfour\nfive\n```\n`
    And in "knowledge/demo/deep-dive.md", `Free-form text.` becomes `Free-form text.\n\n```\none\ntwo\nthree\nfour\nfive\n```\n`
    When the validator runs
    Then it exits with 0 and prints:
      """
        warn  KB-8  identical 5-line block in demo/concept.md, demo/deep-dive.md; keep one copy and link to it
      PASS (1 warning(s))
      """

  Scenario: KB-3 a URL that answers 404 fails with --urls
    Given a local web server that answers "/<code>" with that status code
    And in "knowledge/demo/concept.md", `## Edge cases\nNone.` becomes `## Edge cases\nSee {server}/200 and {server}/404 for details.`
    When the validator runs with "--urls"
    Then it exits with 1 and prints:
      """
      FAIL (1)
        KB-3  demo/concept.md: {server}/404 → HTTP 404
      """

  Scenario: KB-3 a URL that answers 403 only warns
    Given a local web server that answers "/<code>" with that status code
    And in "knowledge/demo/concept.md", `## Edge cases\nNone.` becomes `## Edge cases\nSee {server}/403 for details.`
    When the validator runs with "--urls"
    Then it exits with 0 and prints:
      """
        warn  KB-3  demo/concept.md: {server}/403 → HTTP 403
      PASS (1 warning(s))
      """

  Scenario: KB-3 a URL that cannot be reached only warns
    Given in "knowledge/demo/concept.md", `## Edge cases\nNone.` becomes `## Edge cases\nSee http://127.0.0.1:9/closed for details.`
    When the validator runs with "--urls"
    Then it exits with 0 and prints:
      """
        warn  KB-3  demo/concept.md: http://127.0.0.1:9/closed → TypeError: fetch failed
      PASS (1 warning(s))
      """

  Scenario: KB-3 URLs are not probed without --urls
    Given in "knowledge/demo/concept.md", `## Edge cases\nNone.` becomes `## Edge cases\nSee http://127.0.0.1:9/closed for details.`
    When the validator runs
    Then it passes with no warnings
