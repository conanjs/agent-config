import { describe, expect, it } from "vitest";
import { Document } from "@/domain/Document.js";
import { InMemoryDocumentStore } from "@/infrastructure/InMemoryDocumentStore.js";
import { valueOf } from "@/test/support/results.js";
import { ReviseDocument } from "./ReviseDocument.js";

async function storeWith(body: string): Promise<InMemoryDocumentStore> {
  const store = new InMemoryDocumentStore();
  valueOf(await store.save(valueOf(Document.create("d1", body)), 0));
  return store;
}

describe("ReviseDocument", () => {
  it("stores the next version", async () => {
    const store = await storeWith("draft");

    const result = await new ReviseDocument(store).run({
      id: "d1",
      body: "final",
      expectedVersion: 1,
    });

    // Plain data, not the Document entity: the entity stays inside the use case (CA-4).
    expect(valueOf(result)).toStrictEqual({ id: "d1", body: "final", version: 2 });
    expect(valueOf(result)).not.toBeInstanceOf(Document);
    expect((await store.find("d1"))?.body).toBe("final");
  });

  it("reports not-found for an unknown id", async () => {
    const result = await new ReviseDocument(new InMemoryDocumentStore()).run({
      id: "nope",
      body: "x",
      expectedVersion: 1,
    });

    expect(result).toEqual({ ok: false, error: "not-found" });
  });

  it("lets only one of two writers based on the same version win", async () => {
    const store = await storeWith("draft");
    const useCase = new ReviseDocument(store);

    const results = await Promise.all([
      useCase.run({ id: "d1", body: "first", expectedVersion: 1 }),
      useCase.run({ id: "d1", body: "second", expectedVersion: 1 }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "version-conflict")).toHaveLength(1);
  });
});
