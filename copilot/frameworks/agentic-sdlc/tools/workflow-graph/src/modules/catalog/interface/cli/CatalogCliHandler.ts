import { parseArgs } from "node:util";
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { OptionTable } from "#src/modules/shared/domain/OptionTable.ts";
import type { CliDescriptionSource } from "#src/modules/catalog/domain/ports/CliDescriptionSource.ts";
import type { CheckInterfaces } from "#src/modules/catalog/application/check-interfaces/CheckInterfaces.ts";
import type { HelpPresenter } from "#src/modules/catalog/interface/cli/HelpPresenter.ts";

/** The `help` and `interfaces` commands: help rendered from the usage spec, and the catalog's drift check. */
export class CatalogCliHandler {
  /** The flags each command parses, compared with the usage spec by `interfaces` itself (IF-3). */
  public static readonly options: ReadonlyMap<string, OptionTable> = new Map<string, OptionTable>([
    ["help", {}],
    ["interfaces", { write: { type: "boolean" }, root: { type: "string" } }],
  ]);

  readonly #description: CliDescriptionSource;
  readonly #help: HelpPresenter;
  readonly #check: (root: string) => CheckInterfaces;
  readonly #toolRoot: string;

  /**
   * Keeps the collaborators; nothing is read until a command runs.
   *
   * @param description - the tool's own usage spec, for help
   * @param help - renders help text
   * @param check - builds the drift check for a catalog root
   * @param toolRoot - the tool folder, the default `--root`
   */
  public constructor(
    description: CliDescriptionSource,
    help: HelpPresenter,
    check: (root: string) => CheckInterfaces,
    toolRoot: string,
  ) {
    this.#description = description;
    this.#help = help;
    this.#check = check;
    this.#toolRoot = toolRoot;
  }

  /**
   * Returns help for the words given (the program's when none), or exit 2 for an unknown command.
   *
   * @param words - command words, e.g. `["run", "start"]`
   * @returns the help text with exit 0, or a usage error
   */
  public async help(words: readonly string[]): Promise<CommandOutput> {
    const loaded = await this.#description.load();
    if (!loaded.ok) return { code: 1, out: loaded.error };
    const cli = loaded.value;
    if (words.length === 0) return { code: 0, out: this.#help.program(cli) };
    for (let n = words.length; n > 0; n--) {
      const command = cli.command(words.slice(0, n).join(" "));
      if (command !== undefined) return { code: 0, out: this.#help.command(cli, command) };
    }
    return {
      code: 2,
      out: `unknown command "${words.join(" ")}"; run: ${cli.info().bin} help`,
    };
  }

  /**
   * Runs the drift check, or with `--write` regenerates INTERFACES.md's generated sections and then checks.
   *
   * @param args - the arguments after `interfaces`
   * @returns findings in the validators' format, exit 1 when any
   */
  public async interfaces(args: readonly string[]): Promise<CommandOutput> {
    const { values } = parseArgs({
      args: [...args],
      options: { write: { type: "boolean" }, root: { type: "string" } },
    });
    const root = values.root ?? this.#toolRoot;
    const findings = await this.#check(root).run(values.write === true);
    const lines = findings.map((f) => `  ${f.code}  ${f.where}: ${f.message}`);
    return {
      code: findings.length > 0 ? 1 : 0,
      out: [
        `workflow-graph interfaces: ${root}`,
        ...lines,
        findings.length > 0 ? `FAIL (${findings.length})` : "PASS (0 warning(s))",
      ].join("\n"),
    };
  }
}
