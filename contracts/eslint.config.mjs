// @ts-check
// Lint for the contracts tier (specs/022, T041): the same typescript-node lint baseline as installers/eslint.config.mjs
// (TSN-13, TSN-16 to TSN-20) plus the tier's own zone: contracts imports nothing else in this repo (DR-302).
// `lib/` is functional-pipeline@1 (PDM-contracts-lib): pure functions, no I/O. `tools/` are scripts and may do I/O.
// ESLint reads this file for every file below contracts/ (it looks in the file's own folder, then its parents).
import path from 'node:path';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import localDocs from '../eslint/local-docs.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

// Constitution, "Agentic SDLC: defaults": at most 50 lines and complexity 10 per unit (CS-2).
const unitLimits = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: false, skipComments: false }],
};

// require-param / require-returns skip a method that implements an interface member and links it
// (`{@link Port.member}`): the editor shows the port's @param and @returns there (CMT-12, TSN-13).
const implementing = 'ClassDeclaration[implements.length>0] > ClassBody > MethodDefinition > FunctionExpression';
const notInheriting = [
  { context: 'ArrowFunctionExpression' },
  { context: 'FunctionDeclaration' },
  { context: `FunctionExpression:not(${implementing})` },
  {
    context: implementing,
    comment: 'JsdocBlock:not(:has(JsdocInlineTag[tag="link"][namepathOrURL=/\\./]))',
  },
];

// IMP-1, TSN-16: a relative path may name only a file in the importing file's own folder.
const noRelativeOutsideFolder = {
  regex: '^(\\.\\./|\\./[^/]+/)',
  message: "Use a # alias import outside the file's own folder (IMP-1)",
};

// TSN-18: spread into every block that sets no-restricted-syntax (a later block's options replace earlier ones).
const noReExports = [
  { selector: 'ExportAllDeclaration', message: 'No re-exports: import the declaring file (TSN-18)' },
  { selector: 'ExportNamedDeclaration[source]', message: 'No re-exports: import the declaring file (TSN-18)' },
];
// TSN-20: no TypeScript enum (Node type stripping rejects it).
const noEnums = [
  { selector: 'TSEnumDeclaration', message: 'No enum: use an as-const object or a literal union (TSN-20)' },
];
// TSN-19: a status code is a named constant, never a bare number. Contracts have no HTTP layer, so this is a guard.
const statusLiteral = 'Literal[value>=100][value<=599]';
const comparison = 'BinaryExpression[operator=/^([=!]==?|[<>]=?)$/]';
const noRawStatusCodes = [
  `CallExpression[callee.property.name=/^(status|sendStatus)$/] > ${statusLiteral}`,
  `${comparison}:matches([left.name=/status$/i], [left.property.name=/status$/i]) > ${statusLiteral}.right`,
  `${comparison}:matches([right.name=/status$/i], [right.property.name=/status$/i]) > ${statusLiteral}.left`,
].map((selector) => ({ selector, message: 'Use a named status constant, not a bare status number (TSN-19)' }));
// PDM-functional-pipeline-R2: a pure rule takes the time as an argument.
const noClockInCore = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Take the time as an argument (PDM-functional-pipeline-R2)',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Take the time as an argument (PDM-functional-pipeline-R2)',
  },
];

// PDM-contracts-lib, PDM-functional-pipeline-R2: the shared pure rules in lib/ do no I/O, so the modules that
// do I/O are not importable there (the build tool and validators in tools/ read files and may import them).
const effectModules = [
  'fs',
  'fs/promises',
  'child_process',
  'net',
  'http',
  'https',
  'http2',
  'dns',
  'os',
  'readline',
  'tty',
  'worker_threads',
  'process',
].flatMap((name) => [name, `node:${name}`]);
const noEffectImports = effectModules.map((name) => ({
  name,
  message: 'lib/ is pure: do the I/O in tools/ or the caller (PDM-functional-pipeline-R2)',
}));

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
  { files: ['**/*.mjs'], extends: [js.configs.recommended, tseslint.configs.disableTypeChecked] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: repoRoot } },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions': ['.ts'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: path.join(repoRoot, 'tsconfig.json'),
          // `imports` keys in package.json resolve through these conditions; without them zones fail open (TSN-15).
          conditionNames: ['import', 'node', 'default'],
        }),
      ],
    },
    rules: {
      ...unitLimits,
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder] }],
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums, ...noRawStatusCodes],
      'import-x/no-cycle': 'error',
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      'import-x/no-restricted-paths': ['error', { basePath: repoRoot, zones: contractsZones }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: false }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
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
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder], paths: noEffectImports }],
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums, ...noRawStatusCodes, ...noClockInCore],
    },
  },
  {
    // IMP-1 exception: the one wrapper reaches the vendored library below it with a relative path (DR-102); no alias is needed
    // because nothing else may import the vendored folder. The effect-module restriction stays.
    files: ['lib/yaml.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: noEffectImports }] },
  },
  {
    // Tests write wire values and long describe blocks on purpose; the other size and boundary rules stay on.
    files: ['**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums],
    },
  },
  {
    // TSN-13, CMT-5, CMT-6, CMT-12, CMT-13: TSDoc on every exported declaration and public member.
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts'],
    plugins: { jsdoc, tsdoc, 'local-docs': localDocs },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'tsdoc/syntax': 'error',
      'local-docs/specific-summary': ['error', { minWords: 3 }],
      'local-docs/implementation-summary': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          checkGetters: true,
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSMethodSignature',
            'TSPropertySignature',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
      'jsdoc/informative-docs': 'error',
      'jsdoc/require-param': ['error', { checkDestructured: false, contexts: notInheriting }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/require-returns': ['error', { forceReturnsWithAsync: true, checkGetters: false, contexts: notInheriting }],
      'jsdoc/require-returns-description': 'error',
    },
  },
  prettier,
);
