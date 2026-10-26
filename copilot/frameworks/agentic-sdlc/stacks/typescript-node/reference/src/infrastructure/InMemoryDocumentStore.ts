import type { DocumentStore } from "@/application/ports/DocumentStore.js";
import type { Document } from "@/domain/Document.js";
import type { Result } from "@/domain/Result.js";

/** {@link DocumentStore} that keeps documents in process memory; everything is lost on restart. */
export class InMemoryDocumentStore implements DocumentStore {
  readonly #documents = new Map<string, Document>();

  /** {@inheritDoc DocumentStore.find} */
  public find(id: string): Promise<Document | undefined> {
    return Promise.resolve(this.#documents.get(id));
  }

  /** {@inheritDoc DocumentStore.save} */
  public save(document: Document, replaces: number): Promise<Result<Document, "version-conflict">> {
    // No await between the check and the write, so no other save can run in between.
    const stored = this.#documents.get(document.id)?.version ?? 0;
    if (stored !== replaces) return Promise.resolve({ ok: false, error: "version-conflict" });
    this.#documents.set(document.id, document);
    return Promise.resolve({ ok: true, value: document });
  }
}
