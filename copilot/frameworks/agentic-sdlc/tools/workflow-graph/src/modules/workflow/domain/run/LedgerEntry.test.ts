// LedgerEntry through next, parse and chainsAfter: the chain must detect any edited line (WG-16).
import { describe, expect, it } from 'vitest';
import { LedgerEntry } from '#src/modules/workflow/domain/run/LedgerEntry.ts';

const AT = '2026-11-03T09:00:00.000Z';
const first = LedgerEntry.next(undefined, { run: 'R-001', node: 'P0', result: 'new-feature', actor: 'orchestrator' }, AT, 'agentic-sdlc');
const second = LedgerEntry.next(first, { run: 'R-001', node: 'P1', result: 'done', actor: 'orchestrator' }, AT, 'agentic-sdlc');

describe('LedgerEntry', () => {
  it('numbers lines and chains each to the one before', () => {
    expect([first.seq, second.seq]).toEqual([1, 2]);
    expect(second.chainsAfter(first)).toBe(true);
  });

  it('reads back exactly what it wrote', () => {
    const parsed = LedgerEntry.parse(second.toJsonLine());
    expect(parsed.ok && parsed.value.toJsonLine()).toBe(second.toJsonLine());
    expect(parsed.ok && parsed.value.chainsAfter(first)).toBe(true);
  });

  it('detects a changed result', () => {
    const edited = LedgerEntry.parse(second.toJsonLine().replace('"result":"done"', '"result":"blocked"'));
    expect(edited.ok && edited.value.chainsAfter(first)).toBe(false);
  });

  it('detects a line moved after a different line', () => {
    const other = LedgerEntry.next(undefined, { run: 'R-001', node: 'P0', result: 'fast-path', actor: 'orchestrator' }, AT, 'agentic-sdlc');
    expect(second.chainsAfter(other)).toBe(false);
  });

  it('rejects a line without its required fields', () => {
    expect(LedgerEntry.parse('{"seq":1}')).toEqual({ ok: false, error: 'lacks "prev", "hash", "at", "run", "node", "result", "actor", "gen_ai.workflow.name"' });
  });
});
