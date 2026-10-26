import type { DocumentStore } from "@/application/ports/DocumentStore.js";
import type { Result } from "@/domain/Result.js";

/** Reasons a revision is refused; the interface layer maps each one to an HTTP status. */
export type ReviseDocumentError = "not-found" | "version-conflict" | "invalid-body";

/** Input of {@link ReviseDocument.run}, already validated at the HTTP boundary. */
export interface ReviseDocumentInput {
  /** Identifier of the document to change. */
  readonly id: string;
  /** Replacement text. */
  readonly body: string;
  /** Version the caller read before editing. */
  readonly expectedVersion: number;
}

/** Output of {@link ReviseDocument.run}: plain data, so the `Document` entity never leaves the use case. */
export interface ReviseDocumentOutput {
  /** Identifier of the revised document. */
  readonly id: string;
  /** Text now stored. */
  readonly body: string;
  /** Version number after the revision. */
  readonly version: number;
}

/** Use case: replace a document's body without overwriting a newer change by someone else. */
export class ReviseDocument {
  /**
   * Binds the use case to the store it reads from and writes to.
   *
   * @param documents - Port to storage; the composition root passes an adapter.
   */
  public constructor(private readonly documents: DocumentStore) {}

  /**
   * Applies one revision.
   *
   * @returns The stored new version as plain data, or the reason the revision was refused.
   */
  public async run(
    input: ReviseDocumentInput,
  ): Promise<Result<ReviseDocumentOutput, ReviseDocumentError>> {
    const current = await this.documents.find(input.id);
    if (current === undefined) return { ok: false, error: "not-found" };

    const next = current.revise(input.body, input.expectedVersion);
    if (!next.ok) return next;

    // Saving against the version just read closes the gap between find and save:
    // a concurrent revision in between makes this save return version-conflict.
    const saved = await this.documents.save(next.value, current.version);
    if (!saved.ok) return saved;

    const { id, body, version } = saved.value;
    return { ok: true, value: { id, body, version } };
  }
}
