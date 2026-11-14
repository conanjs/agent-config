// Types for tools.mjs (legacy JavaScript, exempt from the new lint and type rules), so the TypeScript support files
// and tool.ts files of specs/022 can import it under `strict`.

/** The process a tool entry starts: `env` is merged into process.env. */
export interface ToolRun {
  file: string;
  args: string[];
  env: Record<string, string>;
}

/** One entry of the registry; the field meanings are in the header of tools.mjs. */
export interface ToolDefinition {
  fixture?: string;
  /** Method syntax on purpose: a tool.ts may type `world` as its own World shape. */
  run(world: unknown, extraArgs: string[]): ToolRun;
  header?: RegExp;
  normalize?: [RegExp, string][];
  quietPass: string;
  codes: () => string[];
  rules?: string;
}

/** Absolute path of the repository root. */
export declare const repo: string;

/** Registers a tool under its name for the shared steps; throws when the name is taken. */
export declare function registerTool(name: string, def: ToolDefinition): void;

/** The definition registered under `name`; throws when there is none. */
export declare function getTool(name: string): ToolDefinition;

/** Sorted rule codes from the fail/warn calls in a repo file; throws when fewer than 3 are found. */
export declare function codesFromCalls(file: string, fns?: string[]): string[];
