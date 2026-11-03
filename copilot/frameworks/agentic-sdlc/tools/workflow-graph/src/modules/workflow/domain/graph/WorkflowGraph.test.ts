// WorkflowGraph through load and its queries, on a small graph written for each case (PDM-class-modeled-R6).
import { describe, expect, it } from "vitest";
import { WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";

const base = {
  schema: "workflow-graph/v1",
  name: "mini",
  version: "1.0.0",
  start: "A",
  budgets: { retry: { default: 1, loop: "Retry", exhausted: "Stop" } },
  nodes: {
    A: { kind: "phase" },
    G: { kind: "gate" },
    B: { kind: "phase" },
    B1: { kind: "step", of: "B", mode: "execute" },
    end: { kind: "end" },
  },
  edges: [
    { from: "A", to: "G", on: "go" },
    { from: "A", to: "end", on: "otherwise" },
    { from: "G", to: "B", on: "approved" },
    { from: "G", to: "A", on: "changes-requested" },
    { from: "G", to: "end", on: "otherwise" },
    { from: "B", to: "B1", on: "task" },
    { from: "B", to: "end", on: "otherwise" },
    { from: "B1", to: "B1", on: "fail", budget: "retry" },
    { from: "B1", to: "end", on: "otherwise" },
  ],
  paths: [{ id: "go", when: "Always", run: ["B"] }],
};

describe("WorkflowGraph", () => {
  it("loads a sound graph and answers which moves follow a result", () => {
    const g = WorkflowGraph.load(base, "mini.yaml");
    expect(g.ok && [...g.value.movesAfter("G", "approved", "go").keys()]).toEqual(["B"]);
    expect(g.ok && [...g.value.movesAfter("G", "nonsense", "go").keys()]).toEqual(["end"]);
    expect(g.ok && g.value.stepFor("B", "execute")).toBe("B1");
  });

  it("applies project budgets over the defaults and ignores unknown names", () => {
    const g = WorkflowGraph.load(base, "mini.yaml");
    const tuned = g.ok
      ? g.value.withBudgets(
          new Map([
            ["retry", 3],
            ["nope", 9],
          ]),
        )
      : undefined;
    expect([tuned?.budget("retry"), tuned?.budget("nope")]).toEqual([3, undefined]);
  });

  it("rejects a loop with no gate and no budget", () => {
    const edges = base.edges.map((e) =>
      e.from === "B1" && e.to === "B1" ? { from: "B1", to: "B1", on: "fail" } : e,
    );
    expect(WorkflowGraph.load({ ...base, edges }, "mini.yaml")).toEqual({
      ok: false,
      error: [
        {
          code: "WG-11",
          where: "mini.yaml",
          message: "edge B1 → B1 closes a loop with no gate and has no budget",
        },
      ],
    });
  });

  it("rejects a gate that cannot be sent back", () => {
    const edges = base.edges.filter((e) => e.on !== "changes-requested");
    const g = WorkflowGraph.load({ ...base, edges }, "mini.yaml");
    expect(!g.ok && g.error.map((f) => f.code)).toEqual(["WG-7"]);
  });

  it("names owners that are not roles", () => {
    const g = WorkflowGraph.load(
      { ...base, nodes: { ...base.nodes, A: { kind: "phase", owner: ["qa", "ghost"] } } },
      "mini.yaml",
    );
    expect(
      g.ok && g.value.ownersOutside(new Set(["qa"]), "mini.yaml").map((f) => f.message),
    ).toEqual(['node "A": owner "ghost" is not a role in conventions.md §1']);
  });
});
