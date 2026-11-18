// MOD-11: the composer fills the ports in; one run through the API proves the wiring.
import { describe, expect, it } from 'vitest';
import { composeWiring } from '#wiring/WiringModule.ts';
import { COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';

const wiring = composeWiring({
  observer: {
    observe: (target) =>
      target.endsWith('patterns') ? { kind: 'link', target: '/h/.agent-config/patterns' } : { kind: 'absent' },
  },
  hookFiles: { readAll: () => ({ texts: [], unreadable: false }) },
  readYaml: (text) => ({ ok: true, value: JSON.parse(text) as unknown }),
});

describe('the wiring composer', () => {
  it('lists the home entries that compatibility links point at, including the one file inside a folder', () => {
    const entries = wiring.compatHomeEntries('/h', '/h/.agent-config', 'posix');
    expect(entries).toContain('knowledge');
    expect(entries).toContain('global-variables.md');
    expect(entries).toContain('instructions/core.instructions.md');
  });

  it('plans links, reads the retired list, decides it and checks consent through the same ports', () => {
    const plan = wiring.planCompat({
      userHome: '/h',
      home: '/h/.agent-config',
      flavor: 'posix',
      homeEntries: new Set(['patterns', 'knowledge']),
      retired: new Set(),
    });
    expect(plan.unchanged).toEqual([`/h/${COPILOT_FOLDER}/patterns`]);
    expect(plan.operations.map((operation) => operation.path)).toEqual([`/h/${COPILOT_FOLDER}/knowledge`]);
    const list = wiring.readRetiredList(
      JSON.stringify({ schema: 'compat-links/v1', retired: [`~/${COPILOT_FOLDER}/patterns`] }),
      '/h',
      'posix',
    );
    expect(
      list.ok &&
        wiring.planRetired({
          entries: list.value,
          recorded: [{ path: `/h/${COPILOT_FOLDER}/patterns`, target: '/h/.agent-config/patterns' }],
        }),
    ).toEqual([{ path: `/h/${COPILOT_FOLDER}/patterns`, action: 'remove' }]);
    const check = wiring.checkPrivileged({
      sources: [],
      approved: [],
      userHome: '/h',
      home: '/h/.agent-config',
      flavor: 'posix',
    });
    expect(check.ok && check.value.diff).toEqual({ pending: [], removed: [] });
    expect(typeof wiring.describePrivileged).toBe('function');
  });
});
