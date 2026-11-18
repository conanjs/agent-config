// The four kinds of need and the lines text mode prints for each (MG-03 to MG-10). Each function builds the need as `--json` shows it
// and a function that writes its block once its number is known. A suggested source is data labelled unverified and is never part of
// a satisfy line (M-11, AC-4.5).
import { toReportNeeds } from '#resolution/application/messages/renderResolutionMessages.ts';
import type { ComponentNeed } from '#resolution/application/ResolutionTypes.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { ReportHome, ReportNeed } from '#shared/domain/report/InstallReport.ts';
import type { VariableNeed } from '#variables/application/needs/findVariableNeeds.ts';
import type { WiringApi } from '#wiring/application/WiringApi.ts';
import type { WiringPrivilegedDiff } from '#wiring/application/WiringTypes.ts';
import { plain, type PlannedNeed } from '#commands/application/install/CommandOutput.ts';

// MG-10 closes a home or a privileged need only when no person can answer (AC-4.7).
function terminalLine(needed: boolean): readonly string[] {
  return needed ? [renderMessage('MG-10', {})] : [];
}

/**
 * Builds the need to confirm the agent home, or to confirm moving it (MG-04, MG-05).
 *
 * @param home - the home as the run chose it; `recorded` is set for a move
 * @param terminalAttached - true when an interactive terminal is attached; when false the need says one is needed (MG-10, AC-4.7)
 * @returns the need and its lines
 */
export function homeNeed(home: ReportHome, terminalAttached: boolean): PlannedNeed {
  const detail =
    home.recorded === undefined
      ? renderMessage('MG-04.detail', {})
      : renderMessage('MG-05.detail', { oldHome: home.recorded, newHome: home.path });
  const satisfy = renderMessage('MG-04.satisfy', {});
  const need: ReportNeed = {
    kind: 'home',
    item: home.path,
    detail: plain(detail),
    satisfy: plain(satisfy).replace(/^satisfy: /, ''),
    ...(terminalAttached ? {} : { terminal: 'needed' as const }),
  };
  return {
    need,
    lines: (number) => [
      renderMessage('MG-04', { number: String(number), home: home.path }),
      detail,
      satisfy,
      ...terminalLine(!terminalAttached),
    ],
  };
}

/**
 * Builds the needs for slots nothing fills (MG-06, MG-07), one per slot and contract.
 *
 * @param needs - `ResolutionResult.needs`
 * @returns the needs in the same order, each with its lines
 */
export function componentNeeds(needs: readonly ComponentNeed[]): readonly PlannedNeed[] {
  const reports = toReportNeeds(needs);
  return needs.map((found, index) => {
    const need = reports[index];
    if (need === undefined) throw new Error('the report needs and the component needs differ in length');
    return {
      need,
      lines: (number) => [
        renderMessage('MG-06', { number: String(number), slot: found.slot }),
        renderMessage('MG-06.detail', { contract: found.contract }),
        renderMessage('MG-06.satisfy', {}),
        ...(need.suggested === undefined
          ? []
          : [renderMessage('MG-07', { component: need.suggested.by, source: need.suggested.source })]),
      ],
    };
  });
}

/**
 * Builds the needs for required variables with no value (MG-08), with the proposal when the installer has one.
 *
 * @param needs - what `findVariableNeeds` found, in declaration order
 * @returns the needs in the same order, each with its lines
 */
export function variableNeeds(needs: readonly VariableNeed[]): readonly PlannedNeed[] {
  return needs.map((found) => {
    const detail = renderMessage('MG-08.detail', {
      description: found.description,
      component: found.declaredBy.join(', '),
    });
    const satisfy = renderMessage('MG-08.satisfy', { name: found.name });
    const need: ReportNeed = {
      kind: 'variables',
      item: found.name,
      detail: plain(detail),
      satisfy: plain(satisfy).replace(/^satisfy: /, ''),
      ...(found.proposal === undefined ? {} : { proposal: found.proposal }),
    };
    return {
      need,
      lines: (number) => [
        renderMessage('MG-08', { number: String(number), name: found.name }),
        detail,
        satisfy,
        ...(found.proposal === undefined ? [] : [renderMessage('MG-03.proposal', { text: found.proposal })]),
      ],
    };
  });
}

/**
 * Builds the needs for privileged entries that are new or changed against what V approved (MG-09), each listed in full with its
 * component and commit (AC-4.6).
 *
 * @param pending - `PrivilegedDiff.pending`, sorted by key
 * @param wiring - writes the item and detail lines of an entry
 * @param terminalAttached - true when an interactive terminal is attached; when false each need says one is needed (MG-10, AC-4.7)
 * @returns the needs in the same order, each with its lines
 */
export function privilegedNeeds(
  pending: WiringPrivilegedDiff['pending'],
  wiring: Pick<WiringApi, 'describePrivileged'>,
  terminalAttached: boolean,
): readonly PlannedNeed[] {
  return pending.map(({ entry }) => {
    const described = wiring.describePrivileged(entry);
    const satisfy = renderMessage('MG-09.satisfy', {});
    const need: ReportNeed = {
      kind: 'privileged',
      item: described.item,
      detail: described.details.map(plain).join('; '),
      satisfy: plain(satisfy).replace(/^satisfy: /, ''),
      component: entry.component,
      commit: entry.commit,
      ...(terminalAttached ? {} : { terminal: 'needed' as const }),
    };
    return {
      need,
      lines: (number) => [
        renderMessage('MG-09', { number: String(number), item: described.item }),
        ...described.details,
        renderMessage('MG-03.origin', { component: entry.component, commit: entry.commit }),
        satisfy,
        ...terminalLine(!terminalAttached),
      ],
    };
  });
}
