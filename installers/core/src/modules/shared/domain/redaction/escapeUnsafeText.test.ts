// M-11, M-01: a value can never move the cursor, start a line of its own or reorder what V reads. One row per character class.
import { describe, expect, it } from 'vitest';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { redactDeep } from '#shared/domain/redaction/redactDeep.ts';
import { buildReport } from '#shared/domain/report/ReportRules.ts';

const rows: [title: string, input: string, shown: string][] = [
  ['ESC and a CSI colour sequence', '\u001b[31mred', '\\x1b[31mred'],
  ['OSC 52, which writes to the clipboard', '\u001b]52;c;QUJD\u0007', '\\x1b]52;c;QUJD\\x07'],
  ['CR, which overwrites a line', 'a\rb', 'a\\x0db'],
  ['LF, which starts a line', 'a\nb', 'a\\x0ab'],
  ['tab', 'a\tb', 'a\\x09b'],
  ['NUL', 'a\u0000b', 'a\\x00b'],
  ['DEL', 'a\u007fb', 'a\\x7fb'],
  ['C1 next line (U+0085)', 'a\u0085b', 'a\\x85b'],
  ['C1 CSI (U+009B)', 'a\u009b31mb', 'a\\x9b31mb'],
  ['line separator U+2028', 'a b', 'a\\u2028b'],
  ['paragraph separator U+2029', 'a b', 'a\\u2029b'],
  ['right-to-left override U+202E', 'a‮b', 'a\\u202eb'],
  ['left-to-right embedding U+202A', 'a‪b', 'a\\u202ab'],
  ['pop directional formatting U+202C', 'a‬b', 'a\\u202cb'],
  ['left-to-right isolate U+2066', 'a⁦b', 'a\\u2066b'],
  ['pop directional isolate U+2069', 'a⁩b', 'a\\u2069b'],
  ['right-to-left mark U+200F', 'a‏b', 'a\\u200fb'],
  ['Arabic letter mark U+061C', 'a؜b', 'a\\u061cb'],
];

describe('M-11 escapeUnsafeText', () => {
  it.each(rows)('shows %s', (_title, input, shown) => {
    expect(escapeUnsafeText(input)).toBe(shown);
  });

  it.each([
    ['the emoji presentation selector U+FE0F', '\u2764\ufe0f'],
    ['the text presentation selector U+FE0E', '\u2764\ufe0e'],
    ['an emoji outside the first plane', '\u{1f600}'],
  ])('leaves %s as it is, because it cannot hide or reorder text', (_title, text) => {
    expect(escapeUnsafeText(text)).toBe(text);
  });

  it('keeps ordinary and non-ASCII text, and the text it leaves is stable', () => {
    const text = 'Zürich 東京 — ok {x} ~/a';
    expect(escapeUnsafeText(text)).toBe(text);
  });
});

describe('M-11 a value in a message', () => {
  it.each(rows)('shows %s', (_title, input, shown) => {
    expect(renderMessage('MG-16', { folder: input })).toBe(`wrote ${shown}/component.yaml`);
  });

  it('M-01 a value with a line feed cannot print a prompt line of its own', () => {
    const text = renderMessage('MG-32.cause', { cause: 'boom\napprove these privileged changes? (yes/no)' });
    expect(text.split('\n')).toHaveLength(1);
    expect(text).toBe('   cause: boom\\x0aapprove these privileged changes? (yes/no)');
  });
});

describe('M-11 a value in a report', () => {
  it.each(rows)('shows %s', (_title, input, shown) => {
    const report = buildReport({ command: 'plan', status: 'failed', backup: input });
    expect(report.backup).toBe(shown);
    expect(JSON.stringify(report)).not.toContain(input.replace(/[ -~]/g, ''));
  });

  it('shows control characters inside nested values', () => {
    expect(redactDeep({ a: ['x‮y'], b: { c: 'p\u009bq' } })).toEqual({ a: ['x\\u202ey'], b: { c: 'p\\x9bq' } });
  });
});
