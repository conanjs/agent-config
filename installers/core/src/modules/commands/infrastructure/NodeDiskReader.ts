import fs from 'node:fs';
import path from 'node:path';
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';
import { resolveContainedPath } from '#shared/application/containment/resolveContainedPath.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';
import type { DiskReader, EntryKind, MarkdownFile } from '#commands/application/ports/CommandPorts.ts';

/** The most Markdown files one component may have for the citation scan; a larger tree is read up to this many (the listing is cut, not refused). */
export const MAX_MARKDOWN_FILES = 20_000;

/** The largest text file the reader returns; a bigger one is left out, never cut, so the YAML reader and the scan never see half a file. */
export const MAX_TEXT_BYTES = 1_048_576;

const SKIPPED_FOLDERS = new Set(['.git', 'node_modules']);

function contained(probe: PathProbe, flavor: PathFlavor, root: string, relative: string): string | undefined {
  const found = resolveContainedPath({ probe, root, relative, flavor, finalSegment: 'follow-link' });
  return found.ok ? found.value.realPath : undefined;
}

function textOf(file: string): string | undefined {
  try {
    const found = fs.statSync(file);
    if (!found.isFile() || found.size > MAX_TEXT_BYTES) return undefined;
    return fs.readFileSync(file, 'utf8');
  } catch {
    // Unreadable is the same as missing for an optional file: the caller treats both as "nothing to read here".
    return undefined;
  }
}

function namesIn(folder: string): string[] {
  try {
    return fs.readdirSync(folder).sort();
  } catch {
    // A folder that cannot be read has no Markdown the scan can use.
    return [];
  }
}

// A regular file named `*.md` within the size limit; a link is never one, because the scan uses `lstat` (M-04).
function isMarkdown(stat: fs.Stats, name: string): boolean {
  return stat.isFile() && name.endsWith('.md') && stat.size <= MAX_TEXT_BYTES;
}

// Every Markdown file below a folder, sorted, and cut at the limit.
function collectMarkdown(folder: string, relative: string, found: MarkdownFile[]): void {
  for (const name of namesIn(folder)) {
    if (found.length >= MAX_MARKDOWN_FILES) return;
    const full = path.join(folder, name);
    const own = relative === '' ? name : `${relative}/${name}`;
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (stat === undefined) continue;
    if (stat.isDirectory() && !SKIPPED_FOLDERS.has(name)) collectMarkdown(full, own, found);
    else if (isMarkdown(stat, name)) found.push({ file: own, text: fs.readFileSync(full, 'utf8') });
  }
}

/**
 * Builds the reader that answers the install pipeline from the real file system.
 *
 * Reads only. A relative path is proven to stay under its root once links are followed (M-03, M-04) before it is read; the Markdown
 * scan uses `lstat` and never follows a link or enters `.git` or `node_modules`.
 *
 * @param probe - the real-path questions of the disk, shared with the containment check of every other module
 * @param observer - looks at a path without following a link at its end
 * @param flavor - the path syntax of the machine
 * @returns the DiskReader of the pipeline
 */
export function createNodeDiskReader(probe: PathProbe, observer: PathObserver, flavor: PathFlavor): DiskReader {
  return {
    listEntries(folder) {
      try {
        return fs.readdirSync(folder).sort();
      } catch {
        // Not there, not a folder, or not readable: the caller links nothing from it.
        return undefined;
      }
    },
    markdownFiles(root) {
      const found: MarkdownFile[] = [];
      collectMarkdown(root, '', found);
      return found;
    },
    readOptionalText(root, relative) {
      const real = contained(probe, flavor, root, relative);
      return real === undefined ? undefined : textOf(real);
    },
    entryKind(root, relative): EntryKind {
      const real = contained(probe, flavor, root, relative);
      if (real === undefined) return 'missing';
      const stat = fs.lstatSync(real, { throwIfNoEntry: false });
      if (stat === undefined) return 'missing';
      if (stat.isDirectory()) return 'folder';
      return stat.isFile() ? 'file' : 'other';
    },
    observe: (target) => observer.observe(target),
  };
}
