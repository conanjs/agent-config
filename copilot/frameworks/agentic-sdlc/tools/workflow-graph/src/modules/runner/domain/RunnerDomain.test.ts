// The runner's value objects through their public operations (PDM-class-modeled-R6).
import { describe, expect, it } from "vitest";
import { LaunchPrompt } from "#src/modules/runner/domain/LaunchPrompt.ts";
import { RoleReply } from "#src/modules/runner/domain/RoleReply.ts";
import { RunSettings } from "#src/modules/runner/domain/RunSettings.ts";
import { TaskList } from "#src/modules/runner/domain/TaskList.ts";

const reply = (body: string): string =>
  `Here is my reply.\nschema: message/v2\nfrom: qa\nmode: review\n${body}`;
const settings = {
  run: "R-001",
  path: "new-feature",
  feature: "specs/023-cart",
  agent: "claude-code",
  overrides: { qa: "copilot-cli" },
  checks: [],
  maxUsdPerLaunch: 2,
  timeoutMinutes: 30,
};

describe("RoleReply", () => {
  it.each([
    ["type: artifact", "done"],
    ["type: decision", "done"],
    ["type: proposal", "done"],
    ["type: review-pass", "pass"],
    ["type: review-fail\npayload:\n  reason: fixable", "review-fail"],
    ["type: review-fail\npayload:\n  reason: spec-or-plan-wrong", "spec-or-plan-wrong"],
    ["type: question", "blocked"],
    ["type: veto", "blocked"],
  ])('maps "%s" to %s', (body, result) => {
    expect(RoleReply.read(reply(body)).result).toBe(result);
  });

  it("treats a reply without a message/v2 block as blocked, so a person looks at it", () => {
    expect(RoleReply.read("type: artifact, I think").result).toBe("blocked");
  });
});

describe("RunSettings and AgentAssignment", () => {
  it("runs a role with its override and every other role with the run agent", () => {
    const s = RunSettings.of(settings);
    expect(
      s.ok && [
        String(s.value.agents.agentFor("qa")),
        String(s.value.agents.agentFor("architecture")),
      ],
    ).toEqual(["copilot-cli", "claude-code"]);
  });

  it("refuses an unknown agent and a spend cap that is not positive", () => {
    expect(RunSettings.of({ ...settings, overrides: { qa: "gemini" } })).toEqual({
      ok: false,
      error: 'role qa: "gemini" is not claude-code, copilot-cli or codex',
    });
    expect(RunSettings.of({ ...settings, maxUsdPerLaunch: 0 })).toEqual({
      ok: false,
      error: "the spend cap per launch must be above 0",
    });
  });
});

describe("TaskList", () => {
  const list = TaskList.read(
    [
      "- [ ] T001 [Eng] [llm] Model (src/a.ts)",
      "  touches: none · refs: none",
      "- [ ] T002 [QA] [llm] Tests (src/a.test.ts)",
      "  touches: none · refs: none · requires: T001",
    ].join("\n"),
  );

  it("gives the owning role from the department tag", () => {
    expect(list.find("T002")?.role).toBe("qa");
  });

  it("releases a task only after the tasks it requires passed", () => {
    expect(list.nextReady(new Set())?.id).toBe("T001");
    expect(list.nextReady(new Set(["T001"]))?.id).toBe("T002");
    expect(list.nextReady(new Set(["T001", "T002"]))).toBeUndefined();
  });
});

describe("LaunchPrompt", () => {
  it("carries the mission when the run has one", () => {
    expect(
      String(
        LaunchPrompt.for({
          run: "R-001",
          phase: "P1",
          role: "product-spec",
          mode: "propose",
          feature: "specs/023-cart",
          mission: "Add a cart",
        }),
      ),
    ).toContain("Mission: Add a cart");
  });

  it("names the run, phase, role, mode and task the guard reads", () => {
    const text = String(
      LaunchPrompt.for({
        run: "R-001",
        phase: "P6",
        role: "engineering",
        mode: "execute",
        feature: "specs/023-cart",
        task: "T001",
      }),
    );
    expect(text).toContain(
      'mode: execute\nrole: engineering\nphase: P6\nrun: R-001\ntask: "T001 (see specs/023-cart/tasks.md)"',
    );
  });
});
