import type { GuardOutcome } from '#src/modules/workflow/application/guard-role-launch/GuardOutcome.ts';

const LEDGER = /(^|[\\/])\.specify[\\/]runs[\\/]/;

/** Refuses an edit or write tool call on a run ledger: ledgers are written only by `record` and the approval hook (WG-27). */
export class GuardLedgerEdit {
  /**
   * @param paths - every file path the tool call would write
   * @returns a deny when any path is under `.specify/runs/`, otherwise no decision
   */
  public run(paths: readonly string[]): GuardOutcome {
    const ledger = paths.find((p) => LEDGER.test(p));
    return ledger === undefined
      ? { kind: 'no-decision' }
      : { kind: 'deny', reason: `${ledger} is a run ledger; it is written only by the workflow-graph tool (record, approval hook)` };
  }
}
