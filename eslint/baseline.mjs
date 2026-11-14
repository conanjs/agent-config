// The typescript-node lint baseline shared by the TypeScript tiers (specs/022): contracts/, installers/ and scripts/
// each import the constants and the blocks below, then add what is theirs alone (import zones, purity rules, clock rules).
// Rule ids: TSN-13, TSN-16 to TSN-20, CS-2, CMT-5, CMT-6, CMT-12, CMT-13, IMP-1 (stacks/typescript-node/idioms.md).
// Changing a rule here changes it for every tier; prove a refactor of this file with `eslint --print-config` on one file per
// tier before and after.
import path from 'node:path';
import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import localDocs from './local-docs.mjs';

// Constitution, "Agentic SDLC: defaults": at most 50 lines and complexity 10 per unit (CS-2).
export const unitLimits = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: false, skipComments: false }],
};

// require-param / require-returns skip a method that implements an interface member and links it
// (`{@link Port.member}`): the editor shows the port's @param and @returns there (CMT-12, TSN-13).
const implementing = 'ClassDeclaration[implements.length>0] > ClassBody > MethodDefinition > FunctionExpression';
export const notInheriting = [
  { context: 'ArrowFunctionExpression' },
  { context: 'FunctionDeclaration' },
  { context: `FunctionExpression:not(${implementing})` },
  {
    context: implementing,
    comment: 'JsdocBlock:not(:has(JsdocInlineTag[tag="link"][namepathOrURL=/\\./]))',
  },
];

// IMP-1, TSN-16: a relative path may name only a file in the importing file's own folder.
export const noRelativeOutsideFolder = {
  regex: '^(\\.\\./|\\./[^/]+/)',
  message: "Use a # alias import outside the file's own folder (IMP-1)",
};

// TSN-18: spread into every block that sets no-restricted-syntax (a later block's options replace earlier ones).
export const noReExports = [
  { selector: 'ExportAllDeclaration', message: 'No re-exports: import the declaring file (TSN-18)' },
  { selector: 'ExportNamedDeclaration[source]', message: 'No re-exports: import the declaring file (TSN-18)' },
];
// TSN-20: no TypeScript enum (Node type stripping rejects it).
export const noEnums = [
  { selector: 'TSEnumDeclaration', message: 'No enum: use an as-const object or a literal union (TSN-20)' },
];
// TSN-19: a status code is a named constant, never a bare number. The tiers have no HTTP layer, so this is a guard.
const statusLiteral = 'Literal[value>=100][value<=599]';
const comparison = 'BinaryExpression[operator=/^([=!]==?|[<>]=?)$/]';
export const noRawStatusCodes = [
  `CallExpression[callee.property.name=/^(status|sendStatus)$/] > ${statusLiteral}`,
  `${comparison}:matches([left.name=/status$/i], [left.property.name=/status$/i]) > ${statusLiteral}.right`,
  `${comparison}:matches([right.name=/status$/i], [right.property.name=/status$/i]) > ${statusLiteral}.left`,
].map((selector) => ({ selector, message: 'Use a named status constant, not a bare status number (TSN-19)' }));

// PDM-functional-pipeline-R2: a pure rule gets the time from outside; `message` says from where.
export const noClock = (message) => [
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message },
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message },
];

// PDM-functional-pipeline-R2: the modules that do I/O are not importable in pure code; `message` says where the I/O goes.
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
export const noEffectImports = (message) => effectModules.map((name) => ({ name, message }));

/**
 * The `no-restricted-syntax` setting every tier uses: no re-exports, no enums, and the extra selectors given.
 *
 * @param {...object} more - further selector objects, for example `noRawStatusCodes` entries
 * @returns {Array} the rule setting
 */
export const restrictedSyntax = (...more) => ['error', ...noReExports, ...noEnums, ...more];

/** The rules of the type-checked block, which a tier extends with its own. */
export const baseRules = {
  ...unitLimits,
  'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder] }],
  'no-restricted-syntax': restrictedSyntax(...noRawStatusCodes),
  'import-x/no-cycle': 'error',
  'import-x/extensions': ['error', 'always', { ignorePackages: true }],
  '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: false }],
  '@typescript-eslint/consistent-type-imports': 'error',
};

/** The block that applies to every `.mjs` file of a tier: JavaScript recommended, no type information. */
export const mjsBlock = { files: ['**/*.mjs'], extends: [js.configs.recommended, tseslint.configs.disableTypeChecked] };

/**
 * The type-checked TypeScript block of a tier.
 *
 * @param {object} options - the block's settings
 * @param {string[]} options.files - the globs the block covers
 * @param {string} options.repoRoot - the repository root, where tsconfig.json lives
 * @param {object} [options.rules] - rules that replace or add to `baseRules`
 * @returns {object} a flat-config block
 */
export function typeScriptBlock({ files, repoRoot, rules = {} }) {
  return {
    files,
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
    rules: { ...baseRules, ...rules },
  };
}

/**
 * Tests write wire values and long describe blocks on purpose; the other size and boundary rules stay on.
 *
 * @param {string[]} files - the test-file globs of the tier
 * @returns {object} a flat-config block
 */
export const testBlock = (files) => ({
  files,
  rules: { 'max-lines-per-function': 'off', 'no-restricted-syntax': restrictedSyntax() },
});

/**
 * TSN-13, CMT-5, CMT-6, CMT-12, CMT-13: TSDoc on every exported declaration.
 *
 * @param {object} options - the block's settings
 * @param {string[]} options.files - the globs the block covers (test files are always left out)
 * @param {boolean} options.members - true to also require docs on classes and methods and to relax inherited members
 * @returns {object} a flat-config block
 */
export function docsBlock({ files, members }) {
  const contexts = [
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    ...(members ? ['TSMethodSignature'] : []),
    'TSPropertySignature',
    'ExportNamedDeclaration > VariableDeclaration',
  ];
  return {
    files,
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
          require: members
            ? { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true }
            : { FunctionDeclaration: true },
          ...(members ? { checkGetters: true } : {}),
          contexts,
        },
      ],
      'jsdoc/informative-docs': 'error',
      'jsdoc/require-param': [
        'error',
        members ? { checkDestructured: false, contexts: notInheriting } : { checkDestructured: false },
      ],
      'jsdoc/require-param-description': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/require-returns': [
        'error',
        ...(members ? [{ forceReturnsWithAsync: true, checkGetters: false, contexts: notInheriting }] : []),
      ],
      'jsdoc/require-returns-description': 'error',
    },
  };
}
