import type { Finding } from '#src/modules/workflow/domain/graph/Finding.ts';
import { WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';
import type { GraphFiles } from '#src/modules/workflow/domain/ports/GraphFiles.ts';
import { ConventionsDocument } from '#src/modules/workflow/application/conventions/ConventionsDocument.ts';
import type { ConventionsTablesPresenter } from '#src/modules/workflow/application/conventions/ConventionsTablesPresenter.ts';

/** The result of checking the graph files: the graph when it loaded, and every finding. */
export type GraphCheck = { readonly graph?: WorkflowGraph; readonly findings: readonly Finding[] };

/** Checks the YAML source against every graph rule, and that the JSON and the conventions tables were generated from it (WG-1 … WG-14). */
export class CheckGraph {
  readonly #files: GraphFiles;
  readonly #tables: ConventionsTablesPresenter;

  /**
   * @param files - the framework's graph files
   * @param tables - renders the conventions tables the document must contain
   */
  public constructor(files: GraphFiles, tables: ConventionsTablesPresenter) {
    this.#files = files;
    this.#tables = tables;
  }

  /** @returns the loaded graph and every finding; no findings means the files are sound and in step */
  public async run(): Promise<GraphCheck> {
    const source = await this.#files.readSource();
    if (!source.ok) return { findings: [{ code: 'WG-1', where: 'workflow.graph.yaml', message: `does not parse: ${source.error}` }] };
    const loaded = WorkflowGraph.load(source.value, 'workflow.graph.yaml');
    if (!loaded.ok) return { findings: loaded.error };
    const graph = loaded.value;
    const conventions = new ConventionsDocument(await this.#files.readConventions());
    const findings = [...graph.ownersOutside(conventions.roles(), 'workflow.graph.yaml'), ...(await this.#compiled(graph)), ...this.#tablesFindings(graph, conventions)];
    return { graph, findings };
  }

  async #compiled(graph: WorkflowGraph): Promise<Finding[]> {
    const text = await this.#files.readCompiled();
    if (text === undefined) return [{ code: 'WG-13', where: 'workflow.graph.json', message: 'missing; run compile-graph' }];
    return text === CheckGraph.compiledText(graph) ? [] : [{ code: 'WG-13', where: 'workflow.graph.json', message: 'out of date; run compile-graph' }];
  }

  #tablesFindings(graph: WorkflowGraph, conventions: ConventionsDocument): Finding[] {
    return [...this.#tables.render(graph)].flatMap(([name, body]) => {
      const current = conventions.block(name);
      if (current === undefined) return [{ code: 'WG-14', where: 'conventions.md', message: `has no generated block "${name}"` }];
      return current === body ? [] : [{ code: 'WG-14', where: 'conventions.md', message: `the generated block "${name}" is out of date; run compile-graph` }];
    });
  }

  /**
   * @param graph - a loaded graph
   * @returns the exact text of `workflow.graph.json` for it
   */
  public static compiledText(graph: WorkflowGraph): string {
    return `${JSON.stringify(graph.toData(), null, 2)}\n`;
  }
}
