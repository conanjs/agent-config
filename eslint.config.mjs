// Root ESLint config (specs/022, T040): lints only the new TypeScript tiers, which carry their own configs
// (installers/, contracts/ and scripts/eslint.config.mjs; tests/eslint.config.mjs for the test support code); ESLint finds the nearest config for each file.
// Legacy .mjs tools stay exempt from the lint baseline until they are rewritten (constitution, "style deviations").
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  // Everything outside the new tiers and this config's own helper files.
  {
    ignores: [
      '**',
      '!contracts/',
      '!installers/',
      '!eslint/',
      '!eslint.config.mjs',
      // scripts/ and tests/: only the TypeScript and their own configs; the .sh files and legacy .mjs stay ignored.
      '!scripts/',
      'scripts/*',
      '!scripts/*.ts',
      '!scripts/eslint.config.mjs',
      '!tests/',
      'tests/*',
      '!tests/support/',
      'tests/support/*',
      '!tests/support/*.ts',
      '!tests/eslint.config.mjs',
      '!tests/*/',
      'tests/*/*',
      '!tests/*/tool.ts',
    ],
  },
  { files: ['eslint/**/*.mjs', 'eslint.config.mjs'], extends: [js.configs.recommended] },
  prettier,
);
