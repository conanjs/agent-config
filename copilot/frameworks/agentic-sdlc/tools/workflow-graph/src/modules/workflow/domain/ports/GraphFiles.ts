import type { Result } from "#src/modules/shared/domain/Result.ts";

/** The three framework files `check-graph` compares and `compile-graph` writes: the YAML source, its JSON and conventions.md. */
export interface GraphFiles {
  /**
   * Returns the parsed YAML source, or the parse error.
   *
   * @returns the parsed YAML source, or the parse error
   */
  readSource(): Promise<Result<unknown, string>>;
  /**
   * Returns the JSON file's text, or undefined when it does not exist.
   *
   * @returns the JSON file's text, or undefined when it does not exist
   */
  readCompiled(): Promise<string | undefined>;
  /**
   * Returns conventions.md as text.
   *
   * @returns conventions.md as text
   */
  readConventions(): Promise<string>;
  /**
   * Replaces workflow.graph.json with the given text.
   *
   * @param text - the new JSON file content
   */
  writeCompiled(text: string): Promise<void>;
  /**
   * Replaces conventions.md with the given text, its generated tables already updated.
   *
   * @param text - the new conventions.md content
   */
  writeConventions(text: string): Promise<void>;
}
