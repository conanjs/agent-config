# Requirements for the constitution amendment (specs/022 T048, T084; AC-1.5 and FR-007): principle I becomes
# "one source, generated per platform" as version 2.0.0, a MAJOR amendment. The scenarios read .specify/memory/constitution.md.
#
# The last clause of AC-1.5, "scripts/check-docs.sh passes", has no scenario of its own: check-docs.sh runs these
# scenarios, so it cannot be started from one without recursion. It is the run that carries this feature, and the
# phase 0 exit check (T089) requires it green.
#
# Written before the code: @pending marks a scenario that cannot pass yet; T084 removes the tag.

Feature: Constitution principle I, one source generated per platform
  The constitution says there is one source and that the per-platform files are generated from it.

  Scenario: AC-1.5 Principle I is titled "One source, generated per platform", so it says the source is single
    # The old title "One source of truth" already contains "one source", so the new title is matched whole.
    Then the repository file ".specify/memory/constitution.md" has a line matching "^### I\. One source, generated per platform$"
    And in the repository file ".specify/memory/constitution.md", the section "### I." contains "single"

  Scenario: AC-1.5 Principle I says the per-platform files are generated
    Then in the repository file ".specify/memory/constitution.md", the section "### I." contains "generated"
    And in the repository file ".specify/memory/constitution.md", the section "### I." contains "per platform"

  Scenario: AC-1.5 Principle I no longer says the agent files are thin wrappers
    Then in the repository file ".specify/memory/constitution.md", the section "### I." does not contain "thin wrappers"

  Scenario: AC-1.5 The constitution version is 2.0.0
    Then the repository file ".specify/memory/constitution.md" has a line matching "^\*\*Version\*\*: 2\.0\.0 \|"

  Scenario: AC-1.5 The amendment is a MAJOR one that states the change in the Sync Impact Report
    Then the repository file ".specify/memory/constitution.md" has a line matching "^Version: 1\.1\.0 -> 2\.0\.0 \(MAJOR: .*generated.*\)"

  Scenario: AC-1.5 The amendment is dated 2026-11-14 or later
    Then the repository file ".specify/memory/constitution.md" has a line matching "\*\*Last Amended\*\*: (2026-11-(1[4-9]|2\d|30)|2026-12-\d\d|20(2[7-9]|[3-9]\d)-\d\d-\d\d)\b"
