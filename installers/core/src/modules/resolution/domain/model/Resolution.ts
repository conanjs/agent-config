// The data the resolver takes and gives (specs/022 T134, FR-022, DR-418). Plain immutable records, no behaviour: the resolver is a
// pure function from these inputs to one result, so `plan`, `apply`, the needs report and a dry run all read the same answer.

// A domain file cannot import another module's application folder, so the resolver names what it reads of the manifests module's
// types by shape. `ComponentManifest`, `SlotTable` and `ComponentSource` of the manifests module are assignable to these, and the
// results keep the caller's own manifest type through the type parameter `Manifest`.

/** What the resolver reads of a slot. */
export interface SlotView {
  /** The slot name. */
  readonly name: string;
  /** True for the slot only agent-config's own component fills. */
  readonly reserved: boolean;
  /** Whether more than one component may fill it. */
  readonly multiple: boolean;
  /** The contracts the slot stands for. */
  readonly contracts: readonly string[];
}

/** What the resolver reads of the slot table. */
export interface SlotTableView {
  /** The slots. */
  readonly slots: readonly SlotView[];
}

/** What the resolver reads of a dependency on a slot. */
export interface DependencyView {
  /** The slot name. */
  readonly slot: string;
  /** The contract asked for, `name/vN`. */
  readonly contract: string;
  /** Whether install stops without a provider. */
  readonly required: boolean;
  /** The source the component suggests, when it gives one. */
  readonly suggest: { readonly url: string } | undefined;
}

/** What the resolver reads of a manifest. */
export interface ManifestView {
  /** The component id. */
  readonly name: string;
  /** The slot it fills. */
  readonly slot: string;
  /** What it offers. */
  readonly provides: { readonly contracts: readonly string[]; readonly exports: readonly string[] };
  /** What it needs. */
  readonly depends: {
    readonly slots: readonly DependencyView[];
    readonly runtime: Readonly<Record<string, string>>;
  };
}

/** Where a component comes from, as the manifests module writes it. */
export type SourceView =
  | { readonly type: 'git'; readonly url: string; readonly ref: string }
  | { readonly type: 'path'; readonly path: string }
  | { readonly type: 'archive'; readonly url: string; readonly sha256: string };

/** A component the resolver leaves out, with the reason in the manifests module's words. */
export interface SkippedComponent {
  /** The component id. */
  readonly name: string;
  /** Why it is left out. */
  readonly reason:
    { readonly kind: 'unknown-slot'; readonly slot: string } | { readonly kind: 'invalid'; readonly sentence: string };
}

/** Which list a candidate came from; the local list wins over the public one (CL-1). */
export type ListOrigin = 'public' | 'local';

/** One component a list names whose folder was read and whose manifest is valid. */
export interface Candidate<Manifest extends ManifestView = ManifestView> {
  /** The component id from the list. */
  readonly name: string;
  /** The list that supplied the source that is used. */
  readonly origin: ListOrigin;
  /** Where the component comes from. */
  readonly source: SourceView;
  /** The validated manifest. */
  readonly manifest: Manifest;
}

/** A citation of another component's file, already classified by slot by the contract classifier (FR-023, AC-5.10). */
export interface CitedPath {
  /** The component whose file holds the citation. */
  readonly consumer: string;
  /** The citing file, relative to the consumer, for the message. */
  readonly file: string;
  /** The slot the longest matching location belongs to. */
  readonly slot: string;
  /** The text after `{{AGENT_HOME}}/`, for example `knowledge/a/b.md`; it is what `provides.exports` lists. */
  readonly locationPath: string;
}

/** Everything the resolver reads. */
export interface ResolveInput<Manifest extends ManifestView = ManifestView> {
  /** The slots of slots/v1. */
  readonly slots: SlotTableView;
  /** The components of both lists, merged by name, archive entries and skipped components already removed. */
  readonly candidates: readonly Candidate<Manifest>[];
  /** agent-config's own manifest, which fills the reserved `core` slot; absent when it could not be read. */
  readonly core: Manifest | undefined;
  /** Every citation of another component found in the candidates' files. */
  readonly citations: readonly CitedPath[];
  /** The runtime versions found by tool, for example `{ node: '24.12.0' }`, with or without a leading v. */
  readonly runtime: Readonly<Record<string, string>>;
}

/** A component that will be installed. */
export interface Placed<Manifest extends ManifestView = ManifestView> {
  /** The component id. */
  readonly name: string;
  /** The slot it fills. */
  readonly slot: string;
  /** The list it came from, or `core` for agent-config's own component. */
  readonly origin: ListOrigin | 'core';
  /** Where it comes from; absent for core. */
  readonly source: SourceView | undefined;
  /** Its manifest. */
  readonly manifest: Manifest;
}

/** A source a component suggests for a slot it needs: shown to V, never fetched and never part of a command (AC-4.5, M-11). */
export interface SuggestedSource {
  /** The component that suggests it. */
  readonly by: string;
  /** The address, already checked to hold no credential-like text. */
  readonly source: string;
}

/** A slot some component requires and nothing fills (exit 10, MG-06). */
export interface ComponentNeed {
  /** The slot name. */
  readonly slot: string;
  /** The contract the consumers ask for. */
  readonly contract: string;
  /** The components that require it, sorted. */
  readonly requiredBy: readonly string[];
  /** The sources suggested for it, sorted by component. */
  readonly suggested: readonly SuggestedSource[];
}

/** A failure of resolution (exit 1); each is a row of the message catalogue, MG-24 to MG-28 and MG-38. */
export type ResolutionError =
  | { readonly kind: 'cycle'; readonly cycle: readonly string[] }
  | {
      readonly kind: 'contract';
      readonly consumer: string;
      readonly contract: string;
      readonly slot: string;
      readonly provider: string;
      readonly offered: readonly string[];
    }
  | {
      readonly kind: 'export';
      readonly consumer: string;
      readonly file: string;
      readonly path: string;
      readonly provider: string;
    }
  | { readonly kind: 'count'; readonly slot: string; readonly first: string; readonly second: string }
  | {
      readonly kind: 'runtime';
      readonly component: string;
      readonly tool: string;
      readonly range: string;
      readonly found: string;
    }
  | { readonly kind: 'unsafe-suggestion'; readonly component: string };

/** A dependency that is optional and has no provider: `doctor` notes it, install goes on. */
export interface OptionalGap {
  /** The component that would use it. */
  readonly consumer: string;
  /** The slot nothing fills. */
  readonly slot: string;
  /** The contract it asked for. */
  readonly contract: string;
}

/** How a resolution ended. */
export type ResolutionStatus = 'resolved' | 'needs' | 'failed';

/** What the resolver decided. */
export interface ResolutionResult<Manifest extends ManifestView = ManifestView> {
  /** `resolved` installs `install`; `needs` stops with exit 10; `failed` stops with exit 1. Errors win over needs. */
  readonly status: ResolutionStatus;
  /** The components to install, providers before their consumers; empty unless `resolved`. */
  readonly install: readonly Placed<Manifest>[];
  /** The slots to ask V about, sorted by slot then contract. */
  readonly needs: readonly ComponentNeed[];
  /** What failed, in the order count, cycle, contract, export, runtime, suggestion; each sorted. */
  readonly errors: readonly ResolutionError[];
  /** Components the resolver leaves out because their manifest names a slot that slots/v1 lacks (AC-5.8). */
  readonly skipped: readonly SkippedComponent[];
  /** Public default providers a local provider replaced in a one-provider slot, sorted. */
  readonly displaced: readonly string[];
  /** Optional dependencies without a provider. */
  readonly optionalGaps: readonly OptionalGap[];
}
