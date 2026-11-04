import type { CliDescription, CommandSpec } from "#src/modules/catalog/domain/CliDescription.ts";

/** Renders `--help` text from the usage spec, so the help cannot disagree with the interface description. */
export class HelpPresenter {
  /**
   * Returns help for the whole program: its commands, exit codes and how to get one command's help.
   *
   * @param cli - the command-line description
   * @returns the help text
   */
  public program(cli: CliDescription): string {
    const info = cli.info();
    const rows = cli.runnable().map((c) => [c.path, c.help] as const);
    return [
      `Usage: ${info.bin} <command> [options]`,
      "",
      `${info.about}. Version ${info.version}.`,
      "",
      "Commands:",
      ...this.#columns(rows),
      "",
      "Exit codes:",
      ...cli.exitCodesFor("").map((e) => `  ${e.code}  ${e.meaning}`),
      "",
      `Run "${info.bin} help <command>" or "${info.bin} <command> --help" for one command.`,
    ].join("\n");
  }

  /**
   * Returns a command's usage line, arguments, options, exit codes and example; a group lists its subcommands instead.
   *
   * @param cli - the command-line description
   * @param command - the command or group
   * @returns the help text
   */
  public command(cli: CliDescription, command: CommandSpec): string {
    const lines = [`Usage: ${cli.synopsis(command.path)}`, "", `${command.help}.`];
    if (command.effect !== undefined) lines.push(`Effect: ${command.effect}.`);
    if (command.subcommands.length > 0) {
      const rows = command.subcommands.map((p) => [p, cli.command(p)?.help ?? ""] as const);
      lines.push("", "Commands:", ...this.#columns(rows));
      return lines.join("\n");
    }
    if (command.args.length > 0)
      lines.push(
        "",
        "Arguments:",
        ...this.#columns(command.args.map((a) => [a.label, a.help] as const)),
      );
    if (command.flags.length > 0) {
      const rows = command.flags.map((f) => {
        const notes = [
          f.required ? "required" : "",
          f.repeatable ? "repeatable" : "",
          f.defaultValue === undefined ? "" : `default ${f.defaultValue}`,
          f.choices.length > 0 ? `one of: ${f.choices.join(", ")}` : "",
        ].filter((x) => x !== "");
        const spelling = f.value === undefined ? f.name : `${f.name} <${f.value}>`;
        return [spelling, notes.length > 0 ? `${f.help} (${notes.join("; ")})` : f.help] as const;
      });
      lines.push("", "Options:", ...this.#columns(rows));
    }
    lines.push(
      "",
      "Exit codes:",
      ...cli.exitCodesFor(command.path).map((e) => `  ${e.code}  ${e.meaning}`),
    );
    if (command.examples.length > 0)
      lines.push("", "Example:", ...command.examples.map((e) => `  ${e}`));
    return lines.join("\n");
  }

  #columns(rows: ReadonlyArray<readonly [string, string]>): string[] {
    const width = Math.max(...rows.map(([a]) => a.length));
    return rows.map(([a, b]) => `  ${a.padEnd(width)}  ${b}`);
  }
}
