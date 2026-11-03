/** Who wrote a ledger line. */
export type Actor = "orchestrator" | "script" | "human" | "runner";

/** What a ledger line says, without its position in the chain (`seq`, `prev`, `hash`, `at`). */
export type EntryContent = {
  /** Run id. */
  readonly run: string;
  /** Graph node, or guard-off. */
  readonly node: string;
  /** Result of the node. */
  readonly result: string;
  /** Who wrote the line. */
  readonly actor: Actor;
  /** Task id for P6 steps. */
  readonly task?: string;
  /** Attempt number of a P6 execute line, counted by record. */
  readonly attempt?: number;
  /** Feature folder, on the P0 line. */
  readonly feature?: string;
  /** Relative paths produced or checked. */
  readonly evidence?: readonly string[];
  /** For a human line: the message, at most 2,000 characters. */
  readonly quote?: string;
  /** For a human line: agent and hook event, or runner:terminal. */
  readonly source?: string;
  /** For a human line: the session id. */
  readonly session?: string;
  /** For a human line: the session log path, when known. */
  readonly log?: string;
  /** Agent name sdlc-<role> that did the step. */
  readonly agent?: string;
};
