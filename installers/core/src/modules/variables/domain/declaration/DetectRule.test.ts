// M-18, CM-7: a detect rule has two declarative forms; a command is refused however it is written.
import { describe, expect, it } from 'vitest';
import { parseDetectRule } from '#variables/domain/declaration/DetectRule.ts';

describe('M-18 detect rules', () => {
  it('accepts no rule', () => {
    expect(parseDetectRule(undefined, 'X')).toEqual({ ok: true, value: undefined });
    expect(parseDetectRule(null, 'X')).toEqual({ ok: true, value: undefined });
  });

  it('accepts an env rule and a dir-exists rule', () => {
    expect(parseDetectRule({ kind: 'env', name: 'EDITOR' }, 'EDITOR')).toEqual({
      ok: true,
      value: { kind: 'env', name: 'EDITOR' },
    });
    expect(parseDetectRule({ kind: 'dir-exists', candidates: ['~/ws/ref', '~/work'] }, 'X')).toEqual({
      ok: true,
      value: { kind: 'dir-exists', candidates: ['~/ws/ref', '~/work'] },
    });
  });

  it('M-18 copies only the known fields, so an extra command never survives', () => {
    const result = parseDetectRule({ kind: 'env', name: 'EDITOR', command: 'rm -rf /' }, 'EDITOR');
    expect(JSON.stringify(result)).not.toContain('rm -rf');
  });

  it('M-08 refuses an env rule even for its own name when the name is secret-like', () => {
    expect(parseDetectRule({ kind: 'env', name: 'GITHUB_TOKEN' }, 'GITHUB_TOKEN').ok).toBe(false);
  });

  it.each([
    'DB_PASS',
    'MY_PWD',
    'AUTH_HEADER',
    'SESSION_COOKIE',
    'STRIPE_KEY',
    'SLACK_WEBHOOK_URL',
    'CI_JOB_JWT',
    'GH_PAT',
    'SENTRY_DSN',
    'TLS_CERT',
  ])('M-08 refuses an env rule for %s even under its own name', (name) => {
    expect(parseDetectRule({ kind: 'env', name }, name).ok).toBe(false);
  });

  it.each([
    ['a command rule', { kind: 'command', command: 'ls' }],
    ['a command rule with args', { kind: 'command', command: 'sh', args: ['-c', 'x'] }],
    ['a string', 'ls ~'],
    ['an array', ['env']],
    ['no kind', { name: 'EDITOR' }],
    ['env without a name', { kind: 'env' }],
    ['env with a shell-looking name', { kind: 'env', name: '$(id)' }],
    ['env with a space', { kind: 'env', name: 'A B' }],
    ['env of a token variable', { kind: 'env', name: 'GITHUB_TOKEN' }],
    ['env of a CI job token declared under a harmless name', { kind: 'env', name: 'CI_JOB_JWT' }],
    ['env of a webhook url declared under a harmless name', { kind: 'env', name: 'SLACK_WEBHOOK_URL' }],
    ['env of a personal access token declared under a harmless name', { kind: 'env', name: 'GH_PAT' }],
    ['dir-exists with no list', { kind: 'dir-exists' }],
    ['dir-exists with an empty list', { kind: 'dir-exists', candidates: [] }],
    ['dir-exists outside home', { kind: 'dir-exists', candidates: ['/etc'] }],
    ['dir-exists with dot dot', { kind: 'dir-exists', candidates: ['~/../etc'] }],
    ['dir-exists with a backslash', { kind: 'dir-exists', candidates: ['~/a\\b'] }],
    ['dir-exists with a non-string', { kind: 'dir-exists', candidates: [1] }],
    [
      'dir-exists with 17 folders',
      { kind: 'dir-exists', candidates: Array.from({ length: 17 }, (_u, i) => `~/d${i}`) },
    ],
  ])('refuses %s', (_title, raw) => {
    expect(parseDetectRule(raw, 'EDITOR').ok).toBe(false);
  });
});
