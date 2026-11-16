// A stand-in installer for tests/installer-world: it reads the test settings the way the real test entry will, and drives
// small ports through the fault adapter, so each piece of the installer world is observed from outside (specs/022 T117, T118).
// Commands: env | report | now | terminal <question>... | node-version | clone <source> <destination> | faults |
//           write <file>... | link <name>... | link-read <name> | link-kind <kind> <name>... | fetch <component>... | switch <count> | switch-composed <count> | commit | seam-scan <folder>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createFaultInjector, InjectedFault, parseFaults } from '../support/fault-adapters.ts';
import type { GitRequest, LinkKind, PortSpec } from '../support/fault-adapters.ts';
import { readTestSettings, reportedGitVersion, reportedNodeVersion } from '../support/installer-test-settings.ts';
import { findSeamLeaks, formatSeamLeaks } from '../support/seam-guard.ts';

const [command = '', ...args] = process.argv.slice(2);
const home = process.env['HOME'] ?? '';
const out = path.join(home, 'out');
const say = (line: string): void => void console.log(line);
const stamp = (d: Date): string => d.toISOString().slice(0, 19).replace(/\D/g, '');

// Stand-in ports with the method names of the contract in fault-adapters.ts, restricted to what a stand-in needs.
interface StandInFileSystem {
  makeDirectory(dir: string): void;
  writeFile(file: string, text: string): void;
  rename(from: string, to: string): void;
  readFile(file: string): string;
}
interface StandInLinks {
  createLink(name: string, target: string, kind: LinkKind): void;
  removeLink(name: string): void;
  switchLink(name: string, target: string, kind: LinkKind): void;
  readLink(name: string): string;
}
interface StandInGit {
  clone(request: GitRequest): Promise<void>;
  revParse(folder: string): Promise<string>;
}
const fileSystemSpec: PortSpec<StandInFileSystem> = { classes: { write: ['writeFile', 'makeDirectory', 'rename'] }, unfaulted: ['readFile'] };
const linksSpec: PortSpec<StandInLinks> = {
  classes: { create: ['createLink', 'switchLink'], remove: ['removeLink'], switch: ['switchLink'] },
  unfaulted: ['readLink'],
};
const gitSpec: PortSpec<StandInGit> = { async: true, classes: { fetch: ['clone'] }, unfaulted: ['revParse'] };

function ports(injector: ReturnType<typeof createFaultInjector>) {
  const linkFile = (name: string): string => path.join(out, `${name}.link`);
  const fileSystem: StandInFileSystem = {
    makeDirectory: (dir) => void fs.mkdirSync(dir, { recursive: true }),
    writeFile: (file, text) => fs.writeFileSync(file, text),
    rename: (from, to) => fs.renameSync(from, to),
    readFile: (file) => fs.readFileSync(file, 'utf8'),
  };
  // A link is a small file holding its target, so the stand-in runs the same on a Windows account that cannot create symlinks.
  const links: StandInLinks = {
    createLink: (name, target) => fs.writeFileSync(linkFile(name), target),
    removeLink: (name) => fs.rmSync(linkFile(name), { force: true }),
    switchLink: (name, target) => fs.writeFileSync(path.join(out, `switch-${name}`), target),
    readLink: (name) => fs.readFileSync(linkFile(name), 'utf8'),
  };
  const git: StandInGit = {
    clone: (request) => Promise.resolve(void execFileSync('git', ['clone', '-q', '--', request.url, request.dest], { stdio: 'pipe' })),
    revParse: (folder) => Promise.resolve(execFileSync('git', ['-C', folder, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()),
  };
  return {
    fileSystem: injector.wrap('fileSystem', fileSystem, fileSystemSpec),
    links: injector.wrap('links', links, linksSpec),
    git: injector.wrap('git', git, gitSpec),
  };
}

async function settingsCommand(settings: ReturnType<typeof readTestSettings>): Promise<number | undefined> {
  switch (command) {
    case 'env':
      say(`home=${home}`);
      say(`agent-config-home=${process.env['AGENT_CONFIG_HOME'] ?? ''}`);
      say(`terminal=${settings.terminal.interactive ? 'attached' : 'absent'}`);
      say(`faults=${settings.faults.length}`);
      return 0;
    case 'now':
      say(`now=${settings.now.toISOString()}`);
      say(`stamp=${stamp(settings.now)}`);
      return 0;
    case 'report':
      say(`Backed up to ${stamp(settings.now)} at ${settings.now.toISOString()}`);
      return 0;
    case 'terminal':
      say(`interactive=${settings.terminal.interactive}`);
      for (const question of args) say(`${question} -> ${await settings.terminal.ask(question)}`);
      return 0;
    case 'git-version':
      say(`git=${reportedGitVersion(settings)}`);
      return 0;
    case 'node-version':
      say(`node=${reportedNodeVersion(settings)}`);
      return 0;
    default:
      return undefined;
  }
}

async function run(): Promise<number> {
  const settings = readTestSettings();
  const done = await settingsCommand(settings);
  if (done !== undefined) return done;
  const all = ports(createFaultInjector(settings.faults));
  const { git } = all;
  switch (command) {
    case 'clone':
      await git.clone({ component: path.basename(args[0] ?? '', '.git'), url: args[0] ?? '', dest: args[1] ?? '' });
      say(`cloned ${await git.revParse(args[1] ?? '')}`);
      return 0;
    case 'faults':
      return faults();
    case 'seam-scan':
      return seamScan();
    default:
      return faulted(all);
  }
}

function faults(): number {
  for (const fault of parseFaults(args.join(','))) say(JSON.stringify(fault));
  return 0;
}

function seamScan(): number {
  const lines = formatSeamLeaks(findSeamLeaks(path.dirname(home), [args[0] ?? '.']));
  for (const line of lines) say(line);
  if (lines.length === 0) say('no leaks');
  return lines.length === 0 ? 0 : 1;
}

type Ports = ReturnType<typeof ports>;

function linkCommand(links: Ports['links']): number | undefined {
  switch (command) {
    case 'link':
      return each(args, (name) => links.createLink(name, 'target', 'symlink'));
    case 'link-kind':
      return each(args.slice(1), (name) => links.createLink(name, 'target', args[0] === 'junction' ? 'junction' : 'symlink'));
    case 'switch-composed':
      return each(count(), (name) => {
        links.removeLink(name);
        links.createLink(name, 'target', 'junction');
      });
    case 'link-read':
      say(`read ${links.readLink(args[0] ?? '')}`);
      return 0;
    case 'switch':
      return each(count(), (name) => links.switchLink(name, 'target', 'symlink'));
    default:
      return undefined;
  }
}

function fileCommand(fileSystem: Ports['fileSystem']): number | undefined {
  switch (command) {
    case 'write':
      return each(args, (file) => fileSystem.writeFile(path.join(out, file), 'x'));
    case 'commit':
      return each(['install-state.json'], () => {
        fileSystem.writeFile(path.join(out, 'install-state.json.tmp'), '{}');
        fileSystem.rename(path.join(out, 'install-state.json.tmp'), path.join(out, 'install-state.json'));
      });
    default:
      return undefined;
  }
}

async function fetchAll(git: Ports['git']): Promise<number> {
  let failed = 0;
  for (const component of args) {
    try {
      await git.clone({ component, url: path.join(path.dirname(home), 'git-sources', `${component}.git`), dest: path.join(out, component) });
      say(`${component}: fetched`);
    } catch (error) {
      failed += 1;
      say(`${component}: failed: ${describe(error)}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function faulted({ fileSystem, links, git }: Ports): Promise<number> {
  fs.mkdirSync(out, { recursive: true });
  if (command === 'fetch') return fetchAll(git);
  const done = fileCommand(fileSystem) ?? linkCommand(links);
  if (done !== undefined) return done;
  console.error(`unknown command "${command}"`);
  return 2;
}

const count = (): string[] => Array.from({ length: Number(args[0]) }, (_, i) => String(i + 1));

/** Runs `step` for each name, stopping at the first failure like an installer that does not go on after an error. */
function each(names: string[], step: (name: string) => void): number {
  for (const name of names) {
    try {
      step(name);
      say(`${name}: done`);
    } catch (error) {
      say(`${name}: failed: ${describe(error)}`);
      return 1;
    }
  }
  return 0;
}

function describe(error: unknown): string {
  if (error instanceof InjectedFault) return `${error.code} injected`;
  return error instanceof Error ? error.message : String(error);
}

try {
  process.exitCode = await run();
} catch (error) {
  console.error(describe(error));
  process.exitCode = 1;
}
