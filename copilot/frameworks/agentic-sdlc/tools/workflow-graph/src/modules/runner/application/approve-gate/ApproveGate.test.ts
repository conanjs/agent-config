// ApproveGate with a fake terminal (through the HumanConsole port) and a fake recorder: the person must type the gate.
import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RecordApproval } from "#src/modules/workflow/application/record-approval/RecordApproval.ts";
import { ApproveGate } from "#src/modules/runner/application/approve-gate/ApproveGate.ts";
import type { HumanConsole } from "#src/modules/runner/domain/ports/HumanConsole.ts";

class TypedConsole implements HumanConsole {
  readonly #answer: Result<string, string>;
  public constructor(answer: Result<string, string>) {
    this.#answer = answer;
  }
  public ask(): Promise<Result<string, string>> {
    return Promise.resolve(this.#answer);
  }
}

const recorder = (calls: string[]): RecordApproval =>
  ({
    run: (_p: string, text: string) => (
      calls.push(text),
      Promise.resolve([{ run: "R-001", gate: "G3", recorded: true }])
    ),
  }) as unknown as RecordApproval;

describe("ApproveGate", () => {
  it("records the decision when the person types the gate back", async () => {
    const calls: string[] = [];
    expect(
      await new ApproveGate(new TypedConsole(ok("g3")), recorder(calls)).run(
        "/p",
        "approve G3 R-001 fine",
        "G3",
      ),
    ).toEqual({ ok: true, value: true });
    expect(calls).toEqual(["approve G3 R-001 fine"]);
  });

  it("records nothing when the typed gate differs", async () => {
    const calls: string[] = [];
    expect(
      await new ApproveGate(new TypedConsole(ok("G2")), recorder(calls)).run(
        "/p",
        "approve G3 R-001",
        "G3",
      ),
    ).toEqual({ ok: false, error: 'you typed "G2", not G3; nothing recorded' });
    expect(calls).toEqual([]);
  });

  it("records nothing without a terminal", async () => {
    const calls: string[] = [];
    expect(
      (
        await new ApproveGate(new TypedConsole(err("no terminal")), recorder(calls)).run(
          "/p",
          "approve G3 R-001",
          "G3",
        )
      ).ok,
    ).toBe(false);
    expect(calls).toEqual([]);
  });
});
