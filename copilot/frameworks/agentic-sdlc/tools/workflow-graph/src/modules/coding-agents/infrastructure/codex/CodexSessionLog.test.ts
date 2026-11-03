// The Codex session log adapter on the line shape of a real rollout (Codex 0.164.0-alpha.11.1, 2026-11-03).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodexSessionLog } from "#src/modules/coding-agents/infrastructure/codex/CodexSessionLog.ts";
import { JsonlLog } from "#src/modules/coding-agents/infrastructure/JsonlLog.ts";

const rollout = join(mkdtempSync(join(tmpdir(), "codex-log-")), "rollout.jsonl");
writeFileSync(
  rollout,
  [
    { type: "session_meta", payload: { id: "x1" } },
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "approve G2 R-003 (live test from Codex). Reply only: noted.",
          },
        ],
      },
    },
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "approve G5 R-003" }],
      },
    },
  ]
    .map((l) => JSON.stringify(l))
    .join("\n"),
);
const log = new CodexSessionLog(new JsonlLog());

describe("CodexSessionLog", () => {
  it("finds a quote the user typed", async () => {
    expect(
      await log.containsUserMessage(
        { session: "x1", log: rollout },
        "approve G2 R-003 (live test from Codex). Reply only: noted.",
      ),
    ).toEqual({ ok: true, value: true });
  });

  it("does not count the assistant’s own words as the user’s", async () => {
    expect(
      await log.containsUserMessage({ session: "x1", log: rollout }, "approve G5 R-003"),
    ).toEqual({ ok: true, value: false });
  });

  it("reports a missing rollout instead of guessing", async () => {
    expect(await log.containsUserMessage({ session: "x1" }, "anything")).toEqual({
      ok: false,
      error: "session log (unknown) not found",
    });
  });
});
