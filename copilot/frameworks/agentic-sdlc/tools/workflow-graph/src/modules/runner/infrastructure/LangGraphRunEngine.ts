import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Annotation, Command, END, interrupt, START, StateGraph } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import type { WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";
import type {
  AdvanceOutcome,
  RunAdvancer,
} from "#src/modules/runner/application/advance/RunAdvancer.ts";
import type { EngineOutcome, RunEngine } from "#src/modules/runner/domain/ports/RunEngine.ts";
import type { RunFolderLayout } from "#src/modules/shared/infrastructure/RunFolderLayout.ts";

const State = Annotation.Root({
  outcome: Annotation<AdvanceOutcome | null>({
    reducer: (_old, next) => next,
    default: () => null,
  }),
});

/**
 * LangGraph.js as the run's engine (specs/020): one LangGraph node per workflow node, routed by what the ledger says
 * is open now; a gate pauses with `interrupt()` and the checkpoint (`<run>/checkpoints.db`, `thread_id` = run id) lets
 * a later `run approve` or `run resume` continue. Loaded only by the `run` commands.
 */
export class LangGraphRunEngine implements RunEngine {
  readonly #graph: WorkflowGraph;
  readonly #advancer: RunAdvancer;
  readonly #layout: RunFolderLayout;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param graph - the workflow graph whose nodes become LangGraph nodes
   * @param advancer - does the work of whichever node is current
   * @param layout - where the run's checkpoint database lives
   */
  public constructor(graph: WorkflowGraph, advancer: RunAdvancer, layout: RunFolderLayout) {
    this.#graph = graph;
    this.#advancer = advancer;
    this.#layout = layout;
  }

  /**
   * {@link RunEngine.drive}: runs until a gate, an end, or something needing a person.
   */
  public async drive(project: string, run: string): Promise<EngineOutcome> {
    const database = this.#layout.checkpoints(project, run);
    mkdirSync(dirname(database), { recursive: true });
    const app = this.#build(project, run).compile({
      checkpointer: SqliteSaver.fromConnString(database),
    });
    const config = { configurable: { thread_id: run }, recursionLimit: 1000 };
    // Resume only a real gate pause; anything else starts a fresh pass, which routes to whatever the ledger says is current (D26).
    const paused = (await app.getState(config)).tasks.some((t) => (t.interrupts?.length ?? 0) > 0);
    // A fresh pass clears the outcome the thread kept from its last pass, so routing starts from the ledger alone.
    const result =
      ((await app.invoke(
        paused ? new Command({ resume: "continue" }) : { outcome: null },
        config,
      )) as Record<string, unknown> | undefined) ?? {};
    const gate = (result["__interrupt__"] as Array<{ value?: { gate?: string } }> | undefined)?.[0]
      ?.value?.gate;
    if (gate !== undefined) return { kind: "gate", gate };
    const outcome = result["outcome"] as AdvanceOutcome | null | undefined;
    if (outcome?.kind === "end") return { kind: "end", node: outcome.node };
    if (outcome?.kind === "attention") return outcome;
    return { kind: "attention", reason: "the run stopped without reaching a gate or an end" };
  }

  #build(project: string, run: string) {
    const ids = this.#graph.nodeIds();
    const name = (id: string): string => `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
    const route = async (state: typeof State.State): Promise<string> => {
      if (state.outcome?.kind === "end" || state.outcome?.kind === "attention") return END;
      const current = await this.#advancer.current(project, run);
      return current === undefined ? END : name(current);
    };
    const builder = new StateGraph(State);
    for (const id of ids) {
      builder.addNode(name(id), async () => {
        const outcome = await this.#advancer.advance(project, run, id);
        if (outcome.kind === "gate") {
          interrupt({ gate: outcome.gate });
          return { outcome: { kind: "moved" } as const };
        }
        return { outcome };
      });
    }
    const targets = [...ids.map(name), END];
    const enter = async (): Promise<string> => {
      const current = await this.#advancer.current(project, run);
      return current === undefined ? END : name(current);
    };
    builder.addConditionalEdges(START as never, enter, targets as never);
    for (const id of ids) builder.addConditionalEdges(name(id) as never, route, targets as never);
    return builder;
  }
}
