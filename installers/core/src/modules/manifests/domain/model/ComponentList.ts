// The component lists as the installer holds them after reading `components.yaml` and `components.local.yaml`
// (components-list/v1, data-model "ListEntry").

/** Where a component comes from, by `type`. */
export type ComponentSource =
  | { readonly type: 'git'; readonly url: string; readonly ref: string }
  | { readonly type: 'path'; readonly path: string }
  | { readonly type: 'archive'; readonly url: string; readonly sha256: string };

/** One line of a list: a component name and its source. */
export interface ListEntry {
  /** The component id, already checked against the M-03 allow-list. */
  readonly name: string;
  /** Where the component comes from. */
  readonly source: ComponentSource;
}

/** One validated list. */
export interface ComponentList {
  /** True for the local list, false for the public one. */
  readonly local: boolean;
  /** The entries in file order; empty when the list has none or the file is absent. */
  readonly entries: readonly ListEntry[];
  /** Whether the file was there; the public list is expected to be, the local one need not be. */
  readonly present: boolean;
}

/** One entry of the merged lists: the source that is used, and the public source it replaced when a local entry won (CL-1). */
export interface MergedEntry {
  /** The component id. */
  readonly name: string;
  /** The source that is used. */
  readonly source: ComponentSource;
  /** Which list the used source came from. */
  readonly origin: 'public' | 'local';
  /** The public source a local entry replaced; absent when nothing was replaced. */
  readonly replaced: ComponentSource | undefined;
}
