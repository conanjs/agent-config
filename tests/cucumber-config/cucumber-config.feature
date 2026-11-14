# Requirements for cucumber.mjs (specs/022 T042): TypeScript files load by Node type stripping, and the OS tags
# @mac, @windows and @posix keep a scenario to the OS it is meant for. An OS-tagged scenario asserts the OS it names,
# so a scenario that ran on the wrong OS would fail instead of passing unnoticed.

Feature: Cucumber configuration
  The configuration loads tests/*/tool.ts and tests/support/*.ts next to the .mjs files, and runs an OS-tagged
  scenario only on that OS.

  Scenario: T042-1 A tool.ts file and a support .ts file load next to the .mjs ones
    Then a tool.ts file has been loaded

  @mac
  Scenario: T042-2 A @mac scenario runs on macOS only
    Then the operating system is "darwin"

  @windows
  Scenario: T042-3 A @windows scenario runs on Windows only
    Then the operating system is "win32"

  @posix
  Scenario: T042-4 A @posix scenario runs on macOS and Linux, not on Windows
    Then the operating system is not "win32"
