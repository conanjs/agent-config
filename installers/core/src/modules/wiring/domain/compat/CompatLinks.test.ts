// AC-8.1, AC-8.2, FR-031: the table of compatibility links, and that none of them lands on something Copilot owns. The list of Copilot's
// own names is compared with the record of the sorting check, so the two cannot drift apart.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPAT_FOLDER_NAMES,
  COPILOT_FOLDER,
  COPILOT_OWN_NAMES,
  compatLinkTable,
  copilotHomeOf,
  isCopilotOwn,
} from '#wiring/domain/compat/CompatLinks.ts';

const copilot = (...parts: string[]): string => ['/h', COPILOT_FOLDER, ...parts].join('/');
const winCopilot = (...parts: string[]): string => ['C:\\h', COPILOT_FOLDER, ...parts].join('\\');

describe('AC-8.1 the table of compatibility links', () => {
  it('has the eight folders, the variables file and the core instructions file, linked to the new home', () => {
    const table = compatLinkTable('/h', '/h/.agent-config', 'posix');
    expect(table.map((link) => [link.path, link.target, link.kind])).toEqual([
      ...COMPAT_FOLDER_NAMES.map((name) => [copilot(name), `/h/.agent-config/${name}`, 'folder']),
      [copilot('global-variables.md'), '/h/.agent-config/global-variables.md', 'file'],
      [copilot('instructions', 'core.instructions.md'), '/h/.agent-config/instructions/core.instructions.md', 'file'],
    ]);
    expect(COMPAT_FOLDER_NAMES).toEqual([
      'atlas',
      'companies',
      'frameworks',
      'knowledge',
      'patterns',
      'procedures',
      'references',
      'tracker',
    ]);
  });

  it('is written in the path syntax of the machine', () => {
    const table = compatLinkTable('C:\\h', 'C:\\h\\.agent-config', 'win32');
    expect(table[0]).toMatchObject({ path: winCopilot('atlas'), target: 'C:\\h\\.agent-config\\atlas' });
    expect(table.at(-1)).toMatchObject({
      path: winCopilot('instructions', 'core.instructions.md'),
      insideOwnFolder: winCopilot('instructions'),
    });
  });

  it('AC-8.2 places a link on nothing that Copilot owns, except the one file inside the instructions folder', () => {
    const onOwn = compatLinkTable('/h', '/h/.agent-config', 'posix').filter((link) =>
      isCopilotOwn(link.path, '/h', 'posix'),
    );
    expect(onOwn.map((link) => link.path)).toEqual([copilot('instructions', 'core.instructions.md')]);
  });

  it('AC-8.2 plans no link for the folders hooks and agents', () => {
    const paths = compatLinkTable('/h', '/h/.agent-config', 'posix').map((link) => link.path);
    expect(paths).not.toContain(copilot('hooks'));
    expect(paths).not.toContain(copilot('agents'));
  });
});

describe('AC-8.4 Copilot-own names', () => {
  it('are the names the record of the sorting check lists as own', () => {
    const record = fs.readFileSync(
      path.join(import.meta.dirname, '..', '..', '..', '..', '..', '..', '..', 'scripts', 'copilot-paths.yaml'),
      'utf8',
    );
    const block = record.slice(record.indexOf('\nown:\n') + 6, record.indexOf('\nagent-home-lines:'));
    const prefix = `~/${COPILOT_FOLDER}/`;
    const recorded = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith(`- ${prefix}`))
      .map((line) => line.slice(2 + prefix.length));
    expect([...COPILOT_OWN_NAMES].sort()).toEqual([...recorded].sort());
  });

  it.each([
    ['an own folder', copilot('instructions'), true],
    ['inside an own folder', copilot('hooks', 'a.json'), true],
    ['an own file', copilot('config.json'), true],
    ['a compatibility folder', copilot('patterns'), false],
    ['Copilot home itself', copilot(), false],
    ['outside Copilot home', '/h/other', false],
    ['a sibling that starts like Copilot home', `/h/${COPILOT_FOLDER}x/instructions`, false],
    ['a path that climbs out and back', `${copilot()}/patterns/../instructions`, true],
  ])('%s: %s', (_title, candidate, expected) => {
    expect(isCopilotOwn(candidate, '/h', 'posix')).toBe(expected);
  });

  it('gives the folder of Copilot home', () => {
    expect(copilotHomeOf('/h', 'posix')).toBe(copilot());
  });
});
