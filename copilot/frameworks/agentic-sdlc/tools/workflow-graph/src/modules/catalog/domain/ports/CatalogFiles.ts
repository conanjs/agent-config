import type { Result } from "#src/modules/shared/domain/Result.ts";
import type { CatalogEntity } from "#src/modules/catalog/domain/CatalogEntity.ts";

/** The files an interface catalog is made of, under one root folder: `INTERFACES.md`, `catalog-info.yaml`, `interfaces/`. */
export interface CatalogFiles {
  /**
   * Returns the text of `INTERFACES.md`.
   *
   * @returns its text, or undefined when the root has no such file
   */
  readDocument(): Promise<string | undefined>;

  /**
   * Replaces `INTERFACES.md` with new text.
   *
   * @param text - the whole document
   */
  writeDocument(text: string): Promise<void>;

  /**
   * Returns the entities of `catalog-info.yaml`, one per YAML document.
   *
   * @returns the entities, or why the file cannot be read
   */
  entities(): Promise<Result<CatalogEntity[], string>>;

  /**
   * Tells whether a file exists, relative to the root.
   *
   * @param relative - e.g. `interfaces/schemas/ledger-line.schema.json`
   * @returns true when it exists
   */
  exists(relative: string): boolean;

  /**
   * Returns every file under `interfaces/schemas/`, relative to `interfaces/`, e.g. `schemas/hooks/codex.schema.json`.
   *
   * @returns the schema files, sorted
   */
  schemaFiles(): Promise<string[]>;

  /**
   * Returns the version in the root's `package.json`.
   *
   * @returns the version string, or undefined when there is none
   */
  packageVersion(): Promise<string | undefined>;

  /**
   * Returns every environment variable name the composition root reads (`env["NAME"]`).
   *
   * @returns the names, sorted, without repeats
   */
  environmentNamesInCode(): Promise<string[]>;
}
