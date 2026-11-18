// DR-202, EDGE-6, M-03: staging a store tree from the managed clone, and deleting a tree or a clone, through the state API.
import { describe, expect, it } from 'vitest';
import { composeState } from '#state/StateModule.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

const home = '/h/.agent-config';
const id = '0123456789ab';

function withClone() {
  const machine = createMemoryState();
  machine.disk.seedFile(`${home}/components/kb/index.md`, '# kb');
  machine.disk.seedFile(`${home}/components/kb/docs/a.md`, 'a');
  machine.disk.seedFile(`${home}/components/kb/.git/HEAD`, 'ref: refs/heads/main');
  return { machine, state: composeState(machine.ports) };
}

describe('staging a store tree', () => {
  it('copies the clone without .git into store/<name>@<id>', () => {
    const { machine, state } = withClone();
    expect(state.stageTree({ from: `${home}/components/kb`, name: 'kb', id })).toEqual({
      ok: true,
      value: { how: 'staged', folder: `${home}/store/kb@${id}` },
    });
    const listing = machine.disk.listing();
    expect(listing).toContain(`${home}/store/kb@${id}/index.md file 644 "# kb"`);
    expect(listing).toContain(`${home}/store/kb@${id}/docs/a.md file 644 "a"`);
    expect(listing.some((line) => line.startsWith(`${home}/store/kb@${id}/.git`))).toBe(false);
    expect(listing.some((line) => line.includes('.partial'))).toBe(false);
  });

  it('reuses a tree that is there and changes nothing', () => {
    const { machine, state } = withClone();
    state.stageTree({ from: `${home}/components/kb`, name: 'kb', id });
    machine.disk.seedFile(`${home}/components/kb/new.md`, 'changed since');
    const before = machine.disk.listing();
    expect(state.stageTree({ from: `${home}/components/kb`, name: 'kb', id })).toEqual({
      ok: true,
      value: { how: 'exists', folder: `${home}/store/kb@${id}` },
    });
    expect(machine.disk.listing()).toEqual(before);
  });

  it('removes a .partial folder a killed run left before it copies again', () => {
    const { machine, state } = withClone();
    machine.disk.seedFile(`${home}/store/kb@${id}.partial/half.md`, 'half');
    expect(state.stageTree({ from: `${home}/components/kb`, name: 'kb', id }).ok).toBe(true);
    expect(machine.disk.listing().some((line) => line.includes('half.md'))).toBe(false);
  });

  it.each([
    ['an upper-case name', 'Kb', id],
    ['a name with a slash', 'a/b', id],
    ['an id that is not 12 hex characters', 'kb', 'xyz'],
  ])('refuses %s', (_what, name, badId) => {
    const { state } = withClone();
    expect(state.stageTree({ from: `${home}/components/kb`, name, id: badId })).toMatchObject({
      ok: false,
      error: { kind: 'bad-name' },
    });
  });

  it('refuses a source outside the home and a source that is not a folder', () => {
    const { machine, state } = withClone();
    machine.disk.seedFile('/elsewhere/x.md', 'x');
    expect(state.stageTree({ from: '/elsewhere', name: 'kb', id })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
    expect(state.stageTree({ from: `${home}/components/kb/index.md`, name: 'kb', id })).toMatchObject({
      ok: false,
      error: { kind: 'not-a-folder' },
    });
  });
});

describe('removing a managed folder', () => {
  it('deletes a store tree and a clone, and says absent for what is not there', () => {
    const { machine, state } = withClone();
    state.stageTree({ from: `${home}/components/kb`, name: 'kb', id });
    expect(state.removeManagedFolder({ area: 'store', name: 'kb', id })).toEqual({ ok: true, value: 'removed' });
    expect(state.removeManagedFolder({ area: 'components', name: 'kb' })).toEqual({ ok: true, value: 'removed' });
    expect(machine.disk.listing().some((line) => line.includes('/kb'))).toBe(false);
    expect(state.removeManagedFolder({ area: 'components', name: 'kb' })).toEqual({ ok: true, value: 'absent' });
  });

  it('refuses a name that could walk out of the folder', () => {
    const { state } = withClone();
    expect(state.removeManagedFolder({ area: 'components', name: '..' })).toMatchObject({ ok: false });
    expect(state.removeManagedFolder({ area: 'store', name: 'kb', id: '../../x' })).toMatchObject({ ok: false });
  });
});
