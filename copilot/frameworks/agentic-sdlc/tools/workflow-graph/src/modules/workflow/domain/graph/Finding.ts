/** One broken rule: the WG rule id from `schemas/workflow-graph.schema.md`, where, and what is wrong. */
export type Finding = {
  /** Rule id such as `WG-3`. */
  readonly code: string;
  /** File or run the finding is about, for example `workflow.graph.yaml` or `R-007 line 4`. */
  readonly where: string;
  /** Plain-language explanation printed after the rule id. */
  readonly message: string;
  /** True for findings that only warn (WG-22). */
  readonly warning?: boolean;
};
