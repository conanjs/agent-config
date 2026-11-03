import type { Result } from '#src/modules/shared/domain/Result.ts';

/** The three framework files `check-graph` compares and `compile-graph` writes: the YAML source, its JSON and conventions.md. */
export interface GraphFiles {
  /** @returns the parsed YAML source, or the parse error */
  readSource(): Promise<Result<unknown, string>>;
  /** @returns the JSON file's text, or undefined when it does not exist */
  readCompiled(): Promise<string | undefined>;
  /** @returns conventions.md as text */
  readConventions(): Promise<string>;
  /** @param text - the new JSON file content */
  writeCompiled(text: string): Promise<void>;
  /** @param text - the new conventions.md content */
  writeConventions(text: string): Promise<void>;
}
