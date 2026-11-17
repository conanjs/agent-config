import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type { GeneratedRelativePath } from '#rendering/application/ports/GeneratedFileWriter.ts';
import { renderGeneratedIndex } from '#rendering/domain/index/GeneratedIndex.ts';
import { renderGlobalVariablesFile } from '#rendering/domain/variables/GlobalVariablesFile.ts';
import { buildVariableRows, type RowViolation } from '#rendering/domain/variables/VariableTable.ts';
import type { PublicDeclaredVariable, PublicVariableValues } from '#variables/application/VariablesTypes.ts';
import { AGENT_HOME_TABLE_ROW } from '#variables/application/declarations/mergeVariableDeclarations.ts';

/** What the two files are built from. */
export interface VariablesFilesRequest {
  /** The agent home of the run (the value of the first row). */
  readonly home: string;
  /** The merged declarations of the enabled components, in table order. */
  readonly declared: readonly PublicDeclaredVariable[];
  /** V's stored values. */
  readonly values: PublicVariableValues;
}

/** One file of the plan: its text and the SHA-256 the journal records for the write (DR-202). */
export interface PlannedGeneratedFile {
  /** The path below the agent home; T138 journals `{home}/<relativePath>` and the writer writes the same path. */
  readonly relativePath: GeneratedRelativePath;
  /** The whole content. */
  readonly text: string;
  /** SHA-256 of the text, the `hash` of its journal `write` operation. */
  readonly hash: string;
}

/**
 * Decides the content of `generated/global-variables.md` and `generated/index.md` without touching a disk, so `plan`, the journal and
 * `install` all use the same texts (DR-306). The same input gives the same bytes: no clock or machine value but the home goes in.
 *
 * @param request - the home, the merged declarations and V's values
 * @returns the two files in write order, or every cell that must not be printed (credential-like text, M-08)
 */
export function planVariablesFiles(
  request: VariablesFilesRequest,
): Result<readonly PlannedGeneratedFile[], readonly RowViolation[]> {
  // 1. Build the rows: the computed AGENT_HOME first, then one per declared variable.
  const rows = buildVariableRows({
    home: request.home,
    computed: AGENT_HOME_TABLE_ROW,
    declared: request.declared,
    values: request.values,
  });
  // 2. Print the table; a cell that needs redaction is refused, never printed.
  const variables = renderGlobalVariablesFile(rows);
  if (!variables.ok) return refuse(variables.error);
  // 3. The index is fixed text.
  const files = [
    { relativePath: 'generated/global-variables.md', text: variables.value },
    { relativePath: 'generated/index.md', text: renderGeneratedIndex() },
  ] as const;
  return succeed(files.map((file) => ({ ...file, hash: sha256Hex(file.text) })));
}
