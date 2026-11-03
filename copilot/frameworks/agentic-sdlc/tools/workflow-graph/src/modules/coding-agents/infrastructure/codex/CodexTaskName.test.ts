// The Codex task_name convention: what the guard can read from a spawn whose message is encrypted.
import { describe, expect, it } from "vitest";
import { CodexTaskName } from "#src/modules/coding-agents/infrastructure/codex/CodexTaskName.ts";

describe("CodexTaskName", () => {
  it("reads run, phase and role", () => {
    expect(CodexTaskName.read("r004_p4_architecture")?.toLaunchPrompt()).toBe(
      "run: R-004\nphase: P4\nrole: architecture",
    );
  });

  it("reads the task and mode of a P6 spawn", () => {
    expect(CodexTaskName.read("r004_p6_engineering_t001_execute")?.toLaunchPrompt()).toBe(
      "run: R-004\nphase: P6\nrole: engineering\ntask: T001\nmode: execute",
    );
  });

  it("keeps a hyphenated role readable", () => {
    expect(CodexTaskName.read("r010_p3_product_spec")?.toLaunchPrompt()).toBe(
      "run: R-010\nphase: P3\nrole: product-spec",
    );
  });

  it("ignores a name that follows no run convention", () => {
    expect(CodexTaskName.read("explore_cart_code")).toBeUndefined();
  });
});
