import type {
  Candidate,
  ManifestView,
  Placed,
  ResolutionError,
  ResolutionResult,
  ResolveInput,
  SkippedComponent,
  SlotTableView,
} from '#resolution/domain/model/Resolution.ts';
import { checkCitations, checkRuntime } from '#resolution/domain/rules/citationsAndRuntime.ts';
import { findCycles, providersFirst } from '#resolution/domain/rules/cycles.ts';
import { checkDependencies } from '#resolution/domain/rules/dependencies.ts';
import { selectProviders } from '#resolution/domain/rules/selectProviders.ts';

const byName = (left: Placed<ManifestView>, right: Placed<ManifestView>): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

// A component whose manifest, or one of whose dependencies, names a slot that slots/v1 lacks is left out and the others go on
// (AC-5.8, FR-005); a list component in the reserved `core` slot is left out too, because only agent-config's own manifest fills it.
function unusableReason(
  candidate: Candidate<ManifestView>,
  table: SlotTableView,
): SkippedComponent['reason'] | undefined {
  const known = (name: string): boolean => table.slots.some((slot) => slot.name === name);
  if (!known(candidate.manifest.slot)) return { kind: 'unknown-slot', slot: candidate.manifest.slot };
  if (table.slots.some((slot) => slot.name === candidate.manifest.slot && slot.reserved)) {
    return {
      kind: 'invalid',
      sentence: `slot ${candidate.manifest.slot} is reserved for agent-config's own component`,
    };
  }
  const unknown = candidate.manifest.depends.slots.find((dependency) => !known(dependency.slot));
  return unknown === undefined ? undefined : { kind: 'unknown-slot', slot: unknown.slot };
}

function placeCandidate<Manifest extends ManifestView>(candidate: Candidate<Manifest>): Placed<Manifest> {
  return {
    name: candidate.name,
    slot: candidate.manifest.slot,
    origin: candidate.origin,
    source: candidate.source,
    manifest: candidate.manifest,
  };
}

// The order errors are reported in: count, cycle, contract, export, runtime, suggestion.
const ERROR_ORDER: Readonly<Record<ResolutionError['kind'], number>> = {
  count: 0,
  cycle: 1,
  contract: 2,
  export: 3,
  runtime: 4,
  'unsafe-suggestion': 5,
};

/**
 * Resolves the components of both lists into what to install, what to ask V for, or what failed (FR-022, AC-5.1 to AC-5.9).
 *
 * The steps, all pure: leave out a component that names an unknown slot; choose the providers of each slot (a local entry beats a
 * public default in a one-provider slot, and two at one level are an error); check every dependency against the providers (reuse
 * what fills the slot; a required slot nothing fills is a need, with the consumers' suggested sources shown and never fetched); find
 * cycles; check each citation against the provider's exports; check each declared runtime. A chain consumer, A, B needs no
 * recursion: every placed component is checked against the whole set of placed components, so B's own needs are found when B is
 * checked, whatever order the candidates arrive in, and A is accepted only when the whole run is (a need anywhere stops everything). Errors win
 * over needs, because exit 1 means the lists themselves cannot work and exit 10 asks V for something that may fix them.
 *
 * @param input - the slots, the candidates of both lists, agent-config's own manifest, the citations and the runtime versions
 * @returns the result; `install` is filled only when the status is `resolved`
 */
export function resolveInstall<Manifest extends ManifestView>(
  input: ResolveInput<Manifest>,
): ResolutionResult<Manifest> {
  // 1. Leave out what cannot be placed.
  const skipped: SkippedComponent[] = [];
  const usable: Candidate<Manifest>[] = [];
  for (const candidate of input.candidates) {
    const reason = unusableReason(candidate, input.slots);
    if (reason === undefined) usable.push(candidate);
    else skipped.push({ name: candidate.name, reason });
  }
  // 2. Choose the providers of each slot.
  const selection = selectProviders(input.slots, usable);
  const core: Placed<Manifest>[] =
    input.core === undefined
      ? []
      : [{ name: input.core.name, slot: input.core.slot, origin: 'core', source: undefined, manifest: input.core }];
  const placed = [...core, ...selection.selected.map(placeCandidate)].sort(byName);
  // 3. Dependencies, cycles, citations and runtimes.
  const dependencies = checkDependencies(placed, input.slots);
  const cycles = findCycles(dependencies.edges).map((cycle): ResolutionError => ({ kind: 'cycle', cycle }));
  const errors = [
    ...selection.errors,
    ...cycles,
    ...dependencies.errors,
    ...checkCitations(placed, input.citations),
    ...checkRuntime(placed, input.runtime),
  ].sort((left, right) => ERROR_ORDER[left.kind] - ERROR_ORDER[right.kind]);
  const status = errors.length > 0 ? 'failed' : dependencies.needs.length > 0 ? 'needs' : 'resolved';
  const order = status === 'resolved' ? providersFirst(dependencies.edges) : [];
  return {
    status,
    install: order.flatMap((name) => placed.filter((each) => each.name === name)),
    needs: dependencies.needs,
    errors,
    skipped,
    displaced: selection.displaced,
    optionalGaps: dependencies.optionalGaps,
  };
}
