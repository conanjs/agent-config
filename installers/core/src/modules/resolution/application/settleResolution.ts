import { resolveInstall } from '#resolution/application/resolveInstall.ts';
import type { Candidate, ManifestView, ResolutionResult, ResolveInput } from '#resolution/domain/model/Resolution.ts';

/** What settling gave: the final resolution and what the fallback did. */
export interface SettledResolution<Manifest extends ManifestView> {
  /** The resolution after the last round. */
  readonly result: ResolutionResult<Manifest>;
  /** Components that went back to their locked previous version, sorted. */
  readonly restored: readonly string[];
  /** Components that failed and have no previous version, so they are left out, sorted. */
  readonly leftOut: readonly string[];
}

/**
 * Re-runs the cross-checks until nothing changes (DR-418, AC-3.4, AC-7.2): a component that fails acquire or staged validation goes
 * back to its locked previous version, or is left out when it has none, and the whole resolution is run again, because the version
 * that comes back may offer other contracts and exports.
 *
 * Each component is handled at most once as `restored`; one that fails again after that is left out, so the loop always ends.
 * Agent-config's own component is never removed here.
 *
 * @param input - the resolver's input with the candidates at their new versions
 * @param failing - answers which placed components fail the staged check of this resolution; the caller reads it from a table of
 *   check results, so this stays pure
 * @param previous - the locked previous version of each component that has one, as a candidate with its manifest
 * @returns the final resolution with the names restored and left out
 */
export function settleResolution<Manifest extends ManifestView>(
  input: ResolveInput<Manifest>,
  failing: (result: ResolutionResult<Manifest>) => readonly string[],
  previous: ReadonlyMap<string, Candidate<Manifest>>,
): SettledResolution<Manifest> {
  const restored = new Set<string>();
  const leftOut = new Set<string>();
  let candidates = input.candidates;
  for (;;) {
    const result = resolveInstall({ ...input, candidates });
    const failures =
      result.status === 'resolved' ? failing(result).filter((name) => candidates.some((c) => c.name === name)) : [];
    if (failures.length === 0) return { result, restored: [...restored].sort(), leftOut: [...leftOut].sort() };
    candidates = candidates.flatMap((candidate) => {
      if (!failures.includes(candidate.name)) return [candidate];
      const back = restored.has(candidate.name) ? undefined : previous.get(candidate.name);
      if (back !== undefined) {
        restored.add(candidate.name);
        return [back];
      }
      restored.delete(candidate.name);
      leftOut.add(candidate.name);
      return [];
    });
  }
}
