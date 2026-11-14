// Root ESLint config (specs/022, T040): lints only the new TypeScript tiers, which carry their own configs
// (installers/eslint.config.mjs, contracts/eslint.config.mjs); ESLint finds the nearest config for each file.
// Legacy .mjs tools stay exempt from the lint baseline until they are rewritten (constitution, "style deviations").
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  // Everything outside the new tiers and this config's own helper files.
  { ignores: ['**', '!contracts/', '!installers/', '!eslint/', '!eslint.config.mjs'] },
  { files: ['eslint/**/*.mjs', 'eslint.config.mjs'], extends: [js.configs.recommended] },
  prettier,
);
