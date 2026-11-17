import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { RetiredDecision } from '#wiring/domain/compat/RetiredList.ts';

/**
 * Writes the report lines of the retired decisions through the message catalogue (MG-19): one line per link that was removed, left or
 * kept, in list order. A path that was already gone prints nothing, so a second install is quiet.
 *
 * @param decisions - the decisions of `planRetired`
 * @returns the lines: `retired: <path>`, `left: <path>: not the installer's own link`, `kept: <path>: used by a hook command`
 */
export function renderRetired(decisions: readonly RetiredDecision[]): string[] {
  return decisions.flatMap((decision) => {
    if (decision.action === 'remove') return [renderMessage('MG-19.retired', { path: decision.path })];
    if (decision.action === 'left') return [renderMessage('MG-19.not-own', { path: decision.path })];
    return decision.action === 'kept' ? [renderMessage('MG-19.kept', { path: decision.path })] : [];
  });
}
