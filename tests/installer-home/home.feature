# Requirements for the agent home and its confirmation (specs/022 Story 2, T119). Scenarios are written before the code
# (the installer core, T129 to T146; the test entry tests/support/installer-test-main.ts, T142) and carry @pending until then.
#
# The installer is run through the test entry on a throwaway home (tests/support/installer-world.ts): {root}/home is HOME and
# USERPROFILE, {root}/repo is the agent-config folder (the test entry reads it from AGENT_CONFIG_TEST_REPO, set by tool.ts),
# no terminal is attached unless a scenario attaches a scripted one, and the agent home variable is empty unless a scenario sets it.
#
# Text the code must match: every message, exit code and JSON field is in the catalogue "Messages" of
# specs/022-repo-split/contracts/installer-cli.md. Used here: MG-01 (the home line, first line of every run), MG-02 (status), MG-04 and
# MG-05 (the home need and the move), MG-10 (the terminal line, only with no terminal), MG-11 (the two questions to an interactive
# terminal). While the home is unconfirmed the home need is alone and nothing is written. The confirmed home is recorded in
# {home}/install-state.json as "home" (data-model.md, install-state/v1).
#
# Who asked: V; AC-2.1 to AC-2.5, AC-4.7 and FR-013 of specs/022-repo-split/spec.md.

Feature: The agent home is stated, and confirmed by V before anything is written
  The first install names the agent home, asks V to confirm it at an interactive terminal, and writes nothing until V does.

  Background:
    Given the base fixture tree of "installer-home"
    And a temporary home with the agent folders exists

  @posix @pending @T138 @T142
  Scenario: AC-2.1 A first run states ~/.agent-config, lists it as a need, exits 10 and changes nothing
    Given a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (default, not confirmed)
      status: needs-input
      1. home: {root}/home/.agent-config
         confirm the agent home
         satisfy: install (interactive) and answer yes
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed
    And "home/.agent-config" does not exist
    And "home/.agent-config-backups" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.1 The JSON report of a first run is one document with the home need
    When the tool runs with "install --json"
    Then it exits with 10
    And the home report is one JSON document on standard output and nothing on standard error
    And the home report value "schema" is "install-report/v1"
    And the home report value "status" is "needs-input"
    And the home report value "exit" is "10"
    And the home report value "home.path" is "{root}/home/.agent-config"
    And the home report value "home.confirmed" is "false"
    And the home report value "home.source" is "default"
    And the home report value "needs.0.kind" is "home"
    And "home/.agent-config" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.1 A confirmation typed through a pipe is not accepted
    When the tool runs with "install" and this on stdin:
      """
      yes
      """
    Then it exits with 10
    And the output has the line "   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted"
    And "home/.agent-config" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.1 An answer other than yes at an interactive terminal leaves everything unchanged
    Given a scripted terminal that answers:
      """
      maybe
      """
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/home/.agent-config (default, not confirmed)
      status: needs-input
      1. home: {root}/home/.agent-config
         confirm the agent home
         satisfy: install (interactive) and answer yes
      """
    And since the snapshot, nothing under "home" changed

  @posix @pending @T138 @T142
  Scenario: AC-2.1 The answer yes at an interactive terminal confirms the home and installs
    Given a scripted terminal that answers:
      """
      yes
      """
    When the tool runs with "install"
    Then it exits with 0
    And the home report states "agent home: {root}/home/.agent-config (default, confirmed)" on its first line
    And "home/.agent-config" exists
    And the home state records the home "{root}/home/.agent-config"

  @windows @pending @T138 @T142
  Scenario: AC-2.2 A Windows account with no override states USERPROFILE, not APPDATA
    When the tool runs with "install"
    Then it exits with 10
    And the home report states "agent home: {root}\home\.agent-config (default, not confirmed)" on its first line
    And the output does not mention "appdata"
    And "home/.agent-config" does not exist
    And "appdata" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.3 AGENT_CONFIG_HOME is stated as the home when it is not confirmed
    Given the agent home variable is "/data/ac"
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: /data/ac (AGENT_CONFIG_HOME, not confirmed)
      status: needs-input
      1. home: /data/ac
         confirm the agent home
         satisfy: install (interactive) and answer yes
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And "home/.agent-config" does not exist

  @windows @pending @T138 @T142
  Scenario: AC-2.3 (Windows) AGENT_CONFIG_HOME is stated as the home when it is not confirmed
    Given the agent home variable is "{root}\data\ac"
    When the tool runs with "install"
    Then it exits with 10
    And the home report states "agent home: {root}\data\ac (AGENT_CONFIG_HOME, not confirmed)" on its first line
    And "data" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.4 A confirmed home is stated first on the next run, which asks nothing and proceeds
    Given a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    When the tool runs with "install"
    Then it exits with 0
    And the home report states "agent home: {root}/home/.agent-config (recorded, confirmed)" on its first line
    And the output does not mention "needs-input"

  @posix @pending @T138 @T142
  Scenario: AC-2.5 A moved home names the recorded and the new home, exits 10 and writes nothing
    Given a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And no terminal is attached
    And the agent home variable is "{root}/elsewhere"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10 and prints:
      """
      agent home: {root}/elsewhere (AGENT_CONFIG_HOME, not confirmed; recorded home: {root}/home/.agent-config)
      status: needs-input
      1. home: {root}/elsewhere
         confirm moving the agent home from {root}/home/.agent-config to {root}/elsewhere
         satisfy: install (interactive) and answer yes
         an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted
      """
    And since the snapshot, nothing under "home" changed
    And "elsewhere" does not exist

  @posix @pending @T138 @T142
  Scenario: AC-2.5 Refusing the move at an interactive terminal keeps the recorded home
    Given a scripted terminal that answers:
      """
      yes
      """
    And the tool runs with "install"
    And a scripted terminal that answers:
      """
      no
      """
    And the agent home variable is "{root}/elsewhere"
    And a snapshot of "home" is taken
    When the tool runs with "install"
    Then it exits with 10
    And the home report states "agent home: {root}/elsewhere (AGENT_CONFIG_HOME, not confirmed; recorded home: {root}/home/.agent-config)" on its first line
    And since the snapshot, nothing under "home" changed
    And the home state records the home "{root}/home/.agent-config"
    And "elsewhere" does not exist
