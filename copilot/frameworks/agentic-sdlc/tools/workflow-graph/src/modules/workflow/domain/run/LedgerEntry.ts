import { createHash } from "node:crypto";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { Actor, EntryContent } from "./EntryContent.ts";

const ACTORS: ReadonlySet<string> = new Set(["orchestrator", "script", "human", "runner"]);
const REQUIRED = [
  "seq",
  "prev",
  "hash",
  "at",
  "run",
  "node",
  "result",
  "actor",
  "gen_ai.workflow.name",
] as const;

/** One line of a run's ledger: what happened, chained to the line before by a SHA-256 hash (WG-15, WG-16). */
export class LedgerEntry {
  readonly #seq: number;
  readonly #at: string;
  readonly #hash: string;
  readonly #prev: string;
  readonly #content: EntryContent;
  readonly #hashed: string;

  private constructor(fields: {
    seq: number;
    at: string;
    prev: string;
    hash: string;
    content: EntryContent;
    hashed: string;
  }) {
    this.#seq = fields.seq;
    this.#at = fields.at;
    this.#prev = fields.prev;
    this.#hash = fields.hash;
    this.#content = fields.content;
    this.#hashed = fields.hashed;
  }

  /**
   * Builds the next line of a chain.
   * @param previous - the last line, or undefined for line 1
   * @param content - what happened
   * @param at - ISO time of the step
   * @param workflow - the graph's name, written as `gen_ai.workflow.name`
   * @returns the new line with its hash
   */
  public static next(
    previous: LedgerEntry | undefined,
    content: EntryContent,
    at: string,
    workflow: string,
  ): LedgerEntry {
    const seq = previous === undefined ? 1 : previous.#seq + 1;
    const prev = previous === undefined ? LedgerEntry.#sha(content.run) : previous.#hash;
    const body = LedgerEntry.#body(seq, prev, at, content, workflow);
    const hashed = JSON.stringify(body);
    return new LedgerEntry({
      seq,
      at,
      prev,
      hash: LedgerEntry.#sha(prev + hashed),
      content,
      hashed,
    });
  }

  /**
   * Reads one ledger line (WG-15).
   * @param line - the JSON text of the line
   * @returns the entry, or what is wrong with the line
   */
  public static parse(line: string): Result<LedgerEntry, string> {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return err("is not JSON");
    }
    const missing = REQUIRED.filter((k) => raw[k] === undefined || raw[k] === "");
    if (missing.length > 0) return err(`lacks ${missing.map((k) => `"${k}"`).join(", ")}`);
    if (!ACTORS.has(String(raw["actor"])))
      return err(`actor "${String(raw["actor"])}" is not orchestrator, script, human or runner`);
    const { hash, ...rest } = raw;
    return ok(
      new LedgerEntry({
        seq: Number(raw["seq"]),
        at: String(raw["at"]),
        prev: String(raw["prev"]),
        hash: String(hash),
        content: LedgerEntry.#contentOf(raw),
        hashed: JSON.stringify(rest),
      }),
    );
  }

  /**
   * WG-16: this line's `prev` is the previous hash and its own hash matches its content.
   * @param previous - the line before, or undefined for line 1
   * @returns true when the chain holds at this line
   */
  public chainsAfter(previous: LedgerEntry | undefined): boolean {
    const expectedPrev =
      previous === undefined ? LedgerEntry.#sha(this.#content.run) : previous.#hash;
    return (
      this.#prev === expectedPrev && this.#hash === LedgerEntry.#sha(this.#prev + this.#hashed)
    );
  }

  /**
   * Returns the line number in the chain, starting at 1.
   *
   * @returns the line number in the chain, starting at 1
   */
  public get seq(): number {
    return this.#seq;
  }

  /**
   * Returns the ISO time of the step.
   *
   * @returns the ISO time of the step
   */
  public get at(): string {
    return this.#at;
  }

  /**
   * Returns what the line says.
   *
   * @returns what the line says
   */
  public get content(): EntryContent {
    return this.#content;
  }

  /**
   * Returns the line as written to the ledger file, `hash` right after `prev`.
   *
   * @returns the line as written to the ledger file, `hash` right after `prev`
   */
  public toJsonLine(): string {
    const body = JSON.parse(this.#hashed) as Record<string, unknown>;
    const { seq, prev, ...rest } = body;
    return JSON.stringify({ seq, prev, hash: this.#hash, ...rest });
  }

  static #sha(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  static #body(
    seq: number,
    prev: string,
    at: string,
    c: EntryContent,
    workflow: string,
  ): Record<string, unknown> {
    const optional = {
      task: c.task,
      attempt: c.attempt,
      feature: c.feature,
      evidence: c.evidence,
      quote: c.quote,
      source: c.source,
      session: c.session,
      log: c.log,
    };
    const present = Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined));
    const agent = c.agent === undefined ? {} : { "gen_ai.agent.name": c.agent };
    return {
      seq,
      prev,
      at,
      run: c.run,
      node: c.node,
      result: c.result,
      actor: c.actor,
      ...present,
      "gen_ai.workflow.name": workflow,
      ...agent,
    };
  }

  static #contentOf(raw: Record<string, unknown>): EntryContent {
    const pick = (k: string): string | undefined =>
      typeof raw[k] === "string" ? raw[k] : undefined;
    const fields = {
      run: String(raw["run"]),
      node: String(raw["node"]),
      result: String(raw["result"]),
      actor: String(raw["actor"]) as Actor,
      task: pick("task"),
      attempt: typeof raw["attempt"] === "number" ? raw["attempt"] : undefined,
      feature: pick("feature"),
      evidence: Array.isArray(raw["evidence"]) ? raw["evidence"].map(String) : undefined,
      quote: pick("quote"),
      source: pick("source"),
      session: pick("session"),
      log: pick("log"),
      agent: pick("gen_ai.agent.name"),
    };
    return Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    ) as unknown as EntryContent;
  }
}
