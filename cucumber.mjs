// Cucumber.js configuration for the tool tests (specs/003). Each tests/<tool>/ folder holds one feature file,
// a tool.mjs that says how to run that tool, and its fixtures; tests/support/ holds the shared World and steps.
export default {
  paths: ['tests/**/*.feature'],
  import: ['tests/support/*.mjs', 'tests/*/tool.mjs'],
  format: ['progress'],
  parallel: 4,
};
