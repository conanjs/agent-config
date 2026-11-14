// @ts-check
// Lint for the repo's TypeScript checks in scripts/ (specs/022): the shared typescript-node lint baseline
// (eslint/baseline.mjs) without the contracts-only zones, the `lib/` purity rules and the status-code and clock rules.
// Legacy .sh files are not matched. ESLint reads this file for every file below scripts/.
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { docsBlock, mjsBlock, restrictedSyntax, testBlock, typeScriptBlock } from '../eslint/baseline.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

export default defineConfig(
  { ignores: ['**/node_modules/'] },
  mjsBlock,
  typeScriptBlock({ files: ['**/*.ts'], repoRoot, rules: { 'no-restricted-syntax': restrictedSyntax() } }),
  testBlock(['**/*.test.ts']),
  docsBlock({ files: ['**/*.ts'], members: false }),
  prettier,
);
