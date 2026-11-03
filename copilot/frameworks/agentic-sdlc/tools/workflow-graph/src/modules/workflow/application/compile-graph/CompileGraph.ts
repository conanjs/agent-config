import type { Finding } from "#src/modules/workflow/domain/graph/Finding.ts";
import type { GraphFiles } from "#src/modules/workflow/domain/ports/GraphFiles.ts";
import { CheckGraph } from "#src/modules/workflow/application/check-graph/CheckGraph.ts";
import { ConventionsDocument } from "#src/modules/workflow/application/conventions/ConventionsDocument.ts";
import type { ConventionsTablesPresenter } from "#src/modules/workflow/application/conventions/ConventionsTablesPresenter.ts";

/** Writes `workflow.graph.json` and the generated conventions tables from the YAML source; writes nothing when the source breaks a rule. */
export class CompileGraph {
  readonly #files: GraphFiles;
  readonly #tables: ConventionsTablesPresenter;
  readonly #check: CheckGraph;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param files - the framework's graph files
   * @param tables - renders the conventions tables
   * @param check - the graph check run before writing
   */
  public constructor(files: GraphFiles, tables: ConventionsTablesPresenter, check: CheckGraph) {
    this.#files = files;
    this.#tables = tables;
    this.#check = check;
  }

  /**
   * Returns the findings that stopped the write; empty when both files were written.
   *
   * @returns the findings that stopped the write; empty when both files were written
   */
  public async run(): Promise<readonly Finding[]> {
    const checked = await this.#check.run();
    const blocking = checked.findings.filter(
      (f) => f.code !== "WG-13" && !(f.code === "WG-14" && f.message.includes("out of date")),
    );
    if (checked.graph === undefined || blocking.length > 0) return blocking;
    let conventions = new ConventionsDocument(await this.#files.readConventions());
    for (const [name, body] of this.#tables.render(checked.graph))
      conventions = conventions.withBlock(name, body);
    await this.#files.writeCompiled(CheckGraph.compiledText(checked.graph));
    await this.#files.writeConventions(conventions.toString());
    return [];
  }
}
