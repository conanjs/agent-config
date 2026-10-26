import type { Document } from "@/domain/Document.js";
import type { Result } from "@/domain/Result.js";

/**
 * Keeps the current version of each document; the only way the use cases reach storage.
 *
 * @remarks
 * Declared here, next to the use cases that consume it (TSN-2); adapters in `infrastructure/` implement it.
 */
export interface DocumentStore {
  /**
   * Looks up the current version of a document.
   *
   * @param id - Identifier given at creation.
   * @returns The stored version, or `undefined` when no document has this id.
   */
  find(id: string): Promise<Document | undefined>;

  /**
   * Stores `document` as the current version, but only if the stored version is still `replaces`.
   *
   * @remarks
   * The check and the write are one atomic step, so of two concurrent writers based on the same
   * version exactly one succeeds.
   *
   * @param document - The new version, as built by {@link Document.create} or {@link Document.revise}.
   * @param replaces - Version the caller read; `0` when `document` is new.
   * @returns The stored document, or `version-conflict` when another write got there first.
   */
  save(document: Document, replaces: number): Promise<Result<Document, "version-conflict">>;
}
