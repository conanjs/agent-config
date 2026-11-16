/** Why `variables.local.yaml` could not be read: it is there but not a readable regular file (no permission, a folder, a link, a device). */
export interface VariablesFileUnreadable {
  /** The only failure kind: the path is there but cannot be read as a regular file. */
  readonly kind: 'unreadable';
}

/**
 * The read side of V's values file, owned by the variables application layer and answered by an adapter (DR-305). Writing the file is
 * not here: `set` hands the new text to the state module's backup and write steps (A-D3, M-10), so there is one writer.
 */
export interface VariablesFileStore {
  /**
   * Reads the whole text of `variables.local.yaml`, at most one byte more than the YAML reader's size limit (M-17), so a hostile
   * file is never held in memory in full: the reader then refuses the text for its size.
   *
   * @returns the text; `undefined` when the file does not exist; `unreadable` for any other failure
   */
  readText(): Promise<
    | { readonly ok: true; readonly value: string | undefined }
    | { readonly ok: false; readonly error: VariablesFileUnreadable }
  >;
}
