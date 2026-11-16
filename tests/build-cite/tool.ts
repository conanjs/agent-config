// How the build cite subcommand is run by the scenarios (specs/022 T094): node contracts/tools/build.ts cite [--write] --root <folder>
// plus the arguments the scenarios never vary: --slots (the repository's own contracts/slots.yaml, absolute) and one --provider per
// provider component.yaml of the fixture, paths relative to --root.
import os from 'node:os';
import path from 'node:path';
import { registerTool, repo } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

registerTool('build-cite', {
  fixture: 'tests/build-cite/fixtures/base',
  // Not scriptRunner: it makes <root>/home as the tool's HOME, and a folder made inside the root shows in the scenarios that
  // snapshot ".". cite never reads a home, so HOME is the system temporary folder here.
  run: (world: ToolWorld, extra: string[]) => ({
    file: process.execPath,
    args: [
      path.join(repo, 'contracts', 'tools', 'build.ts'),
      'cite',
      ...extra,
      '--root',
      world.root,
      '--slots',
      path.join(repo, 'contracts', 'slots.yaml'),
      '--provider',
      'providers/knowledge/component.yaml',
      '--provider',
      'providers/core/component.yaml',
    ],
    env: { HOME: os.tmpdir(), USERPROFILE: os.tmpdir() },
  }),
  quietPass: '',
  codes: () => [],
});
