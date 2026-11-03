import type { CliDescription, CommandSpec } from "#src/modules/catalog/domain/CliDescription.ts";
import type { EnvironmentVariable } from "#src/modules/catalog/domain/EnvironmentVariable.ts";

const SECTIONS = ["commands", "environment"] as const;

/** A generated section of `INTERFACES.md`, between `<!-- generated:<name> -->` and `<!-- end:<name> -->`. */
export type SectionName = (typeof SECTIONS)[number];

/**
 * Renders the generated sections of `INTERFACES.md` from their sources (the usage spec, the environment list) and
 * puts them between their markers, the way `compile-graph` writes the tables in `conventions.md`.
 */
export class CatalogMarkdown {
  /**
   * Returns each generated section's body.
   *
   * @param cli - the command-line description
   * @param environment - the variables the program reads
   * @returns section name to Markdown body
   */
  public render(
    cli: CliDescription,
    environment: readonly EnvironmentVariable[],
  ): Record<SectionName, string> {
    return { commands: this.#commands(cli), environment: this.#environment(environment) };
  }

  /**
   * Returns the names of sections whose text in the document differs from the rendered body, or is missing.
   *
   * @param document - the current `INTERFACES.md`
   * @param bodies - the rendered sections
   * @returns stale or missing section names
   */
  public stale(document: string, bodies: Record<SectionName, string>): SectionName[] {
    return SECTIONS.filter((name) => this.#current(document, name) !== bodies[name]);
  }

  /**
   * Returns the document with every generated section replaced, or undefined when a marker pair is missing.
   *
   * @param document - the current `INTERFACES.md`
   * @param bodies - the rendered sections
   * @returns the new document text, or undefined when a section has no markers to write between
   */
  public replace(document: string, bodies: Record<SectionName, string>): string | undefined {
    let out = document;
    for (const name of SECTIONS) {
      const [start, end] = this.#markers(name);
      const a = out.indexOf(start);
      const b = out.indexOf(end);
      if (a < 0 || b < a) return undefined;
      out = `${out.slice(0, a + start.length)}\n${bodies[name]}\n${out.slice(b)}`;
    }
    return out;
  }

  #current(document: string, name: SectionName): string | undefined {
    const [start, end] = this.#markers(name);
    const a = document.indexOf(start);
    const b = document.indexOf(end);
    return a < 0 || b < a ? undefined : document.slice(a + start.length, b).trim();
  }

  #markers(name: SectionName): [string, string] {
    return [`<!-- generated:${name} -->`, `<!-- end:${name} -->`];
  }

  #commands(cli: CliDescription): string {
    const blocks = cli.runnable().map((c) => this.#command(cli, c));
    return blocks.join("\n\n");
  }

  #command(cli: CliDescription, c: CommandSpec): string {
    const lines = [`#### \`${c.path}\``, "", "```text", cli.synopsis(c.path), "```", ""];
    lines.push(`${c.help}. Effect: **${c.effect ?? "unknown"}**.`);
    const rows = [
      ...c.args.map(
        (a) => `| \`${a.label}\` | argument | ${a.required ? "yes" : ""} | ${a.help} |`,
      ),
      ...c.flags.map((f) => {
        const notes = [
          f.repeatable ? "repeatable" : "",
          f.defaultValue === undefined ? "" : `default \`${f.defaultValue}\``,
          f.choices.length > 0 ? `one of ${f.choices.map((x) => `\`${x}\``).join(", ")}` : "",
        ].filter((x) => x !== "");
        const spelling = f.value === undefined ? f.name : `${f.name} <${f.value}>`;
        return `| \`${spelling}\` | flag${notes.length > 0 ? `; ${notes.join("; ")}` : ""} | ${f.required ? "yes" : ""} | ${f.help} |`;
      }),
    ];
    if (rows.length > 0)
      lines.push("", "| Input | Kind | Required | Meaning |", "|---|---|---|---|", ...rows);
    // Only a command that overrides the shared exit codes lists them; the others follow the Exit codes table.
    if (c.exitCodes.length > 0) {
      const codes = cli
        .exitCodesFor(c.path)
        .map((e) => `${e.code} ${e.meaning}`)
        .join(" · ");
      lines.push("", `Exit codes: ${codes}.`);
    }
    for (const e of c.examples) lines.push("", `Example: \`${e}\``);
    return lines.join("\n");
  }

  #environment(environment: readonly EnvironmentVariable[]): string {
    return [
      "| Variable | When unset | Who sets it | Meaning |",
      "|---|---|---|---|",
      ...environment.map(
        (v) => `| \`${v.name}\` | ${v.whenUnset} | ${v.audience} | ${v.meaning} |`,
      ),
    ].join("\n");
  }
}
