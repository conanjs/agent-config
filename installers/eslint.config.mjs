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
  noRelativeOutsideFolder,
  restrictedSyntax,
  testBlock,
  typeScriptBlock,
} from '../eslint/baseline.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

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
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: [...layerZones, ...moduleZones, ...tierZones] },
      ],
    },
  }),
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
      'no-restricted-syntax': restrictedSyntax(...noRawStatusCodes, ...noClockInCore),
    },
  },
  testBlock(['core/**/*.test.ts']),
  docsBlock({ files: ['core/**/*.ts'], members: true }),
  prettier,
);
