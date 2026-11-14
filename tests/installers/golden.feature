# Requirements for the golden plans of the old installers (specs/022 AC-1.9, QB-3, T036, T037, T038).
# Phase 0 must not change any installed path or installer behaviour. The plan of installers/install.sh (one line per
# link or seeded file, target to source with mode) was recorded before anything changed in
# tests/installers/golden/posix/{darwin,linux}.txt by golden/posix/plan.sh. These scenarios list the plan again and
# compare it with the whole recorded file, header line included.
#
# The Linux golden is pinned as the stub's own result: installers/linux/install.sh is a stub that exits 1 and installs
# nothing, so the file holds the header "exit=1" and an empty plan (V's decision, spec 022). A change to that stub, or
# to any mapping.yaml entry, makes a comparison fail on purpose: the golden file is then updated in the same commit.
# The plan is listed with a private temporary HOME and a fake `uname`, so both POSIX scenarios run on Mac and Linux.
# The Windows plan comes from install.ps1 on the Windows runner: golden/windows/plan.ps1 (T037) lists it, the workflow
# uploads it as the artifact golden-plan-windows, and V commits it as golden/windows/windows.txt. Until then the scenario
# is pending on both tasks, so it is not reported as failing the moment T037 is ticked.

Feature: Golden install plans of the old installers
  The plan of the old installers on the phase 0 branch equals the recorded golden file of each OS.

  @posix
  Scenario: AC-1.9 The Mac plan equals the golden file darwin.txt
    When the old installers' plan for "darwin" is listed
    Then the plan equals the golden file "posix/darwin.txt"

  @posix
  Scenario: AC-1.9 The Linux plan equals the golden file linux.txt, the stub's exit 1 with an empty plan
    When the old installers' plan for "linux" is listed
    Then the plan equals the golden file "posix/linux.txt"
    And the output has the line "# install plan of installers/install.sh, os=linux, exit=1"

  @posix
  Scenario: AC-1.9 A changed mapping target makes the Mac plan differ from the golden file
    Given a copy of the old installers and their mapping in "copy"
    And in "copy/mapping.yaml", `target: ~/.claude/CLAUDE.md,` becomes `target: ~/.claude/CHANGED.md,`
    When the old installers' plan in "copy" for "darwin" is listed
    Then the plan differs from the golden file "posix/darwin.txt"
    And the output has the line "link ~/.claude/CHANGED.md -> claude/CLAUDE.md"
    And the output has no line "link ~/.claude/CLAUDE.md -> claude/CLAUDE.md"

  @posix
  Scenario: AC-1.9 A copy with an unchanged mapping still equals the golden file
    Given a copy of the old installers and their mapping in "copy"
    When the old installers' plan in "copy" for "darwin" is listed
    Then the plan equals the golden file "posix/darwin.txt"

  @windows @pending @T037 @T038
  Scenario: AC-1.9 The Windows plan equals the golden file windows.txt, once T037 provides it
    When the plan of install.ps1 is listed on the Windows runner
    Then the plan equals the golden file "windows/windows.txt"
