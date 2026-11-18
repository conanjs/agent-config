// T138: the install and plan pipeline end to end on a throwaway machine. The real adapters of every module work on a temporary folder, a
// scripted terminal answers, and the scenarios of tests/installer-* that need the entry (T142) are covered here by their unit-level
// equivalents: one test per rule of the task, each asserting what the disk looks like afterwards.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { composeCommands } from '#commands/CommandsModule.ts';
import type { CommandResult, CommandServices } from '#commands/interface/CommandTypes.ts';
import { composeManifests } from '#manifests/ManifestsModule.ts';
import { createNodeManifestPorts } from '#manifests/infrastructure/NodeManifestPorts.ts';
import { composeRendering } from '#rendering/RenderingModule.ts';
import { nodePathProbe } from '#shared/infrastructure/nodePathProbe.ts';
import { composeSources } from '#sources/SourcesModule.ts';
import { createNodeGit } from '#sources/infrastructure/NodeGit.ts';
import { createNodeSourceDisk } from '#sources/infrastructure/NodeSourceDisk.ts';
import { composeState } from '#state/StateModule.ts';
import { createFixedClock } from '#state/infrastructure/memory/MemoryState.ts';
import { fileHomeLockStore } from '#state/infrastructure/FileHomeLockStore.ts';
import { nodeFileSystem } from '#state/infrastructure/NodeFileSystem.ts';
import { nodeLinks } from '#state/infrastructure/NodeLinks.ts';
import { composeVariables } from '#variables/VariablesModule.ts';
import { fileVariablesFileStore } from '#variables/infrastructure/FileVariablesFileStore.ts';
import { nodeDetectProbe } from '#variables/infrastructure/NodeDetectProbe.ts';
import { composeWiring } from '#wiring/WiringModule.ts';
import { nodeHookFiles } from '#wiring/infrastructure/NodeHookFiles.ts';
import { nodePathObserver } from '#wiring/infrastructure/NodePathObserver.ts';
import { createNodeDiskReader } from '#commands/infrastructure/NodeDiskReader.ts';
import { refuse, succeed } from '#shared/domain/result/Result.ts';

// ---- the throwaway machine ------------------------------------------------------------------------------------------

// Real git on a loaded machine (the full check runs the scenarios beside this file) needs more than the default five seconds.
vi.setConfig({ testTimeout: 60_000 });

const SLOTS_FILE = path.resolve(import.meta.dirname, '..', '..', '..', 'contracts', 'slots.yaml');
const NOW = '2026-11-20T09:14:03.000Z';

const CORE_MANIFEST = `schema: component/v1
name: agent-config
version: 2.0.0
slot: core
scope: global
contracts:
  pin: 1
locations:
  core: core
  instructions: instructions
  patterns: patterns
  procedures: procedures
  references: references
  atlas: atlas
  tracker: tracker
  agent-foundry: frameworks/agent-foundry
provides:
  contracts: [component/v1]
  index: index.md
  exports: []
`;

const NOTES_MANIFEST = (name: string, extra = ''): string => `schema: component/v1
name: ${name}
version: 1.0.0
slot: company-knowledge-storage
scope: global
contracts:
  pin: 1
locations:
  content: companies
provides:
  contracts: [company-kb/v1]
  index: index.md
  exports: []
${extra}`;

const KB_MANIFEST = `schema: component/v1
name: kb
version: 1.0.0
slot: knowledge-storage
scope: global
repository: https://github.com/example/kb
contracts:
  pin: 1
locations:
  content: knowledge
  framework: frameworks/knowledge
provides:
  contracts: [knowledge-provider/v1]
  index: index.md
  exports: [knowledge/a/b.md]
`;

const list = (local: boolean, entries: string): string =>
  `schema: components-list/v1\nlocal: ${String(local)}\ncomponents:${entries === '' ? ' []' : `\n${entries}`}\n`;

function writeTree(base: string, files: Readonly<Record<string, string>>): void {
  for (const [relative, text] of Object.entries(files)) {
    const target = path.join(base, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}

const yamlReader = (text: string) => {
  try {
    return { ok: true as const, value: parse(text) as unknown };
  } catch {
    return { ok: false as const, findings: [{ code: 'yaml', message: 'not YAML', line: undefined }] };
  }
};

interface Machine {
  readonly root: string;
  readonly userHome: string;
  readonly home: string;
  readonly repo: string;
  readonly clock: ReturnType<typeof createFixedClock>;
  readonly terminal: { interactive: boolean; answers: string[]; asked: string[] };
  readonly deniedLinks: { on: boolean };
  readonly commands: ReturnType<typeof composeCommands>;
  readonly services: CommandServices;
}

function makeMachine(): Machine {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ac-install-')));
  const userHome = path.join(root, 'home');
  const repo = path.join(root, 'repo');
  const home = path.join(userHome, '.agent-config');
  for (const folder of ['.claude', '.copilot', '.codex'])
    fs.mkdirSync(path.join(userHome, folder), { recursive: true });
  writeTree(repo, {
    'component.yaml': CORE_MANIFEST,
    'index.md': '# agent-config\n',
    'components.yaml': list(false, ''),
    'contracts/slots.yaml': fs.readFileSync(SLOTS_FILE, 'utf8'),
    ...Object.fromEntries(
      [
        'core',
        'instructions',
        'patterns',
        'procedures',
        'references',
        'atlas',
        'tracker',
        'frameworks/agent-foundry',
      ].map((folder) => [`${folder}/index.md`, `# ${folder}\n`]),
    ),
    'instructions/core.instructions.md': '# core instructions\n',
  });
  const clock = createFixedClock(NOW);
  const terminal = { interactive: false, answers: [] as string[], asked: [] as string[] };
  const deniedLinks = { on: false };
  const policy = { allowedProtocols: ['https', 'ssh', 'file'] } as const;
  const links = {
    ...nodeLinks,
    createLink: (...args: Parameters<typeof nodeLinks.createLink>) => {
      if (deniedLinks.on) throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
      nodeLinks.createLink(...args);
    },
  };
  const forHome = (folder: string): CommandServices['forHome'] extends (home: string) => infer R ? R : never => {
    const state = composeState({
      fs: nodeFileSystem,
      links,
      probe: nodePathProbe,
      clock,
      flavor: 'posix',
      home: folder,
      backups: path.join(userHome, '.agent-config-backups'),
      roots: ['.claude', '.copilot', '.codex'].map((name) => path.join(userHome, name)),
      lock: fileHomeLockStore(path.join(folder, 'install.lock')),
    });
    const variables = composeVariables({
      store: fileVariablesFileStore(path.join(folder, 'variables.local.yaml')),
      readYaml: yamlReader,
      detectProbe: nodeDetectProbe(process.env),
      pathProbe: nodePathProbe,
      userHome,
      flavor: 'posix',
    });
    const rendering = composeRendering({
      writer: {
        write(relativePath, text) {
          const target = path.join(folder, ...relativePath.split('/'));
          const written = state.writeFile(target, text);
          return written.ok ? succeed({ path: target }) : refuse(written.error);
        },
      },
    });
    return { state, variables, rendering };
  };
  const services: CommandServices = {
    manifests: composeManifests({ ports: createNodeManifestPorts(), flavor: 'posix', gitPolicy: policy }),
    sources: composeSources({
      // https://example.invalid/<name>.git stands for the local bare repository root/git-sources/<name>.git (the way the scenarios do it).
      git: createNodeGit({
        policy,
        environment: { PATH: process.env['PATH'], HOME: userHome },
        extraEnvironment: {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: `url.${root}/git-sources/.insteadOf`,
          GIT_CONFIG_VALUE_0: 'https://example.invalid/',
        },
      }),
      disk: createNodeSourceDisk(),
      gitPolicy: policy,
      flavor: 'posix',
    }),
    wiring: composeWiring({
      observer: nodePathObserver,
      hookFiles: nodeHookFiles(userHome, 'posix'),
      readYaml: yamlReader,
    }),
    environment: {
      flavor: 'posix',
      userHome,
      configuredHome: undefined,
      repoRoot: repo,
      processId: 4242,
      installer: { version: '0.2.0', commit: 'abc1234' },
    },
    terminal: {
      get interactive() {
        return terminal.interactive;
      },
      ask: (question) => {
        terminal.asked.push(question);
        const answer = terminal.answers.shift();
        return answer === undefined ? Promise.reject(new Error('no answer scripted')) : Promise.resolve(answer);
      },
    },
    runtime: { nodeVersion: () => 'v24.22.1', gitVersionText: () => 'git version 2.50.1' },
    disk: createNodeDiskReader(nodePathProbe, nodePathObserver, 'posix'),
    clock,
    forHome,
  };
  return { root, userHome, home, repo, clock, terminal, deniedLinks, commands: composeCommands(services), services };
}

let machine: Machine;
beforeEach(() => {
  machine = makeMachine();
});
afterEach(() => {
  fs.rmSync(machine.root, { recursive: true, force: true });
});

const textOf = (result: CommandResult): string => result.text.join('\n');
const seed = (relative: string, text: string): void => writeTree(machine.root, { [relative]: text });
const target = (link: string): string | undefined => {
  try {
    return fs.readlinkSync(link);
  } catch {
    return undefined;
  }
};
const noUpdate = { kind: 'none' } as const;

function addNotes(...names: string[]): void {
  for (const name of names) {
    seed(`sources/${name}/component.yaml`, NOTES_MANIFEST(name));
    seed(`sources/${name}/index.md`, `# ${name}\n`);
    seed(`sources/${name}/companies/${name}/index.md`, `# ${name}\n\nNotes of ${name}.\n`);
  }
  const entries = names.map(
    (name) => `  - { name: ${name}, source: { type: path, path: ${machine.root}/sources/${name} } }`,
  );
  seed('home/.agent-config/components.local.yaml', list(true, entries.join('\n')));
}

function confirmAndInstall(): Promise<CommandResult> {
  machine.terminal.interactive = true;
  machine.terminal.answers = ['yes'];
  return machine.commands.install(noUpdate);
}

describe('the home (AC-2.1, AC-2.4, AC-4.7)', () => {
  it('states the default home, asks V to confirm, exits 10 and writes nothing when no terminal is attached', async () => {
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(10);
    expect(result.text).toEqual([
      `agent home: ${machine.home} (default, not confirmed)`,
      'status: needs-input',
      `1. home: ${machine.home}`,
      '   confirm the agent home',
      '   satisfy: install (interactive) and answer yes',
      '   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted',
    ]);
    expect(fs.existsSync(machine.home)).toBe(false);
    expect(machine.terminal.asked).toEqual([]);
  });

  it('accepts only the answer yes at an interactive terminal and installs', async () => {
    machine.terminal.interactive = true;
    machine.terminal.answers = ['maybe'];
    const refused = await machine.commands.install(noUpdate);
    expect(refused.report.exit).toBe(10);
    expect(textOf(refused)).not.toContain('an interactive terminal is needed');
    expect(fs.existsSync(machine.home)).toBe(false);
    machine.terminal.answers = [' YES '];
    const accepted = await machine.commands.install(noUpdate);
    expect(accepted.report.exit).toBe(0);
    expect(accepted.text[0]).toBe(`agent home: ${machine.home} (default, confirmed)`);
    expect(machine.terminal.asked.at(-1)).toBe(`use ${machine.home} as the agent home? (yes/no)`);
    expect(readState().home).toBe(machine.home);
  });

  it('states a moved home with the recorded one and asks nothing of plan', async () => {
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const moved = path.join(machine.root, 'elsewhere');
    const services = { ...machine.services, environment: { ...machine.services.environment, configuredHome: moved } };
    const result = await composeCommands(services).plan();
    expect(result.report.exit).toBe(10);
    expect(result.text.slice(0, 4)).toEqual([
      `agent home: ${moved} (AGENT_CONFIG_HOME, not confirmed; recorded home: ${machine.home})`,
      'status: needs-input',
      `1. home: ${moved}`,
      `   confirm moving the agent home from ${machine.home} to ${moved}`,
    ]);
    expect(fs.existsSync(moved)).toBe(false);
  });
});

// The log and the fetch cache change on every run, by design; what a failed run must keep is the rest of the home.
const withoutLog = (lines: readonly string[]): string[] =>
  lines.filter((line) => !line.startsWith('install-log') && !line.startsWith('components/'));

interface StateJson {
  home: string;
  installer: unknown;
  last_run: unknown;
  approved_privileged_hash: string;
  components: Record<string, string>;
  entries: { path: string; class: string; kind: string; hash: string; component: string }[];
}
interface LockJson {
  components: Record<string, { resolved: { commit: string; live?: boolean; path?: string } }>;
}
const readState = (): StateJson =>
  JSON.parse(fs.readFileSync(path.join(machine.home, 'install-state.json'), 'utf8')) as StateJson;
const readLock = (): LockJson =>
  JSON.parse(fs.readFileSync(path.join(machine.home, 'components.lock'), 'utf8')) as LockJson;

function listing(folder: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) found.push(`${path.relative(folder, full)} -> ${fs.readlinkSync(full)}`);
      else if (stat.isDirectory()) {
        found.push(`${path.relative(folder, full)}/`);
        walk(full);
      } else found.push(`${path.relative(folder, full)} ${stat.mtimeMs}`);
    }
  };
  walk(folder);
  return found;
}

describe('a first install (AC-3.1, AC-3.2, FR-015, VR-1)', () => {
  it('links every location of core and of each component, and the generated variables file', async () => {
    addNotes('notes', 'extras');
    const result = await confirmAndInstall();
    expect(result.text).toEqual([
      `agent home: ${machine.home} (default, confirmed)`,
      'status: done',
      `component notes: path ${machine.root}/sources/notes (live)`,
      `component extras: path ${machine.root}/sources/extras (live)`,
    ]);
    const { home, repo, root } = machine;
    expect(target(path.join(home, 'core'))).toBe(path.join(repo, 'core'));
    expect(target(path.join(home, 'frameworks', 'agent-foundry'))).toBe(path.join(repo, 'frameworks', 'agent-foundry'));
    expect(target(path.join(home, 'companies', 'notes'))).toBe(
      path.join(root, 'sources', 'notes', 'companies', 'notes'),
    );
    expect(fs.lstatSync(path.join(home, 'companies')).isDirectory()).toBe(true);
    expect(target(path.join(home, 'global-variables.md'))).toBe(path.join(home, 'generated', 'global-variables.md'));
    expect(fs.readFileSync(path.join(home, 'companies', 'extras', 'index.md'), 'utf8')).toContain('extras');
    expect(fs.readFileSync(path.join(home, 'generated', 'global-variables.md'), 'utf8')).toContain('| AGENT_HOME |');
    expect(fs.existsSync(path.join(home, 'generated', 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'install-state.pending.json'))).toBe(false);
    expect(fs.existsSync(path.join(home, 'install.lock'))).toBe(false);
  });

  it('records every placed path in install-state.json, the lock, and one line of the log', async () => {
    addNotes('notes');
    await confirmAndInstall();
    const state = readState();
    expect(state.home).toBe(machine.home);
    expect(state.installer).toEqual({ version: '0.2.0', commit: 'abc1234' });
    expect(state.last_run).toEqual({ time: NOW, command: 'install', exit: 0 });
    expect(state.components).toEqual({ 'agent-config': 'live', notes: 'live' });
    const paths = state.entries.map((entry) => entry.path);
    expect(paths).toContain(path.join(machine.home, 'core'));
    expect(paths).toContain(path.join(machine.home, 'companies', 'notes'));
    expect(paths).toContain(path.join(machine.home, 'global-variables.md'));
    expect(paths).toContain(path.join(machine.home, 'generated', 'global-variables.md'));
    const variablesEntry = state.entries.find((entry) => entry.path.endsWith('generated/global-variables.md'));
    expect(variablesEntry).toMatchObject({ class: 'generated', kind: 'file', component: 'core' });
    expect(variablesEntry?.hash).toMatch(/^[0-9a-f]{64}$/);
    const lock = readLock();
    expect(lock.components['notes']?.resolved).toEqual({ live: true, path: `${machine.root}/sources/notes` });
    const log = fs.readFileSync(path.join(machine.home, 'install-log.jsonl'), 'utf8').trim().split('\n');
    expect(log).toHaveLength(1);
    expect(JSON.parse(log[0] ?? '')).toMatchObject({ command: 'install', exit: 0, time: NOW });
  });

  it('AC-7.1, AC-16.7 a second install reports no changes and rewrites no file', async () => {
    addNotes('notes', 'extras');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const files = ['install-state.json', 'components.lock', 'generated/global-variables.md', 'generated/index.md'];
    const before = files.map((file) => fs.statSync(path.join(machine.home, file)).mtimeMs);
    fs.utimesSync(path.join(machine.home, 'generated', 'global-variables.md'), 1000, 1000);
    for (const file of ['install-state.json', 'components.lock', 'generated/index.md']) {
      fs.utimesSync(path.join(machine.home, file), 1000, 1000);
    }
    const second = await machine.commands.install(noUpdate);
    expect(second.text).toEqual([`agent home: ${machine.home} (recorded, confirmed)`, 'status: no-changes']);
    expect(second.report.exit).toBe(0);
    for (const file of files) expect(fs.statSync(path.join(machine.home, file)).mtimeMs).toBe(1_000_000);
    expect(before.every((time) => time > 1_000_000)).toBe(true);
    expect(fs.existsSync(path.join(machine.root, 'home', '.agent-config-backups'))).toBe(false);
  });
});

const KB_FILES: Readonly<Record<string, string>> = {
  'component.yaml': KB_MANIFEST,
  'index.md': '# kb\n',
  'knowledge/index.md': '# kb knowledge\n',
  'knowledge/a/b.md': 'b\n',
  'frameworks/knowledge/index.md': '# knowledge framework\n',
};

const SDLC_MANIFEST = (extra = '', variables = 'variables: []'): string => `schema: component/v1
name: sdlc-x
version: 1.0.0
slot: framework
scope: per-project
contracts:
  pin: 1
locations:
  framework: .
provides:
  contracts: [framework/v1]
  index: index.md
  exports: []
depends:
  slots:
    - slot: knowledge-storage
      contract: knowledge-provider/v1
      required: true
      docs: [knowledge/a/b.md]
${extra}routes: []
hooks: []
${variables}
`;

function addKb(): void {
  writeTree(path.join(machine.root, 'sources', 'kb'), KB_FILES);
}

function addSdlc(extra = '', variables = 'variables: []', hooks = ''): void {
  const manifest = SDLC_MANIFEST(extra, variables).replace('hooks: []\n', hooks === '' ? 'hooks: []\n' : hooks);
  writeTree(path.join(machine.root, 'sources', 'sdlc-x'), {
    'component.yaml': manifest,
    'index.md': '# sdlc-x\n',
    'docs/guide.md':
      'See [{{AGENT_HOME}}/knowledge/a/b.md](https://github.com/example/kb/blob/main/knowledge/a/b.md).\n',
  });
}

function listLocal(...names: string[]): void {
  const entries = names.map(
    (name) => `  - { name: ${name}, source: { type: path, path: ${machine.root}/sources/${name} } }`,
  );
  seed('home/.agent-config/components.local.yaml', list(true, entries.join('\n')));
}

async function confirmedHome(): Promise<void> {
  fs.mkdirSync(machine.home, { recursive: true });
  const first = await confirmAndInstall();
  expect(first.report.exit).toBe(0);
  machine.terminal.interactive = false;
}

describe('plan (AC-7.4, TR-4)', () => {
  it('on a first run reports the home need and writes nothing', async () => {
    const result = await machine.commands.plan();
    expect(result.report.exit).toBe(10);
    expect(fs.existsSync(machine.home)).toBe(false);
  });

  it('lists what install would change, writes nothing, and lists exactly what install then changes', async () => {
    await confirmedHome();
    addNotes('notes', 'extras');
    const before = listing(machine.home);
    const plan = await machine.commands.plan();
    expect(plan.report.exit).toBe(0);
    expect(plan.report.status).toBe('done');
    expect(listing(machine.home)).toEqual(before);
    const planned = plan.report.changes.filter((change) => change.op === 'link').map((change) => change.path);
    expect(plan.text).toContain(`would link: ${path.join(machine.home, 'companies', 'notes')}`);
    const applied = await machine.commands.install(noUpdate);
    expect(applied.report.exit).toBe(0);
    expect(applied.report.changes.map((change) => change.path)).toEqual(
      plan.report.changes.map((change) => change.path),
    );
    for (const link of planned) expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });

  it('on an installed home with nothing to change reports no changes', async () => {
    await confirmedHome();
    const result = await machine.commands.plan();
    expect(result.text).toEqual([`agent home: ${machine.home} (recorded, confirmed)`, 'status: no-changes']);
  });

  it('shows the override of a public entry by a local one (MG-20)', async () => {
    await confirmedHome();
    addNotes('notes');
    seed('sources/notes-public/component.yaml', NOTES_MANIFEST('notes'));
    seed('sources/notes-public/index.md', '# notes\n');
    seed('sources/notes-public/companies/notes/index.md', '# notes\n');
    seed(
      'repo/components.yaml',
      list(false, `  - { name: notes, source: { type: path, path: ${machine.root}/sources/notes-public } }`),
    );
    const result = await machine.commands.plan();
    expect(result.text).toContain(
      `override: notes: local source ${machine.root}/sources/notes replaces public source ${machine.root}/sources/notes-public`,
    );
  });
});

describe('the needs report (AC-4.1, AC-4.2, AC-4.3, AC-4.5)', () => {
  it('reports components before variables, in one report, and changes nothing', async () => {
    await confirmedHome();
    addSdlc(
      '',
      'variables:\n  - name: SDLC_LANGUAGE\n    description: Language the agents write documents in\n    required: true',
    );
    listLocal('sdlc-x');
    const before = listing(machine.home);
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(10);
    expect(result.text).toEqual([
      `agent home: ${machine.home} (recorded, confirmed)`,
      'status: needs-input',
      '1. components: slot knowledge-storage',
      '   contract knowledge-provider/v1, no provider',
      '   satisfy: add <name> <source>',
      '2. variables: SDLC_LANGUAGE',
      '   Language the agents write documents in (declared by sdlc-x)',
      '   satisfy: set SDLC_LANGUAGE=<value>',
    ]);
    expect(result.report.needs.map((need) => need.kind)).toEqual(['components', 'variables']);
    expect(listing(machine.home)).toEqual(before);
  });

  it('shows a suggested source as data labelled unverified, never as a command', async () => {
    await confirmedHome();
    addSdlc('      suggest:\n        source: { type: git, url: https://example.invalid/kb-g.git, ref: main }\n');
    listLocal('sdlc-x');
    const result = await machine.commands.install(noUpdate);
    expect(result.text).toContain('   suggested by sdlc-x, unverified: https://example.invalid/kb-g.git');
    expect(result.text.filter((line) => line.includes('add kb-g') || line.includes('add https'))).toEqual([]);
    expect(result.report.needs[0]?.suggested).toEqual({
      by: 'sdlc-x',
      verified: false,
      source: 'https://example.invalid/kb-g.git',
    });
    expect(fs.existsSync(path.join(machine.home, 'components'))).toBe(false);
  });

  it('installs once the slot is filled and the variable has a value, and renders the value', async () => {
    await confirmedHome();
    addKb();
    addSdlc(
      '',
      'variables:\n  - name: SDLC_LANGUAGE\n    description: Language the agents write documents in\n    required: true',
    );
    listLocal('kb', 'sdlc-x');
    expect((await machine.commands.install(noUpdate)).report.needs.map((need) => need.item)).toEqual(['SDLC_LANGUAGE']);
    seed('home/.agent-config/variables.local.yaml', 'schema: variables-local/v1\nvalues:\n  SDLC_LANGUAGE: English\n');
    const done = await machine.commands.install(noUpdate);
    expect(done.report.exit).toBe(0);
    const table = fs.readFileSync(path.join(machine.home, 'generated', 'global-variables.md'), 'utf8');
    expect(table).toContain('| SDLC_LANGUAGE | English |');
    expect(fs.existsSync(path.join(machine.home, 'knowledge', 'a', 'b.md'))).toBe(true);
    expect(fs.existsSync(path.join(machine.home, 'frameworks', 'sdlc-x', 'index.md'))).toBe(true);
  });

  it('AC-5.6 fails when a component cites a doc its provider does not export, naming the file', async () => {
    await confirmedHome();
    addKb();
    addSdlc();
    seed('sources/sdlc-x/docs/guide.md', 'See [{{AGENT_HOME}}/knowledge/a/c.md](https://x.invalid/c.md).\n');
    listLocal('kb', 'sdlc-x');
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain('error: sdlc-x: docs/guide.md cites knowledge/a/c.md, which kb does not export');
  });
});

const HOOK = (command: string): string =>
  `hooks:\n  - id: guard\n    event: pre-tool\n    agents: [claude-code]\n    command: ${command}\n    matcher: null\n`;

describe('privileged changes (AC-4.6, AC-4.7, M-01, M-11)', () => {
  function withHook(command: string): void {
    addKb();
    addSdlc('', 'variables: []', HOOK(command));
    listLocal('kb', 'sdlc-x');
  }

  it('lists a new hook in full with its component and commit, writes nothing, and says a terminal is needed', async () => {
    await confirmedHome();
    withHook('node {{AGENT_HOME}}/core/tools/guard.mjs');
    const before = listing(machine.home);
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(10);
    expect(result.text).toEqual([
      `agent home: ${machine.home} (recorded, confirmed)`,
      'status: needs-input',
      '1. privileged: hook guard (claude-code, pre-tool)',
      '   node {{AGENT_HOME}}/core/tools/guard.mjs',
      '   matcher: all tools',
      '   component: sdlc-x, commit: live',
      '   satisfy: install (interactive) and approve',
      '   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted',
    ]);
    expect(result.report.needs[0]).toMatchObject({
      kind: 'privileged',
      component: 'sdlc-x',
      commit: 'live',
      terminal: 'needed',
    });
    expect(listing(machine.home)).toEqual(before);
  });

  it('approving at a terminal installs and records the hash, so the same set needs no second approval', async () => {
    await confirmedHome();
    withHook('node {{AGENT_HOME}}/core/tools/guard.mjs');
    machine.terminal.interactive = true;
    machine.terminal.answers = ['yes'];
    const approved = await machine.commands.install(noUpdate);
    expect(approved.report.exit).toBe(0);
    expect(machine.terminal.asked.at(-1)).toBe('approve these privileged changes? (yes/no)');
    const state = readState();
    expect(state.approved_privileged_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.entries.map((entry) => entry.path)).toContain('privileged:hook:sdlc-x:guard');
    const asked = machine.terminal.asked.length;
    machine.terminal.interactive = false;
    const again = await machine.commands.install(noUpdate);
    expect(again.text.at(-1)).toBe('status: no-changes');
    expect(machine.terminal.asked).toHaveLength(asked);
  });

  it('a hook changed after approval is a new need again, and no answers other than yes approve', async () => {
    await confirmedHome();
    withHook('node {{AGENT_HOME}}/core/tools/guard.mjs');
    machine.terminal.interactive = true;
    machine.terminal.answers = ['yes'];
    await machine.commands.install(noUpdate);
    addSdlc('', 'variables: []', HOOK('node {{AGENT_HOME}}/core/tools/other.mjs'));
    machine.terminal.answers = ['no'];
    const before = listing(machine.home);
    const refused = await machine.commands.install(noUpdate);
    expect(refused.report.exit).toBe(10);
    expect(refused.text).not.toContain(
      '   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted',
    );
    expect(listing(machine.home).filter((line) => !line.startsWith('install-log'))).toEqual(
      before.filter((line) => !line.startsWith('install-log')),
    );
  });

  it('refuses a hook command with credential-like text instead of showing it redacted', async () => {
    await confirmedHome();
    withHook('curl https://user:hunter2@example.invalid/x');
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(textOf(result)).not.toContain('hunter2');
    expect(textOf(result)).toContain('credential-like text in a privileged entry');
  });
});

describe('a failed run changes nothing (AC-7.2, FR-026, M-02)', () => {
  const read = (file: string): string => fs.readFileSync(path.join(machine.home, file), 'utf8');

  it('a failed export check keeps the previous links, the lock and the state', async () => {
    addNotes('notes');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const lockBefore = read('components.lock');
    const stateBefore = read('install-state.json');
    const linksBefore = listing(machine.home);
    seed(
      'sources/notes/component.yaml',
      NOTES_MANIFEST('notes')
        .replace('exports: []', 'exports: [companies/missing.md]')
        .replace('scope: global', 'scope: global\nrepository: https://github.com/example/notes'),
    );
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: check failed: exports: notes: exported path companies/missing.md does not exist',
    );
    expect(read('components.lock')).toBe(lockBefore);
    expect(read('install-state.json')).toBe(stateBefore);
    expect(withoutLog(listing(machine.home))).toEqual(withoutLog(linksBefore));
  });

  it('a manifest of an installed component that is no longer valid fails the check and keeps the links', async () => {
    addNotes('notes');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    seed(
      'sources/notes/component.yaml',
      NOTES_MANIFEST('notes').replace('schema: component/v1', 'schema: component/v9'),
    );
    const linksBefore = listing(machine.home);
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: check failed: schema: notes: component.yaml is not a valid component/v1 manifest',
    );
    expect(withoutLog(listing(machine.home))).toEqual(withoutLog(linksBefore));
  });

  it('a manifest of a component never installed is skipped with a warning and the others install', async () => {
    addNotes('notes');
    seed('sources/odd/readme.md', 'no manifest\n');
    listLocal('notes', 'odd');
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(0);
    expect(result.text).toContain(
      `warning: component odd is skipped: no component.yaml in ${machine.root}/sources/odd`,
    );
    expect(fs.existsSync(path.join(machine.home, 'companies', 'notes'))).toBe(true);
  });

  it('a path source whose folder is gone exits 1 naming it and leaves the earlier links', async () => {
    addNotes('notes');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    fs.rmSync(path.join(machine.root, 'sources', 'notes'), { recursive: true });
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      `error: component notes: path source folder ${machine.root}/sources/notes does not exist`,
    );
    expect(target(path.join(machine.home, 'core'))).toBe(path.join(machine.repo, 'core'));
  });

  it('EDGE-3 an account that cannot create links exits 1 naming the cause and leaves nothing behind', async () => {
    addNotes('notes');
    fs.mkdirSync(machine.home, { recursive: true });
    machine.deniedLinks.on = true;
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain('error: install failed: cannot create links');
    for (const name of [
      'install-state.json',
      'components.lock',
      'store',
      'companies',
      'core',
      'install-state.pending.json',
    ]) {
      expect(fs.existsSync(path.join(machine.home, name))).toBe(false);
    }
  });

  it('a link that fails halfway puts the earlier links back, and writes neither the lock nor the state', async () => {
    addNotes('notes');
    fs.mkdirSync(machine.home, { recursive: true });
    const real = machine.services.forHome;
    let placed = 0;
    const flaky: CommandServices = {
      ...machine.services,
      forHome: (folder) => {
        const services = real(folder);
        return {
          ...services,
          state: {
            ...services.state,
            switchLinks: (journal, roots) => {
              const result = services.state.switchLinks(
                { ...journal, operations: journal.operations.slice(0, 3) },
                roots,
              );
              placed = result.ok ? result.value.length : 0;
              throw new Error('EIO: the disk failed after three links');
            },
          },
        };
      },
    };
    machine.terminal.interactive = true;
    machine.terminal.answers = ['yes'];
    const result = await composeCommands(flaky).install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(placed).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(machine.home, 'install-state.json'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'components.lock'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'install-state.pending.json'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'core'))).toBe(false);
  });
});

describe('an interrupted run (EDGE-4, DR-202)', () => {
  it('the next install restores from the journal, says so, and completes', async () => {
    addNotes('notes');
    fs.mkdirSync(machine.home, { recursive: true });
    const real = machine.services.forHome;
    // A killed process cannot clean up: this run's restore does nothing and its switch stops after two operations, as a kill would.
    const killed: CommandServices = {
      ...machine.services,
      forHome: (folder) => {
        const services = real(folder);
        return {
          ...services,
          state: {
            ...services.state,
            restoreFromJournal: () => ({ ok: true, value: { interrupted: false, discarded: false } }),
            switchLinks: (journal, roots) => {
              services.state.switchLinks({ ...journal, operations: journal.operations.slice(0, 4) }, roots);
              throw new Error('killed');
            },
          },
        };
      },
    };
    machine.terminal.interactive = true;
    machine.terminal.answers = ['yes'];
    const first = await composeCommands(killed).install(noUpdate);
    expect(first.report.exit).toBe(1);
    expect(fs.existsSync(path.join(machine.home, 'install-state.pending.json'))).toBe(true);
    expect(fs.existsSync(path.join(machine.home, 'install-state.json'))).toBe(false);
    machine.terminal.interactive = true;
    machine.terminal.answers = ['yes'];
    const second = await machine.commands.install(noUpdate);
    expect(second.report.exit).toBe(0);
    expect(second.text).toContain(
      `warning: interrupted-install: ${path.join(machine.home, 'install-state.pending.json')}: restored to the previous state`,
    );
    expect(fs.existsSync(path.join(machine.home, 'install-state.pending.json'))).toBe(false);
    expect(target(path.join(machine.home, 'core'))).toBe(path.join(machine.repo, 'core'));
    expect(fs.existsSync(path.join(machine.home, 'companies', 'notes'))).toBe(true);
  });
});

describe('the lock (M-12, EDGE-15)', () => {
  it('names a held lock, says what a killed run leaves behind, and exits 1', async () => {
    await confirmedHome();
    fs.writeFileSync(
      path.join(machine.home, 'install.lock'),
      `${JSON.stringify({ command: 'install', pid: 99, started: '2026-11-20T09:10:00.000Z' })}\n`,
    );
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      `error: another run holds the lock ${path.join(machine.home, 'install.lock')} (install, started 2026-11-20T09:10:00.000Z)`,
    );
    expect(result.text).toContain(
      '   a run that was killed leaves this file behind: wait until it is 10 minutes old, or delete it when no other run is active',
    );
  });

  it('takes over a lock older than ten minutes', async () => {
    await confirmedHome();
    fs.writeFileSync(
      path.join(machine.home, 'install.lock'),
      `${JSON.stringify({ command: 'install', pid: 99, started: '2026-11-20T08:50:00.000Z' })}\n`,
    );
    fs.utimesSync(path.join(machine.home, 'install.lock'), 1000, 1000);
    expect((await machine.commands.install(noUpdate)).report.exit).toBe(0);
    expect(fs.existsSync(path.join(machine.home, 'install.lock'))).toBe(false);
  });

  it('removes the lock at the end of every run, also a failing one', async () => {
    addNotes('notes');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    seed('sources/notes/component.yaml', 'not yaml: [');
    expect((await machine.commands.install(noUpdate)).report.exit).toBe(1);
    expect(fs.existsSync(path.join(machine.home, 'install.lock'))).toBe(false);
  });
});

// ---- git sources, against local bare repositories ---------------------------------------------------------------------

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull } },
  ).trim();
}

interface GitSource {
  readonly url: string;
  readonly bare: string;
  head(): string;
  commit(files: Readonly<Record<string, string>>): string;
}

function makeGitSource(name: string, files: Readonly<Record<string, string>>): GitSource {
  const bare = path.join(machine.root, 'git-sources', `${name}.git`);
  const work = path.join(machine.root, 'git-work', name);
  fs.mkdirSync(bare, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  git(bare, 'init', '-q', '--bare', '--initial-branch=main');
  git(work, 'init', '-q', '--initial-branch=main');
  const commit = (changes: Readonly<Record<string, string>>): string => {
    writeTree(work, changes);
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'change');
    git(work, 'push', '-q', bare, 'main');
    return git(work, 'rev-parse', 'HEAD');
  };
  commit(files);
  return { url: `https://example.invalid/${name}.git`, bare, head: () => git(work, 'rev-parse', 'HEAD'), commit };
}

const GIT_NOTES = (version = '1.0.0'): Record<string, string> => ({
  'component.yaml': NOTES_MANIFEST('gitnotes').replace('version: 1.0.0', `version: ${version}`),
  'index.md': '# gitnotes\n',
  'companies/gitnotes/index.md': 'first version\n',
});

function listPublic(entries: string): void {
  seed('repo/components.yaml', list(false, entries));
}

const gitEntry = (url: string): string => `  - { name: gitnotes, source: { type: git, url: ${url}, ref: main } }`;
const readLink = (file: string): string => fs.readFileSync(file, 'utf8');
const storeTrees = (): string[] => fs.readdirSync(path.join(machine.home, 'store')).sort();
const lockCommit = (): string => readLock().components['gitnotes']?.resolved.commit ?? '';

describe('git sources (AC-3.1, AC-3.4, AC-3.9, AC-7.2, M-02, EDGE-6, EDGE-9)', () => {
  it('clones at the commit the ref names, copies the tree into the store without .git, locks the commit and links the entry', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(0);
    expect(result.text).toContain(`component gitnotes: git ${source.url} main at ${source.head().slice(0, 12)}`);
    expect(lockCommit()).toBe(source.head());
    const [tree] = storeTrees();
    expect(tree).toMatch(/^gitnotes@[0-9a-f]{12}$/);
    expect(fs.existsSync(path.join(machine.home, 'store', tree ?? '', '.git'))).toBe(false);
    expect(target(path.join(machine.home, 'companies', 'gitnotes'))).toBe(
      path.join(machine.home, 'store', tree ?? '', 'companies', 'gitnotes'),
    );
    expect(readLink(path.join(machine.home, 'companies', 'gitnotes', 'index.md'))).toBe('first version\n');
    expect(fs.existsSync(path.join(machine.home, 'components', 'gitnotes', '.git'))).toBe(true);
  });

  it('a plain install never moves a source to a newer commit, and with nothing else changed prints no component line', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const noted = lockCommit();
    source.commit({ 'companies/gitnotes/index.md': 'second version\n' });
    const again = await machine.commands.install(noUpdate);
    expect(again.text).toEqual([`agent home: ${machine.home} (recorded, confirmed)`, 'status: no-changes']);
    expect(lockCommit()).toBe(noted);
    expect(readLink(path.join(machine.home, 'companies', 'gitnotes', 'index.md'))).toBe('first version\n');
  });

  it('install --update advances the named source, prints the range, switches the link and keeps the previous tree', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const noted = lockCommit();
    const second = source.commit({ 'companies/gitnotes/index.md': 'second version\n' });
    const result = await machine.commands.install({ kind: 'named', names: ['gitnotes'] });
    expect(result.report.exit).toBe(0);
    expect(result.text).toContain(`updated gitnotes: ${noted.slice(0, 12)}..${second.slice(0, 12)}`);
    expect(lockCommit()).toBe(second);
    expect(readLink(path.join(machine.home, 'companies', 'gitnotes', 'index.md'))).toBe('second version\n');
    expect(storeTrees()).toHaveLength(2);
  });

  it('an update whose new commit fails the schema check stays on the commit it had', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const noted = lockCommit();
    source.commit({ 'component.yaml': 'schema: component/v9\n' });
    const trees = storeTrees();
    const result = await machine.commands.install({ kind: 'all' });
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: check failed: schema: gitnotes: component.yaml is not a valid component/v1 manifest',
    );
    expect(lockCommit()).toBe(noted);
    expect(storeTrees()).toEqual(trees);
    expect(readLink(path.join(machine.home, 'companies', 'gitnotes', 'index.md'))).toBe('first version\n');
    const later = await machine.commands.install(noUpdate);
    expect(later.report.exit).toBe(0);
  });

  it('a source that cannot be fetched exits 1 naming it and the cause, and keeps the previous link', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    fs.rmSync(source.bare, { recursive: true });
    const result = await machine.commands.install({ kind: 'all' });
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(`error: component gitnotes: cannot fetch git source ${source.url} (ref main)`);
    expect(result.text.some((line) => line.startsWith('   cause: '))).toBe(true);
    expect(readLink(path.join(machine.home, 'companies', 'gitnotes', 'index.md'))).toBe('first version\n');
  });

  it('with the source gone, a plain rerun that needs no fetch still succeeds (EDGE-9)', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    fs.rmSync(source.bare, { recursive: true });
    const result = await machine.commands.install(noUpdate);
    expect(result.text).toEqual([`agent home: ${machine.home} (recorded, confirmed)`, 'status: no-changes']);
  });

  it('DR-418 a source with no previous version that cannot be fetched is left out, the others install, and the run exits 1', async () => {
    addNotes('notes');
    listPublic(gitEntry('https://example.invalid/missing.git'));
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(1);
    expect(result.report.status).toBe('failed');
    expect(result.text).toContain(
      'error: component gitnotes: cannot fetch git source https://example.invalid/missing.git (ref main)',
    );
    expect(fs.existsSync(path.join(machine.home, 'companies', 'gitnotes'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'companies', 'notes'))).toBe(true);
    const lock = readLock();
    expect(Object.keys(lock.components)).toEqual(['notes']);
  });

  it('DR-418 one component fails its schema and goes back; the other component new version switches in the same run', async () => {
    const files = (name: string, text: string): Record<string, string> => ({
      'component.yaml': NOTES_MANIFEST(name),
      'index.md': `# ${name}\n`,
      [`companies/${name}/index.md`]: text,
    });
    const good = makeGitSource('gitgood', files('gitgood', 'good one\n'));
    const bad = makeGitSource('gitbad', files('gitbad', 'bad one\n'));
    listPublic(
      `${gitEntry(good.url).replace('gitnotes', 'gitgood')}\n${gitEntry(bad.url).replace('gitnotes', 'gitbad')}`,
    );
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const badBefore = path.join(machine.home, 'companies', 'gitbad');
    const badTarget = target(badBefore);
    good.commit({ 'companies/gitgood/index.md': 'good two\n' });
    bad.commit({ 'component.yaml': 'schema: component/v9\n' });
    const result = await machine.commands.install({ kind: 'all' });
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: check failed: schema: gitbad: component.yaml is not a valid component/v1 manifest',
    );
    expect(readLink(path.join(machine.home, 'companies', 'gitgood', 'index.md'))).toBe('good two\n');
    expect(target(badBefore)).toBe(badTarget);
    expect(readLink(path.join(badBefore, 'index.md'))).toBe('bad one\n');
    const lock = readLock();
    expect(lock.components['gitgood']?.resolved.commit).toBe(good.head());
    expect(lock.components['gitbad']?.resolved.commit).not.toBe(bad.head());
  });

  it('DR-418 a cross-check that fails only after a fallback is reported, and nothing is switched', async () => {
    const kb = makeGitSource('kb', KB_FILES);
    listPublic(`  - { name: kb, source: { type: git, url: ${kb.url}, ref: main } }`);
    addSdlc();
    listLocal('sdlc-x');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const before = withoutLog(listing(machine.home));
    kb.commit({
      'component.yaml': KB_MANIFEST.replace(
        'exports: [knowledge/a/b.md]',
        'exports: [knowledge/a/b.md, knowledge/a/c.md]',
      ),
    });
    seed('sources/sdlc-x/docs/guide.md', 'See [{{AGENT_HOME}}/knowledge/a/c.md](https://x.invalid/c.md).\n');
    const result = await machine.commands.install({ kind: 'all' });
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain('error: check failed: exports: kb: exported path knowledge/a/c.md does not exist');
    expect(result.text).toContain('error: sdlc-x: docs/guide.md cites knowledge/a/c.md, which kb does not export');
    expect(withoutLog(listing(machine.home))).toEqual(before);
  });

  it('EDGE-6 a git component that left the lists loses its links and its managed clone, not its remote', async () => {
    const source = makeGitSource('gitnotes', GIT_NOTES());
    listPublic(gitEntry(source.url));
    await confirmAndInstall();
    machine.terminal.interactive = false;
    listPublic('');
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(0);
    expect(fs.existsSync(path.join(machine.home, 'components', 'gitnotes'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'companies', 'gitnotes'))).toBe(false);
    expect(fs.existsSync(source.bare)).toBe(true);
  });
});

describe('what is replaced, removed or carried (AC-7.3, EDGE-1, EDGE-6, AC-8.1, AC-8.3)', () => {
  it('copies a real folder where a link goes to the backups folder first, and names the backup', async () => {
    addNotes('notes');
    seed('home/.agent-config/patterns/mine.md', 'mine\n');
    fs.mkdirSync(machine.home, { recursive: true });
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(0);
    const backup = path.join(machine.userHome, '.agent-config-backups', '20261120091403');
    expect(result.text).toContain(`backup: ${backup}`);
    expect(fs.readFileSync(path.join(backup, '1-patterns', 'mine.md'), 'utf8')).toBe('mine\n');
    expect(target(path.join(machine.home, 'patterns'))).toBe(path.join(machine.repo, 'patterns'));
    expect(result.report.backup).toBe(backup);
  });

  it('an install that replaces nothing makes no backup folder', async () => {
    addNotes('notes');
    const result = await confirmAndInstall();
    expect(fs.existsSync(path.join(machine.userHome, '.agent-config-backups'))).toBe(false);
    expect(result.text.some((line) => line.startsWith('backup:'))).toBe(false);
  });

  it('leaves files of other tools in the home alone', async () => {
    addNotes('notes');
    seed('home/.agent-config/my-notes.txt', 'not the installer\n');
    seed('home/.agent-config/scratch/draft.md', 'a draft\n');
    await confirmAndInstall();
    expect(fs.readFileSync(path.join(machine.home, 'my-notes.txt'), 'utf8')).toBe('not the installer\n');
    const state = fs.readFileSync(path.join(machine.home, 'install-state.json'), 'utf8');
    expect(state).not.toContain('my-notes.txt');
  });

  it('EDGE-6 a path component that left the lists loses its links and its folder is not touched', async () => {
    addNotes('notes', 'extras');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const sources = listing(path.join(machine.root, 'sources'));
    listLocal('notes');
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(0);
    expect(fs.existsSync(path.join(machine.home, 'companies', 'extras'))).toBe(false);
    expect(fs.existsSync(path.join(machine.home, 'companies', 'notes'))).toBe(true);
    expect(listing(path.join(machine.root, 'sources'))).toEqual(sources);
  });

  it('puts a compatibility link under Copilot only where its target is installed, and never over Copilot own folders', async () => {
    addKb();
    listLocal('kb');
    fs.mkdirSync(path.join(machine.userHome, '.copilot', 'instructions'), { recursive: true });
    await confirmAndInstall();
    const copilot = path.join(machine.userHome, '.copilot');
    expect(target(path.join(copilot, 'knowledge'))).toBe(path.join(machine.home, 'knowledge'));
    expect(target(path.join(copilot, 'instructions', 'core.instructions.md'))).toBe(
      path.join(machine.home, 'instructions', 'core.instructions.md'),
    );
    expect(fs.existsSync(path.join(copilot, 'companies'))).toBe(false);
    const state = readState();
    const compat = state.entries.filter((entry) => entry.class === 'compat');
    expect(compat.length).toBeGreaterThan(3);
  });

  it('removes a retired compatibility link that is the installers own, and says so', async () => {
    addKb();
    listLocal('kb');
    await confirmAndInstall();
    machine.terminal.interactive = false;
    const link = path.join(machine.userHome, '.copilot', 'knowledge');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    seed('repo/compat.yaml', `schema: compat-links/v1\nretired:\n  - "~/.${'copilot'}/knowledge"\n`);
    const result = await machine.commands.install(noUpdate);
    expect(result.text).toContain(`retired: ${link}`);
    expect(fs.existsSync(link)).toBe(false);
  });

  it('AC-6.1 a changed value rewrites the generated variables file after backing up the old one', async () => {
    addNotes('notes');
    seed(
      'sources/notes/component.yaml',
      NOTES_MANIFEST('notes').replace(
        'provides:',
        'variables:\n  - name: NOTES_ROOT\n    description: Folder of notes\nprovides:',
      ),
    );
    await confirmAndInstall();
    machine.terminal.interactive = false;
    expect(fs.readFileSync(path.join(machine.home, 'generated', 'global-variables.md'), 'utf8')).toContain('(not set)');
    seed('home/.agent-config/variables.local.yaml', 'schema: variables-local/v1\nvalues:\n  NOTES_ROOT: /notes\n');
    const result = await machine.commands.install(noUpdate);
    expect(result.report.exit).toBe(0);
    expect(fs.readFileSync(path.join(machine.home, 'generated', 'global-variables.md'), 'utf8')).toContain(
      '| NOTES_ROOT | /notes |',
    );
    expect(result.text.some((line) => line.startsWith('backup: '))).toBe(true);
  });

  it('M-08 a description with credential-like text is refused before anything is written, never printed', async () => {
    addNotes('notes');
    fs.mkdirSync(machine.home, { recursive: true });
    seed(
      'sources/notes/component.yaml',
      NOTES_MANIFEST('notes').replace(
        'provides:',
        'variables:\n  - name: NOTES_ROOT\n    description: use https://user:hunter2@example.invalid/x\nprovides:',
      ),
    );
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: component notes: variable NOTES_ROOT: the description contains credential-like text',
    );
    expect(textOf(result)).not.toContain('hunter2');
    expect(fs.existsSync(path.join(machine.home, 'install-state.json'))).toBe(false);
  });

  it('EDGE-10 two components that describe one variable differently fail the install naming both', async () => {
    addNotes('notes', 'extras');
    const declare = (description: string): string =>
      `variables:\n  - name: NOTES_ROOT\n    description: ${description}\nprovides:`;
    seed('sources/notes/component.yaml', NOTES_MANIFEST('notes').replace('provides:', declare('Folder of notes')));
    seed('sources/extras/component.yaml', NOTES_MANIFEST('extras').replace('provides:', declare('Folder with notes')));
    const result = await confirmAndInstall();
    expect(result.report.exit).toBe(1);
    expect(result.text).toContain(
      'error: check failed: variables: NOTES_ROOT: extras says "Folder with notes", notes says "Folder of notes"',
    );
    expect(fs.existsSync(path.join(machine.home, 'install-state.json'))).toBe(false);
  });
});
