// @ts-check
// Lint for the workflow-graph tool (specs/019): the typescript-node stack with the class-modeled@1 overlay.
// Adapted from the stack reference's eslint.config.mjs (stacks/typescript-node/reference.md), with three changes:
// aliases are package.json `imports` (`#src/…`) because Node's type stripping ignores tsconfig paths; no HTTP
// status-code rule (no HTTP layer); the reference's own local-docs plugin is not copied.
import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

// IMP-1, TSN-16: a relative path may name only a file in the importing file's own folder.
const noRelativeOutsideFolder = {
  regex: '^(\\.\\./|\\./[^/]+/)',
  message: 'Use a #src/ import outside the file\'s own folder (IMP-1)',
};

// PDM-class-modeled-R7: free functions only in these Tier B files (plan.md, Module layout).
const tierB = ['src/main.ts', 'src/CompositionRoot.ts', 'src/modules/shared/domain/Result.ts'];

const noReExports = [
  { selector: 'ExportAllDeclaration', message: 'No re-exports: import the declaring file (TSN-18)' },
  { selector: 'ExportNamedDeclaration[source]', message: 'No re-exports: import the declaring file (TSN-18)' },
];
const noEnums = [{ selector: 'TSEnumDeclaration', message: 'No enum: use an as-const object or a literal union (TSN-20)' }];
const noParameterProperties = [
  {
    selector: 'TSParameterProperty',
    message: 'Node type stripping rejects parameter properties: use a readonly #field set in the constructor (research.md D15)',
  },
];
const noFreeFunctions = [
  'Program > FunctionDeclaration',
  'Program > ExportNamedDeclaration > FunctionDeclaration',
  'Program > ExportDefaultDeclaration > FunctionDeclaration',
  "Program > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
  "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
].map((selector) => ({ selector, message: 'Tier A code is a class (PDM-class-modeled-R7)' }));
const domainState = [
  { selector: "PropertyDefinition[accessibility='private']", message: 'Domain state uses readonly #fields (PDM-class-modeled-R1)' },
  { selector: 'PropertyDefinition:not([readonly=true])', message: 'Domain state is readonly (PDM-class-modeled-R1)' },
];

const modules = readdirSync('src/modules', { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'shared')
  .map((d) => d.name);

// FF-1, TSN-17: layer direction inside every module; adapters reachable only from the composition root (R9).
const layerZones = [
  {
    target: './src/modules/*/domain/**',
    from: ['./src/modules/*/application/**', './src/modules/*/infrastructure/**', './src/modules/*/interface/**'],
  },
  { target: './src/modules/*/application/**', from: ['./src/modules/*/infrastructure/**', './src/modules/*/interface/**'] },
  { target: './src/modules/*/infrastructure/**', from: ['./src/modules/*/interface/**'] },
  { target: './src/modules/*/interface/**', from: ['./src/modules/*/infrastructure/**'] },
  { target: ['./src/!(CompositionRoot|main).ts', './src/modules/**'], from: ['./src/CompositionRoot.ts', './src/main.ts'] },
];

// MOD-3: coding-agents may use workflow's public surface (application/, not its ports); workflow never names an agent.
const mayDependOn = { 'coding-agents': ['workflow'] };
const moduleZones = [
  ...modules.flatMap((target) =>
    modules
      .filter((from) => from !== target)
      .flatMap((from) =>
        (mayDependOn[target] ?? []).includes(from)
          ? [
              { target: `./src/modules/${target}`, from: `./src/modules/${from}`, except: ['./application', './domain'], message: `${target} may import only ${from}/application and its value types (MOD-3)` },
            ]
          : [{ target: `./src/modules/${target}`, from: `./src/modules/${from}`, message: `${target} may not depend on ${from} (MOD-3)` }],
      ),
  ),
  ...modules.map((from) => ({ target: './src/modules/shared', from: `./src/modules/${from}`, message: 'shared/ imports no feature module (MOD-4)' })),
];

export default tseslint.config(
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },
  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions': ['.ts'],
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: 'tsconfig.json' })],
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder] }],
      'import-x/no-cycle': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: false }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: { 'import-x/no-restricted-paths': ['error', { zones: [...layerZones, ...moduleZones] }] },
  },
  {
    files: ['src/**/*.ts'],
    ignores: [...tierB, 'src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noFreeFunctions, ...noReExports, ...noEnums, ...noParameterProperties] },
  },
  { files: tierB, rules: { 'no-restricted-syntax': ['error', ...noReExports, ...noEnums, ...noParameterProperties] } },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['src/**/*.test.ts', ...tierB],
    rules: {
      'no-restricted-syntax': ['error', ...noFreeFunctions, ...noReExports, ...domainState, ...noEnums, ...noParameterProperties],
    },
  },
  { files: ['src/**/*.test.ts'], rules: { 'no-restricted-syntax': ['error', ...noEnums, ...noParameterProperties] } },
  {
    // TSN-13, CMT-5: TSDoc on every exported declaration and public member.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    plugins: { jsdoc, tsdoc },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSMethodSignature'],
        },
      ],
      'jsdoc/informative-docs': 'error',
    },
  },
  prettier,
);
