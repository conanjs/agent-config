import { ExitCode } from '#shared/domain/exit/ExitCode.ts';
import { copyChange, copyFinding, copyHome, copyNeed } from '#shared/domain/report/copyKnownFields.ts';
import { redactDeep } from '#shared/domain/redaction/redactDeep.ts';
import type { InstallReport, NeedKind, ReportNeed, ReportStatus } from '#shared/domain/report/InstallReport.ts';

const EXIT_CODE_OF_STATUS: Readonly<Record<ReportStatus, ExitCode>> = {
  done: ExitCode.done,
  'no-changes': ExitCode.done,
  'needs-input': ExitCode.needsInput,
  failed: ExitCode.failed,
  'usage-error': ExitCode.usageError,
};

const NEED_ORDER: Readonly<Record<NeedKind, number>> = { home: 0, components: 1, variables: 2, privileged: 3 };

/**
 * Looks up the exit code that goes with a run status.
 *
 * @param status - how the run ended
 * @returns 0 for done and no-changes, 10 for needs-input, 1 for failed, 2 for usage-error
 */
export function exitCodeForStatus(status: ReportStatus): ExitCode {
  return EXIT_CODE_OF_STATUS[status];
}

/**
 * Sorts needs into the order V is asked in: home, components, variables, privileged; needs of one kind keep their order.
 *
 * @param needs - the needs in any order
 * @returns a new list in report order
 */
export function orderNeeds(needs: readonly ReportNeed[]): readonly ReportNeed[] {
  return needs
    .map((need, index) => ({ need, index }))
    .sort((a, b) => NEED_ORDER[a.need.kind] - NEED_ORDER[b.need.kind] || a.index - b.index)
    .map(({ need }) => need);
}

/** The facts a command knows when it ends; the rest of the report follows from them. */
export type ReportDraft = Pick<InstallReport, 'command' | 'status'> &
  Partial<Pick<InstallReport, 'home' | 'needs' | 'changes' | 'findings' | 'backup'>>;

/**
 * Completes a draft into a report: fills the exit code from the status, copies only the known fields of each part, orders the needs, defaults the lists, and redacts and escapes every
 * string (M-07, M-11), so no presenter can print an unredacted report.
 *
 * @param draft - what the command knows
 * @returns the finished, redacted report
 */
export function buildReport(draft: ReportDraft): InstallReport {
  const report: InstallReport = {
    schema: 'install-report/v1',
    command: draft.command,
    status: draft.status,
    exit: exitCodeForStatus(draft.status),
    home: draft.home === undefined || draft.home === null ? null : copyHome(draft.home),
    needs: orderNeeds(draft.needs ?? []).map(copyNeed),
    changes: (draft.changes ?? []).map(copyChange),
    findings: (draft.findings ?? []).map(copyFinding),
    backup: draft.backup ?? null,
  };
  return redactDeep(report);
}
