# Requirements for copilot/atlas/tools/atlas.mjs, as executable scenarios (specs/009).
# Each scenario title starts with the rule it covers; the rules are the AT-n rows of copilot/atlas/schemas/atlas.schema.md.
#
# Change policy (constitution principle IV): a changed rule edits its scenario in the same commit as the tool; a new
# rule adds scenarios and every existing one keeps passing. Output text is compared exactly.
#
# The fixture is a tiny repo with an atlas: two docs areas (Guides under Docs) and the atlas's own area, three kinds
# and one chain, with its generated pages already written.

Feature: Atlas
  The atlas tool checks that every file sits under exactly one kind, that the tree from the root down to every kind is
  whole, and that the generated map is current; it writes the map and explains where a file sits.

  Background:
    Given the base fixture tree of "atlas"

  Scenario: The base fixture tree passes with no warnings
    When the tool runs
    Then it passes with no warnings

  Scenario: AT-1 a file that belongs to no kind fails
    Given the file "notes/todo.txt" contains:
      """
      later
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-1  home: notes/todo.txt belongs to no kind
      """

  Scenario: AT-1 a file goes to the first kind that matches, so specific kinds come first
    Given in "copilot/atlas/atlas.yaml", `  - { id: guide, area: guides, home: "docs/guides/*.md"` becomes `  - { id: guide, area: guides, home: "docs/guides/*.md", title: "Guides", summary: "One task each", schema: docs/guide.schema.md, index: docs/index.md, checked-by: "a validator G-1", tests: —, deploy: ~/.demo/guides }\n  - { id: any-guide, area: guides, home: "docs/guides/*.md"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-2  kind any-guide: "docs/guides/*.md" matches no file in home
      """

  Scenario: AT-2 a kind that matches no file fails
    Given in "copilot/atlas/atlas.yaml", `home: "docs/guides/*.md"` becomes `home: "docs/tutorials/*.md"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-2  kind guide: "docs/tutorials/*.md" matches no file in home
      """

  Scenario: AT-3 a schema path that does not exist fails
    Given in "copilot/atlas/atlas.yaml", `schema: docs/guide.schema.md` becomes `schema: docs/guide-v2.schema.md`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-3  kind guide: schema docs/guide-v2.schema.md does not exist
      """

  Scenario: AT-3 a generated page named as an index counts as present
    When the tool runs
    Then it passes with no warnings

  Scenario: AT-4 a kind in an area that does not exist fails
    Given in "copilot/atlas/atlas.yaml", `{ id: guide, area: guides,` becomes `{ id: guide, area: tutorials,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-4  kind guide: area "tutorials" is not an area
      """

  Scenario: AT-4 an area whose parent is not an area fails
    Given in "copilot/atlas/atlas.yaml", `{ id: guides, repo: home, parent: docs,` becomes `{ id: guides, repo: home, parent: manuals,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-4  area guides: parent "manuals" is not an area
      """

  Scenario: AT-4 an area in a repo that does not exist fails
    Given in "copilot/atlas/atlas.yaml", `{ id: meta, repo: home,` becomes `{ id: meta, repo: elsewhere,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (7)
        AT-4  area meta: repo "elsewhere" is not a repo
        AT-1  home: copilot/atlas/atlas.yaml belongs to no kind
        AT-1  home: copilot/atlas/index.md belongs to no kind
        AT-1  home: copilot/atlas/map/elsewhere/meta.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/docs.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/guides.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/meta.md belongs to no kind
      """

  Scenario: AT-4 an area whose parent is in another repo fails
    Given in "copilot/atlas/atlas.yaml", `\nareas:` becomes `\n  - { id: other, root: missing-repo, ref: —, url: —, title: "Other", summary: "Not cloned here" }\nareas:\n  - { id: shelf, repo: other, parent: root, title: "Shelf", summary: "An area of the other repo" }`
    And in "copilot/atlas/atlas.yaml", `{ id: guides, repo: home, parent: docs,` becomes `{ id: guides, repo: home, parent: shelf,`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  AT-7  repo other: {root}/missing-repo not found; skipped (pass --repo other=<path>)
      FAIL (1)
        AT-4  area guides: parent shelf is in repo other, not home
      """

  Scenario: AT-4 areas whose parents loop fail
    Given in "copilot/atlas/atlas.yaml", `{ id: docs, repo: home, parent: root,` becomes `{ id: docs, repo: home, parent: guides,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        AT-4  area docs: its parents loop and never reach root
        AT-4  area guides: its parents loop and never reach root
      """

  Scenario: AT-5 a page that differs from the registry fails
    Given in "copilot/atlas/atlas.yaml", `summary: "How-to guides"` becomes `summary: "Step-by-step guides"`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        AT-5  copilot/atlas/index.md is out of date; run with --write
        AT-5  copilot/atlas/map/home/guides.md is out of date; run with --write
      """

  Scenario: AT-5 a missing page fails
    Given the file "copilot/atlas/map/home/guides.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-5  copilot/atlas/map/home/guides.md is missing; run with --write
      """

  Scenario: AT-5 --write regenerates the pages, after which the check passes
    Given in "copilot/atlas/atlas.yaml", `summary: "How-to guides"` becomes `summary: "Step-by-step guides"`
    And the tool runs with "--write"
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (0 warning(s))
      """

  Scenario: AT-6 an entry without a required field fails
    Given in "copilot/atlas/atlas.yaml", `, deploy: ~/.demo/guides }` becomes ` }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-6  atlas.yaml:9: kinds entry lacks "deploy"
      """

  Scenario: AT-6 an id used twice fails
    Given in "copilot/atlas/atlas.yaml", `{ id: meta, repo: home,` becomes `{ id: docs, repo: home,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (7)
        AT-6  atlas.yaml:7: areas id "docs" is used twice
        AT-4  kind atlas-file: area "meta" is not an area
        AT-1  home: copilot/atlas/atlas.yaml belongs to no kind
        AT-1  home: copilot/atlas/index.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/docs.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/guides.md belongs to no kind
        AT-1  home: copilot/atlas/map/home/meta.md belongs to no kind
      """

  Scenario: AT-6 an edge to a kind that does not exist fails
    Given in "copilot/atlas/atlas.yaml", `{ from: guide, to: doc,` becomes `{ from: guide, to: page,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        AT-6  atlas.yaml:13: edge to "page" is not a kind
      """

  Scenario: AT-7 a repo whose root is not present is skipped with a warning
    Given in "copilot/atlas/atlas.yaml", `\nareas:` becomes `\n  - { id: other, root: missing-repo, ref: —, url: —, title: "Other", summary: "Not cloned here" }\nareas:`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  AT-7  repo other: {root}/missing-repo not found; skipped (pass --repo other=<path>)
      FAIL (1)
        AT-5  copilot/atlas/index.md is out of date; run with --write
      """

  Scenario: AT-7 a repo at a ref the clone does not have is skipped with a warning
    Given the file "other/a.md" contains:
      """
      # A
      """
    And "other" is a git repository with everything committed
    And in "copilot/atlas/atlas.yaml", `\nareas:` becomes `\n  - { id: other, root: other, ref: v9.9.9, url: —, title: "Other", summary: "A ref not fetched" }\nareas:`
    When the tool runs
    Then it exits with 1 and prints:
      """
        warn  AT-7  repo other: cannot list v9.9.9 in {root}/other (fatal: Not a valid object name v9.9.9); skipped
      FAIL (1)
        AT-5  copilot/atlas/index.md is out of date; run with --write
      """

  Scenario: A repo with a ref is listed at that ref, whatever is checked out
    Given the file "other/a.md" contains:
      """
      # A
      """
    And "other" is a git repository with everything committed
    And in "copilot/atlas/atlas.yaml", `\nareas:` becomes `\n  - { id: other, root: other, ref: main, url: "https://example.com/other/blob/main", title: "Other", summary: "Listed at main" }\nareas:`
    And in "copilot/atlas/atlas.yaml", `\nkinds:` becomes `\n  - { id: other-root, repo: other, parent: root, title: "Other files", summary: "Everything in other" }\nkinds:`
    And in "copilot/atlas/atlas.yaml", `\nedges:` becomes `\n  - { id: other-file, area: other-root, home: "**", title: "Other files", summary: "Any file", schema: —, index: —, checked-by: —, tests: —, deploy: — }\nedges:`
    And the file "other/b.md" contains:
      """
      # B, not committed
      """
    And the tool runs with "--write"
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (0 warning(s))
      """
    And the file "copilot/atlas/map/other/other-root.md" has the line "- [`a.md`](https://example.com/other/blob/main/a.md)"
    And the file "copilot/atlas/map/other/other-root.md" has no line containing "b.md"
    And the file "copilot/atlas/map/home/docs.md" has no line containing "other/"

  Scenario: --repo uses another folder for a repo
    Given the file "elsewhere/x.md" contains:
      """
      # X
      """
    And in "copilot/atlas/atlas.yaml", `\nareas:` becomes `\n  - { id: other, root: missing, ref: —, url: —, title: "Other", summary: "Passed with --repo" }\nareas:`
    And in "copilot/atlas/atlas.yaml", `\nkinds:` becomes `\n  - { id: other-root, repo: other, parent: root, title: "Other files", summary: "Everything in other" }\nkinds:`
    And in "copilot/atlas/atlas.yaml", `\nedges:` becomes `\n  - { id: other-file, area: other-root, home: "**", title: "Other files", summary: "Any file", schema: —, index: —, checked-by: —, tests: —, deploy: — }\nedges:`
    And the tool runs with "--repo other={root}/elsewhere --write"
    When the tool runs with "--repo other={root}/elsewhere"
    Then it exits with 0 and prints:
      """
      PASS (0 warning(s))
      """
    And the file "copilot/atlas/map/other/other-root.md" has the line "- [`x.md`](../../../../elsewhere/x.md)"

  Scenario: --explain shows a file's place, its kind's facts and the files that link to it
    When the tool runs with "--explain {root}/docs/guides/setup.md"
    Then it exits with 0 and prints:
      """
      docs/guides/setup.md
        place:        Home repo › Docs › Guides › Guides
        kind:         guide — One task each
        schema:       docs/guide.schema.md
        index:        docs/index.md
        checked by:   a validator G-1
        scenarios:    —
        installed to: ~/.demo/guides
        linked from:
          copilot/atlas/map/home/guides.md
          docs/index.md
      """

  Scenario: --explain on a file that is not on the map says so
    Given the file "notes/todo.txt" contains:
      """
      later
      """
    When the tool runs with "--explain {root}/notes/todo.txt"
    Then it exits with 1 and prints:
      """
      notes/todo.txt: not on the map (no present repo has it)
      """

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every rule code the tool prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature

  Scenario: Every rule code the tool prints is a rule in the atlas schema
    Then every rule code the tool prints is a rule row in its schemas
