/** Who wrote a ledger line. */
export type Actor = 'orchestrator' | 'script' | 'human' | 'runner';

/** What a ledger line says, without its position in the chain (`seq`, `prev`, `hash`, `at`). */
export type EntryContent = {
  readonly run: string;
  readonly node: string;
  readonly result: string;
  readonly actor: Actor;
  readonly task?: string;
  readonly attempt?: number;
  readonly feature?: string;
  readonly evidence?: readonly string[];
  readonly quote?: string;
  readonly source?: string;
  readonly session?: string;
  readonly log?: string;
  readonly agent?: string;
};
