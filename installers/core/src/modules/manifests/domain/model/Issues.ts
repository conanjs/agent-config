// What the manifests module reports instead of throwing: expected failures as values (ERR-1). The printed text of each is a row of
// the shared message catalogue; application/messages renders them.

/** Why a whole list or slots file is refused (the run stops, exit 1). */
export type FileIssue =
  | { readonly kind: 'invalid'; readonly sentence: string }
  | { readonly kind: 'credentials'; readonly component: string };

/** Why one component is skipped while the others install (exit 0 with a warning, MG-21). */
export type SkipReason =
  | { readonly kind: 'archive' }
  | { readonly kind: 'no-manifest'; readonly folder: string }
  | { readonly kind: 'unknown-slot'; readonly slot: string }
  | { readonly kind: 'invalid'; readonly sentence: string }
  | { readonly kind: 'symlink'; readonly path: string };

/** One component the run leaves out. */
export interface ComponentSkip {
  /** The component id from the list. */
  readonly name: string;
  /** Why it is left out. */
  readonly reason: SkipReason;
}
