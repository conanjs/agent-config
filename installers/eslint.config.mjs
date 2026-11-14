// @ts-check
// Lint for the installer tier (specs/022, T040): the typescript-node stack's lint baseline plus the
// functional-pipeline@1 rules (PDM-installers-core) and the module boundaries of docs/architecture.md §4.
// Built from stacks/typescript-node/idioms.md (TSN-13, TSN-16 to TSN-20, "Module-boundary lint configuration").
// Differences from the class-modeled example (tools/workflow-graph): no class-only rules; aliases are `package.json`
// `imports` keys (`#...ts`); the zones are written for the installer's fixed module list instead of read from disk.
// ESLint reads this file for every file below installers/ (it looks in the file's own folder, then its parents).
// Legacy .mjs tools stay exempt from the baseline (constitution, "style deviations"), so no block here names them.
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
// TSN-19: a status code is a named constant, never a bare number. The installer has no HTTP layer, so this is a guard.
const statusLiteral = 'Literal[value>=100][value<=599]';
const comparison = 'BinaryExpression[operator=/^([=!]==?|[<>]=?)$/]';
const noRawStatusCodes = [
  `CallExpression[callee.property.name=/^(status|sendStatus)$/] > ${statusLiteral}`,
  `${comparison}:matches([left.name=/status$/i], [left.property.name=/status$/i]) > ${statusLiteral}.right`,
  `${comparison}:matches([right.name=/status$/i], [right.property.name=/status$/i]) > ${statusLiteral}.left`,
].map((selector) => ({ selector, message: 'Use a named status constant, not a bare status number (TSN-19)' }));
// PDM-functional-pipeline-R2, CA-7: the core reads the clock through the Clock port.
const noClockInCore = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Read the time through the Clock port (PDM-functional-pipeline-R2)',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Read the time through the Clock port (PDM-functional-pipeline-R2)',
  },
];

// PDM-functional-pipeline-R2, DR-305: domain and application reach the file system, network, processes and
// terminal only through ports, so the modules that do I/O are not importable there.
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
  message: 'Effects belong to infrastructure behind a port (PDM-functional-pipeline-R2, DR-305)',
}));

// FF-1, TSN-17: modules and their public folders, as docs/architecture.md §4 lists them.
const mayDependOn = {
  manifests: ['shared'],
  sources: ['manifests', 'shared'],
  resolution: ['manifests', 'shared'],
  variables: ['shared'],
  rendering: ['manifests', 'variables', 'shared'],
  wiring: ['manifests', 'shared'],
  state: ['shared'],
  commands: ['manifests', 'sources', 'resolution', 'variables', 'rendering', 'wiring', 'state', 'shared'],
  shared: [],
};
const publicFolders = { commands: ['interface'], shared: ['domain', 'application'] };
const modules = Object.keys(mayDependOn);
const modulesRoot = './core/src/modules';

// Layers inside every module (globs end in /**, or the zone fails open), then the composition-root rules (MOD-11).
const layerZones = [
  {
    target: `${modulesRoot}/*/domain/**`,
    from: [`${modulesRoot}/*/application/**`, `${modulesRoot}/*/infrastructure/**`, `${modulesRoot}/*/interface/**`],
  },
  {
    target: `${modulesRoot}/*/application/**`,
    from: [`${modulesRoot}/*/infrastructure/**`, `${modulesRoot}/*/interface/**`],
  },
  { target: `${modulesRoot}/*/infrastructure/**`, from: [`${modulesRoot}/*/interface/**`] },
  {
    target: `${modulesRoot}/*/interface/**`,
    from: [`${modulesRoot}/*/domain/**`, `${modulesRoot}/*/infrastructure/**`],
  },
  {
    target: ['./core/src/!(CompositionRoot).ts', `${modulesRoot}/**`],
    from: ['./core/src/CompositionRoot.ts', './core/main.ts'],
    message: 'Only the composition root imports adapters and composers (MOD-11)',
  },
  {
    target: './core/main.ts',
    from: modulesRoot,
    message: 'The entry imports only the composition root (MOD-11)',
  },
  {
    target: `${modulesRoot}/*/*Module.ts`,
    from: `${modulesRoot}/*/infrastructure/**`,
    message: 'A module composer receives adapters from the composition root (MOD-11)',
  },
  {
    target: `${modulesRoot}/*/@(domain|application|infrastructure|interface)/**`,
    from: `${modulesRoot}/*/*Module.ts`,
    message: 'Only the composition root imports a module composer (MOD-11)',
  },
];

// MOD-3: a module imports another only through the other's public folders, and only the ones it may depend on.
const moduleZones = modules.flatMap((target) =>
  modules
    .filter((from) => from !== target)
    .map((from) =>
      (mayDependOn[target] ?? []).includes(from)
        ? {
            target: `${modulesRoot}/${target}`,
            from: `${modulesRoot}/${from}`,
            except: (publicFolders[from] ?? ['application']).map((folder) => `./${folder}`),
            message: `${target} may import only ${from}/${(publicFolders[from] ?? ['application']).join(' and ')} (MOD-3)`,
          }
        : {
            target: `${modulesRoot}/${target}`,
            from: `${modulesRoot}/${from}`,
            message: `${target} may not depend on ${from} (MOD-3)`,
          },
    ),
);

// DR-302: the installer reads components only through their component.yaml, never through their folders, and
// nothing in the tier depends on the checks that depend on it.
const tierZones = [
  {
    target: './core',
    from: [
      '../scripts',
      '../tests',
      '../copilot',
      '../claude',
      '../codex',
      '../skills',
      '../templates',
      '../home',
      '../adapters',
      '../agents',
      './legacy',
    ],
    message: 'The installer core does not import legacy folders or checks (DR-302)',
  },
];

export default defineConfig(
  { ignores: ['**/node_modules/', '**/vendor/'] },
  { files: ['**/*.mjs'], extends: [js.configs.recommended, tseslint.configs.disableTypeChecked] },
  {
    files: ['core/**/*.ts'],
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
      'no-console': 'error',
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder] }],
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums, ...noRawStatusCodes],
      'import-x/no-cycle': 'error',
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: [...layerZones, ...moduleZones, ...tierZones] },
      ],
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: false }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // PDM-functional-pipeline-R1, R2, R5: the pure core is immutable and does no I/O.
    files: ['core/src/modules/*/domain/**/*.ts', 'core/src/modules/*/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-param-reassign': ['error', { props: true }],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Reach the process through a port (PDM-functional-pipeline-R2)' },
        { name: 'fetch', message: 'Reach the network through a port (PDM-functional-pipeline-R2)' },
      ],
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder], paths: noEffectImports }],
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums, ...noRawStatusCodes, ...noClockInCore],
    },
  },
  {
    // Tests write wire values and long describe blocks on purpose; the other size and boundary rules stay on.
    files: ['core/**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-restricted-syntax': ['error', ...noReExports, ...noEnums],
    },
  },
  {
    // TSN-13, CMT-5, CMT-6, CMT-12, CMT-13: TSDoc on every exported declaration and public member.
    files: ['core/**/*.ts'],
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
