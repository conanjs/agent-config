// M-14, AC-8.3: for each path of the retired list, decide whether the installer removes its own link, leaves what is not its own, or keeps
// a link a hook command still names. The decision reads the paths and the hook files; the removal is carried out later through the state
// module, one link at a time, with the link itself checked (never what it points at).
import { textNamesPath } from '#wiring/domain/compat/HookUsage.ts';
import {
  decideRetired,
  type RecordedLink,
  type RetiredDecision,
  type RetiredEntry,
} from '#wiring/domain/compat/RetiredList.ts';
import type { HookFiles } from '#wiring/application/ports/HookFiles.ts';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';

/** What the retired decision needs. */
export interface RetiredRequest {
  /** The list from `compat.yaml`. */
  readonly entries: readonly RetiredEntry[];
  /** The compatibility links the install state recorded (class `compat`), with their targets. */
  readonly recorded: readonly RecordedLink[];
}

/**
 * Says, for each path a release retires, whether the installer removes it, leaves it or keeps it.
 *
 * @param observer - looks at the paths
 * @param hookFiles - reads the agent hook and settings files once for the whole list
 * @param request - the list, what the installer recorded, and the homes
 * @returns one decision per entry, in list order
 */
export function planRetired(observer: PathObserver, hookFiles: HookFiles, request: RetiredRequest): RetiredDecision[] {
  const files = hookFiles.readAll();
  return request.entries.map((entry) =>
    decideRetired(entry.path, {
      observed: observer.observe(entry.path),
      recorded: request.recorded.find((link) => link.path === entry.path),
      usedByHook: files.texts.some((text) => textNamesPath(text, entry.path)),
      hookFilesUnreadable: files.unreadable,
    }),
  );
}
