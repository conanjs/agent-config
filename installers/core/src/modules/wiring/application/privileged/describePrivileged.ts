import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { PrivilegedEntry } from '#wiring/domain/privileged/PrivilegedSet.ts';

/** The lines the needs report shows for one privileged entry, already escaped and redacted by the message catalogue (MG-09). */
export interface PrivilegedLines {
  /** The item of the need: `hook <id> (<agents>, <event>)`, `route <id>` or `service <name> (<kind>)`. */
  readonly item: string;
  /**
   * The detail lines, indented as the catalogue says, one for every field that decides what runs:
   * a hook shows its command and its matcher (`all tools` when it has none);
   * a route shows `when` and `read`, and `before writing` when it has one;
   * a service shows its command and its arguments as a JSON array, so `["-y","pkg --allow-all"]` differs from `["-y","pkg","--allow-all"]`.
   */
  readonly details: readonly string[];
}

/** What a hook with no matcher is shown as. */
export const ALL_TOOLS = 'all tools';

/**
 * Writes the item and the detail lines of one entry through the message catalogue.
 *
 * @param entry - an entry of the privileged set
 * @returns the lines; the component and commit line (MG-03.origin) and the satisfy line (MG-09.satisfy) are the presenter's
 */
export function describePrivileged(entry: PrivilegedEntry): PrivilegedLines {
  const { display } = entry;
  if (display.kind === 'hook') {
    return {
      item: renderMessage('MG-09.hook', { id: display.id, agents: display.agents.join(', '), event: display.event }),
      details: [
        renderMessage('MG-03.detail', { detail: display.command }),
        renderMessage('MG-09.matcher', { matcher: display.matcher ?? ALL_TOOLS }),
      ],
    };
  }
  if (display.kind === 'route') {
    return {
      item: renderMessage('MG-09.route', { id: display.id }),
      details: [
        renderMessage('MG-09.route-detail', { when: display.when, read: display.read }),
        ...(display.beforeWriting === null
          ? []
          : [renderMessage('MG-09.before-writing', { path: display.beforeWriting })]),
      ],
    };
  }
  return {
    item: renderMessage('MG-09.service', { name: display.name, kind: display.serviceKind }),
    details: [renderMessage('MG-09.service-detail', { command: display.command, args: JSON.stringify(display.args) })],
  };
}
