import path from 'node:path';
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { loadContractFile } from '#manifests/application/read/loadContractFile.ts';
import type { FileFailure } from '#manifests/application/read/readSlots.ts';
import { decodeList } from '#manifests/domain/decode/decodeList.ts';
import type { ComponentList } from '#manifests/domain/model/ComponentList.ts';
import { checkListEntries, listIssuesOf } from '#manifests/domain/rules/listRules.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** Which of the two lists to read. */
export type ListKind = 'public' | 'local';

/** What to read: which list, and the folder it lies in. */
export interface ListRequest {
  /** `public` for components.yaml, `local` for components.local.yaml. */
  readonly kind: ListKind;
  /** The folder the file lies in: the checkout for the public list, the home for the local one. */
  readonly root: string;
}

/** The file name of each list. */
export const LIST_FILE: Readonly<Record<ListKind, string>> = {
  public: 'components.yaml',
  local: 'components.local.yaml',
};

/**
 * Reads and validates one component list (components-list/v1): `components.yaml` in the agent-config checkout or
 * `components.local.yaml` in the agent home.
 *
 * A file that is not there is an empty list marked not present, so the caller decides whether that matters (the local list may be
 * absent; the public one is expected). Any fault refuses the whole list (MG-23); a source address with credentials names the
 * component and nothing else (M-07).
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param request - what to read
 * @returns the list, or the file's path with every issue
 */
export function readComponentList(deps: ManifestDeps, request: ListRequest): Result<ComponentList, FileFailure> {
  const relative = LIST_FILE[request.kind];
  const file = path[deps.flavor].join(request.root, relative);
  const local = request.kind === 'local';
  // 1. Read the file under its folder.
  const loaded = loadContractFile(deps, { id: 'components-list/v1', root: request.root, relative });
  if (loaded.kind === 'absent') return succeed({ local, entries: [], present: false });
  if (loaded.kind !== 'loaded') return refuse({ file, issues: [{ kind: 'invalid', sentence: loaded.sentence }] });
  // 2. The contract reader's verdict, turned into issues.
  if (!loaded.parse.ok) return refuse({ file, issues: listIssuesOf(loaded.parse) });
  // 3. The faults across entries and on this machine.
  const list = decodeList(loaded.parse.value);
  const issues = checkListEntries(list, local, deps.gitPolicy, deps.flavor);
  return issues.length === 0 ? succeed(list) : refuse({ file, issues });
}
