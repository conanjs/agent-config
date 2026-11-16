// Which components fill each slot (FR-022: reuse a filled slot, else take the default, else report a need; AC-5.2, AC-5.7).
// A local entry beats a public default in a slot that takes one provider (CL-1, CL-6); a slot that takes many keeps both.
import type { Candidate, ManifestView, ResolutionError, SlotTableView } from '#resolution/domain/model/Resolution.ts';

/** The providers chosen for every slot. */
export interface Selection<Manifest extends ManifestView> {
  /** The candidates that stay, in name order. */
  readonly selected: readonly Candidate<Manifest>[];
  /** Public defaults a local provider replaced, sorted. */
  readonly displaced: readonly string[];
  /** One error per slot that takes one provider and has two or more at the same level. */
  readonly errors: readonly ResolutionError[];
}

const byName = (left: Candidate<ManifestView>, right: Candidate<ManifestView>): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

/**
 * Picks, for every slot of the table, the candidates that fill it: all of a many-provider slot, the local ones of a one-provider slot
 * that has any, else its public ones.
 *
 * @param table - the slots of slots/v1
 * @param candidates - the components of both lists, each naming a slot of the table
 * @returns the providers that stay, the public defaults that were replaced, and a count error for each one-provider slot with two
 *   providers at the same level (the first two by name, so the message is the same on every run)
 */
export function selectProviders<Manifest extends ManifestView>(
  table: SlotTableView,
  candidates: readonly Candidate<Manifest>[],
): Selection<Manifest> {
  const selected: Candidate<Manifest>[] = [];
  const displaced: string[] = [];
  const errors: ResolutionError[] = [];
  for (const slot of table.slots) {
    const filling = candidates.filter((candidate) => candidate.manifest.slot === slot.name).sort(byName);
    const local = filling.filter((candidate) => candidate.origin === 'local');
    const kept = slot.multiple || local.length === 0 ? filling : local;
    if (!slot.multiple) displaced.push(...filling.filter((candidate) => !kept.includes(candidate)).map((c) => c.name));
    const [first, second] = kept;
    if (!slot.multiple && first !== undefined && second !== undefined) {
      errors.push({ kind: 'count', slot: slot.name, first: first.name, second: second.name });
    }
    selected.push(...kept);
  }
  return { selected: selected.sort(byName), displaced: displaced.sort(), errors };
}
