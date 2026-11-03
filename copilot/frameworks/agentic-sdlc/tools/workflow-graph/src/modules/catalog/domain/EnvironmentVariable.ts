/** One environment variable the program reads, as the interface catalog lists it. */
export type EnvironmentVariable = {
  /** The variable's name, e.g. `WORKFLOW_GRAPH_FRAMEWORK`. */
  readonly name: string;
  /** What applies when it is unset or empty. */
  readonly whenUnset: string;
  /** `user` (anyone may set it), `human only` (an agent must not) or `test only` (not part of the stable interface). */
  readonly audience: "user" | "human only" | "test only";
  /** What setting it does. */
  readonly meaning: string;
};
