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
import prettier from 'eslint-config-prettier';
import {
  docsBlock,
  mjsBlock,
  noClock,
  noEffectImports,
  noRawStatusCodes,
  noRelativeOutsideFolder as baseRelativeOutsideFolder,
  restrictedSyntax,
  testBlock,
  typeScriptBlock,
} from '../eslint/baseline.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

// IMP-1 with one exception. installers/core has its own package.json, so its `#` aliases cannot reach the root alias
// `#contracts/*.ts` (Node refuses an `imports` target that leaves the package, tested on Node 24.22), and the installer runs
// from a clone with no installed package. So ONE file, shared/domain/name/NameRules.ts, names a file directly inside
// contracts/lib (value-problems.ts) by a relative path; every other file, and every other path that leaves a file's folder
// (`contracts/lib/../x.ts`, `contracts/lib/sub/x.ts` included), needs an alias.
const noRelativeOutsideFolder = {
  ...baseRelativeOutsideFolder,
  message: "Use a # alias import outside the file's own folder (IMP-1)",
};
const contractsLibException = {
  regex: baseRelativeOutsideFolder.regex.replace(
    '^(\\.\\./',
    '^(\\.\\./(?!(?:\\.\\./)*contracts/lib/[a-z0-9-]+\\.ts$)',
  ),
  message:
    "Use a # alias import outside the file's own folder; only NameRules.ts names a file of contracts/lib relatively (IMP-1, DR-304)",
};
const nameRulesFile = 'core/src/modules/shared/domain/name/NameRules.ts';

// No clean-up code may run when the process ends, so a killed run and a finished run leave the same files (DR-202; the test
// entry's kill faults rely on it): no exit or beforeExit listener anywhere below installers/, and process.exit only in main.ts.
// Not caught (a text rule cannot see them): a computed `process['exit']`, an event name held in a variable
// (`process.on(name, ...)`), and `globalThis.process`. Review looks for those.
const exitListener =
  "CallExpression[callee.object.name='process'][callee.property.name=/^(on|once|addListener|prependListener|prependOnceListener)$/]";
const exitEvent = /^(exit|beforeExit)$/.source;
const noExitHooks = [
  {
    selector: `${exitListener}:matches([arguments.0.value=/${exitEvent}/], [arguments.0.quasis.0.value.raw=/${exitEvent}/])`,
    message: 'No exit or beforeExit listener: a killed run must leave no clean-up behind (DR-202)',
  },
];
const noProcessExit = [
  {
    selector: "MemberExpression[object.name='process'][property.name=/^(exit|reallyExit)$/]",
    message: 'Set process.exitCode and return; process.exit is only for main.ts',
  },
];

// Everything the installer prints goes through one interface file, which escapes and redacts it first (M-07, M-11). T138 and
// T142 write that file at the path below; the composition root builds the `io` that runCli takes from it, and main.ts gets none
// of the streams directly. The git adapter of T133 pipes git's standard error and prints it only through MG-32.cause.
const presenterFile = 'core/src/modules/commands/interface/ConsolePresenter.ts';
const outputMessage = `Print through the presenter, which redacts and escapes first (M-07, M-11): only installers/${presenterFile} reaches a stream`;
// Every way to reach fd 1 or 2 that a text rule can see: the stream properties, named or namespace imports of them, any computed
// access to process or to the global object, `globalThis.process`, process passed or stored as a value (so it can be
// destructured), a write to a literal fd 1 or 2, and a child process that inherits the streams.
const outputSelectors = [
  "MemberExpression[object.name='process'][property.name=/^(stdout|stderr)$/]",
  "MemberExpression[object.name='process'][computed=true]",
  'MemberExpression[object.name=/^(globalThis|global|window|self)$/][computed=true]',
  "MemberExpression[object.name=/^(globalThis|global)$/][property.name='process']",
  'ImportDeclaration[source.value=/^(node:)?process$/]:has(ImportSpecifier[imported.name=/^(stdout|stderr)$/])',
  'ImportDeclaration[source.value=/^(node:)?process$/] > ImportNamespaceSpecifier',
  "Identifier[name='process']:not(MemberExpression > Identifier.object):not(ImportDefaultSpecifier > Identifier.local):not(MemberExpression > Identifier.property):not(Property > Identifier.key)",
  "CallExpression[callee.property.name=/^(writeSync|write)$/][arguments.0.type='Literal'][arguments.0.raw=/^[12]$/]",
  "CallExpression[callee.name=/^(writeSync|write)$/][arguments.0.type='Literal'][arguments.0.raw=/^[12]$/]",
  'Property[key.name=/^(stdio|stdout|stderr)$/] Literal[raw=/^(1|2|\'inherit\'|"inherit")$/]',
];
const noProcessOutput = outputSelectors.map((selector) => ({ selector, message: outputMessage }));

// M-05, DR-609: the git adapter's two test seams. `extraEnvironment` adds GIT_CONFIG_* names to git's environment and `hooksPath`
// replaces the empty hooks path; a production caller giving either could undo the adapter's protections. Only the test entry
// (outside this config, under the tests folder) and unit tests may give them, so an object property with either
// name is refused everywhere else in the core.
const noTestSeams = [
  {
    selector:
      'Property[key.name=/^(extraEnvironment|hooksPath)$/], Property[key.value=/^(extraEnvironment|hooksPath)$/]',
    message: 'Only the test entry and unit tests give the git adapter extraEnvironment or hooksPath (M-05, DR-609)',
  },
];

// PDM-functional-pipeline-R2, CA-7: the core reads the clock through the Clock port.
const noClockInCore = noClock('Read the time through the Clock port (PDM-functional-pipeline-R2)');

// PDM-functional-pipeline-R2, DR-305: domain and application reach the file system, network, processes and
// terminal only through ports, so the modules that do I/O are not importable there.
const noEffects = noEffectImports(
  'Effects belong to infrastructure behind a port (PDM-functional-pipeline-R2, DR-305)',
);

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
  mjsBlock,
  typeScriptBlock({
    files: ['core/**/*.ts'],
    repoRoot,
    rules: {
      'no-console': 'error',
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder] }],
      'no-restricted-syntax': restrictedSyntax(
        ...noRawStatusCodes,
        ...noExitHooks,
        ...noProcessExit,
        ...noProcessOutput,
        ...noTestSeams,
      ),
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: [...layerZones, ...moduleZones, ...tierZones] },
      ],
    },
  }),
  {
    // The entry may end the process itself; it still may not listen for the end.
    files: ['core/main.ts'],
    rules: {
      'no-restricted-syntax': restrictedSyntax(...noRawStatusCodes, ...noExitHooks, ...noProcessOutput, ...noTestSeams),
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
      'no-restricted-imports': ['error', { patterns: [noRelativeOutsideFolder], paths: noEffects }],
      'no-restricted-syntax': restrictedSyntax(
        ...noRawStatusCodes,
        ...noClockInCore,
        ...noExitHooks,
        ...noProcessExit,
        ...noProcessOutput,
        ...noTestSeams,
      ),
    },
  },
  {
    // The one file of the core that names contracts/lib relatively (see the exception above); it is pure like the rest of domain.
    files: [nameRulesFile],
    rules: { 'no-restricted-imports': ['error', { patterns: [contractsLibException], paths: noEffects }] },
  },
  {
    // The presenter is the only file that may write to a stream; the exit rules still apply to it.
    files: [presenterFile],
    rules: {
      'no-restricted-syntax': restrictedSyntax(...noRawStatusCodes, ...noExitHooks, ...noProcessExit, ...noTestSeams),
    },
  },
  testBlock(['core/**/*.test.ts']),
  {
    files: ['core/**/*.test.ts'],
    rules: { 'no-restricted-syntax': restrictedSyntax(...noExitHooks, ...noProcessExit, ...noProcessOutput) },
  },
  docsBlock({ files: ['core/**/*.ts'], members: true }),
  prettier,
);
