import type { OptionTable } from "#src/modules/shared/domain/OptionTable.ts";
import type { CliDescription, CommandSpec } from "#src/modules/catalog/domain/CliDescription.ts";
import type { EnvironmentVariable } from "#src/modules/catalog/domain/EnvironmentVariable.ts";
import type { CatalogFiles } from "#src/modules/catalog/domain/ports/CatalogFiles.ts";
import type { CliDescriptionSource } from "#src/modules/catalog/domain/ports/CliDescriptionSource.ts";
import type { CatalogMarkdown } from "#src/modules/catalog/application/CatalogMarkdown.ts";

/** One disagreement between the interface catalog and the code (spec 021, rules IF-1 … IF-8). */
export type CatalogFinding = {
  /** Rule id, e.g. `IF-3`. */
  readonly code: string;
  /** File or command the finding is about. */
  readonly where: string;
  /** What disagrees. */
  readonly message: string;
};

/** What the code itself says about its interfaces, handed in by the composition root. */
export type CodeFacts = {
  /** Each runnable command path (`record`, `run start` …) and the flags its handler parses. */
  readonly options: ReadonlyMap<string, OptionTable>;
  /** The environment variables the program declares it reads. */
  readonly environment: readonly EnvironmentVariable[];
};

const DESCRIPTION = "interfaces/workflow-graph.usage.kdl";

/**
 * Checks that the interface catalog tells the truth about the code, and with `write` regenerates the sections of
 * `INTERFACES.md` that come from a source. Every rule compares one source with one generated or hand-written form.
 */
export class CheckInterfaces {
  readonly #source: CliDescriptionSource;
  readonly #files: CatalogFiles;
  readonly #markdown: CatalogMarkdown;
  readonly #facts: CodeFacts;

  /**
   * Keeps the collaborators; nothing is read until {@link CheckInterfaces.run}.
   *
   * @param source - the usage spec
   * @param files - INTERFACES.md, catalog-info.yaml, the schemas and package.json under one root
   * @param markdown - renders the generated sections
   * @param facts - the handlers' option tables and the declared environment variables
   */
  public constructor(
    source: CliDescriptionSource,
    files: CatalogFiles,
    markdown: CatalogMarkdown,
    facts: CodeFacts,
  ) {
    this.#source = source;
    this.#files = files;
    this.#markdown = markdown;
    this.#facts = facts;
  }

  /**
   * Returns every disagreement; with `write`, first rewrites the generated sections so they cannot be one.
   *
   * @param write - true to regenerate `INTERFACES.md`'s generated sections before checking
   * @returns the findings, empty when the catalog and the code agree
   */
  public async run(write: boolean): Promise<CatalogFinding[]> {
    const loaded = await this.#source.load();
    if (!loaded.ok) return [{ code: "IF-1", where: DESCRIPTION, message: loaded.error }];
    const cli = loaded.value;
    const findings = [
      ...this.#commands(cli),
      ...(await this.#version(cli)),
      ...(await this.#environment()),
      ...(await this.#document(cli, write)),
      ...(await this.#catalog()),
      ...(await this.#schemas(cli)),
    ];
    return findings;
  }

  // IF-2 a command on one side only; IF-3 a flag that differs.
  #commands(cli: CliDescription): CatalogFinding[] {
    const described = new Map(cli.runnable().map((c) => [c.path, c] as const));
    const out: CatalogFinding[] = [];
    for (const path of this.#facts.options.keys())
      if (!described.has(path))
        out.push({
          code: "IF-2",
          where: DESCRIPTION,
          message: `command "${path}" is in the code but not described`,
        });
    for (const [path, spec] of described) {
      const table = this.#facts.options.get(path);
      if (table === undefined) {
        out.push({
          code: "IF-2",
          where: DESCRIPTION,
          message: `command "${path}" is described but no handler parses it`,
        });
        continue;
      }
      out.push(...this.#flags(spec, table));
    }
    return out;
  }

  #flags(spec: CommandSpec, table: OptionTable): CatalogFinding[] {
    const out: CatalogFinding[] = [];
    const where = `${DESCRIPTION} (${spec.path})`;
    const described = new Map(spec.flags.map((f) => [f.name.replace(/^--/, ""), f] as const));
    for (const [name, option] of Object.entries(table)) {
      const f = described.get(name);
      if (f === undefined) {
        out.push({
          code: "IF-3",
          where,
          message: `--${name} is parsed by the code but not described`,
        });
        continue;
      }
      if ((option.type === "string") !== (f.value !== undefined))
        out.push({
          code: "IF-3",
          where,
          message: `--${name} ${option.type === "string" ? "takes a value in the code" : "takes no value in the code"} but not in the description`,
        });
      if ((option.multiple === true) !== f.repeatable)
        out.push({
          code: "IF-3",
          where,
          message: `--${name} is ${option.multiple === true ? "" : "not "}repeatable in the code but ${f.repeatable ? "" : "not "}in the description`,
        });
    }
    for (const name of described.keys())
      if (!(name in table))
        out.push({
          code: "IF-3",
          where,
          message: `--${name} is described but the code does not parse it`,
        });
    return out;
  }

  // IF-4 the description's version is the package's.
  async #version(cli: CliDescription): Promise<CatalogFinding[]> {
    const pkg = await this.#files.packageVersion();
    return pkg === cli.info().version
      ? []
      : [
          {
            code: "IF-4",
            where: DESCRIPTION,
            message: `version ${cli.info().version} is not package.json's ${pkg ?? "(none)"}`,
          },
        ];
  }

  // IF-5 every variable the code reads is declared, and every declared one is read.
  async #environment(): Promise<CatalogFinding[]> {
    const read = await this.#files.environmentNamesInCode();
    const declared = this.#facts.environment.map((v) => v.name);
    return [
      ...read
        .filter((n) => !declared.includes(n))
        .map((n) => ({
          code: "IF-5",
          where: "src/CompositionRoot.ts",
          message: `${n} is read but not in ENVIRONMENT`,
        })),
      ...declared
        .filter((n) => !read.includes(n))
        .map((n) => ({
          code: "IF-5",
          where: "src/CompositionRoot.ts",
          message: `${n} is in ENVIRONMENT but never read`,
        })),
    ];
  }

  // IF-6 the generated sections of INTERFACES.md match their sources.
  async #document(cli: CliDescription, write: boolean): Promise<CatalogFinding[]> {
    const doc = await this.#files.readDocument();
    if (doc === undefined) return [{ code: "IF-6", where: "INTERFACES.md", message: "missing" }];
    const bodies = this.#markdown.render(cli, this.#facts.environment);
    if (write) {
      const next = this.#markdown.replace(doc, bodies);
      if (next === undefined)
        return [
          {
            code: "IF-6",
            where: "INTERFACES.md",
            message: "a <!-- generated:… --> / <!-- end:… --> marker pair is missing",
          },
        ];
      if (next !== doc) await this.#files.writeDocument(next);
      return [];
    }
    return this.#markdown.stale(doc, bodies).map((name) => ({
      code: "IF-6",
      where: "INTERFACES.md",
      message: `the "${name}" section is not what its source generates; run: workflow-graph interfaces --write`,
    }));
  }

  // IF-7 every API in catalog-info.yaml has its description file and is listed in INTERFACES.md.
  async #catalog(): Promise<CatalogFinding[]> {
    const entities = await this.#files.entities();
    if (!entities.ok)
      return [{ code: "IF-7", where: "catalog-info.yaml", message: entities.error }];
    const doc = (await this.#files.readDocument()) ?? "";
    const out: CatalogFinding[] = [];
    for (const e of entities.value.filter((x) => x.kind === "API")) {
      if (e.definition === undefined || !this.#files.exists(e.definition))
        out.push({
          code: "IF-7",
          where: "catalog-info.yaml",
          message: `API ${e.name}: definition ${e.definition ?? "(none)"} does not exist`,
        });
      if (!doc.includes(`\`${e.name}\``))
        out.push({
          code: "IF-7",
          where: "INTERFACES.md",
          message: `API ${e.name} from catalog-info.yaml is not listed`,
        });
    }
    return out;
  }

  // IF-8 every schema the description names exists, and every schema file is listed in INTERFACES.md.
  async #schemas(cli: CliDescription): Promise<CatalogFinding[]> {
    const doc = (await this.#files.readDocument()) ?? "";
    const out: CatalogFinding[] = [];
    for (const c of cli.commands())
      for (const s of c.outputSchemas)
        if (!this.#files.exists(`interfaces/${s}`))
          out.push({
            code: "IF-8",
            where: `${DESCRIPTION} (${c.path})`,
            message: `output schema ${s} does not exist`,
          });
    for (const s of await this.#files.schemaFiles())
      if (!doc.includes(s))
        out.push({
          code: "IF-8",
          where: "INTERFACES.md",
          message: `interfaces/${s} is not listed`,
        });
    return out;
  }
}
