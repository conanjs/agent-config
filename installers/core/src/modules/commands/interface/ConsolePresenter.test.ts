// AC-4.3, MG-12: what reaches standard output and standard error, in text and in JSON.
import { describe, expect, it } from 'vitest';
import { buildOutput } from '#commands/application/install/CommandOutput.ts';
import { present, type OutputStreams } from '#commands/interface/ConsolePresenter.ts';

function streams(): OutputStreams & { out_: string[]; err_: string[] } {
  const out_: string[] = [];
  const err_: string[] = [];
  return { out_, err_, out: (text) => out_.push(text), err: (text) => err_.push(text) };
}

const home = { path: '/h/.agent-config', confirmed: true, source: 'recorded' as const };

describe('the presenter', () => {
  it('prints the lines of text mode on standard output, one per line', () => {
    const io = streams();
    present(buildOutput({ command: 'install', status: 'no-changes', home }), 'text', io);
    expect(io.out_.join('')).toBe('agent home: /h/.agent-config (recorded, confirmed)\nstatus: no-changes\n');
    expect(io.err_).toEqual([]);
  });

  it('prints the report as one JSON document on standard output and nothing on standard error', () => {
    const io = streams();
    present(buildOutput({ command: 'install', status: 'no-changes', home }), 'json', io);
    expect(io.err_).toEqual([]);
    expect(io.out_).toHaveLength(1);
    expect(JSON.parse(io.out_[0] ?? '')).toMatchObject({ schema: 'install-report/v1', status: 'no-changes', exit: 0 });
  });

  it('sends a usage error to standard error only', () => {
    const io = streams();
    present(
      buildOutput({ command: 'install', status: 'usage-error', home: null, body: ['usage: agent-config'] }),
      'json',
      io,
    );
    expect(io.out_).toEqual([]);
    expect(io.err_.join('')).toBe('status: usage-error\nusage: agent-config\n');
  });
});
