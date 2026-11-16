/** One reason the YAML reader refused a text: a stable code, a fixed sentence that never quotes the text, and the line when known. */
export interface YamlReaderFinding {
  /** Stable code of the failure, for tests and logs. */
  readonly code: string;
  /** A fixed sentence about the failure; it never quotes the text. */
  readonly message: string;
  /** The 1-based line the failure points at, when known. */
  readonly line: number | undefined;
}

/**
 * The hardened YAML reader of `contracts/lib/yaml.ts` (`readYaml`, M-17: size cap, no tags, no aliases, no duplicate keys), as the
 * variables module needs it. It has the same shape as that function, so the composition root passes it in; this module imports no
 * YAML library, so there is one place that decides what a safe YAML text is.
 *
 * @param text - the whole file
 * @returns the plain value (`null` for an empty file), or every finding
 */
export type YamlReader = (
  text: string,
) =>
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly findings: readonly YamlReaderFinding[] };
