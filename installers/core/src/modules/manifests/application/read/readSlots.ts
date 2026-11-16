import path from 'node:path';
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { loadContractFile } from '#manifests/application/read/loadContractFile.ts';
import { decodeSlots } from '#manifests/domain/decode/decodeSlots.ts';
import type { FileIssue } from '#manifests/domain/model/Issues.ts';
import type { SlotTable } from '#manifests/domain/model/Slots.ts';
import { findingsSentence } from '#manifests/domain/rules/findingSentences.ts';
import { slotTableProblems } from '#manifests/domain/rules/slotRules.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** A file that was refused as a whole: where it is, for the message, and what is wrong with it. */
export interface FileFailure {
  /** The absolute path of the file, for the message `error: <path> is invalid: ...`. */
  readonly file: string;
  /** What is wrong, in file order; at least one. */
  readonly issues: readonly FileIssue[];
}

/** What to read: the folder of the agent-config checkout. */
export interface SlotsRequest {
  /** The folder of the agent-config checkout. */
  readonly root: string;
}

/** Where slots.yaml lies below the agent-config checkout. */
export const SLOTS_FILE = 'contracts/slots.yaml';

/**
 * Reads and validates `contracts/slots.yaml` of the agent-config checkout (slots/v1, FR-003).
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param request - what to read
 * @returns the slot table, or the issues that stop the run
 */
export function readSlots(deps: ManifestDeps, request: SlotsRequest): Result<SlotTable, FileFailure> {
  const file = path[deps.flavor].join(request.root, ...SLOTS_FILE.split('/'));
  const fail = (sentence: string): Result<never, FileFailure> =>
    refuse({ file, issues: [{ kind: 'invalid', sentence }] });
  // 1. Read the file under the checkout, the way every contract file is read.
  const loaded = loadContractFile(deps, { id: 'slots/v1', root: request.root, relative: SLOTS_FILE });
  if (loaded.kind === 'absent') return fail('the file is not there');
  if (loaded.kind !== 'loaded') return fail(loaded.sentence);
  // 2. The contract reader's verdict.
  if (!loaded.parse.ok) return fail(findingsSentence(loaded.parse.findings));
  // 3. The faults that need the whole table: a name or a mount that appears twice.
  const table = decodeSlots(loaded.parse.value);
  const problems = slotTableProblems(table);
  return problems.length === 0
    ? succeed(table)
    : refuse({ file, issues: problems.map((sentence) => ({ kind: 'invalid', sentence }) as const) });
}
