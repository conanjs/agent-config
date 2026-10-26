import { describe, expect, it } from "vitest";
import { valueOf } from "@/test/support/results.js";
import { Document } from "./Document.js";

describe("Document", () => {
  it("starts at version 1", () => {
    const document = valueOf(Document.create("d1", "draft"));

    expect(document.version).toBe(1);
  });

  it("revises to the next version when the caller saw the current one", () => {
    const original = valueOf(Document.create("d1", "draft"));

    const revised = valueOf(original.revise("final", 1));

    expect([revised.body, revised.version]).toEqual(["final", 2]);
    expect(original.body).toBe("draft");
  });

  it("refuses a revision based on a stale version", () => {
    const document = valueOf(Document.create("d1", "draft"));

    expect(document.revise("final", 7)).toEqual({
      ok: false,
      error: "version-conflict",
    });
  });

  it("refuses a body longer than the limit", () => {
    const tooLong = "x".repeat(Document.MAX_BODY_LENGTH + 1);

    expect(Document.create("d1", tooLong)).toEqual({
      ok: false,
      error: "invalid-body",
    });
  });
});
