Feature: The tracker keeps the open work of a repo and reminds the next session of it (specs/015)

  `copilot/tracker/tracker.mjs` checks `TRACKER.md` against `tracker/v1` (TR-1 … TR-10), prints the open items most
  urgent first, feeds them to the session-start hooks of Claude Code and Copilot CLI, and adds, updates, closes and
  drops items. "Today" is 2026-10-30 in every scenario.

  Background:
    Given the base fixture tree of "tracker"

  # ---- check ------------------------------------------------------------------------------------------

  Scenario: The base tracker passes with no warnings
    When the tool runs
    Then it passes with no warnings

  Scenario: Without a TRACKER.md there is nothing to check
    Given the file "TRACKER.md" is removed
    When the tool runs
    Then it exits with 0 and prints:
      """
      no TRACKER.md in {root}: nothing to check
      """

  Scenario: TR-1 a section other than Open and Done, or a line that is not an item, field or blank, fails
    Given in "TRACKER.md", `## Done` becomes `## Notes\n\n## Done`
    And in "TRACKER.md", `- from: 2026-10-20` becomes `- from: 2026-10-20\nRemember the screenshots.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TR-1  line 11: "Remember the screenshots." is not an item heading, a "- key: value" line or blank
        TR-1  line 19: section "## Notes" is not Open or Done
      """

  Scenario: TR-1 Open and Done must both be there, Open first
    Given in "TRACKER.md", `## Open` becomes `## Later`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TR-1  line 5: section "## Later" is not Open or Done
        TR-1  there is no "## Open" section
      """

  Scenario: TR-1 a section given twice, a missing Done, and Done before Open fail
    Given in "TRACKER.md", `## Done` becomes `## Open`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TR-1  line 18: section "## Open" appears twice
        TR-1  there is no "## Done" section
      """
    Given the file "TRACKER.md" contains:
      """
      # Tracker

      ## Done

      ## Open
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TR-1  "## Done" comes before "## Open"
      """

  Scenario: TR-2 an item heading without an id, and an id used twice, fail
    Given in "TRACKER.md", `### T-2 Decide on the old stash` becomes `### T-1 Decide on the old stash`
    And in "TRACKER.md", `### T-3 Fix the broken link` becomes `### Fix the broken link`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TR-2  line 20: "### Fix the broken link" is not "### T-<n> <title>"
        TR-2  T-1 is used twice (lines 7 and 12)
      """

  Scenario: TR-3 an unknown key, a key given twice and a missing required key fail
    Given in "TRACKER.md", `- waiting-on: V` becomes `- owner: V`
    And in "TRACKER.md", `- next: Draft the install steps` becomes `- next: Draft the install steps\n- next: Again`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        TR-3  T-1: "next" is given twice
        TR-3  T-2: unknown key "owner"
        TR-3  T-2: status waiting needs "waiting-on"
      """

  Scenario: TR-3 an item without a status fails
    Given in "TRACKER.md", `- status: open\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TR-3  T-1: needs "status"
      """

  Scenario: TR-3 a dropped item needs a why, and a done item a closed date
    Given in "TRACKER.md", `- status: done` becomes `- status: dropped`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TR-3  T-3: status dropped needs "why"
      """

  Scenario: TR-4 an unknown status, an unknown priority and a date that is not a date fail
    Given in "TRACKER.md", `- status: open` becomes `- status: pending`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- priority: urgent\n- from: 2026-02-30 · abc123`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        TR-4  T-1: status "pending" is not open, doing, waiting, done or dropped
        TR-4  T-2: priority "urgent" is not high, normal or low
        TR-4  T-2: from "2026-02-30 · abc123" does not start with a date (YYYY-MM-DD)
      """

  Scenario: TR-5 a closed item under Open, and an open item under Done, fail
    Given in "TRACKER.md", `- status: done` becomes `- status: open\n- next: Recheck it`
    And in "TRACKER.md", `- status: open` becomes `- status: done\n- closed: 2026-10-29`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        TR-5  T-1: status done belongs under "## Done"
        TR-5  T-3: status open belongs under "## Open"
      """

  Scenario: TR-6 a done-when that is not one of the checks fails
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: when it ships\n- from: 2026-10-20`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TR-6  T-1: done-when "when it ships" is not "merged <ref> into <ref>", "exists <path>", "gone <path>", "commit <text>" or "no-stash <text>"
      """

  Scenario: TR-7 an open item whose path check holds looks done; one whose check does not hold does not
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: exists docs/setup.md\n- from: 2026-10-20`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- done-when: gone old.md\n- from: 2026-10-25`
    And the file "old.md" contains:
      """
      still here
      """
    And the file "docs/setup.md" contains:
      """
      # Setup
      """
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-7  T-1 looks done: docs/setup.md exists; close it with --close T-1
      PASS (1 warning(s))
      """
    Given the file "old.md" is removed
    When the tool runs
    Then the output has the line "  warn  TR-7  T-2 looks done: old.md is gone; close it with --close T-2"

  Scenario: TR-7 an item looks done once its branch is merged, not before
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: merged feature into main\n- from: 2026-10-20`
    And "." is a git repository with everything committed
    And in ".", the branch "feature" has a new commit
    When the tool runs
    Then it passes with no warnings
    Given in ".", the branch "feature" is merged into "main"
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-7  T-1 looks done: feature is merged into main; close it with --close T-1
      PASS (1 warning(s))
      """

  Scenario: TR-7 a merged branch that is only on origin is found as origin/<branch>
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: merged feature into main\n- from: 2026-10-20`
    And "." is a git repository with everything committed
    And in ".", the branch "feature" has a new commit
    And in ".", the branch "feature" is merged into "main"
    And in ".", the branch "feature" is only on origin
    When the tool runs
    Then the output has the line "  warn  TR-7  T-1 looks done: feature is merged into main; close it with --close T-1"

  Scenario: TR-7 an item looks done when a commit mentions it, and when its stash is gone
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: commit fixture\n- from: 2026-10-20`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- done-when: no-stash old idea\n- from: 2026-10-25`
    And "." is a git repository with everything committed
    And in ".", a change is stashed as "old idea"
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-7  T-1 looks done: a commit on HEAD mentions "fixture"; close it with --close T-1
      PASS (1 warning(s))
      """
    Given in "TRACKER.md", `- done-when: commit fixture` becomes `- done-when: commit fixtur.`
    And in ".", the stash is dropped
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-7  T-2 looks done: no stash mentions "old idea"; close it with --close T-2
      PASS (1 warning(s))
      """

  Scenario: TR-8 an open item past its due date is overdue; one due today is not
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- due: 2026-10-29\n- from: 2026-10-20`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- due: 2026-10-30\n- from: 2026-10-25`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-8  T-1 is overdue: due 2026-10-29
      PASS (1 warning(s))
      """

  Scenario: TR-9 an open item with no change for more than 14 days is stale, counted from updated when set
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- from: 2026-10-15`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- from: 2026-10-01\n- updated: 2026-10-16`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-9  T-1 is stale: no change for 15 days
      PASS (1 warning(s))
      """

  Scenario: TR-10 a done-when that cannot run is reported, not guessed
    Given in "TRACKER.md", `- from: 2026-10-20` becomes `- done-when: commit fixture\n- from: 2026-10-20`
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-10  T-1: cannot check "commit fixture": not a git repository
      PASS (1 warning(s))
      """
    Given in "TRACKER.md", `- done-when: commit fixture` becomes `- done-when: merged nope into main`
    And in "TRACKER.md", `- from: 2026-10-25` becomes `- done-when: merged main into gone\n- from: 2026-10-25`
    And "." is a git repository with everything committed
    When the tool runs
    Then it exits with 0 and prints:
      """
        warn  TR-10  T-1: cannot check "merged nope into main": no ref "nope" (nor "origin/nope")
        warn  TR-10  T-2: cannot check "merged main into gone": no ref "gone" (nor "origin/gone")
      PASS (2 warning(s))
      """

  Scenario: The checks ignore items that are already closed
    Given in "TRACKER.md", `- closed: 2026-10-02` becomes `- closed: 2026-10-02\n- due: 2026-10-03\n- done-when: gone nothing.md`
    When the tool runs
    Then it passes with no warnings

  # ---- brief ------------------------------------------------------------------------------------------

  Scenario: --brief lists the open items with their next step, waiting items first
    When the tool runs with "--brief {root}"
    Then it exits with 0 and prints:
      """
      TRACKER.md: 2 open — 1 waiting
      - T-2 Decide on the old stash · waiting on V · next: Pop it or drop it
      - T-1 Write the setup guide · next: Draft the install steps
      """

  Scenario: --brief orders items: looks done, overdue, high, doing, waiting, open, low
    Given the file "TRACKER.md" contains:
      """
      # Tracker

      ## Open

      ### T-1 Low one
      - status: open
      - priority: low
      - next: a
      - from: 2026-10-29

      ### T-2 Plain one
      - status: open
      - next: b
      - from: 2026-10-29

      ### T-3 Waiting one
      - status: waiting
      - next: c
      - waiting-on: CI
      - from: 2026-10-29

      ### T-4 Doing one
      - status: doing
      - next: d
      - from: 2026-10-29

      ### T-5 High one
      - status: open
      - priority: high
      - next: e
      - from: 2026-10-29

      ### T-6 Late one
      - status: open
      - next: f
      - due: 2026-10-01
      - from: 2026-10-29

      ### T-7 Finished one
      - status: open
      - next: g
      - done-when: exists README.md
      - from: 2026-10-29

      ### T-8 Old one
      - status: open
      - next: h
      - from: 2026-09-01

      ## Done
      """
    And the file "README.md" contains:
      """
      # Readme
      """
    When the tool runs with "--brief {root}"
    Then it exits with 0 and prints:
      """
      TRACKER.md: 8 open — 1 looks done, 1 overdue, 1 high, 1 doing, 1 waiting, 1 stale
      - T-7 Finished one · looks done: README.md exists · next: g
      - T-6 Late one · overdue: due 2026-10-01 · next: f
      - T-5 High one · high priority · next: e
      - T-4 Doing one · doing · next: d
      - T-3 Waiting one · waiting on CI · next: c
      - T-2 Plain one · next: b
      - T-8 Old one · stale: 59 days · next: h
      - T-1 Low one · low priority · next: a
      """

  Scenario: --brief prints nothing without a tracker, or without open items
    When the tool runs with arguments:
      """
      --close
      T-1
      {root}
      """
    And the tool runs with arguments:
      """
      --close
      T-2
      {root}
      """
    And the tool runs with "--brief {root}"
    Then it exits with 0 and prints:
      """
      """
    Given the file "TRACKER.md" is removed
    When the tool runs with "--brief {root}"
    Then it exits with 0 and prints:
      """
      """

  Scenario: --brief on a tracker with format errors says so instead of listing
    Given in "TRACKER.md", `- status: open` becomes `- status: pending`
    When the tool runs with "--brief {root}"
    Then it exits with 0 and prints:
      """
      TRACKER.md: 1 format error; run: node ~/.copilot/tracker/tracker.mjs to see it
      """

  # ---- hooks ------------------------------------------------------------------------------------------

  Scenario: --hook claude shows the user a summary and gives the model the list and how to use it
    When the tool runs with "--hook claude {root}"
    Then it exits with 0 and prints:
      """
      {
        "systemMessage": "TRACKER.md: 2 open — 1 waiting\n- T-2 Decide on the old stash · waiting on V · next: Pop it or drop it\n- T-1 Write the setup guide · next: Draft the install steps",
        "hookSpecificOutput": {
          "hookEventName": "SessionStart",
          "additionalContext": "TRACKER.md: 2 open — 1 waiting\n- T-2 Decide on the old stash · waiting on V · next: Pop it or drop it\n- T-1 Write the setup guide · next: Draft the install steps\n\nThese are the open items in this repo's TRACKER.md (tracker/v1). Tell the user about any item that looks done, and close it once they agree: node ~/.copilot/tracker/tracker.mjs --close <id>. When this session leaves work undone, add it with --add; when it finishes an item, close it."
        }
      }
      """

  Scenario: --hook claude shows the user at most 5 items and says how many more there are
    Given the file "TRACKER.md" contains:
      """
      # Tracker

      ## Open

      ### T-1 One
      - status: open
      - next: a
      - from: 2026-10-29

      ### T-2 Two
      - status: open
      - next: b
      - from: 2026-10-29

      ### T-3 Three
      - status: open
      - next: c
      - from: 2026-10-29

      ### T-4 Four
      - status: open
      - next: d
      - from: 2026-10-29

      ### T-5 Five
      - status: open
      - next: e
      - from: 2026-10-29

      ### T-6 Six
      - status: open
      - next: f
      - from: 2026-10-29

      ## Done
      """
    When the tool runs with "--hook claude {root}"
    Then it exits with 0 and prints:
      """
      {
        "systemMessage": "TRACKER.md: 6 open\n- T-1 One · next: a\n- T-2 Two · next: b\n- T-3 Three · next: c\n- T-4 Four · next: d\n- T-5 Five · next: e\n… and 1 more",
        "hookSpecificOutput": {
          "hookEventName": "SessionStart",
          "additionalContext": "TRACKER.md: 6 open\n- T-1 One · next: a\n- T-2 Two · next: b\n- T-3 Three · next: c\n- T-4 Four · next: d\n- T-5 Five · next: e\n- T-6 Six · next: f\n\nThese are the open items in this repo's TRACKER.md (tracker/v1). Tell the user about any item that looks done, and close it once they agree: node ~/.copilot/tracker/tracker.mjs --close <id>. When this session leaves work undone, add it with --add; when it finishes an item, close it."
        }
      }
      """

  Scenario: --hook codex prints the same SessionStart JSON as Claude Code, which Codex reads
    When the tool runs with "--hook codex {root}"
    Then it exits with 0 and prints:
      """
      {
        "systemMessage": "TRACKER.md: 2 open — 1 waiting\n- T-2 Decide on the old stash · waiting on V · next: Pop it or drop it\n- T-1 Write the setup guide · next: Draft the install steps",
        "hookSpecificOutput": {
          "hookEventName": "SessionStart",
          "additionalContext": "TRACKER.md: 2 open — 1 waiting\n- T-2 Decide on the old stash · waiting on V · next: Pop it or drop it\n- T-1 Write the setup guide · next: Draft the install steps\n\nThese are the open items in this repo's TRACKER.md (tracker/v1). Tell the user about any item that looks done, and close it once they agree: node ~/.copilot/tracker/tracker.mjs --close <id>. When this session leaves work undone, add it with --add; when it finishes an item, close it."
        }
      }
      """
    When the tool runs with "--hook chatgpt {root}"
    Then it exits with 1 and prints:
      """
      --hook takes claude, codex or copilot
      """

  Scenario: --hook copilot gives the model the list as additionalContext
    When the tool runs with "--hook copilot {root}"
    Then it exits with 0 and prints:
      """
      {
        "additionalContext": "TRACKER.md: 2 open — 1 waiting\n- T-2 Decide on the old stash · waiting on V · next: Pop it or drop it\n- T-1 Write the setup guide · next: Draft the install steps\n\nThese are the open items in this repo's TRACKER.md (tracker/v1). Tell the user about any item that looks done, and close it once they agree: node ~/.copilot/tracker/tracker.mjs --close <id>. When this session leaves work undone, add it with --add; when it finishes an item, close it."
      }
      """

  Scenario: The hooks print nothing when there is no tracker
    Given the file "TRACKER.md" is removed
    When the tool runs with "--hook claude {root}"
    Then it exits with 0 and prints:
      """
      """
    When the tool runs with "--hook copilot {root}"
    Then it exits with 0 and prints:
      """
      """

  Scenario: --stdin takes the folder from the hook payload's cwd
    When the tool runs with "--hook copilot --stdin" and this on stdin:
      """
      {"sessionId": "s1", "cwd": "{root}", "source": "startup"}
      """
    Then the output has the line "{"
    And the output has the line "}"

  Scenario: The tracker of a subfolder's repo is the one at the repo root
    Given "." is a git repository with everything committed
    And the folder "src/deep" exists
    When the tool runs with "--brief {root}/src/deep"
    Then the output has the line "TRACKER.md: 2 open — 1 waiting"

  # ---- edits ------------------------------------------------------------------------------------------

  Scenario: --add appends an item under Open with the next free id and today's date
    Given in "TRACKER.md", `### T-3 Fix the broken link` becomes `### T-7 Fix the broken link`
    When the tool runs with arguments:
      """
      --add
      Ship the release
      --next
      Tag v1.0 and push the tag
      --done-when
      commit v1.0
      {root}
      """
    Then it exits with 0 and prints:
      """
      added T-8 to TRACKER.md
      """
    And the file "TRACKER.md" contains exactly:
      """
      # Tracker

      Open work in this repo.

      ## Open

      ### T-1 Write the setup guide
      - status: open
      - next: Draft the install steps
      - from: 2026-10-20

      ### T-2 Decide on the old stash
      - status: waiting
      - next: Pop it or drop it
      - waiting-on: V
      - from: 2026-10-25

      ### T-8 Ship the release
      - status: open
      - next: Tag v1.0 and push the tag
      - done-when: commit v1.0
      - from: 2026-10-30

      ## Done

      ### T-7 Fix the broken link
      - status: done
      - from: 2026-10-01
      - closed: 2026-10-02
      """

  Scenario: --add creates TRACKER.md when there is none, local to the clone
    Given the file "TRACKER.md" is removed
    And the file "README.md" contains:
      """
      # Readme
      """
    And "." is a git repository with everything committed
    When the tool runs with arguments:
      """
      --add
      Decide on the stash
      --status
      waiting
      --waiting-on
      V
      --next
      Pop it or drop it
      --from
      a1b2c3d
      {root}
      """
    Then it exits with 0 and prints:
      """
      created TRACKER.md (local only: listed in .git/info/exclude; run git add -f TRACKER.md to share it)
      added T-1 to TRACKER.md
      """
    And the file ".git/info/exclude" has the line "/TRACKER.md"
    And the file "TRACKER.md" contains exactly:
      """
      # Tracker

      Work this repo still owes, carried from one session to the next. Format and tool: tracker/v1 (agent-config, copilot/tracker/).

      ## Open

      ### T-1 Decide on the stash
      - status: waiting
      - next: Pop it or drop it
      - waiting-on: V
      - from: 2026-10-30 · a1b2c3d

      ## Done
      """

  Scenario: --add does not list TRACKER.md in .git/info/exclude twice
    Given the file "TRACKER.md" is removed
    And the file "README.md" contains:
      """
      # Readme
      """
    And "." is a git repository with everything committed
    And the file ".git/info/exclude" contains:
      """
      *.log
      /TRACKER.md
      """
    When the tool runs with "--add Later --next Soon {root}"
    Then the file ".git/info/exclude" contains exactly:
      """
      *.log
      /TRACKER.md
      """

  Scenario: --add refuses an item that would not pass the checks, and leaves the file as it was
    When the tool runs with arguments:
      """
      --add
      Wait for review
      --status
      waiting
      --next
      Ping the reviewer
      {root}
      """
    Then it exits with 1 and prints:
      """
      TRACKER.md not changed:
        TR-3  T-4: status waiting needs "waiting-on"
      """
    And the file "TRACKER.md" has no line containing "Wait for review"

  Scenario: --update changes the given fields and records today as updated
    When the tool runs with arguments:
      """
      --update
      T-1
      --priority
      high
      --next
      Draft it today
      {root}
      """
    Then it exits with 0 and prints:
      """
      updated T-1
      """
    And the file "TRACKER.md" contains exactly:
      """
      # Tracker

      Open work in this repo.

      ## Open

      ### T-1 Write the setup guide
      - status: open
      - priority: high
      - next: Draft it today
      - from: 2026-10-20
      - updated: 2026-10-30

      ### T-2 Decide on the old stash
      - status: waiting
      - next: Pop it or drop it
      - waiting-on: V
      - from: 2026-10-25

      ## Done

      ### T-3 Fix the broken link
      - status: done
      - from: 2026-10-01
      - closed: 2026-10-02
      """

  Scenario: --close moves the item to the top of Done with today's date and the note
    When the tool runs with arguments:
      """
      --close
      T-1
      --note
      abc123
      {root}
      """
    Then it exits with 0 and prints:
      """
      closed T-1
      """
    And the file "TRACKER.md" contains exactly:
      """
      # Tracker

      Open work in this repo.

      ## Open

      ### T-2 Decide on the old stash
      - status: waiting
      - next: Pop it or drop it
      - waiting-on: V
      - from: 2026-10-25

      ## Done

      ### T-1 Write the setup guide
      - status: done
      - next: Draft the install steps
      - from: 2026-10-20
      - closed: 2026-10-30 · abc123

      ### T-3 Fix the broken link
      - status: done
      - from: 2026-10-01
      - closed: 2026-10-02
      """

  Scenario: --drop needs a reason and records it
    When the tool runs with "--drop T-2 {root}"
    Then it exits with 1 and prints:
      """
      --drop needs --why <text>
      """
    When the tool runs with arguments:
      """
      --drop
      T-2
      --why
      The stash was already applied
      {root}
      """
    Then it exits with 0 and prints:
      """
      dropped T-2
      """
    And the file "TRACKER.md" has the line "- status: dropped"
    And the file "TRACKER.md" has the line "- why: The stash was already applied"

  Scenario: An edit names an item that does not exist, or one already closed
    When the tool runs with "--close T-9 {root}"
    Then it exits with 1 and prints:
      """
      no open item T-9 in TRACKER.md
      """
    When the tool runs with "--update T-3 --priority high {root}"
    Then it exits with 1 and prints:
      """
      no open item T-3 in TRACKER.md
      """

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every rule code the tool prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature

  Scenario: Every rule code the tool prints is a rule in the tracker schema
    Then every rule code the tool prints is a rule row in its schemas
