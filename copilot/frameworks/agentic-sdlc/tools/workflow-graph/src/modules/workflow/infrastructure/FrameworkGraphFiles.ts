import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { Finding } from '#src/modules/workflow/domain/graph/Finding.ts';
import { WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';
import type { GraphFiles } from '#src/modules/workflow/domain/ports/GraphFiles.ts';
import type { GraphSource } from '#src/modules/workflow/domain/ports/GraphSource.ts';

/** The graph files in the agentic-sdlc framework folder. The YAML parser loads only when the source is read, so hooks never need it. */
export class FrameworkGraphFiles implements GraphFiles, GraphSource {
  readonly #folder: string;

  /** @param folder - the framework folder holding workflow.graph.yaml, workflow.graph.json and conventions.md */
  public constructor(folder: string) {
    this.#folder = folder;
  }

  /** Parses workflow.graph.yaml with the `yaml` package (YAML 1.2, so `on:` stays a string key). @returns the document or the parse error */
  public async readSource(): Promise<Result<unknown, string>> {
    const { parse } = await import('yaml');
    try {
      return ok(parse(await readFile(this.#path('workflow.graph.yaml'), 'utf8')) as unknown);
    } catch (e) {
      return err(e instanceof Error ? e.message.split('\n')[0] ?? e.message : String(e));
    }
  }

  /** Reads workflow.graph.json as text. @returns its text, or undefined when it does not exist */
  public async readCompiled(): Promise<string | undefined> {
    const file = this.#path('workflow.graph.json');
    return existsSync(file) ? readFile(file, 'utf8') : undefined;
  }

  /** Reads conventions.md. @returns its text */
  public async readConventions(): Promise<string> {
    return readFile(this.#path('conventions.md'), 'utf8');
  }

  /** Overwrites workflow.graph.json. @param text - the new content */
  public async writeCompiled(text: string): Promise<void> {
    await writeFile(this.#path('workflow.graph.json'), text);
  }

  /** Overwrites conventions.md. @param text - the new content */
  public async writeConventions(text: string): Promise<void> {
    await writeFile(this.#path('conventions.md'), text);
  }

  /** Loads and validates workflow.graph.json for the run commands and hooks. @returns the graph, or why it cannot be used */
  public async loadGraph(): Promise<Result<WorkflowGraph, readonly Finding[]>> {
    const text = await this.readCompiled();
    if (text === undefined) return err([{ code: 'WG-13', where: 'workflow.graph.json', message: `missing in ${this.#folder}` }]);
    try {
      return WorkflowGraph.load(JSON.parse(text) as unknown, 'workflow.graph.json');
    } catch {
      return err([{ code: 'WG-1', where: 'workflow.graph.json', message: 'is not JSON' }]);
    }
  }

  #path(name: string): string {
    return join(this.#folder, name);
  }
}
