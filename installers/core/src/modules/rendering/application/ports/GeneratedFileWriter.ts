import type { Result } from '#shared/domain/result/Result.ts';

/** The files this module writes directly under the generated folder, as paths relative to the agent home (the one source of the path). */
export type GeneratedRelativePath = 'generated/global-variables.md' | 'generated/index.md';

/** Why a generated file was not written; the same refusals as the state module's file write, so the composition root passes them on. */
export type GeneratedWriteRefusal =
  { readonly kind: 'outside'; readonly reason: string } | { readonly kind: 'is-link' | 'not-a-file' };

/**
 * Where generated files go, owned by the rendering application layer (DR-305) and answered by the composition root with the state
 * module's atomic write: a temporary file, then a rename, owner-only. This module has no second write path. The journal `write`
 * entry of a file is made before this call, from the plan (`{home}/{relativePath}`, hash from the plan), so the adapter must write
 * to exactly that path.
 */
export interface GeneratedFileWriter {
  /**
   * Writes one file at `{home}/{relativePath}`, replacing the old one.
   *
   * @param relativePath - the planned path below the agent home, from `planVariablesFiles`
   * @param text - the whole content
   * @returns the absolute path written, or why it was refused; a disk failure is thrown
   */
  write(relativePath: GeneratedRelativePath, text: string): Result<{ readonly path: string }, GeneratedWriteRefusal>;
}
