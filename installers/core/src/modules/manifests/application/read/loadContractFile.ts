import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { MAX_CONTRACT_FILE_BYTES, parseContractFile, type ContractParse } from '#shared/domain/name/NameRules.ts';
import { resolveContainedPath } from '#shared/application/containment/resolveContainedPath.ts';

/** What reading one contract file from a folder gave. */
export type FileLoad =
  | { readonly kind: 'loaded'; readonly parse: ContractParse }
  | { readonly kind: 'absent' }
  | { readonly kind: 'link-escapes'; readonly sentence: string }
  | { readonly kind: 'refused'; readonly sentence: string };

/** What to read: the contract, the folder the file must stay under and its path below it. */
export interface ContractFileRequest {
  /** The contract and major to read the file as. */
  readonly id: 'slots/v1' | 'component/v1' | 'components-list/v1';
  /** The folder the file must stay under. */
  readonly root: string;
  /** The file's path relative to the root. */
  readonly relative: string;
}

/**
 * Reads one contract file that lies under a root: proves its real path stays under the root (M-03, M-04), reads at most the size
 * limit plus one byte (M-17), and hands the text to the contract reader.
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param request - what to read
 * @returns the reader's verdict, `absent` when the root or the file is not there, or why the file was not read
 */
export function loadContractFile(deps: ManifestDeps, request: ContractFileRequest): FileLoad {
  const { ports, flavor } = deps;
  // 1. A root that is not there means the file is not there; nothing is read.
  if (ports.files.folderState(request.root) === 'missing') return { kind: 'absent' };
  // 2. The file's real path, every link followed, must stay under the root.
  const contained = resolveContainedPath({
    probe: ports.probe,
    root: request.root,
    relative: request.relative,
    flavor,
    finalSegment: 'follow-link',
  });
  if (!contained.ok) {
    const kind = contained.error.kind === 'escapes-root' ? 'link-escapes' : 'refused';
    return { kind, sentence: contained.error.reason };
  }
  // 3. Read it within the size limit; a longer file arrives cut one byte past the limit so the reader refuses it by size.
  const read = ports.files.readText(contained.value, MAX_CONTRACT_FILE_BYTES + 1);
  if (read.kind === 'missing') return { kind: 'absent' };
  if (read.kind === 'unreadable') return { kind: 'refused', sentence: 'the file cannot be read' };
  // 4. The contract reader alone judges the content.
  return { kind: 'loaded', parse: parseContractFile(request.id, read.text) };
}
