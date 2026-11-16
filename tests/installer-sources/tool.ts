// How the installer scenarios of the component sources (specs/022 T120, Story 3) run the installer: the test entry
// tests/support/installer-test-main.ts (T142) through `installerRunner`, and the check of the local files
// (scripts/check-local-files.ts, T150) as a second tool.
//
// What this tool adds to the environment of the test entry (the entry and its Git adapter must honour both):
//   AGENT_CONFIG_TEST_REPO  the agent-config folder of the run, {root}/repo: components.yaml, component.yaml (core's manifest),
//                           contracts/slots.yaml.
//   GIT_CONFIG_COUNT=2 with url.{root}/git-sources/.insteadOf = https://example.invalid/ and protocol.file.allow = always:
//                           a list says `https://example.invalid/<name>.git` (the only form the list schema accepts, CL-3), and git
//                           reads the local bare repository {root}/git-sources/<name>.git that the World made. The test Git adapter
//                           must pass these variables on to git; the production adapter never does (M-05).
//   PATH                    {root}/bin first, where FR-034 puts fake package managers.
// Sources are named like their component, so the git source "agent-knowledge" is the bare repository of the component of that name.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { createGitSource, gitSourceHead, installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { gitSourcePath } from '../support/installer-test-settings.ts';
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner } from '../support/tools.ts';

const fixture = 'tests/installer-sources/fixtures/base';

registerTool('installer-sources', {
  fixture,
  run: (world: InstallerWorld, extra: string[]) => {
    const run = installerRunner('tests/support/installer-test-main.ts')(world, extra);
    const sources = world.at('git-sources').replaceAll('\\', '/');
    return {
      ...run,
      env: {
        ...run.env,
        AGENT_CONFIG_TEST_REPO: world.at('repo'),
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: `url.${sources}/.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://example.invalid/',
        GIT_CONFIG_KEY_1: 'protocol.file.allow',
        GIT_CONFIG_VALUE_1: 'always',
        PATH: `${world.at('bin')}${path.delimiter}${process.env['PATH'] ?? ''}`,
      },
    };
  },
  quietPass: '',
  codes: () => [],
});

registerTool('installer-local-files', {
  fixture,
  run: scriptRunner('scripts/check-local-files.ts'),
  quietPass: '',
  codes: () => [],
});

// ---- Helpers -----------------------------------------------------------------------------------------

type Result = { code: number; out: string; stdout: string; stderr: string };
interface SourcesWorld extends InstallerWorld {
  notedCommits?: Map<string, string>;
  notedLinks?: Map<string, string>;
}
const world = (self: unknown): SourcesWorld => self as SourcesWorld;
const outOf = (self: unknown): string => {
  const { result } = self as { result?: Result };
  assert.ok(result, 'the tool has not run');
  return result.out;
};
const fill = (self: unknown, text: string): string => text.replaceAll('{root}', world(self).root);
const agentHome = (self: unknown, ...parts: string[]): string =>
  path.join(world(self).root, 'home', '.agent-config', ...parts);

function gitEnvironment(self: SourcesWorld): NodeJS.ProcessEnv {
  const empty = self.at('git-config-empty');
  if (!fs.existsSync(empty)) fs.writeFileSync(empty, '');
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: empty,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Vinh Do',
    GIT_AUTHOR_EMAIL: 'v@example.invalid',
    GIT_COMMITTER_NAME: 'Vinh Do',
    GIT_COMMITTER_EMAIL: 'v@example.invalid',
  };
}
const git = (self: SourcesWorld, ...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', env: gitEnvironment(self), stdio: 'pipe' }).trim();

/** The files of a small component for `slot` (a manifest that passes component/v1, and the folders its locations name). */
function componentFiles(name: string, slot: string, withPackageJson = false): Record<string, string> {
  const knowledge = slot === 'knowledge-storage';
  const manifest = [
    'schema: component/v1',
    `name: ${name}`,
    'version: 1.0.0',
    `slot: ${slot}`,
    `scope: ${knowledge ? 'global' : 'per-project'}`,
    'contracts:',
    '  pin: 1',
    'locations:',
    ...(knowledge ? ['  content: .', '  framework: fw'] : ['  framework: .']),
    'provides:',
    `  contracts: [${knowledge ? 'knowledge-provider/v1' : 'framework/v1'}]`,
    '  index: index.md',
    '  exports: []',
  ].join('\n');
  return {
    'component.yaml': `${manifest}\n`,
    'index.md': `# ${name}\n`,
    ...(knowledge && { 'fw/index.md': `# ${name} framework\n` }),
    ...(withPackageJson && {
      'package.json': `${JSON.stringify({ name, version: '1.0.0', scripts: { postinstall: "node -e \"require('fs').writeFileSync('ran-postinstall','x')\"" } }, null, 2)}\n`,
    }),
  };
}

function writeComponent(self: SourcesWorld, folder: string, name: string, slot: string): void {
  for (const [file, content] of Object.entries(componentFiles(name, slot))) {
    fs.mkdirSync(path.dirname(self.at(path.join(folder, file))), { recursive: true });
    fs.writeFileSync(self.at(path.join(folder, file)), content);
  }
}

const publicList = (name: string, ref: string): string =>
  `schema: components-list/v1\nlocal: false\ncomponents:\n  - name: ${name}\n    source: { type: git, url: https://example.invalid/${name}.git, ref: ${ref} }\n`;
const localPathList = (name: string, folder: string): string =>
  `schema: components-list/v1\nlocal: true\ncomponents:\n  - name: ${name}\n    source: { type: path, path: ${folder} }\n`;

function lockOf(self: unknown): {
  components: Record<string, { resolved: { commit?: string; live?: boolean; path?: string } }>;
} {
  return JSON.parse(fs.readFileSync(agentHome(self, 'components.lock'), 'utf8')) as ReturnType<typeof lockOf>;
}
const lockCommit = (self: unknown, name: string): string => {
  const commit = lockOf(self).components[name]?.resolved.commit;
  assert.ok(commit, `the lock holds no commit for "${name}"`);
  return commit;
};
const noted = (self: unknown, name: string): string => {
  const commit = world(self).notedCommits?.get(name);
  assert.ok(commit, `no lock commit of "${name}" was noted`);
  return commit;
};

// ---- Steps: building sources ---------------------------------------------------------------------------

Given(
  'the source component {string} for the slot {string} is a git source',
  function (this: unknown, name: string, slot: string) {
    createGitSource(world(this), name, componentFiles(name, slot));
  },
);

Given(
  'the source component {string} for the slot {string} is a git source with a package.json that installs by script',
  function (this: unknown, name: string, slot: string) {
    createGitSource(world(this), name, componentFiles(name, slot, true));
  },
);

Given(
  'the source component {string} for the slot {string} is a folder {string}',
  function (this: unknown, name: string, slot: string, folder: string) {
    writeComponent(world(this), folder, name, slot);
  },
);

Given(
  'the source component {string} is listed as a {string} source',
  function (this: unknown, name: string, kind: string) {
    const w = world(this);
    if (kind === 'git') {
      createGitSource(w, name, componentFiles(name, 'knowledge-storage'));
      fs.writeFileSync(w.at('repo/components.yaml'), publicList(name, 'main'));
    } else {
      assert.equal(kind, 'path');
      writeComponent(w, `work/${name}`, name, 'knowledge-storage');
      fs.mkdirSync(agentHome(this), { recursive: true });
      fs.writeFileSync(agentHome(this, 'components.local.yaml'), localPathList(name, `${w.root}/work/${name}`));
    }
  },
);

Given(
  'the source tag {string} of {string} is moved to the newest commit',
  function (this: unknown, tag: string, name: string) {
    const w = world(this);
    git(w, '-C', gitSourcePath(w.root, name), 'tag', '-f', tag, 'refs/heads/main');
  },
);

Given('the source bare repository of {string} is deleted', function (this: unknown, name: string) {
  const w = world(this);
  fs.rmSync(gitSourcePath(w.root, name), { recursive: true, force: true });
});

Given('the source repo stages {string}', function (this: unknown, file: string) {
  const w = world(this);
  git(w, '-C', w.at('repo'), 'add', '--', file);
});

Given('the source package managers on the PATH only leave a mark', function (this: unknown) {
  const w = world(this);
  fs.mkdirSync(w.at('bin'), { recursive: true });
  for (const name of ['npm', 'pnpm', 'yarn', 'npx', 'corepack']) {
    fs.writeFileSync(
      w.at(`bin/${name}`),
      `#!/bin/sh\necho "${name} $*" >> "${w.at('package-manager-ran')}"\nexit 0\n`,
      { mode: 0o755 },
    );
  }
});

// ---- Steps: noting and comparing the state -----------------------------------------------------------

Given('the source lock commit of {string} is noted', function (this: unknown, name: string) {
  const w = world(this);
  (w.notedCommits ??= new Map()).set(name, lockCommit(this, name));
});

Given('the source link {string} is noted', function (this: unknown, link: string) {
  const w = world(this);
  (w.notedLinks ??= new Map()).set(link, fs.realpathSync(w.at(link)));
});

Then('the source link {string} still resolves to the noted target', function (this: unknown, link: string) {
  const w = world(this);
  const before = w.notedLinks?.get(link);
  assert.ok(before, `link "${link}" was not noted`);
  assert.equal(fs.realpathSync(w.at(link)), before);
});

Then(
  'the source link {string} resolves to the folder {string}',
  function (this: unknown, link: string, folder: string) {
    const w = world(this);
    assert.equal(fs.realpathSync(w.at(link)), fs.realpathSync(w.at(folder)));
  },
);

Then('the source lock commit of {string} is the noted one', function (this: unknown, name: string) {
  assert.equal(lockCommit(this, name), noted(this, name));
});

Then('the source lock commit of {string} is the head of its git source', function (this: unknown, name: string) {
  assert.equal(lockCommit(this, name), gitSourceHead(world(this), name));
});

Then(
  'the source lock records {string} as a live link to {string}',
  function (this: unknown, name: string, folder: string) {
    assert.deepEqual(lockOf(this).components[name]?.resolved, { live: true, path: fill(this, folder) });
  },
);

Then(
  'the source clone {string} is at the head of the git source {string}',
  function (this: unknown, folder: string, name: string) {
    const w = world(this);
    assert.equal(git(w, '-C', w.at(folder), 'rev-parse', 'HEAD'), gitSourceHead(w, name));
  },
);

Then(
  'the source clone {string} is at the noted commit of {string}',
  function (this: unknown, folder: string, name: string) {
    const w = world(this);
    assert.equal(git(w, '-C', w.at(folder), 'rev-parse', 'HEAD'), noted(this, name));
  },
);

// ---- Steps: the text of the report -----------------------------------------------------------------------

const hasLine = (self: unknown, line: string): void => {
  assert.ok(outOf(self).split('\n').includes(line), `no output line "${line}" in:\n${outOf(self)}`);
};

Then(
  'the source output has the component line for {string} on ref {string} at the head of its git source',
  function (this: unknown, name: string, ref: string) {
    const head = gitSourceHead(world(this), name).slice(0, 12);
    hasLine(this, `component ${name}: git https://example.invalid/${name}.git ${ref} at ${head}`);
  },
);

Then(
  'the source output has the component line for {string} at the noted commit',
  function (this: unknown, name: string) {
    hasLine(
      this,
      `component ${name}: git https://example.invalid/${name}.git main at ${noted(this, name).slice(0, 12)}`,
    );
  },
);

Then(
  'the source output has the update line for {string} from the noted commit to the head of its git source',
  function (this: unknown, name: string) {
    hasLine(
      this,
      `updated ${name}: ${noted(this, name).slice(0, 12)}..${gitSourceHead(world(this), name).slice(0, 12)}`,
    );
  },
);

Then(
  'the source output says the tag {string} of {string} moved from the noted commit to the head of its git source',
  function (this: unknown, tag: string, name: string) {
    hasLine(
      this,
      `error: tag moved: component ${name}, tag ${tag}, locked ${noted(this, name)}, now ${gitSourceHead(world(this), name)}`,
    );
  },
);

// ---- Steps: other checks -------------------------------------------------------------------------------------

Then('the source starter {string} passes the schema check', function (this: unknown, file: string) {
  const w = world(this);
  const out = execFileSync(process.execPath, [path.join(repo, 'contracts/tools/check-schemas.ts'), w.at(file)], {
    encoding: 'utf8',
    env: { ...process.env, HOME: w.at('home'), USERPROFILE: w.at('home') },
  });
  assert.match(out, /: ok/);
});
