/** One reason the YAML reader refused a text. */
export interface YamlReaderFinding {
  /** A stable code. */
  readonly code: string;
  /** A fixed sentence that never quotes the text. */
  readonly message: string;
  /** The 1-based line, when known. */
  readonly line: number | undefined;
}

/**
 * The hardened YAML reader of `contracts/lib/yaml.ts` (`readYaml`, M-17), as the wiring module needs it for `compat.yaml`. It has the
 * same shape as that function, so the composition root passes it in; this module imports no YAML library.
 *
 * @param text - the whole file
 * @returns the plain value (`null` for an empty file), or every finding
 */
export type YamlReader = (
  text: string,
) =>
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly findings: readonly YamlReaderFinding[] };
