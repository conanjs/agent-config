import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type {
  GeneratedRelativePath,
  GeneratedFileWriter,
  GeneratedWriteRefusal,
} from '#rendering/application/ports/GeneratedFileWriter.ts';
import type { PlannedGeneratedFile } from '#rendering/application/generated/planVariablesFiles.ts';

/** A file that was written. */
export interface WrittenGeneratedFile {
  /** Which file. */
  readonly relativePath: GeneratedRelativePath;
  /** The absolute path the writer used. */
  readonly path: string;
  /** SHA-256 of what was written, for `install-state.json`. */
  readonly hash: string;
}

/** The first file that was refused; files before it were written, files after it were not tried. */
export interface GeneratedWriteFailure {
  /** Which file. */
  readonly relativePath: GeneratedRelativePath;
  /** Why the writer refused it. */
  readonly refusal: GeneratedWriteRefusal;
}

/**
 * Writes a plan through the writer in order and stops at the first refusal; the journal of the run restores what was written.
 *
 * It writes every file it is given. T138 first drops each planned file whose hash equals the hash recorded for its path in
 * `install-state.json`, so an unchanged rerun rewrites no identical file (FR-026, AC-16.7).
 *
 * @param writer - the port answered by the state module's atomic write
 * @param plan - the files from `planVariablesFiles`
 * @returns what was written, or the first refusal
 */
export function writeGeneratedFiles(
  writer: GeneratedFileWriter,
  plan: readonly PlannedGeneratedFile[],
): Result<readonly WrittenGeneratedFile[], GeneratedWriteFailure> {
  const written: WrittenGeneratedFile[] = [];
  for (const file of plan) {
    const outcome = writer.write(file.relativePath, file.text);
    if (!outcome.ok) return refuse({ relativePath: file.relativePath, refusal: outcome.error });
    written.push({ relativePath: file.relativePath, path: outcome.value.path, hash: file.hash });
  }
  return succeed(written);
}
