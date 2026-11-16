// M-18: this file may look at one environment object and one folder, and nothing else. It imports no process or shell module, and a
// unit test reads this text to keep it that way.
import { stat } from 'node:fs/promises';
import type { DetectProbe } from '#variables/application/ports/DetectProbe.ts';

/**
 * The real probe: an environment map given by the composition root, and a folder check by `stat` (a link to a folder counts).
 *
 * @param environment - the process environment, handed in by the composition root so the adapter never reads the process itself
 * @returns a probe that can look at that environment and at folders, and at nothing else
 */
export function nodeDetectProbe(environment: Readonly<Record<string, string | undefined>>): DetectProbe {
  return {
    environmentValue: (name) => (Object.hasOwn(environment, name) ? environment[name] : undefined),
    async directoryExists(absolutePath) {
      try {
        return (await stat(absolutePath)).isDirectory();
      } catch {
        // Any error means "not found as a folder"; a proposal is optional, so nothing needs reporting.
        return false;
      }
    },
  };
}
