import { readFile } from "node:fs/promises";
import { parse, type Node } from "@bgotink/kdl";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import {
  CliDescription,
  type ArgSpec,
  type CommandSpec,
  type ExitCodeSpec,
  type FlagSpec,
} from "#src/modules/catalog/domain/CliDescription.ts";
import type { CliDescriptionSource } from "#src/modules/catalog/domain/ports/CliDescriptionSource.ts";

const FLAG = /^(?:-\w\s+)?(--[\w-]+)(?:\s+<([^>]+)>)?$/;

/**
 * {@link CliDescriptionSource} over a usage spec file (KDL 2.0, https://usage.jdx.dev/spec/), parsed with
 * `@bgotink/kdl`. Reads the subset this tool's spec uses: `bin`, `version`, `about`, `exit_code`, and nested `cmd`
 * nodes with `arg`, `flag` (`required`, `var`, `default`, `choices`), `example`, `exit_code` and `output`/`schema`.
 */
export class UsageSpecFile implements CliDescriptionSource {
  readonly #file: string;

  /**
   * Keeps the path; nothing is read until {@link UsageSpecFile.load}.
   *
   * @param file - absolute path of the `.usage.kdl` file
   */
  public constructor(file: string) {
    this.#file = file;
  }

  /**
   * {@link CliDescriptionSource.load}: a KDL syntax error or a flag spelling it cannot read is returned as text.
   */
  public async load(): Promise<Result<CliDescription, string>> {
    let nodes: Node[];
    try {
      nodes = parse(await readFile(this.#file, "utf8")).nodes;
    } catch (e) {
      return err(`${this.#file}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const text = (name: string): string =>
      String(nodes.find((n) => n.getName() === name)?.getArgument(0) ?? "");
    const commands: CommandSpec[] = [];
    for (const n of nodes.filter((c) => c.getName() === "cmd")) {
      const read = this.#command(n, "", commands);
      if (!read.ok) return read;
    }
    return CliDescription.of(
      { bin: text("bin"), version: text("version"), about: text("about") },
      this.#exitCodes(nodes),
      commands,
    );
  }

  #command(node: Node, parent: string, into: CommandSpec[]): Result<true, string> {
    const path = `${parent} ${String(node.getArgument(0))}`.trim();
    const children = node.children?.nodes ?? [];
    const flags: FlagSpec[] = [];
    for (const f of children.filter((c) => c.getName() === "flag")) {
      const flag = this.#flag(f);
      if (!flag.ok) return err(`${this.#file}: command "${path}": ${flag.error}`);
      flags.push(flag.value);
    }
    const subs = children.filter((c) => c.getName() === "cmd");
    into.push({
      path,
      help: String(node.getProperty("help") ?? ""),
      effect: node.hasProperty("effect") ? String(node.getProperty("effect")) : undefined,
      args: children.filter((c) => c.getName() === "arg").map((a) => this.#arg(a)),
      flags,
      subcommands: subs.map((s) => `${path} ${String(s.getArgument(0))}`),
      examples: children
        .filter((c) => c.getName() === "example")
        .map((e) => String(e.getArgument(0))),
      exitCodes: this.#exitCodes(children),
      outputSchemas: children
        .filter((c) => c.getName() === "output")
        .flatMap((o) => o.children?.nodes ?? [])
        .filter((s) => s.getName() === "schema" && s.hasProperty("file"))
        .map((s) => String(s.getProperty("file"))),
    });
    for (const s of subs) {
      const read = this.#command(s, path, into);
      if (!read.ok) return read;
    }
    return ok(true);
  }

  #flag(node: Node): Result<FlagSpec, string> {
    const spelling = String(node.getArgument(0));
    const m = FLAG.exec(spelling);
    if (m === null) return err(`flag "${spelling}" is not "--name" or "--name <value>"`);
    const choices = node.children?.nodes.find((c) => c.getName() === "choices");
    return ok({
      name: String(m[1]),
      value: m[2],
      repeatable: node.getProperty("var") === true,
      required: node.getProperty("required") === true,
      help: String(node.getProperty("help") ?? ""),
      defaultValue: node.hasProperty("default") ? String(node.getProperty("default")) : undefined,
      choices: choices?.getArguments().map(String) ?? [],
    });
  }

  #arg(node: Node): ArgSpec {
    const label = String(node.getArgument(0));
    return { label, required: label.startsWith("<"), help: String(node.getProperty("help") ?? "") };
  }

  #exitCodes(nodes: readonly Node[]): ExitCodeSpec[] {
    return nodes
      .filter((n) => n.getName() === "exit_code")
      .map((n) => ({ code: Number(n.getArgument(0)), meaning: String(n.getArgument(1) ?? "") }));
  }
}
