// The Run aggregate through its public operations only: invalid sequences must be refused (PDM-class-modeled-R6).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';
import { LaunchRequest } from '#src/modules/workflow/domain/launch/LaunchRequest.ts';
import { Approval } from '#src/modules/workflow/domain/run/Approval.ts';
import type { EntryContent } from '#src/modules/workflow/domain/run/EntryContent.ts';
import { Run } from '#src/modules/workflow/domain/run/Run.ts';
import { RunId } from '#src/modules/workflow/domain/run/RunId.ts';

const AT = '2026-11-03T09:00:00.000Z';
const loaded = WorkflowGraph.load(JSON.parse(readFileSync(join(import.meta.dirname, '../../../../../../../workflow.graph.json'), 'utf8')), 'workflow.graph.json');
if (!loaded.ok) throw new Error('the real graph must load');
const graph = loaded.value;
const id = RunId.parse('R-001');
if (!id.ok) throw new Error('R-001 is a run id');

const step = (node: string, result: string, extra: Partial<EntryContent> = {}): EntryContent => ({ run: 'R-001', node, result, actor: 'orchestrator', ...extra });
const from = { source: 'claude-code:UserPromptSubmit', session: 's1' };

function play(...steps: Array<EntryContent | string>): Run {
  let run = Run.fromLedger(id.ok ? id.value : (undefined as never), graph, [], ['T001']);
  for (const s of steps) {
    const next = typeof s === 'string' ? run.approve(Approval.allIn(s)[0] as Approval, from, AT) : run.record(s, AT);
    if (!next.ok) throw new Error(`step refused: ${JSON.stringify(next.error)}`);
    run = next.value.run;
  }
  return run;
}

const launch = (prompt: string): LaunchRequest => {
  const parsed = LaunchRequest.fromPrompt(prompt);
  if (!parsed.ok || parsed.value === 'none') throw new Error('a launch prompt');
  return parsed.value;
};

describe('Run', () => {
  it('refuses a phase launch while its gate waits for the human', () => {
    const run = play(step('P0', 'new-feature'), step('P1', 'done'), 'approve G0 R-001', step('P3', 'done'));
    expect(run.permitLaunch(launch('phase: P4\nmode: decide\nrun: R-001'))).toEqual({ ok: false, error: 'G2 is not approved in run R-001: reply "approve G2 R-001" to approve' });
  });

  it('allows the launch once the gate is approved', () => {
    const run = play(step('P0', 'new-feature'), step('P1', 'done'), 'approve G0 R-001', step('P3', 'done'), 'approve G2 R-001');
    expect(run.permitLaunch(launch('phase: P4\nmode: decide\nrun: R-001'))).toEqual({ ok: true, value: true });
  });

  it('refuses to record a gate result for the orchestrator', () => {
    const run = play(step('P0', 'new-feature'), step('P1', 'done'));
    expect(run.record(step('G0', 'approved'), AT).ok).toBe(false);
  });

  it('refuses an approval for a gate that is not open', () => {
    const run = play(step('P0', 'new-feature'), step('P1', 'done'));
    expect(run.approve(Approval.allIn('approve G3 R-001')[0] as Approval, from, AT)).toEqual({ ok: false, error: 'G3 is not the open gate of R-001' });
  });

  it('counts the execute attempts of a task and stops at the budget', () => {
    const steps = [step('P0', 'fast-path')];
    for (let i = 0; i < 3; i += 1) steps.push(step('P6.execute', 'done', { task: 'T001' }), step('P6.checks', 'fail', { task: 'T001' }));
    const run = play(...steps);
    expect(run.record(step('P6.execute', 'done', { task: 'T001' }), AT).ok).toBe(false);
    expect(run.status().tasks[0]).toMatchObject({ task: 'T001', attempts: 3, retriesLeft: [{ budget: 're-execute-after-check', left: 0 }] });
  });

  it('replays its own ledger with no findings (the hash chain holds)', () => {
    const run = play(step('P0', 'new-feature'), step('P1', 'done'), 'approve G0 R-001');
    expect(run.findings).toEqual([]);
    expect(run.status().next).toEqual(['P3']);
  });
});
