import { describe, expect, it } from 'vitest';
import { renderGlobalVariablesFile } from '#rendering/domain/variables/GlobalVariablesFile.ts';

const rows = [{ name: 'AGENT_HOME', value: '/h', description: 'Folder of the agent home', declaredBy: 'agent-config' }];

describe('VR-1 the global variables file', () => {
  it('holds one table with the header the scenarios look for, and ends with one line ending', () => {
    const result = renderGlobalVariablesFile(rows);
    const text = result.ok ? result.value : '';
    expect(text.split('\n').filter((line) => line === '| Variable | Value | Description | Declared by |')).toHaveLength(
      1,
    );
    expect(text.endsWith('|\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('is the same bytes for the same rows and refuses a credential-like value', () => {
    expect(renderGlobalVariablesFile(rows)).toEqual(renderGlobalVariablesFile(rows));
    expect(renderGlobalVariablesFile([{ ...rows[0]!, value: 'https://u:p@h.example/' }]).ok).toBe(false);
  });
});
