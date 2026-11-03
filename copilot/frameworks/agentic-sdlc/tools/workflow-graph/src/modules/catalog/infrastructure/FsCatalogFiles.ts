import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseAllDocuments } from "yaml";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { CatalogEntity } from "#src/modules/catalog/domain/CatalogEntity.ts";
import type { CatalogFiles } from "#src/modules/catalog/domain/ports/CatalogFiles.ts";

const ENV_READ = /env\["([A-Z][A-Z0-9_]*)"\]/g;

/**
 * {@link CatalogFiles} on disk, under the tool folder (or `--root`). Reads `catalog-info.yaml` with the `yaml` package,
 * a development dependency: the `interfaces` command is a repository check, not something hooks run.
 */
export class FsCatalogFiles implements CatalogFiles {
  readonly #root: string;
  readonly #code: string;

  /**
   * Keeps the folders; nothing is read until a method is called.
   *
   * @param root - folder holding INTERFACES.md, catalog-info.yaml, interfaces/ and package.json
   * @param code - the composition root's source file, scanned for `env["NAME"]`
   */
  public constructor(root: string, code: string) {
    this.#root = root;
    this.#code = code;
  }

  /**
   * {@link CatalogFiles.readDocument}: reads `<root>/INTERFACES.md`.
   */
  public async readDocument(): Promise<string | undefined> {
    const file = join(this.#root, "INTERFACES.md");
    return existsSync(file) ? readFile(file, "utf8") : undefined;
  }

  /**
   * {@link CatalogFiles.writeDocument}: overwrites `<root>/INTERFACES.md`.
   */
  public async writeDocument(text: string): Promise<void> {
    await writeFile(join(this.#root, "INTERFACES.md"), text);
  }

  /**
   * {@link CatalogFiles.entities}: a YAML error is returned as text.
   */
  public async entities(): Promise<Result<CatalogEntity[], string>> {
    const file = join(this.#root, "catalog-info.yaml");
    if (!existsSync(file)) return err("missing");
    const docs = parseAllDocuments(await readFile(file, "utf8"));
    const out: CatalogEntity[] = [];
    for (const d of docs) {
      if (d.errors.length > 0) return err(d.errors[0]?.message ?? "not YAML");
      const e = d.toJS() as {
        kind?: string;
        metadata?: { name?: string };
        spec?: { definition?: { $text?: string } };
      };
      out.push({
        kind: String(e.kind ?? ""),
        name: String(e.metadata?.name ?? ""),
        definition: e.spec?.definition?.$text?.replace(/^\.\//, ""),
      });
    }
    return ok(out);
  }

  /**
   * {@link CatalogFiles.exists}: resolves against the root.
   */
  public exists(path: string): boolean {
    return existsSync(join(this.#root, path));
  }

  /**
   * {@link CatalogFiles.schemaFiles}: walks `<root>/interfaces/schemas/`.
   */
  public async schemaFiles(): Promise<string[]> {
    const base = join(this.#root, "interfaces");
    const folder = join(base, "schemas");
    if (!existsSync(folder)) return [];
    const entries = await readdir(folder, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => relative(base, join(e.parentPath, e.name)))
      .sort();
  }

  /**
   * {@link CatalogFiles.packageVersion}: reads `<root>/package.json`.
   */
  public async packageVersion(): Promise<string | undefined> {
    const file = join(this.#root, "package.json");
    if (!existsSync(file)) return undefined;
    const pkg = JSON.parse(await readFile(file, "utf8")) as { version?: string };
    return pkg.version;
  }

  /**
   * {@link CatalogFiles.environmentNamesInCode}: a text scan of the composition root for `env["NAME"]`.
   */
  public async environmentNamesInCode(): Promise<string[]> {
    const text = await readFile(this.#code, "utf8");
    return [...new Set([...text.matchAll(ENV_READ)].map((m) => String(m[1])))].sort();
  }
}
