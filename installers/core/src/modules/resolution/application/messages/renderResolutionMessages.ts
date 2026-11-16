// The printed texts of the resolution module, all rows of the shared message catalogue (TR-5). `renderMessage` hides credentials and
// shows control characters in each value, so a hostile component name or contract text cannot print a secret or a line.
import type { ReportNeed } from '#shared/domain/report/InstallReport.ts';
import type { ComponentNeed, ResolutionError } from '#resolution/domain/model/Resolution.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';

/**
 * Writes one failure of resolution as its catalogue line (MG-24 to MG-28, MG-44, MG-45).
 *
 * @param error - one entry of `ResolutionResult.errors`
 * @returns the line, without a line break; a dependency cycle starts at its smallest name and ends where it began
 */
export function renderResolutionError(error: ResolutionError): string {
  switch (error.kind) {
    case 'cycle':
      return renderMessage('MG-24', { cycle: [...error.cycle, error.cycle[0] ?? ''].join(' -> ') });
    case 'contract':
      return renderMessage('MG-25', {
        consumer: error.consumer,
        contract: error.contract,
        slot: error.slot,
        provider: error.provider,
        offered: error.offered.length > 0 ? error.offered.join(', ') : 'no contract',
      });
    case 'export':
      return renderMessage('MG-26', {
        consumer: error.consumer,
        file: error.file,
        path: error.path,
        provider: error.provider,
      });
    case 'count':
      return renderMessage('MG-27', { slot: error.slot, first: error.first, second: error.second });
    case 'runtime':
      return error.tool === 'node'
        ? renderMessage('MG-28', { name: error.component, range: error.range, version: error.found })
        : renderMessage('MG-44', { name: error.component, tool: error.tool, range: error.range, version: error.found });
    case 'unsafe-suggestion':
      return renderMessage('MG-45', { name: error.component });
  }
}

/**
 * Turns the component needs into report needs (MG-06, MG-07): kind components, the item slot name, the detail contract and no
 * provider, and the one command that satisfies it. A suggested source is carried as data labelled unverified and is never part of a
 * command (M-11); only the first suggestion is shown, because a need has one suggested field.
 *
 * @param needs - `ResolutionResult.needs`
 * @returns the needs in the same order, for the report builder
 */
export function toReportNeeds(needs: readonly ComponentNeed[]): readonly ReportNeed[] {
  return needs.map((need) => {
    const [first] = need.suggested;
    return {
      kind: 'components',
      item: `slot ${need.slot}`,
      detail: `contract ${need.contract}, no provider`,
      satisfy: 'add <name> <source>',
      ...(first === undefined ? {} : { suggested: { by: first.by, verified: false as const, source: first.source } }),
    };
  });
}
