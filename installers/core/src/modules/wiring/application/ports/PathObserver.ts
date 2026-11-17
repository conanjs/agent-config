import type { Observation } from '#wiring/domain/compat/CompatPlan.ts';

/**
 * Looks at what is at a path, without following a link at its end and without changing anything. Owned here and answered by an adapter:
 * `NodePathObserver` in production, or a small table in a test. The composition root (T142) may also answer it from the state module's
 * file system and link ports.
 */
export interface PathObserver {
  /**
   * Reports what is at one path, a link included, with the target text of a link.
   *
   * @param target - an absolute path
   * @returns nothing there, a link with its target text, a folder, a regular file, something else, or `unknown` for any error but "not there"
   */
  observe(target: string): Observation;
}
