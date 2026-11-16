// M-07, M-11: a report holds the fields its types name and nothing else. A command that passes an object with an extra key (a raw
// error, a secret, an own `toJSON`) must not see that key reach the screen or the JSON document, so each part of a report is copied
// field by field from the list below, never spread or cloned.
import type { ReportChange, ReportFinding, ReportHome, ReportNeed } from '#shared/domain/report/InstallReport.ts';

// Keeps the listed keys that are present and not undefined, in the listed order; every other own or inherited key is dropped.
function pick<Part extends object>(source: Part, keys: readonly (keyof Part & string)[]): Part {
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    const value: unknown = source[key];
    if (value !== undefined) copy[key] = value;
  }
  return copy as Part;
}

/**
 * Copies the known fields of the agent home part of a report.
 *
 * @param home - the home as a command built it, possibly with extra keys
 * @returns a new home with only `path`, `confirmed`, `source` and `recorded`
 */
export function copyHome(home: ReportHome): ReportHome {
  return pick(home, ['path', 'confirmed', 'source', 'recorded']);
}

/**
 * Copies the known fields of one need, including those of its suggested source.
 *
 * @param need - the need as a command built it
 * @returns a new need with only the fields of {@link ReportNeed}
 */
export function copyNeed(need: ReportNeed): ReportNeed {
  const copy = pick(need, ['kind', 'item', 'detail', 'satisfy', 'proposal', 'component', 'commit', 'terminal']);
  return need.suggested === undefined
    ? copy
    : { ...copy, suggested: pick(need.suggested, ['by', 'verified', 'source']) };
}

/**
 * Copies the known fields of one planned or applied change.
 *
 * @param change - the change as a command built it
 * @returns a new change with only the fields of {@link ReportChange}
 */
export function copyChange(change: ReportChange): ReportChange {
  return pick(change, ['op', 'path', 'target', 'hash', 'class', 'component', 'privileged']);
}

/**
 * Copies the known fields of one finding.
 *
 * @param finding - the finding as a command built it
 * @returns a new finding with only `severity`, `check`, `item`, `detail` and `fix`
 */
export function copyFinding(finding: ReportFinding): ReportFinding {
  return pick(finding, ['severity', 'check', 'item', 'detail', 'fix']);
}
