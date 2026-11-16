// DR-414, VR-5: the old variables file offers values as proposals; a placeholder and anything unsafe is not offered.
import { describe, expect, it } from 'vitest';
import { legacyValueProposals } from '#variables/domain/legacy/legacyValues.ts';

const table = (...rows: string[]): string => ['| Variable | Value | Notes |', '|---|---|---|', ...rows].join('\n');

describe('DR-414 values of the old variables file', () => {
  it('reads the scenario table: a placeholder and the computed AGENT_HOME are skipped', () => {
    const text = table(
      `| \`{{AGENT_HOME}}\` | \`~/${'.copilot'}\` | Deployed config root. |`,
      '| `{{AGENT_CONFIG_REPO}}` | `<SETUP REQUIRED>` | Clone of agent-config. |',
      '| `{{LANGUAGE}}` | English | Default language. |',
    );
    expect(legacyValueProposals(text)).toEqual(new Map([['LANGUAGE', 'English']]));
  });

  it.each([
    ['a secret-like name', table('| `{{GITHUB_TOKEN}}` | abc | n |')],
    ['a secret-like value', table('| `{{LANGUAGE}}` | ghp_abc | n |')],
    ['an empty value', table('| `{{LANGUAGE}}` |  | n |')],
    ['a value with credentials in a URL', table('| `{{LANGUAGE}}` | https://u:p@h/x | n |')],
    ['a lower case name', table('| `{{language}}` | x | n |')],
    ['a name without braces', table('| `LANGUAGE` | x | n |')],
    ['a line that is not a table row', '`{{LANGUAGE}}` | x | n'],
    ['a value with an invisible character', table('| `{{LANGUAGE}}` | a\u202eb | n |')],
  ])('offers nothing for %s', (_title, text) => {
    expect(legacyValueProposals(text).size).toBe(0);
  });

  it('keeps the first row of a repeated name', () => {
    expect(legacyValueProposals(table('| `{{A}}` | one | n |', '| `{{A}}` | two | n |')).get('A' as never)).toBe('one');
  });

  it('reads at most 2000 lines', () => {
    const text = `${'x\n'.repeat(2000)}${table('| `{{LATE}}` | v | n |')}`;
    expect(legacyValueProposals(text).size).toBe(0);
  });
});
