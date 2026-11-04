// Tier B (PDM-class-modeled-R9): the interface catalog's composition root, imported only by `help`, `--help` and
// `interfaces`, so hooks never load the KDL parser or the yaml package.
import { join } from "node:path";
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { OptionTable } from "#src/modules/shared/domain/OptionTable.ts";
import type { EnvironmentVariable } from "#src/modules/catalog/domain/EnvironmentVariable.ts";
import { CatalogMarkdown } from "#src/modules/catalog/application/CatalogMarkdown.ts";
import { CheckInterfaces } from "#src/modules/catalog/application/check-interfaces/CheckInterfaces.ts";
import { FsCatalogFiles } from "#src/modules/catalog/infrastructure/FsCatalogFiles.ts";
import { UsageSpecFile } from "#src/modules/catalog/infrastructure/UsageSpecFile.ts";
import { CatalogCliHandler } from "#src/modules/catalog/interface/cli/CatalogCliHandler.ts";
import { HelpPresenter } from "#src/modules/catalog/interface/cli/HelpPresenter.ts";

/** What the main composition root hands the catalog. */
export type CatalogParts = {
  /** Every runnable command path and the flags its handler parses. */
  readonly options: ReadonlyMap<string, OptionTable>;
  /** The environment variables the program declares. */
  readonly environment: readonly EnvironmentVariable[];
  /** The tool folder: INTERFACES.md, catalog-info.yaml, interfaces/, package.json. */
  readonly toolRoot: string;
  /** The composition root's source file, scanned for the variables it reads. */
  readonly code: string;
};

const DESCRIPTION = join("interfaces", "workflow-graph.usage.kdl");

/**
 * Builds the catalog handler and runs `help` or `interfaces`.
 *
 * @param parts - option tables, environment list and folders from the main composition root
 * @param command - `help` or `interfaces`
 * @param args - the arguments after the command
 * @returns what to print and the exit code
 */
export async function runCatalog(
  parts: CatalogParts,
  command: "help" | "interfaces",
  args: readonly string[],
): Promise<CommandOutput> {
  const options = new Map([...parts.options, ...CatalogCliHandler.options]);
  const markdown = new CatalogMarkdown();
  const handler = new CatalogCliHandler(
    new UsageSpecFile(join(parts.toolRoot, DESCRIPTION)),
    new HelpPresenter(),
    (root) =>
      new CheckInterfaces(
        new UsageSpecFile(join(root, DESCRIPTION)),
        new FsCatalogFiles(root, parts.code),
        markdown,
        { options, environment: parts.environment },
      ),
    parts.toolRoot,
  );
  return command === "help" ? handler.help(args) : handler.interfaces(args);
}
