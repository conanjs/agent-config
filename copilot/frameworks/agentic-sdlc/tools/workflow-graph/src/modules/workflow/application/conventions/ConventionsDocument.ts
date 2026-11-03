const ROLE = /^\s*-\s*\{\s*id:\s*([a-z-]+)\s*,/;

/** conventions.md as the graph tools see it: the role ids of §1 and the blocks generated from the graph. */
export class ConventionsDocument {
  readonly #text: string;

  /** @param text - the whole conventions.md */
  public constructor(text: string) {
    this.#text = text;
  }

  /** @returns the role ids listed in the `roles:` block of §1 (WG-8) */
  public roles(): Set<string> {
    const section = this.#text.split(/^## /m).find((s) => s.startsWith('1. Roles')) ?? '';
    return new Set(section.split('\n').map((l) => ROLE.exec(l)?.[1]).filter((id): id is string => id !== undefined));
  }

  /**
   * @param name - a generated block's name, such as `phases`
   * @returns the block's lines between its markers, or undefined when the markers are missing
   */
  public block(name: string): string | undefined {
    const m = ConventionsDocument.#pattern(name).exec(this.#text);
    return m?.[2];
  }

  /**
   * @param name - a generated block's name
   * @param body - the new lines between the markers, ending in a newline
   * @returns the whole document with that block replaced
   */
  public withBlock(name: string, body: string): ConventionsDocument {
    return new ConventionsDocument(this.#text.replace(ConventionsDocument.#pattern(name), (_all, open: string, _old: string, close: string) => `${open}${body}${close}`));
  }

  /** @returns the document text */
  public toString(): string {
    return this.#text;
  }

  static #pattern(name: string): RegExp {
    return new RegExp(`(<!-- generated: workflow-graph ${name} [^\\n]*-->\\n)([\\s\\S]*?)(<!-- /generated: workflow-graph ${name} -->)`);
  }
}
