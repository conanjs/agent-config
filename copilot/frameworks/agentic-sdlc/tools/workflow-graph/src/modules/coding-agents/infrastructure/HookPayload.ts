import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

/** A hook's JSON input with safe accessors: a missing or wrongly typed field reads as undefined instead of throwing. */
export class HookPayload {
  readonly #data: Readonly<Record<string, unknown>>;

  private constructor(data: Readonly<Record<string, unknown>>) {
    this.#data = data;
  }

  /**
   * Returns the payload, or why it is not a JSON object.
   *
   * @param raw - the hook's stdin
   * @returns the payload, or why it is not a JSON object
   */
  public static parse(raw: string): Result<HookPayload, string> {
    try {
      const data: unknown = JSON.parse(raw);
      return typeof data === "object" && data !== null && !Array.isArray(data)
        ? ok(new HookPayload(data as Record<string, unknown>))
        : err("hook input is not a JSON object");
    } catch {
      return err("hook input is not JSON");
    }
  }

  /**
   * Returns the first that holds a string.
   *
   * @param keys - field names to try in order
   * @returns the first that holds a string
   */
  public text(...keys: string[]): string | undefined {
    for (const k of keys) if (typeof this.#data[k] === "string") return this.#data[k];
    return undefined;
  }

  /**
   * Reads a nested object; a JSON string holding an object is parsed (some agents send tool arguments as a string).
   * @param keys - field names to try in order
   * @returns the first that holds an object, as a payload
   */
  public object(...keys: string[]): HookPayload | undefined {
    for (const k of keys) {
      const v = this.#data[k];
      if (typeof v === "object" && v !== null && !Array.isArray(v))
        return new HookPayload(v as Record<string, unknown>);
      if (typeof v === "string") {
        const parsed = HookPayload.parse(v);
        if (parsed.ok) return parsed.value;
      }
    }
    return undefined;
  }
}
