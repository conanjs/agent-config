/** One flag as `node:util` `parseArgs` declares it: a value-taking string or a boolean, maybe repeatable. */
export type OptionSpec = {
  /** `string` takes a value (`--node P3`); `boolean` takes none (`--write`). */
  readonly type: "string" | "boolean";
  /** True when the flag may be given more than once (`--check a --check b`). */
  readonly multiple?: boolean;
};

/** The flags one command accepts, keyed by long name without the dashes; the interface catalog compares it with the CLI description. */
export type OptionTable = Readonly<Record<string, OptionSpec>>;
