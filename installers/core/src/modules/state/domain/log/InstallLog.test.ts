// M-16, C-4, M-07: one line per run, no variable value, nothing that can break the line or leak a credential.
import { describe, expect, it } from 'vitest';
import { emitLogLine, LOG_ROTATE_BYTES, mustRotateLog, type LogEntry } from '#state/domain/log/InstallLog.ts';

const entry: LogEntry = {
  time: '2026-11-20T09:14:03.000Z',
  command: 'install',
  exit: 0,
  components: [{ name: 'kb-a', source: '/h/src/kb-a', commit_before: 'none', commit_after: 'live' }],
  approved_privileged: [],
};

describe('M-16 a log line', () => {
  it('is one canonical JSON line', () => {
    const line = emitLogLine(entry);
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line)).toEqual(entry);
    expect(line.indexOf('"approved_privileged"')).toBeLessThan(line.indexOf('"time"'));
  });

  it('M-07 hides a credential in a source', () => {
    const line = emitLogLine({
      ...entry,
      components: [{ ...entry.components[0]!, source: 'https://u:s3cr3t-fake@example.invalid/kb.git' }],
    });
    expect(line).not.toContain('s3cr3t-fake');
  });

  it('M-11 keeps a control character from starting a second line', () => {
    const line = emitLogLine({ ...entry, command: 'install\n{"forged":true}' });
    expect(line.slice(0, -1)).not.toContain('\n');
  });

  it('rotates at 1 MiB and not before', () => {
    expect([LOG_ROTATE_BYTES - 1, LOG_ROTATE_BYTES, LOG_ROTATE_BYTES + 1].map(mustRotateLog)).toEqual([
      false,
      true,
      true,
    ]);
  });
});
