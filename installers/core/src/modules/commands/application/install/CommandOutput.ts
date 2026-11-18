// How a command result becomes the one report and the lines of text mode (DR-305, installer-cli.md "Grammar"): the home line, the
// status line, then the body. Every line is a row of the message catalogue, so it is redacted and escaped before it exists; the report
// goes through `buildReport`, which redacts and escapes once more. The presenter only prints what it is given here.
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type {
  CommandName,
  InstallReport,
  ReportChange,
  ReportFinding,
  ReportHome,
  ReportNeed,
  ReportStatus,
} from '#shared/domain/report/InstallReport.ts';
import { buildReport, orderNeeds } from '#shared/domain/report/ReportRules.ts';
import type { CommandOutput } from '#commands/application/install/InstallTypes.ts';

/** One warning or error of a run: the check that found it, what it is about, and the exact line text mode prints. */
export interface Notice {
  /** An error makes the run exit 1; a warning does not. */
  readonly severity: 'error' | 'warning';
  /** A short id such as `component-skipped`, for `--json`. */
  readonly check: string;
  /** What it is about, such as a component name. */
  readonly item: string;
  /** The finished line, also the start of the `detail` of the finding in `--json`. */
  readonly line: string;
  /** Lines that follow the first one in text mode, such as the `cause:` line of MG-32 and MG-38. */
  readonly more?: readonly string[];
}

/**
 * Gives the lines text mode prints for a notice.
 *
 * @param found - the warning or error
 * @returns its first line, then the lines that follow it
 */
export function noticeText(found: Notice): readonly string[] {
  return [found.line, ...(found.more ?? [])];
}

/** One need with the lines text mode prints for it once its number in the ordered list is known. */
export interface PlannedNeed {
  /** The need as `--json` shows it. */
  readonly need: ReportNeed;
  /**
   * Renders the lines of this need once its place in the ordered list is known, because the first line starts with that number.
   *
   * @param number - the 1-based position of the need in the ordered list
   * @returns the lines of MG-03 and the rows under it, in print order
   */
  lines(number: number): readonly string[];
}

/** Everything a command knows when it ends. */
export interface OutputParts {
  /** The command that ran. */
  readonly command: CommandName;
  /** How it ended. */
  readonly status: ReportStatus;
  /** The agent home, or null when none could be chosen. */
  readonly home: ReportHome | null;
  /** The body lines before the needs, in print order: progress, warnings and errors. */
  readonly body?: readonly string[];
  /** The warnings and errors, for `--json`; their lines are in `body`. */
  readonly notices?: readonly Notice[];
  /** What V must supply; ordered home, components, variables, privileged. */
  readonly needs?: readonly PlannedNeed[];
  /** The planned or applied changes. */
  readonly changes?: readonly ReportChange[];
  /** The backup folder of this run, when one was made. */
  readonly backup?: string | null;
}

/**
 * Writes the home line of every run: MG-01, or the move form while a move is not confirmed.
 *
 * @param home - the home as the run saw it
 * @returns the line, without a line break
 */
export function homeLine(home: ReportHome): string {
  if (home.recorded !== undefined && !home.confirmed) {
    return renderMessage('MG-01.move', { home: home.path, source: home.source, recordedHome: home.recorded });
  }
  return renderMessage('MG-01', {
    home: home.path,
    source: home.source,
    confirmation: home.confirmed ? 'confirmed' : 'not confirmed',
  });
}

/**
 * Removes the three spaces of indent a catalogue row carries, for the field of the same text in `--json`.
 *
 * @param line - a finished catalogue line
 * @returns the line without its leading spaces
 */
export function plain(line: string): string {
  return line.trimStart();
}

function findingOf(notice: Notice): ReportFinding {
  return {
    severity: notice.severity,
    check: notice.check,
    item: notice.item,
    detail: noticeText(notice).map(plain).join('; '),
    fix: '',
  };
}

/**
 * Builds the report and the text of a run from what it knows.
 *
 * Needs are put in report order (home, components, variables, privileged), numbered from 1, and printed after the other body lines.
 *
 * @param parts - the facts of the run
 * @returns the report for `--json` and the lines for text mode
 */
export function buildOutput(parts: OutputParts): CommandOutput {
  const planned = parts.needs ?? [];
  const ordered = orderNeeds(planned.map((each) => each.need));
  const blocks = ordered.flatMap((need, index) => {
    const found = planned.find((each) => each.need === need);
    return found === undefined ? [] : found.lines(index + 1);
  });
  const report: InstallReport = buildReport({
    command: parts.command,
    status: parts.status,
    home: parts.home,
    needs: ordered,
    changes: parts.changes ?? [],
    findings: (parts.notices ?? []).map(findingOf),
    backup: parts.backup ?? null,
  });
  const head = [
    ...(parts.home === null ? [] : [homeLine(parts.home)]),
    renderMessage('MG-02', { status: parts.status }),
  ];
  return { report, text: [...head, ...(parts.body ?? []), ...blocks] };
}
