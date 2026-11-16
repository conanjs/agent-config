import type { ContractFinding } from '#shared/domain/name/NameRules.ts';

/** How many findings one sentence names before it says how many more there are (the reader already caps a file at 50). */
export const SENTENCE_FINDINGS = 3;

/**
 * Writes one finding as a sentence: the field it is about and what is wrong, never the value found.
 *
 * @param finding - a finding of the contract reader
 * @returns `components[0].name must be ...`, or only the message for a finding about the whole file
 */
export function findingSentence(finding: ContractFinding): string {
  return finding.field === '(document)' ? finding.message : `${finding.field} ${finding.message}`;
}

/**
 * Joins the first findings of a file into one line, so an author sees more than the first fault and the line stays short.
 *
 * @param findings - the findings in file order, at least one
 * @returns up to three sentences joined with `; `, then how many more were left out
 */
export function findingsSentence(findings: readonly ContractFinding[]): string {
  const shown = findings.slice(0, SENTENCE_FINDINGS).map(findingSentence);
  const more = findings.length - shown.length;
  return more > 0 ? `${shown.join('; ')}; ${more} more not shown` : shown.join('; ');
}
