// AC-7.3, AC-8.1, AC-8.2, DR-306: the plan of compatibility links over a table of observations.
import { describe, expect, it } from 'vitest';
import { COMPAT_FOLDER_NAMES, COPILOT_FOLDER, compatLinkTable } from '#wiring/domain/compat/CompatLinks.ts';
import { planCompatLinks, type Observation } from '#wiring/domain/compat/CompatPlan.ts';

const home = '/h/.agent-config';
const copilotHome = `/h/${COPILOT_FOLDER}`;
const table = compatLinkTable('/h', home, 'posix');
const everything = new Set([...COMPAT_FOLDER_NAMES, 'global-variables.md', 'instructions/core.instructions.md']);
const real: Observation = { kind: 'folder' };

function plan(observed: Record<string, unknown>, options: { entries?: Set<string>; retired?: string[] } = {}) {
  return planCompatLinks({
    table,
    observed: new Map(
      Object.entries({ [copilotHome]: real, [`${copilotHome}/instructions`]: real, ...observed }) as [
        string,
        Observation,
      ][],
    ),
    homeEntries: options.entries ?? everything,
    retired: new Set(options.retired ?? []),
    copilotHome,
  });
}

describe('AC-8.1 a first install', () => {
  const first = plan({});
  it('creates every link, backing up nothing', () => {
    expect(
      first.operations.map((operation) => [operation.path, operation.target, operation.old.state, operation.backup]),
    ).toEqual(table.map((link) => [link.path, link.target, 'absent', false]));
    expect(first.unchanged).toEqual([]);
    expect(first.skipped).toEqual([]);
    expect(first.ensureFolders).toEqual([]);
  });

  it('marks each operation as a compat link of core, never privileged', () => {
    expect(
      first.operations.every(
        (operation) => operation.class === 'compat' && operation.component === 'core' && !operation.privileged,
      ),
    ).toBe(true);
  });
});

describe('AC-8.1 a second install', () => {
  it('leaves every link that is already right and plans nothing', () => {
    const links = Object.fromEntries(table.map((link) => [link.path, { kind: 'link', target: link.target }]));
    const second = plan(links);
    expect(second.operations).toEqual([]);
    expect(second.unchanged).toEqual(table.map((link) => link.path));
  });
});

describe('AC-7.3 what is at a link path', () => {
  const patterns = `${copilotHome}/patterns`;
  it.each([
    ['a real folder is replaced after a backup', real, { state: 'real', kind: 'folder' }, true],
    ['a real file is replaced after a backup', { kind: 'file' }, { state: 'real', kind: 'file' }, true],
    ['something that is neither is replaced after a backup', { kind: 'other' }, { state: 'real', kind: 'other' }, true],
    [
      'a link to the old clone is switched, and copied to the backups folder',
      { kind: 'link', target: '/old/clone/patterns' },
      { state: 'link', target: '/old/clone/patterns' },
      true,
    ],
    ['nothing is created with no backup', { kind: 'absent' }, { state: 'absent' }, false],
  ])('%s', (_title, seen, old, backup) => {
    const operation = plan({ [patterns]: seen }).operations.find((candidate) => candidate.path === patterns);
    expect(operation).toMatchObject({ old, backup });
  });
});

describe('AC-8.2 Copilot own folders', () => {
  it('links inside the instructions folder when it is a real folder, and does not touch the folder', () => {
    const result = plan({});
    expect(result.operations.map((operation) => operation.path)).toContain(
      `${copilotHome}/instructions/core.instructions.md`,
    );
    expect(result.operations.map((operation) => operation.path)).not.toContain(`${copilotHome}/instructions`);
  });

  it.each([
    ['is missing', { kind: 'absent' }, 'copilot-folder-missing'],
    ['is a link', { kind: 'link', target: '/x' }, 'copilot-folder-not-real'],
    ['is a file', { kind: 'file' }, 'copilot-folder-not-real'],
  ])(
    'does not create or replace the instructions folder when it %s, and skips the file link',
    (_title, seen, reason) => {
      const result = plan({ [`${copilotHome}/instructions`]: seen });
      expect(result.skipped).toEqual([{ path: `${copilotHome}/instructions/core.instructions.md`, reason }]);
      expect(result.ensureFolders).toEqual([]);
    },
  );

  it('never plans a path for hooks, agents or any other name Copilot owns, whatever is there', () => {
    const result = plan({ [`${copilotHome}/hooks`]: real, [`${copilotHome}/agents`]: real });
    const planned = [...result.operations, ...result.skipped].map((entry) => entry.path);
    expect(planned.filter((entry) => /\/(hooks|agents|skills|prompts|memory|logs|session-state)$/.test(entry))).toEqual(
      [],
    );
  });

  it('asks for Copilot home to be made when it is missing and a link is needed, and for no own folder', () => {
    const result = plan({ [copilotHome]: { kind: 'absent' }, [`${copilotHome}/instructions`]: { kind: 'absent' } });
    expect(result.ensureFolders).toEqual([copilotHome]);
    expect(result.skipped.map((entry) => entry.reason)).toEqual(['copilot-folder-missing']);
  });

  it('skips every link when Copilot home is a file', () => {
    const result = plan({ [copilotHome]: { kind: 'file' } });
    expect(result.operations).toEqual([]);
    expect(new Set(result.skipped.map((entry) => entry.reason))).toEqual(new Set(['copilot-folder-not-real']));
  });

  it('accepts Copilot home that is a link, as dotfile setups make it', () => {
    expect(plan({ [copilotHome]: { kind: 'link', target: '/dotfiles/copilot' } }).operations).toHaveLength(
      table.length,
    );
  });
});

describe('what is not placed', () => {
  it('skips a link whose target the run does not put in the agent home, so nothing dangles', () => {
    const result = plan({}, { entries: new Set(['knowledge']) });
    expect(result.operations.map((operation) => operation.path)).toEqual([`${copilotHome}/knowledge`]);
    expect(new Set(result.skipped.map((entry) => entry.reason))).toEqual(new Set(['target-not-installed']));
  });

  it('skips a retired path instead of creating it again', () => {
    const result = plan({}, { retired: [`${copilotHome}/patterns`] });
    expect(result.skipped).toEqual([{ path: `${copilotHome}/patterns`, reason: 'retired' }]);
  });

  it('skips a path the observer could not see, rather than guess', () => {
    const result = plan({ [`${copilotHome}/atlas`]: { kind: 'unknown' } });
    expect(result.skipped).toEqual([{ path: `${copilotHome}/atlas`, reason: 'cannot-observe' }]);
  });
});
