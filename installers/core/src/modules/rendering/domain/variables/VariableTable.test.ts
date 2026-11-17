import { describe, expect, it } from 'vitest';
import {
  buildVariableRows,
  escapeTableCell,
  renderVariableTable,
  VARIABLE_TABLE_HEADER,
  type DeclaredVariableSource,
  type VariableRow,
} from '#rendering/domain/variables/VariableTable.ts';

const computed = { name: 'AGENT_HOME', description: 'Folder of the agent home', declaredBy: 'agent-config' };
const declare = (name: string, description: string, ...declaredBy: string[]): DeclaredVariableSource => ({
  name,
  description,
  declaredBy,
});

describe('VR-1 the rows', () => {
  const declared = [
    declare('ALPHA_ROOT', 'Folder of alpha files', 'vars-a'),
    declare('BETA_NAME', 'Name of beta', 'vars-a'),
    declare('GAMMA_DIR', 'Folder of gamma files', 'vars-a'),
    declare('DELTA_HOME', 'Home of delta', 'vars-b'),
  ];
  const values = new Map([
    ['ALPHA_ROOT', '/data/alpha'],
    ['BETA_NAME', 'beta'],
    ['GAMMA_DIR', '/data/gamma'],
    ['DELTA_HOME', '/data/delta'],
    ['OFF_ONLY', 'left over from a disabled component'],
  ]);

  it('puts AGENT_HOME first, then exactly one row per declared variable of two components with 3 and 1 variables', () => {
    const rows = buildVariableRows({ home: '/h/.agent-config', computed, declared, values });
    expect(rows.map((row) => row.name)).toEqual(['AGENT_HOME', 'ALPHA_ROOT', 'BETA_NAME', 'GAMMA_DIR', 'DELTA_HOME']);
    expect(rows[0]).toEqual({
      name: 'AGENT_HOME',
      value: '/h/.agent-config',
      description: 'Folder of the agent home',
      declaredBy: 'agent-config',
    });
    expect(rows).toHaveLength(5);
  });

  it('gives no row to a stored value whose component is not enabled', () => {
    const rows = buildVariableRows({ home: '/h', computed, declared, values });
    expect(rows.some((row) => row.name === 'OFF_ONLY')).toBe(false);
  });

  it('shows the first declaring component', () => {
    const rows = buildVariableRows({
      home: '/h',
      computed,
      declared: [declare('SHARED', 'd', 'a-first', 'b-second')],
      values: new Map(),
    });
    expect(rows[1]?.declaredBy).toBe('a-first');
  });

  it('says "(not set)" for an optional variable with no value', () => {
    const rows = buildVariableRows({ home: '/h', computed, declared: [declare('X', 'd', 'c')], values: new Map() });
    expect(rows[1]?.value).toBe('(not set)');
  });

  it('keeps the order it is given and gives the same rows twice', () => {
    const input = { home: '/h', computed, declared, values };
    expect(buildVariableRows(input)).toEqual(buildVariableRows(input));
    expect(buildVariableRows({ ...input, declared: [...declared].reverse() }).map((row) => row.name)).toEqual([
      'AGENT_HOME',
      'DELTA_HOME',
      'GAMMA_DIR',
      'BETA_NAME',
      'ALPHA_ROOT',
    ]);
  });
});

describe('VR-1 M-07 M-08 the printed table', () => {
  const row = (value: string, description = 'd'): VariableRow => ({ name: 'N', value, description, declaredBy: 'c' });

  it('prints the header, a separator and the rows exactly as the scenarios expect', () => {
    const result = renderVariableTable([
      {
        name: 'AGENT_HOME',
        value: '/r/home/.agent-config',
        description: 'Folder of the agent home',
        declaredBy: 'agent-config',
      },
      { name: 'REF_ROOT', value: '~/ws/ref', description: 'Folder of references', declaredBy: 'vars-detect' },
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        VARIABLE_TABLE_HEADER,
        '| --- | --- | --- | --- |',
        '| AGENT_HOME | /r/home/.agent-config | Folder of the agent home | agent-config |',
        '| REF_ROOT | ~/ws/ref | Folder of references | vars-detect |',
      ].join('\n'),
    });
  });

  it('escapes a pipe, so a cell cannot add a column', () => {
    expect(escapeTableCell('a|b')).toBe('a\\|b');
    expect(escapeTableCell('a\\|b')).toBe('a\\\\\\|b');
    expect(escapeTableCell('C:\\Users\\v')).toBe('C:\\Users\\v');
  });

  it('escapes a line break, so a cell cannot add a row', () => {
    const result = renderVariableTable([row('one\n| FAKE | x | y | z |')]);
    expect(result.ok && result.value.split('\n')).toHaveLength(3);
    expect(result.ok && result.value).toContain('one\\x0a\\| FAKE \\| x');
  });

  it('shows control, bidi and invisible characters as visible escapes', () => {
    expect(escapeTableCell('a\u001b[31mb\r\tc\u202ed\u200be')).toBe('a\\x1b[31mb\\x0d\\x09c\\u202ed\\u200be');
  });

  it('does not expand a placeholder inside a value', () => {
    const result = renderVariableTable([row('{{include:secret.md}} {{OTHER}}')]);
    expect(result.ok && result.value).toContain('| {{include:secret.md}} {{OTHER}} |');
  });

  it('refuses a value that needs redaction, naming the variable and never the text', () => {
    const secret = 'https://user:hunter2@example.com/x';
    const result = renderVariableTable([row(secret)]);
    expect(result).toEqual({ ok: false, error: [{ kind: 'credential-like', name: 'N', column: 'value' }] });
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });

  it('refuses a description that needs redaction', () => {
    const result = renderVariableTable([row('ok', 'see ?token=abc123')]);
    expect(result).toEqual({ ok: false, error: [{ kind: 'credential-like', name: 'N', column: 'description' }] });
  });

  it('reports every refused cell, not only the first', () => {
    const result = renderVariableTable([
      row('ghp_abcdef1234567890'),
      { ...row('fine'), name: 'M', description: 'Bearer abcdefgh12345' },
    ]);
    expect(result.ok === false && result.error.map((v) => `${v.name}:${v.column}`)).toEqual([
      'N:value',
      'M:description',
    ]);
  });
});
