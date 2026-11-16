// M-03 and M-04, the real-path half of containment. The pure half is domain/path/PathContainment.ts.
//
// FOR T132 AND EVERY CALLER (the file system adapters and the commands that write): a ContainedPath is proof about the disk as it was
// a moment ago, not a lock. So
//   - create folders one level at a time and check again after each one (mkdir, then resolveContainedPath on the new folder);
//   - write a file by opening a temp file with the exclusive flag `wx` in the checked folder and renaming it onto the target,
//     never by opening the target for writing;
//   - to remove or replace a link use `keep-link` (the link itself is checked, not its target), `lstat` to confirm it is a link,
//     then `unlink`; never `rm -r` through a path that may hold a link;
//   - hand the file system `realPath` of the result, not the text the component wrote.
// The FileSystem and Links ports of T132 take a ContainedPath, so an unchecked string cannot reach them.
import path from 'node:path';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import {
  isSameOrInside,
  joinUnderRoot,
  type ContainmentViolation,
  type PathFlavor,
} from '#shared/domain/path/PathContainment.ts';
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';

// Type-level only (`declare` emits nothing) and not exported: no other module can write the key, so an object literal cannot pass
// for a ContainedPath; only the cast inside resolveContainedPath makes one.
declare const contained: unique symbol;

/** How the last segment of the path is treated. */
export type FinalSegment = 'follow-link' | 'keep-link';

/** The path to read or write and the root it was proven to stay in. */
export interface ContainedPath {
  /** The canonical path of the target, links followed, ready to hand to the file system. */
  readonly realPath: string;
  /** The canonical path of the root the target was checked against. */
  readonly realRoot: string;
  /** Marks a value that only `resolveContainedPath` makes, so a port that asks for it cannot be given an unchecked path. */
  readonly [contained]: true;
}

/** Everything the check needs besides the path itself. */
export interface ContainmentRequest {
  /** The answers of the disk. */
  readonly probe: PathProbe;
  /** The absolute folder the path must stay in: the component root for a read, the home or an agent folder for a write. */
  readonly root: string;
  /** The component's path field, relative. */
  readonly relative: string;
  /** The path syntax of the root. */
  readonly flavor: PathFlavor;
  /** `follow-link` for a read or write through the path; `keep-link` to remove or replace a link itself (uninstall uses lstat). */
  readonly finalSegment: FinalSegment;
}

type Existing = { readonly real: string; readonly missing: readonly string[] };

const CANNOT_BE_CHECKED =
  'the path cannot be checked: the file system could not resolve it (a link loop, no permission or a read error)';

// The deepest part of the path that exists, and the names below it that do not. A dangling link refuses the whole path (a later
// write would follow it to wherever it points), and so does any answer that is not a plain "found" or "not there".
function deepestExisting(probe: PathProbe, start: string, flavor: PathFlavor): Result<Existing, ContainmentViolation> {
  const flavored = path[flavor];
  const missing: string[] = [];
  let current = start;
  for (;;) {
    const answer = probe.realPath(current);
    if (answer.kind === 'real') return succeed({ real: answer.path, missing });
    if (answer.kind === 'unknown') return refuse({ kind: 'cannot-check', reason: CANNOT_BE_CHECKED });
    const link = probe.isLink(current);
    if (link === 'unknown') return refuse({ kind: 'cannot-check', reason: CANNOT_BE_CHECKED });
    if (link === 'link') return refuse({ kind: 'escapes-root', reason: 'a link on the path points at nothing' });
    const parent = flavored.dirname(current);
    if (parent === current) return refuse({ kind: 'escapes-root', reason: 'no part of the path exists' });
    missing.unshift(flavored.basename(current));
    current = parent;
  }
}

// The root as the check reads it: separators and dot segments normalised, no trailing separator (except for a drive or `/` root).
function normalizedRoot(root: string, flavor: PathFlavor): string {
  const flavored = path[flavor];
  const normal = flavored.normalize(root);
  return normal.length > flavored.parse(normal).root.length ? normal.replace(/[\\/]+$/, '') : normal;
}

/**
 * Proves that a component path stays under its root once links on disk are followed (M-03, M-04).
 *
 * The text rules run first (relative, no `..`, drive letter, colon, backslash, NUL or Windows device name). Then the deepest
 * existing part of the target is made canonical through the probe and must lie in the canonical root, so a link inside the root
 * that points out is refused, also when the file below it does not exist yet. An answer the probe cannot give (a loop, no
 * permission, a read error) refuses the path. With `keep-link` the last segment is not followed: its folder is checked and the
 * link itself is kept as a name, which is what removing a link needs; the root itself is then refused, since it is not a link
 * inside the root.
 *
 * @param request - the probe, root, path field, path syntax and treatment of the last segment
 * @returns the canonical target and root, or why the path was refused (the reason never repeats the path)
 */
export function resolveContainedPath(request: ContainmentRequest): Result<ContainedPath, ContainmentViolation> {
  const { probe, relative, flavor, finalSegment } = request;
  const root = normalizedRoot(request.root, flavor);
  const lexical = joinUnderRoot(root, relative, flavor);
  if (!lexical.ok) return lexical;
  const flavored = path[flavor];
  const keepsLink = finalSegment === 'keep-link';
  if (keepsLink && lexical.value === root)
    return refuse({ kind: 'escapes-root', reason: 'the root itself is not a link inside it' });
  const realRoot = probe.realPath(root);
  if (realRoot.kind === 'unknown') return refuse({ kind: 'cannot-check', reason: CANNOT_BE_CHECKED });
  if (realRoot.kind === 'missing') return refuse({ kind: 'escapes-root', reason: 'the root does not exist' });
  const existing = deepestExisting(probe, keepsLink ? flavored.dirname(lexical.value) : lexical.value, flavor);
  if (!existing.ok) return existing;
  const tail = keepsLink ? [flavored.basename(lexical.value)] : [];
  const realPath = flavored.join(existing.value.real, ...existing.value.missing, ...tail);
  return isSameOrInside(realRoot.path, realPath, flavor)
    ? succeed({ realPath, realRoot: realRoot.path } as ContainedPath)
    : refuse({ kind: 'escapes-root', reason: 'a link on the path leaves its root' });
}
