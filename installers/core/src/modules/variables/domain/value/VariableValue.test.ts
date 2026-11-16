// M-08, M-11, M-07 for values: one safe public line, and a refusal that never carries the value.
import { describe, expect, it } from 'vitest';
import { parseVariableValue } from '#variables/domain/value/VariableValue.ts';

describe('values that are accepted', () => {
  it.each([
    'English',
    '/data/alpha',
    '~/ws/ref',
    'C:\\Users\\v\\docs',
    'Folder with spaces',
    'a=b',
    '\u00c9t\u00e9',
    'x'.repeat(1024),
  ])('accepts %j', (value) => {
    expect(parseVariableValue(value)).toEqual({ ok: true, value });
  });
});

describe('values that are refused', () => {
  it.each([
    ['ghp_0000FAKE', 'secret-prefix'],
    ['\u200bsk-abc', 'secret-prefix'],
    ['sk_live_abcdefghijkl', 'secret-shape'],
    ['AIzaSyA1234567890abcdefghijklmnopqrstu', 'secret-shape'],
    ['ASIAIOSFODNN7EXAMPLE', 'secret-shape'],
    ['npm_abcdefghijklmnopqrstuvwxyz0123456789', 'secret-shape'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r', 'secret-shape'],
    ['x -----BEGIN RSA PRIVATE KEY-----', 'secret-shape'],
    ['\u200bsk_live_abc', 'secret-shape'],
    ['', 'empty'],
    ['x'.repeat(1025), 'too-long'],
    ['two\nlines', 'unsafe-characters'],
    ['cr\rhere', 'unsafe-characters'],
    ['tab\there', 'unsafe-characters'],
    ['esc\u001b[31m', 'unsafe-characters'],
    ['c1\u0085x', 'unsafe-characters'],
    ['bidi\u202eabc', 'unsafe-characters'],
    ['zero\u200bwidth', 'unsafe-characters'],
    ['nul\0x', 'unsafe-characters'],
    ['lone\ud800surrogate', 'unsafe-characters'],
    ['https://user:hunter2@example.com/r', 'credential-like'],
    ['https://example.com/r?token=abc123', 'credential-like'],
    ['Bearer abcdefghijkl', 'credential-like'],
  ])('refuses %j as %s', (value, kind) => {
    const result = parseVariableValue(value);
    expect(result.ok === false && result.error.kind).toBe(kind);
  });

  it('M-08 never repeats the value in a refusal', () => {
    for (const value of ['ghp_SECRETVALUE1', 'https://u:SECRETVALUE1@h/', `${'S3CRET'.repeat(300)}`]) {
      expect(JSON.stringify(parseVariableValue(value))).not.toContain('SECRETVALUE1');
      expect(JSON.stringify(parseVariableValue(value))).not.toContain('S3CRETS3CRET');
    }
  });
});
