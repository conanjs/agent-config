// @ts-check
// Lint for the test support code (tests/support/*.ts, tests/*/tool.ts), a lighter baseline than the shipped tiers:
// typescript-eslint recommended with type information (which includes no-floating-promises), complexity 10 and
// no re-exports or enums. It carries no TSDoc, size or import-zone rules, because these files are glue for Cucumber
// steps whose World is untyped and whose steps are short registrations, not a designed API.
// Legacy .mjs files here stay unlinted (constitution, "style deviations"). ESLint reads this file for every file below tests/.
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { noEnums, noReExports } from '../eslint/baseline.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

export default defineConfig(
  { ignores: ['**/node_modules/', '**/fixtures/', '**/golden/'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: repoRoot } },
    rules: {
      complexity: ['error', 10],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums],
    },
  },
  prettier,
);
