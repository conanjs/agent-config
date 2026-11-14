// Cucumber.js configuration for the tool tests (specs/003, 022). Each tests/<tool>/ folder holds one feature file,
// a tool.mjs or tool.ts that says how to run that tool, and its fixtures; tests/support/ holds the shared World and steps.
// .ts files load by Node type stripping (Node 24.12+, specs/022 DR-601): erasable syntax only, imports keep their extension.
//
// OS tags: @mac, @windows and @posix (macOS and Linux) mark a scenario that makes sense on one OS only. A scenario whose
// tag does not match the OS running the tests is left out of the run, so it is neither passed nor skipped.
const hostOs = { darwin: ['@mac', '@posix'], linux: ['@posix'], win32: ['@windows'] }[process.platform] ?? [];
const leftOut = ['@mac', '@windows', '@posix'].filter((tag) => !hostOs.includes(tag));

export default {
  paths: ['tests/**/*.feature'],
  import: ['tests/support/*.mjs', 'tests/support/*.ts', 'tests/*/tool.mjs', 'tests/*/tool.ts'],
  ...(leftOut.length > 0 && { tags: leftOut.map((tag) => `not ${tag}`).join(' and ') }),
  format: ['progress'],
  parallel: 4,
};
