// The exit code table (installer-cli.md, "Exit codes") and the report rules: status to exit, need order, redaction of the whole report.
import { describe, expect, it } from 'vitest';
import { ExitCode } from '#shared/domain/exit/ExitCode.ts';
import type { ReportNeed, ReportStatus } from '#shared/domain/report/InstallReport.ts';
import { redactDeep } from '#shared/domain/redaction/redactDeep.ts';
import { buildReport, exitCodeForStatus, orderNeeds } from '#shared/domain/report/ReportRules.ts';

describe('exit codes', () => {
  it('are 0 done, 10 needs input, 1 failed, 2 usage error', () => {
    expect(ExitCode).toEqual({ done: 0, needsInput: 10, failed: 1, usageError: 2 });
  });

  it.each<[ReportStatus, number]>([
    ['done', 0],
    ['no-changes', 0],
    ['needs-input', 10],
    ['failed', 1],
    ['usage-error', 2],
  ])('maps status %s to exit %i', (status, exit) => {
    expect(exitCodeForStatus(status)).toBe(exit);
  });
});

const need = (kind: ReportNeed['kind'], item: string): ReportNeed => ({ kind, item, detail: 'd', satisfy: 's' });

describe('orderNeeds', () => {
  it('sorts home, components, variables, privileged and keeps the order inside a kind', () => {
    const input = [
      need('privileged', 'p1'),
      need('variables', 'v2'),
      need('components', 'c1'),
      need('variables', 'v1'),
      need('home', 'h'),
    ];
    expect(orderNeeds(input).map((entry) => entry.item)).toEqual(['h', 'c1', 'v2', 'v1', 'p1']);
  });

  it('does not change the list it was given', () => {
    const input = [need('variables', 'v'), need('home', 'h')];
    orderNeeds(input);
    expect(input.map((entry) => entry.item)).toEqual(['v', 'h']);
  });
});

describe('M-07 buildReport', () => {
  it('fills the exit code, defaults the lists and orders the needs', () => {
    const report = buildReport({
      command: 'install',
      status: 'needs-input',
      needs: [need('variables', 'V'), need('home', 'H')],
    });
    expect(report).toMatchObject({
      schema: 'install-report/v1',
      exit: 10,
      home: null,
      changes: [],
      findings: [],
      backup: null,
    });
    expect(report.needs.map((entry) => entry.kind)).toEqual(['home', 'variables']);
  });

  it('redacts credentials in every field', () => {
    const report = buildReport({
      command: 'plan',
      status: 'needs-input',
      needs: [
        {
          ...need('components', 'slot x'),
          suggested: { by: 'c', verified: false, source: 'https://h.invalid/x?token=SECRETQUERY' },
        },
      ],
      findings: [{ severity: 'error', check: 'c', item: 'https://u:s3cr3t@h.invalid/x', detail: 'd', fix: 'f' }],
      backup: '/b',
    });
    expect(JSON.stringify(report)).not.toMatch(/SECRETQUERY|s3cr3t/);
  });

  it('M-07 copies only the known fields, so an extra key cannot carry a secret or a raw byte', () => {
    const finding = {
      severity: 'error',
      check: 'c',
      item: 'i',
      detail: 'd',
      fix: 'f',
      extra: 'https://u:SECRET@h.invalid/x \u009b31m',
    } as const;
    const report = buildReport({ command: 'doctor', status: 'failed', findings: [finding] });
    expect(report.findings).toEqual([{ severity: 'error', check: 'c', item: 'i', detail: 'd', fix: 'f' }]);
    expect(JSON.stringify(report)).not.toMatch(/SECRET|extra|\u009b/);
  });

  it.each([
    [
      'a need',
      {
        needs: [
          { ...need('home', 'h'), raw: 'SECRET', suggested: { by: 'c', verified: false, source: 's', raw: 'SECRET' } },
        ],
      },
    ],
    [
      'a change',
      { changes: [{ op: 'link', path: 'p', class: 'linked', component: 'c', privileged: false, raw: 'SECRET' }] },
    ],
    ['the home', { home: { path: '/h', confirmed: true, source: 'default', raw: 'SECRET' } }],
  ] as const)('M-07 drops an extra key of %s', (_title, draft) => {
    const report = buildReport({ command: 'plan', status: 'done', ...(draft as object) });
    expect(JSON.stringify(report)).not.toMatch(/SECRET|raw/);
  });

  it('M-07 a home with its own toJSON cannot choose what is printed', () => {
    const home = {
      path: '/h',
      confirmed: true,
      source: 'default',
      toJSON: () => ({ path: 'https://u:SECRET@h.invalid/x' }),
    } as const;
    const report = buildReport({ command: 'plan', status: 'done', home });
    expect(JSON.stringify(report)).not.toMatch(/SECRET|toJSON/);
    expect(JSON.parse(JSON.stringify(report.home))).toEqual({ path: '/h', confirmed: true, source: 'default' });
  });
});

describe('M-11 redactDeep on keys and functions', () => {
  it('shows control characters in keys and drops function values', () => {
    const output = redactDeep({ 'a\u009bb': 1, f: () => 'x', toJSON: () => 'y', ok: 'v' });
    expect(output).toEqual({ 'a\\x9bb': 1, ok: 'v' });
  });

  it('redacts a credential in a key', () => {
    expect(JSON.stringify(redactDeep({ 'https://u:SECRET@h.invalid/x': 1 }))).not.toContain('SECRET');
  });
});
