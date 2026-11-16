import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { findEscapingLinks } from '#manifests/application/read/findEscapingLinks.ts';
import { pathSourceProblem, type PathSourceGuard } from '#manifests/application/read/checkPathSource.ts';
import { loadContractFile } from '#manifests/application/read/loadContractFile.ts';
import { decodeComponent } from '#manifests/domain/decode/decodeComponent.ts';
import type { ContractFinding } from '#shared/domain/name/NameRules.ts';
import type { ComponentManifest } from '#manifests/domain/model/Component.ts';
import type { ComponentSkip, SkipReason } from '#manifests/domain/model/Issues.ts';
import type { SlotTable } from '#manifests/domain/model/Slots.ts';
import { findingsSentence } from '#manifests/domain/rules/findingSentences.ts';
import { checkAgainstSlot, ownFolderPaths, pointsIntoGitFolder } from '#manifests/domain/rules/slotRules.ts';
import { resolveContainedPath } from '#shared/application/containment/resolveContainedPath.ts';

/** The manifest file every component carries at its root. */
export const MANIFEST_FILE = 'component.yaml';

/** What reading one component folder gave. */
export type ComponentRead =
  | {
      readonly kind: 'loaded';
      readonly manifest: ComponentManifest;
      /** The absolute component root the manifest was read from. */
      readonly root: string;
      /** What the contract reader tolerated, such as unknown keys (CM-1); each is printed by `renderComponentWarning`. */
      readonly warnings: readonly ContractFinding[];
    }
  | { readonly kind: 'skipped'; readonly skip: ComponentSkip }
  | {
      /** A `path` source names the user's home, a folder that holds it, or the agent home or a folder around it (M-03): the run fails (MG-31.refused), it does not skip. */
      readonly kind: 'source-refused';
      readonly name: string;
      readonly folder: string;
      /** Why, as a clause that ends the sentence of the message. */
      readonly reason: string;
    }
  | {
      /** The folder is not there (a `path` source that was moved): the run fails with MG-31, it does not skip. */
      readonly kind: 'folder-missing';
      readonly name: string;
      readonly folder: string;
    };

/** Where the folder of a component comes from. */
export type ComponentSourceKind =
  { readonly kind: 'path'; readonly guard: PathSourceGuard } | { readonly kind: 'clone' } | { readonly kind: 'core' };

/** What a caller gives to read one component. */
export interface ReadComponentRequest {
  /** The name the list gives the component; the manifest must carry the same one. */
  readonly name: string;
  /** The absolute component root: the managed clone, or the folder of a `path` source. */
  readonly root: string;
  /** The slots of slots/v1. */
  readonly slots: SlotTable;
  /**
   * Where the folder comes from, which cannot be left out: a `path` source carries the folders it must keep away from (M-03), a
   * managed `clone` is the installer's own copy, and `core` is agent-config's own manifest, the only one that may fill a reserved slot.
   */
  readonly source: ComponentSourceKind;
}

function skipped(name: string, reason: SkipReason): ComponentRead {
  return { kind: 'skipped', skip: { name, reason } };
}

// A manifest field that points at its own folder must keep to it once links are followed (M-03, CM-3), stay out of `.git` (M-04), and be
// what the contract says it is: a folder for a location, skills or agents, a regular file for the index (M-13: a pipe or device is never opened).
function fieldProblem(deps: ManifestDeps, root: string, field: string, relative: string): SkipReason | undefined {
  const contained = resolveContainedPath({
    probe: deps.ports.probe,
    root,
    relative,
    flavor: deps.flavor,
    finalSegment: 'follow-link',
  });
  if (!contained.ok) {
    return contained.error.kind === 'escapes-root'
      ? { kind: 'symlink', path: relative }
      : { kind: 'invalid', sentence: `${field} ${contained.error.reason}` };
  }
  const { realRoot, realPath } = contained.value;
  if (pointsIntoGitFolder(relative, realRoot, realPath, deps.flavor)) {
    return { kind: 'invalid', sentence: `${field} must not be inside a .git folder (M-04)` };
  }
  const found = deps.ports.files.entryKind(contained.value);
  const wanted = field === 'provides.index' ? 'file' : 'folder';
  if (found === wanted) return undefined;
  if (found === 'missing') return { kind: 'invalid', sentence: `${field} is not there` };
  const wording = wanted === 'file' ? 'a regular file' : 'a folder';
  return { kind: 'invalid', sentence: `${field} must be ${wording}` };
}

function escapingField(deps: ManifestDeps, root: string, manifest: ComponentManifest): SkipReason | undefined {
  for (const [field, relative] of ownFolderPaths(manifest)) {
    const problem = fieldProblem(deps, root, field, relative);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

function escapingLink(deps: ManifestDeps, root: string): SkipReason | undefined {
  const check = findEscapingLinks(deps, root);
  if (check.kind === 'escapes') return { kind: 'symlink', path: check.link };
  return check.kind === 'unchecked'
    ? { kind: 'invalid', sentence: 'the folder could not be checked for links that leave it (M-04)' }
    : undefined;
}

// component.yaml of a folder: under the root with links followed, within the size limit, valid for the contract reader.
interface ReadManifest {
  readonly manifest: ComponentManifest;
  readonly warnings: readonly ContractFinding[];
}

function readManifest(deps: ManifestDeps, request: ReadComponentRequest): ReadManifest | ComponentSkip {
  const { name, root } = request;
  const loaded = loadContractFile(deps, { id: 'component/v1', root, relative: MANIFEST_FILE });
  const skip = (reason: SkipReason): ComponentSkip => ({ name, reason });
  if (loaded.kind === 'absent') return skip({ kind: 'no-manifest', folder: root });
  if (loaded.kind === 'link-escapes') return skip({ kind: 'symlink', path: MANIFEST_FILE });
  if (loaded.kind === 'refused') return skip({ kind: 'invalid', sentence: loaded.sentence });
  if (!loaded.parse.ok) return skip({ kind: 'invalid', sentence: findingsSentence(loaded.parse.findings) });
  const manifest = decodeComponent(loaded.parse.value);
  return manifest.name === name
    ? { manifest, warnings: loaded.parse.warnings }
    : skip({ kind: 'invalid', sentence: 'name does not match the name in the list' });
}

// The folder is there, and a `path` source keeps away from the user's home, what holds it, and the agent home (M-03).
function checkFolder(deps: ManifestDeps, request: ReadComponentRequest): ComponentRead | undefined {
  const { name, root, source } = request;
  const folder = deps.ports.files.folderState(root);
  if (folder === 'missing' || folder === 'not-folder') return { kind: 'folder-missing', name, folder: root };
  if (folder === 'unknown') return skipped(name, { kind: 'invalid', sentence: 'the folder cannot be read' });
  const refused = source.kind === 'path' ? pathSourceProblem(deps, root, source.guard) : undefined;
  return refused === undefined ? undefined : { kind: 'source-refused', name, folder: root, reason: refused };
}

/**
 * Reads and validates one component folder: its `component.yaml` through the contract reader, then everything the reader cannot
 * see (the slot, the name, what each path field really is on disk, and links), so a component that passes has folders where it names
 * folders and a regular file for its index; the caller still proves containment again at each write (the shared header).
 *
 * Every fault of one component skips that component and no other (FR-021, AC-5.8, M-03, M-04, M-17); only a folder that is gone
 * (AC-3.3) or a `path` source that names a forbidden folder (M-03) is an error for the run instead.
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param request - the component name, its root, the slots and who named it
 * @returns the manifest, the reason the component is skipped, or the folder that is missing
 */
export function readComponent(deps: ManifestDeps, request: ReadComponentRequest): ComponentRead {
  const { name, root } = request;
  // 1. The folder must be there, and a `path` source must keep away from the homes (M-03).
  const folderResult = checkFolder(deps, request);
  if (folderResult !== undefined) return folderResult;
  // 2. The manifest, valid and naming the same component as the list.
  const read = readManifest(deps, request);
  if ('reason' in read) return { kind: 'skipped', skip: read };
  const { manifest } = read;
  // 3. The slot, then the paths and links of the folder.
  const reason =
    checkAgainstSlot(manifest, request.slots, request.source.kind === 'core' ? 'core' : 'list') ??
    escapingField(deps, root, manifest) ??
    escapingLink(deps, root);
  return reason === undefined ? { kind: 'loaded', manifest, root, warnings: read.warnings } : skipped(name, reason);
}
