// @ts-check
// Lint for the contracts tier (specs/022, T041): the shared typescript-node lint baseline (eslint/baseline.mjs) plus the tier's
// own zone: contracts imports nothing else in this repo (DR-302).
// `lib/` is functional-pipeline@1 (PDM-contracts-lib): pure functions, no I/O. `tools/` are scripts and may do I/O.
// ESLint reads this file for every file below contracts/ (it looks in the file's own folder, then its parents).
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import {
  docsBlock,
  mjsBlock,
  noClock,
  noEffectImports,
  noRawStatusCodes,
  noRelativeOutsideFolder,
  restrictedSyntax,
  testBlock,
  typeScriptBlock,
} from '../eslint/baseline.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

// PDM-functional-pipeline-R2: a pure rule takes the time as an argument.
const noClockInCore = noClock('Take the time as an argument (PDM-functional-pipeline-R2)');

// PDM-contracts-lib, PDM-functional-pipeline-R2: the shared pure rules in lib/ do no I/O, so the modules that
// do I/O are not importable there (the build tool and validators in tools/ read files and may import them).
const noEffects = noEffectImports('lib/ is pure: do the I/O in tools/ or the caller (PDM-functional-pipeline-R2)');

// DR-302: contracts depends on nothing else in the repo, so no file below it may resolve to a path outside it
// (installers, scripts, tests, components, legacy folders). Installed packages stay allowed.
const contractsZones = [
  {
    target: './contracts',
    from: './',
    except: ['./contracts', './node_modules'],
    message: 'contracts imports nothing else in this repo (DR-302)',
  },
];

export default defineConfig(
  { ignores: ['**/node_modules/', '**/vendor/'] },
  mjsBlock,
  typeScriptBlock({
    files: ['**/*.ts'],
    repoRoot,
    rules: { 'import-x/no-restricted-paths': ['error', { basePath: repoRoot, zones: contractsZones }] },
  }),
  {
    // PDM-functional-pipeline-R1, R2: the shared pure rules are immutable and do no I/O.
    files: ['lib/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-console': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Take the environment as an argument (PDM-functional-pipeline-R2)' },
        { name: 'fetch', message: 'lib/ does no network I/O (PDM-functional-pipeline-R2)' },
      ],
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder], paths: noEffects }],
      'no-restricted-syntax': restrictedSyntax(...noRawStatusCodes, ...noClockInCore),
    },
  },
  {
    // IMP-1 exception: the one wrapper reaches the vendored library below it with a relative path (DR-102); no alias is needed
    // because nothing else may import the vendored folder. The effect-module restriction stays.
    files: ['lib/yaml.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: noEffects }] },
  },
  testBlock(['**/*.test.ts']),
  docsBlock({ files: ['**/*.ts'], members: true }),
  prettier,
);
