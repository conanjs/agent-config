// What each component needs from the slots (FR-022, AC-5.3, AC-5.5, AC-4.5): a provider for every required slot, offering the contract
// the consumer was written against. Contract majors are written in the name, `knowledge-provider/v1`, so a provider that offers
// `/v1` and `/v2` during a migration serves both generations of consumers and one that offers `/v2` only serves the newer one.
import type { Edges } from '#resolution/domain/rules/cycles.ts';
import type {
  ComponentNeed,
  DependencyView,
  ManifestView,
  OptionalGap,
  Placed,
  ResolutionError,
  SlotTableView,
  SuggestedSource,
} from '#resolution/domain/model/Resolution.ts';
import { needsRedaction } from '#shared/domain/redaction/redact.ts';

/** What the dependency pass found. */
export interface DependencyOutcome {
  /** Consumer to the providers it depends on. */
  readonly edges: Edges;
  /** The slots to ask V about. */
  readonly needs: readonly ComponentNeed[];
  /** Contract and suggestion errors. */
  readonly errors: readonly ResolutionError[];
  /** Optional dependencies without a provider. */
  readonly optionalGaps: readonly OptionalGap[];
}

type Provider = Placed<ManifestView>;

const byText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * The contracts a provider offers: what its manifest lists, plus the contracts of a reserved slot it fills, because agent-config's own
 * manifest is the surface of `core` and the slot table, not the manifest, says it is `component/v1` (slots.yaml, `core`).
 *
 * @param placed - a component that will be installed
 * @param table - the slots of slots/v1
 * @returns the contract ids, in a fixed order
 */
export function offeredContracts(placed: Provider, table: SlotTableView): readonly string[] {
  const slot = table.slots.find((each) => each.name === placed.slot);
  const implied = slot?.reserved === true ? slot.contracts : [];
  return [...new Set([...placed.manifest.provides.contracts, ...implied])].sort(byText);
}

// The contracts of a provider that share the wanted one's name (`knowledge-provider/v2` for a wanted `knowledge-provider/v1`);
// all of them when none share it, so the message always shows what the provider does offer.
function offeredFor(wanted: string, offered: readonly string[]): readonly string[] {
  const name = wanted.slice(0, wanted.lastIndexOf('/'));
  const same = offered.filter((contract) => contract.slice(0, contract.lastIndexOf('/')) === name);
  return same.length > 0 ? same : offered;
}

interface NeedDraft {
  readonly slot: string;
  readonly contract: string;
  readonly by: Set<string>;
  readonly suggested: Map<string, string>;
}

/** What one consumer's dependencies gave. */
interface ConsumerOutcome {
  readonly targets: readonly string[];
  readonly errors: readonly ResolutionError[];
  readonly gaps: readonly OptionalGap[];
  readonly missing: readonly DependencyView[];
}

function checkConsumer(
  consumer: Provider,
  providers: ReadonlyMap<string, readonly Provider[]>,
  table: SlotTableView,
): ConsumerOutcome {
  const targets = new Set<string>();
  const errors: ResolutionError[] = [];
  const gaps: OptionalGap[] = [];
  const missing: DependencyView[] = [];
  for (const dependency of consumer.manifest.depends.slots) {
    const filling = providers.get(dependency.slot) ?? [];
    const serving = filling.filter((each) => offeredContracts(each, table).includes(dependency.contract));
    const [first] = [...filling].sort((left, right) => byText(left.name, right.name));
    if (first === undefined) {
      if (dependency.required) missing.push(dependency);
      else gaps.push({ consumer: consumer.name, slot: dependency.slot, contract: dependency.contract });
    } else if (serving.length === 0) {
      errors.push({
        kind: 'contract',
        consumer: consumer.name,
        contract: dependency.contract,
        slot: dependency.slot,
        provider: first.name,
        offered: offeredFor(dependency.contract, offeredContracts(first, table)),
      });
    } else {
      for (const each of serving) targets.add(each.name);
    }
  }
  return { targets: [...targets].sort(byText), errors, gaps, missing };
}

// One need per slot and contract, with every consumer that asks and the source each suggests (shown, never fetched, AC-4.5).
function collectNeeds(drafts: Map<string, NeedDraft>, consumer: Provider, missing: readonly DependencyView[]): void {
  for (const dependency of missing) {
    const key = `${dependency.slot}\0${dependency.contract}`;
    const draft = drafts.get(key) ?? {
      slot: dependency.slot,
      contract: dependency.contract,
      by: new Set<string>(),
      suggested: new Map<string, string>(),
    };
    draft.by.add(consumer.name);
    if (dependency.suggest !== undefined) draft.suggested.set(consumer.name, dependency.suggest.url);
    drafts.set(key, draft);
  }
}

// A suggested source that holds credential-like text is refused (M-07, M-11): it is dropped from the need and reported once.
function finishNeeds(drafts: ReadonlyMap<string, NeedDraft>): {
  readonly needs: readonly ComponentNeed[];
  readonly refused: readonly string[];
} {
  const refused = new Set<string>();
  const needs = [...drafts.values()]
    .sort((left, right) => byText(left.slot, right.slot) || byText(left.contract, right.contract))
    .map((draft): ComponentNeed => {
      const suggested: SuggestedSource[] = [];
      for (const [by, source] of [...draft.suggested].sort(([left], [right]) => byText(left, right))) {
        if (needsRedaction(source)) refused.add(by);
        else suggested.push({ by, source });
      }
      return { slot: draft.slot, contract: draft.contract, requiredBy: [...draft.by].sort(byText), suggested };
    });
  return { needs, refused: [...refused].sort(byText) };
}

/**
 * Checks every dependency of every placed component against the providers of its slot.
 *
 * @param placed - the components that stay, in name order
 * @param table - the slots of slots/v1
 * @returns the edges for the cycle check, the needs, the errors and the optional gaps
 */
export function checkDependencies(placed: readonly Provider[], table: SlotTableView): DependencyOutcome {
  const providers = new Map<string, Provider[]>();
  for (const each of placed) providers.set(each.slot, [...(providers.get(each.slot) ?? []), each]);
  const edges = new Map<string, readonly string[]>();
  const drafts = new Map<string, NeedDraft>();
  const errors: ResolutionError[] = [];
  const optionalGaps: OptionalGap[] = [];
  for (const consumer of placed) {
    const outcome = checkConsumer(consumer, providers, table);
    edges.set(consumer.name, outcome.targets);
    errors.push(...outcome.errors);
    optionalGaps.push(...outcome.gaps);
    collectNeeds(drafts, consumer, outcome.missing);
  }
  const { needs, refused } = finishNeeds(drafts);
  errors.push(...refused.map((component): ResolutionError => ({ kind: 'unsafe-suggestion', component })));
  return { edges, needs, errors, optionalGaps };
}
