// The composer of the rendering module (MOD-11): it receives the adapters from the composition root (T142) and returns the use cases
// with their ports filled in. It imports no adapter itself. Phase 2 has the variables and index part only; the rendered copies,
// routes and the session-start refresh join it in later phases.
import { planVariablesFiles } from '#rendering/application/generated/planVariablesFiles.ts';
import { writeGeneratedFiles } from '#rendering/application/generated/writeGeneratedFiles.ts';
import type { GeneratedFileWriter } from '#rendering/application/ports/GeneratedFileWriter.ts';

/** The adapters the module needs. */
export interface RenderingPorts {
  /** Writes into the generated folder; the composition root answers it with the state module's atomic write. */
  readonly writer: GeneratedFileWriter;
}

/** The rendering use cases with their ports filled in; the install and plan commands (T138) call these. */
export interface RenderingApi {
  /** Decides the texts and hashes of `global-variables.md` and `index.md`; writes nothing. */
  planVariablesFiles: typeof planVariablesFiles;
  /** Writes a plan from `planVariablesFiles` through the writer (T138 filters out files unchanged since the last run first). */
  writeGeneratedFiles(plan: Parameters<typeof writeGeneratedFiles>[1]): ReturnType<typeof writeGeneratedFiles>;
}

/**
 * Builds the rendering use cases over the given adapters.
 *
 * @param ports - the adapters, chosen by the composition root
 * @returns the use cases, ready to call
 */
export function composeRendering(ports: RenderingPorts): RenderingApi {
  return {
    planVariablesFiles,
    writeGeneratedFiles: (plan) => writeGeneratedFiles(ports.writer, plan),
  };
}
