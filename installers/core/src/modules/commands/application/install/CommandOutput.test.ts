// DR-305, installer-cli.md "Grammar": the home line, the status line, then the body; needs numbered in report order; JSON and text agree.
import { describe, expect, it } from 'vitest';
import {
  buildOutput,
  homeLine,
  noticeText,
  plain,
  type PlannedNeed,
} from '#commands/application/install/CommandOutput.ts';
import { homeNeed } from '#commands/application/install/NeedBlocks.ts';

const home = { path: '/h/.agent-config', confirmed: true, source: 'recorded' as const };

const need = (kind: 'components' | 'variables', item: string): PlannedNeed => ({
  need: { kind, item, detail: 'd', satisfy: 's' },
  lines: (number) => [`${number}. ${kind}: ${item}`],
});

describe('the home line (MG-01)', () => {
  it('says confirmed or not, and names the recorded home of a move', () => {
    expect(homeLine(home)).toBe('agent home: /h/.agent-config (recorded, confirmed)');
    expect(homeLine({ ...home, confirmed: false, source: 'default' })).toBe(
      'agent home: /h/.agent-config (default, not confirmed)',
    );
    expect(homeLine({ path: '/n', confirmed: false, source: 'AGENT_CONFIG_HOME', recorded: '/o' })).toBe(
      'agent home: /n (AGENT_CONFIG_HOME, not confirmed; recorded home: /o)',
    );
  });
});

describe('building the output', () => {
  it('numbers the needs in report order whatever order they arrive in, and prints them after the body', () => {
    const output = buildOutput({
      command: 'install',
      status: 'needs-input',
      home,
      body: ['warning: x'],
      needs: [need('variables', 'A'), need('components', 'slot s')],
    });
    expect(output.text).toEqual([
      'agent home: /h/.agent-config (recorded, confirmed)',
      'status: needs-input',
      'warning: x',
      '1. components: slot s',
      '2. variables: A',
    ]);
    expect(output.report.needs.map((each) => each.kind)).toEqual(['components', 'variables']);
    expect(output.report.exit).toBe(10);
  });

  it('prints no home line when no home could be chosen, and defaults the lists', () => {
    const output = buildOutput({ command: 'plan', status: 'failed', home: null });
    expect(output.text).toEqual(['status: failed']);
    expect(output.report).toMatchObject({ home: null, needs: [], changes: [], findings: [], backup: null, exit: 1 });
  });

  it('puts warnings and errors in findings with the lines that follow them', () => {
    const output = buildOutput({
      command: 'install',
      status: 'failed',
      home,
      notices: [{ severity: 'error', check: 'fetch-failed', item: 'kb', line: 'error: a', more: ['   cause: b'] }],
    });
    expect(output.report.findings).toEqual([
      { severity: 'error', check: 'fetch-failed', item: 'kb', detail: 'error: a; cause: b', fix: '' },
    ]);
    expect(noticeText({ severity: 'error', check: 'c', item: 'i', line: 'l', more: ['m'] })).toEqual(['l', 'm']);
    expect(plain('   indented')).toBe('indented');
  });

  it('redacts a credential in anything it prints, in the report as well', () => {
    const output = buildOutput({
      command: 'install',
      status: 'failed',
      home,
      notices: [
        {
          severity: 'error',
          check: 'c',
          item: 'https://user:hunter2@example.invalid/x',
          line: 'error: https://user:hunter2@example.invalid/x',
        },
      ],
    });
    expect(JSON.stringify(output.report)).not.toContain('hunter2');
  });
});

describe('the home need (MG-04, MG-05, MG-10)', () => {
  it('adds the terminal line only when no terminal is attached, and says so in the report', () => {
    const unconfirmed = { path: '/h/.agent-config', confirmed: false, source: 'default' as const };
    const without = homeNeed(unconfirmed, false);
    const withTerminal = homeNeed(unconfirmed, true);
    expect(without.lines(1)).toHaveLength(4);
    expect(withTerminal.lines(1)).toHaveLength(3);
    expect(without.need.terminal).toBe('needed');
    expect(withTerminal.need.terminal).toBeUndefined();
    expect(without.need.satisfy).toBe('install (interactive) and answer yes');
  });

  it('names both homes in a move', () => {
    const moved = homeNeed({ path: '/n', confirmed: false, source: 'AGENT_CONFIG_HOME', recorded: '/o' }, true);
    expect(moved.lines(1)[1]).toBe('   confirm moving the agent home from /o to /n');
  });
});
