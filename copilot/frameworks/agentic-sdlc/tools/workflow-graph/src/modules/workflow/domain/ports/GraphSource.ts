import type { Result } from '#src/modules/shared/domain/Result.ts';
import type { Finding } from '#src/modules/workflow/domain/graph/Finding.ts';
import type { WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';

/** Loads the compiled rulebook (`workflow.graph.json`) the hooks and run commands check against. */
export interface GraphSource {
  /** @returns the validated graph, or why it cannot be used */
  loadGraph(): Promise<Result<WorkflowGraph, readonly Finding[]>>;
}
