# Requirements for installers/install.sh, installers/uninstall.sh, installers/macos/install.sh and
# installers/lib/{os,link-or-copy}.sh, as executable scenarios (specs/008). Source of the requirements: README.md
# "Usage" and the scripts' header comments.
#
# Each scenario copies the current installers/ folder into a fixture repo with a small mapping.yaml, and runs it
# with a private HOME. A fake `uname` decides which OS the installer sees, so every route runs on any machine.
# The PowerShell installers (install.ps1, uninstall.ps1) are not covered here: they need a Windows runner
# (specs/008-installer-tests/research.md, finding F-1).
#
# Change policy (constitution principle IV): a changed behavior edits its scenario in the same commit as the
# script; a new behavior adds scenarios and every existing one keeps passing. Output text is compared exactly;
# "<timestamp>" stands for the backup folder's date and time.

Feature: Bash installers
  install.sh routes to the installer for the current OS, which links or seeds every mapping.yaml entry into HOME,
  backing up anything already there. uninstall.sh removes the symlinks again.

  Background:
    Given the base fixture tree of "installers"
    And the repo's "installers" folder is copied to "repo/installers"
    And the command "uname" prints "Darwin"

  # ---- install on macOS ------------------------------------------------------------------------------

  Scenario: A clean install links every symlink entry, seeds seed-once files and creates no backup
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        seeded {root}/home/.claude/settings.json from {root}/repo/claude/settings.json (will not be touched by future installs)
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Done.
      """
    And "home/.copilot/knowledge" is a symlink to "repo/copilot/knowledge"
    And "home/.claude/CLAUDE.md" is a symlink to "repo/claude/CLAUDE.md"
    And "home/.claude/skills" is a symlink to "repo/skills"
    And "home/.agents/skills" is a symlink to "repo/skills"
    And the file "home/.claude/settings.json" contains exactly:
      """
      { "fixture": true }
      """
    And "home/.claude/settings.json" is a real file or folder, not a symlink
    And "home/.agent-config-backups" does not exist

  Scenario: A second install changes nothing
    Given the tool runs with "install.sh"
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        {root}/home/.copilot/knowledge already correctly symlinked, skipped
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        {root}/home/.claude/CLAUDE.md already correctly symlinked, skipped
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        {root}/home/.claude/settings.json already exists, leaving it alone (seed-once)
      [symlink] skills -> ~/.claude/skills
        {root}/home/.claude/skills already correctly symlinked, skipped
      [symlink] skills -> ~/.agents/skills
        {root}/home/.agents/skills already correctly symlinked, skipped
      Done.
      """
    And "home/.agent-config-backups" does not exist

  Scenario: Existing content at a symlink target is backed up under the source path, then linked
    Given the file "home/.claude/CLAUDE.md" contains:
      """
      my own notes
      """
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        existing content at {root}/home/.claude/CLAUDE.md -> backing up to {root}/home/.agent-config-backups/<timestamp>/claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        seeded {root}/home/.claude/settings.json from {root}/repo/claude/settings.json (will not be touched by future installs)
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Backed up pre-existing content to: {root}/home/.agent-config-backups/<timestamp>
      Done.
      """
    And "home/.claude/CLAUDE.md" is a symlink to "repo/claude/CLAUDE.md"
    And the file "home/.agent-config-backups/<timestamp>/claude/CLAUDE.md" contains exactly:
      """
      my own notes
      """

  Scenario: Two targets of one source both backed up get .2 on the second backup
    Given the file "home/.claude/skills/mine/SKILL.md" contains:
      """
      claude skill
      """
    And the file "home/.agents/skills/mine/SKILL.md" contains:
      """
      agents skill
      """
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        seeded {root}/home/.claude/settings.json from {root}/repo/claude/settings.json (will not be touched by future installs)
      [symlink] skills -> ~/.claude/skills
        existing content at {root}/home/.claude/skills -> backing up to {root}/home/.agent-config-backups/<timestamp>/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        existing content at {root}/home/.agents/skills -> backing up to {root}/home/.agent-config-backups/<timestamp>/skills.2
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Backed up pre-existing content to: {root}/home/.agent-config-backups/<timestamp>
      Done.
      """
    And the file "home/.agent-config-backups/<timestamp>/skills/mine/SKILL.md" contains exactly:
      """
      claude skill
      """
    And the file "home/.agent-config-backups/<timestamp>/skills.2/mine/SKILL.md" contains exactly:
      """
      agents skill
      """

  Scenario: A symlink that points somewhere else is backed up and replaced
    Given "home/.copilot/knowledge" already links to "repo/claude"
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        existing content at {root}/home/.copilot/knowledge -> backing up to {root}/home/.agent-config-backups/<timestamp>/copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        seeded {root}/home/.claude/settings.json from {root}/repo/claude/settings.json (will not be touched by future installs)
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Backed up pre-existing content to: {root}/home/.agent-config-backups/<timestamp>
      Done.
      """
    And "home/.copilot/knowledge" is a symlink to "repo/copilot/knowledge"
    And "home/.agent-config-backups/<timestamp>/copilot/knowledge" is a symlink to "repo/claude"

  Scenario: A seed-once target that already exists is left alone
    Given the file "home/.claude/settings.json" contains:
      """
      { "mine": true }
      """
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        {root}/home/.claude/settings.json already exists, leaving it alone (seed-once)
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Done.
      """
    And the file "home/.claude/settings.json" contains exactly:
      """
      { "mine": true }
      """

  Scenario: An unknown strategy is reported and skipped
    Given in "repo/mapping.yaml", `target: ~/.claude/settings.json, strategy: seed-once` becomes `target: ~/.claude/settings.json, strategy: copy`
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledge -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledge
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [copy] claude/settings.json -> ~/.claude/settings.json
        unknown strategy 'copy', skipped
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Done.
      """
    And "home/.claude/settings.json" does not exist

  # ---- routing by OS -----------------------------------------------------------------------------------

  Scenario: On Linux, install.sh routes to the Linux installer, which is not implemented yet
    Given the command "uname" prints "Linux"
    When the tool runs with "install.sh"
    Then it exits with 1 and prints:
      """
      Linux install is not implemented yet.
      The mapping/strategy logic in installers/lib/link-or-copy.sh is OS-agnostic bash
      and should work as-is — this stub exists so install.sh has somewhere to route
      to once someone actually needs it on Linux. Copy installers/macos/install.sh's
      body here when that happens; nothing OS-specific was found to differ so far.
      """
    And "home/.copilot" does not exist

  Scenario: Under Git Bash on Windows, install.sh points to install.ps1 and changes nothing
    Given the command "uname" prints "MINGW64_NT-10.0-22631"
    When the tool runs with "install.sh"
    Then it exits with 1 and prints:
      """
      You're in Git Bash / MSYS / Cygwin on Windows. Use the native Windows installer instead:
        powershell -ExecutionPolicy Bypass -File {root}/repo/installers\install.ps1
      (bash symlinks under Git Bash are unreliable without admin/Developer Mode and aren't what install.ps1's fallback logic covers)
      """
    And "home/.copilot" does not exist

  Scenario: On an unknown OS, install.sh stops and changes nothing
    Given the command "uname" prints "SunOS"
    When the tool runs with "install.sh"
    Then it exits with 1 and prints:
      """
      Unsupported OS: SunOS. No installer for this platform yet.
      """
    And "home/.copilot" does not exist

  # ---- uninstall -----------------------------------------------------------------------------------------

  Scenario: Uninstall removes the symlinks and leaves seeded files
    Given the tool runs with "install.sh"
    When the tool runs with "uninstall.sh"
    Then it exits with 0 and prints:
      """
      Removing symlinks created by install.sh (seed-once files are left untouched — they've diverged from the repo by design).
      removing symlink {root}/home/.copilot/knowledge
      removing symlink {root}/home/.claude/CLAUDE.md
      removing symlink {root}/home/.claude/skills
      removing symlink {root}/home/.agents/skills
      Done. Any pre-existing content backed up during install is at ~/.agent-config-backups/<timestamp>/ — restore it manually if needed.
      """
    And "home/.copilot/knowledge" does not exist
    And "home/.claude/skills" does not exist
    And the file "home/.claude/settings.json" contains exactly:
      """
      { "fixture": true }
      """

  Scenario: Uninstall leaves real content at a symlink target alone
    Given the file "home/.claude/CLAUDE.md" contains:
      """
      not a link
      """
    When the tool runs with "uninstall.sh"
    Then it exits with 0 and prints:
      """
      Removing symlinks created by install.sh (seed-once files are left untouched — they've diverged from the repo by design).
      Done. Any pre-existing content backed up during install is at ~/.agent-config-backups/<timestamp>/ — restore it manually if needed.
      """
    And the file "home/.claude/CLAUDE.md" contains exactly:
      """
      not a link
      """

  # ---- pinned as found -----------------------------------------------------------------------------------

  Scenario: A mapping entry whose source does not exist still gets a symlink, which dangles
    # Pinned as found: specs/008-installer-tests/research.md, finding F-3.
    Given in "repo/mapping.yaml", `source: copilot/knowledge,` becomes `source: copilot/knowledgebase,`
    When the tool runs with "install.sh"
    Then it exits with 0 and prints:
      """
      Installing agent-config from {root}/repo (macOS)
      [symlink] copilot/knowledgebase -> ~/.copilot/knowledge
        symlinked {root}/home/.copilot/knowledge -> {root}/repo/copilot/knowledgebase
      [symlink] claude/CLAUDE.md -> ~/.claude/CLAUDE.md
        symlinked {root}/home/.claude/CLAUDE.md -> {root}/repo/claude/CLAUDE.md
      [seed-once] claude/settings.json -> ~/.claude/settings.json
        seeded {root}/home/.claude/settings.json from {root}/repo/claude/settings.json (will not be touched by future installs)
      [symlink] skills -> ~/.claude/skills
        symlinked {root}/home/.claude/skills -> {root}/repo/skills
      [symlink] skills -> ~/.agents/skills
        symlinked {root}/home/.agents/skills -> {root}/repo/skills
      Done.
      """
    And "home/.copilot/knowledge" is a symlink to "repo/copilot/knowledgebase"
