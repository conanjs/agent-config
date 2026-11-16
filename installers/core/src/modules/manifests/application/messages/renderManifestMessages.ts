// The printed texts of the manifests module. Every text is a row of the shared message catalogue (TR-5); `renderMessage` hides
// credentials and shows control characters in each value, so a hostile name, path or sentence cannot print a secret or a line.
import type { FileIssue, ComponentSkip, SkipReason } from '#manifests/domain/model/Issues.ts';
import type { ComponentSource, MergedEntry } from '#manifests/domain/model/ComponentList.ts';
import { findingSentence } from '#manifests/domain/rules/findingSentences.ts';
import type { ContractFinding } from '#shared/domain/name/NameRules.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';

function renderReason(reason: SkipReason): string {
  switch (reason.kind) {
    case 'archive':
      return renderMessage('MG-21.archive', {});
    case 'no-manifest':
      return renderMessage('MG-21.no-manifest', { folder: reason.folder });
    case 'unknown-slot':
      return renderMessage('MG-21.unknown-slot', { slot: reason.slot });
    case 'invalid':
      return renderMessage('MG-21.invalid', { sentence: reason.sentence });
    case 'symlink':
      return renderMessage('MG-21.symlink', { path: reason.path });
  }
}

/**
 * Writes the warning for a component the run leaves out (MG-21): the component name, then one of the five reasons of the catalogue.
 *
 * @param skip - the component and why
 * @returns the line, without a line break
 */
export function renderSkipWarning(skip: ComponentSkip): string {
  return renderMessage('MG-21', { name: skip.name, reason: renderReason(skip.reason) });
}

/**
 * Writes the error for a list or slots file that is refused as a whole: MG-23 for a fault in the file, MG-34 for a source address
 * with credentials, which names the component and prints no part of the address (M-07).
 *
 * @param file - the absolute path of the file
 * @param issue - one issue of the file
 * @returns the line, without a line break
 */
export function renderFileIssue(file: string, issue: FileIssue): string {
  return issue.kind === 'credentials'
    ? renderMessage('MG-34', { name: issue.component })
    : renderMessage('MG-23', { list: file, sentence: issue.sentence });
}

/**
 * Writes the error for a `path` source whose folder is gone (MG-31).
 *
 * @param name - the component name
 * @param folder - the folder the list names
 * @returns the line, without a line break
 */
export function renderPathSourceMissing(name: string, folder: string): string {
  return renderMessage('MG-31', { name, folder });
}

/**
 * Writes the error for a `path` source that names a folder it may not (MG-31.refused): the user's home, a folder that holds it, or
 * the agent home or a folder around it.
 *
 * @param name - the component name
 * @param folder - the folder the list names
 * @param reason - why it is refused, as the clause that ends the sentence
 * @returns the line, without a line break
 */
export function renderPathSourceRefused(name: string, folder: string, reason: string): string {
  return renderMessage('MG-31.refused', { name, folder, reason });
}

/**
 * Shows a source the way `override:` lines do: the folder of a `path` source, the address of a git or archive source.
 *
 * @param source - a source of a list entry
 * @returns the text; a credential in an address is hidden when it is printed
 */
export function describeSource(source: ComponentSource): string {
  return source.type === 'path' ? source.path : source.url;
}

/**
 * Writes the line that shows a local entry replacing a public one (MG-20); only a replaced entry has one.
 *
 * @param entry - one entry of the merged lists
 * @returns the line, or `undefined` when no public source was replaced
 */
export function renderOverride(entry: MergedEntry): string | undefined {
  return entry.replaced === undefined
    ? undefined
    : renderMessage('MG-20', {
        name: entry.name,
        local: describeSource(entry.source),
        public: describeSource(entry.replaced),
      });
}

/**
 * Writes the warning for something the contract reader tolerated in a component's manifest, such as an unknown key that is ignored (MG-43, CM-1).
 *
 * @param name - the component the manifest belongs to, as the list names it
 * @param finding - one warning of the contract reader, naming the field
 * @returns the line, without a line break
 */
export function renderComponentWarning(name: string, finding: ContractFinding): string {
  return renderMessage('MG-43', { name, file: 'component.yaml', sentence: findingSentence(finding) });
}
