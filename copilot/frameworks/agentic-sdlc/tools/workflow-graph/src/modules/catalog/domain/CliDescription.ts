import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

/** One flag of a command, as the usage spec declares it. */
export type FlagSpec = {
  /** Long spelling with dashes, e.g. `--node`. */
  readonly name: string;
  /** The value's placeholder, e.g. `id` in `--node <id>`; undefined for a boolean flag. */
  readonly value: string | undefined;
  /** True when the flag may be given more than once (`var=#true`). */
  readonly repeatable: boolean;
  /** True when every call must give it. */
  readonly required: boolean;
  /** One-line help. */
  readonly help: string;
  /** Value used when the flag is left out, if any. */
  readonly defaultValue: string | undefined;
  /** Accepted values; empty means any. */
  readonly choices: readonly string[];
};

/** One positional argument, as the usage spec declares it. */
export type ArgSpec = {
  /** The argument as written in the spec, e.g. `<run>` or `[words]...`. */
  readonly label: string;
  /** True for `<…>`, false for `[…]`. */
  readonly required: boolean;
  /** One-line help. */
  readonly help: string;
};

/** One exit status and what it means. */
export type ExitCodeSpec = {
  /** The process exit code. */
  readonly code: number;
  /** What a caller should conclude from it. */
  readonly meaning: string;
};

/** One command or command group, by its full path, e.g. `run start`. */
export type CommandSpec = {
  /** Space-separated words after the program name, e.g. `run start`. */
  readonly path: string;
  /** One-line help. */
  readonly help: string;
  /** `read`, `write` or `destructive`; undefined means unknown, so callers should ask first. */
  readonly effect: string | undefined;
  /** Positional arguments in order. */
  readonly args: readonly ArgSpec[];
  /** Flags in declaration order. */
  readonly flags: readonly FlagSpec[];
  /** Full paths of its subcommands; non-empty only for a group such as `run`. */
  readonly subcommands: readonly string[];
  /** Example command lines. */
  readonly examples: readonly string[];
  /** Exit codes declared on the command itself; they override the program's by number. */
  readonly exitCodes: readonly ExitCodeSpec[];
  /** Where a declared stdout output's JSON Schema lives, relative to the description file. */
  readonly outputSchemas: readonly string[];
};

/** The program's metadata from the top of the spec. */
export type ProgramInfo = {
  /** The executable name, e.g. `workflow-graph`. */
  readonly bin: string;
  /** Release version, which must equal the package version. */
  readonly version: string;
  /** One-line summary. */
  readonly about: string;
};

/**
 * The whole command-line interface of a program, read from its usage spec: every command and group by path, with
 * flags, arguments, exit codes and effects. Built only through {@link CliDescription.of}, which refuses a path
 * declared twice.
 */
export class CliDescription {
  readonly #info: ProgramInfo;
  readonly #exitCodes: readonly ExitCodeSpec[];
  readonly #commands: ReadonlyMap<string, CommandSpec>;

  private constructor(
    info: ProgramInfo,
    exitCodes: readonly ExitCodeSpec[],
    commands: ReadonlyMap<string, CommandSpec>,
  ) {
    this.#info = info;
    this.#exitCodes = exitCodes;
    this.#commands = commands;
  }

  /**
   * Builds a description, or names the first command path declared twice.
   *
   * @param info - name, version and summary from the top of the spec
   * @param exitCodes - exit codes every command shares
   * @param commands - every command and group in declaration order
   * @returns the description, or the duplicated path
   */
  public static of(
    info: ProgramInfo,
    exitCodes: readonly ExitCodeSpec[],
    commands: readonly CommandSpec[],
  ): Result<CliDescription, string> {
    const byPath = new Map<string, CommandSpec>();
    for (const c of commands) {
      if (byPath.has(c.path)) return err(`command "${c.path}" is declared twice`);
      byPath.set(c.path, c);
    }
    return ok(new CliDescription(info, exitCodes, byPath));
  }

  /**
   * Returns the program's name, version and summary.
   *
   * @returns the metadata declared at the top of the spec
   */
  public info(): ProgramInfo {
    return this.#info;
  }

  /**
   * Returns one command or group by its path.
   *
   * @param path - words after the program name, e.g. `run start`
   * @returns the command, or undefined when the spec has no such path
   */
  public command(path: string): CommandSpec | undefined {
    return this.#commands.get(path);
  }

  /**
   * Returns every command and group in declaration order.
   *
   * @returns all paths, groups included
   */
  public commands(): CommandSpec[] {
    return [...this.#commands.values()];
  }

  /**
   * Returns the commands that run something, leaving out groups such as `run`.
   *
   * @returns every path with no subcommands
   */
  public runnable(): CommandSpec[] {
    return this.commands().filter((c) => c.subcommands.length === 0);
  }

  /**
   * Returns the top-level commands, the words a caller may type first.
   *
   * @returns paths with no space, in declaration order
   */
  public topLevel(): CommandSpec[] {
    return this.commands().filter((c) => !c.path.includes(" "));
  }

  /**
   * Returns the one-line form of a command: program, path, arguments, required flags, then `[options]` when it has
   * optional flags, e.g. `workflow-graph status [run] [options]`.
   *
   * @param path - the command's path
   * @returns the synopsis, or the program and path alone for an unknown path
   */
  public synopsis(path: string): string {
    const c = this.#commands.get(path);
    const words = [this.#info.bin, path];
    if (c === undefined) return words.join(" ");
    if (c.subcommands.length > 0) return [...words, "<command>"].join(" ");
    words.push(...c.args.map((a) => a.label));
    for (const f of c.flags.filter((x) => x.required))
      words.push(f.value === undefined ? f.name : `${f.name} <${f.value}>`);
    if (c.flags.some((x) => !x.required)) words.push("[options]");
    return words.join(" ");
  }

  /**
   * Returns the exit codes that apply to one command: the program's, overridden by number by the command's own.
   *
   * @param path - the command's path
   * @returns exit codes sorted by number
   */
  public exitCodesFor(path: string): ExitCodeSpec[] {
    const merged = new Map(this.#exitCodes.map((e) => [e.code, e] as const));
    for (const e of this.#commands.get(path)?.exitCodes ?? []) merged.set(e.code, e);
    return [...merged.values()].sort((a, b) => a.code - b.code);
  }
}
