// Each catalog rule (IF-2 … IF-8) proven to catch a planted fault, and the real catalog proven clean (spec 021 SC-003).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { OptionTable } from "#src/modules/shared/domain/OptionTable.ts";
import { ENVIRONMENT } from "#src/CompositionRoot.ts";
import type { CatalogEntity } from "#src/modules/catalog/domain/CatalogEntity.ts";
import { CliDescription } from "#src/modules/catalog/domain/CliDescription.ts";
import type { CatalogFiles } from "#src/modules/catalog/domain/ports/CatalogFiles.ts";
import { CatalogMarkdown } from "#src/modules/catalog/application/CatalogMarkdown.ts";
import { CheckInterfaces } from "#src/modules/catalog/application/check-interfaces/CheckInterfaces.ts";
import { UsageSpecFile } from "#src/modules/catalog/infrastructure/UsageSpecFile.ts";
import { AgentCliHandler } from "#src/modules/coding-agents/interface/cli/AgentCliHandler.ts";
import { RunCliHandler } from "#src/modules/runner/interface/cli/RunCliHandler.ts";
import { WorkflowCliHandler } from "#src/modules/workflow/interface/cli/WorkflowCliHandler.ts";
import { CatalogCliHandler } from "#src/modules/catalog/interface/cli/CatalogCliHandler.ts";

const spec = new UsageSpecFile(
  join(import.meta.dirname, "../../../../../interfaces/workflow-graph.usage.kdl"),
);
const realOptions = new Map<string, OptionTable>([
  ...WorkflowCliHandler.options,
  ...AgentCliHandler.options,
  ...RunCliHandler.options,
  ...CatalogCliHandler.options,
]);

/** An in-memory catalog that is correct for the real spec unless a test changes it. */
class MemoryCatalog implements CatalogFiles {
  public document = "";
  public entityList: CatalogEntity[] = [
    { kind: "API", name: "workflow-graph-cli", definition: "interfaces/workflow-graph.usage.kdl" },
  ];
  public files = new Set([
    "interfaces/workflow-graph.usage.kdl",
    "interfaces/schemas/hooks/guard-output.schema.json",
    "interfaces/schemas/hooks/approve-output.schema.json",
  ]);
  public schemas = ["schemas/hooks/guard-output.schema.json"];
  public version = "0.1.0";
  public envRead = ENVIRONMENT.map((v) => v.name).sort();

  public readDocument(): Promise<string | undefined> {
    return Promise.resolve(this.document);
  }
  public writeDocument(text: string): Promise<void> {
    this.document = text;
    return Promise.resolve();
  }
  public entities(): Promise<Result<CatalogEntity[], string>> {
    return Promise.resolve(ok(this.entityList));
  }
  public exists(path: string): boolean {
    return this.files.has(path);
  }
  public schemaFiles(): Promise<string[]> {
    return Promise.resolve(this.schemas);
  }
  public packageVersion(): Promise<string | undefined> {
    return Promise.resolve(this.version);
  }
  public environmentNamesInCode(): Promise<string[]> {
    return Promise.resolve(this.envRead);
  }
}

async function cleanCatalog(): Promise<MemoryCatalog> {
  const files = new MemoryCatalog();
  files.document = [
    "`workflow-graph-cli` schemas/hooks/guard-output.schema.json",
    "<!-- generated:commands -->",
    "<!-- end:commands -->",
    "<!-- generated:environment -->",
    "<!-- end:environment -->",
  ].join("\n");
  await check(files, realOptions).run(true);
  return files;
}

function check(files: CatalogFiles, options: ReadonlyMap<string, OptionTable>): CheckInterfaces {
  return new CheckInterfaces(spec, files, new CatalogMarkdown(), {
    options,
    environment: ENVIRONMENT,
  });
}

const codes = async (c: CheckInterfaces): Promise<string[]> =>
  (await c.run(false)).map((f) => `${f.code} ${f.message}`);

describe("CheckInterfaces", () => {
  it("finds nothing when the code, the spec and the catalog agree", async () => {
    expect(await codes(check(await cleanCatalog(), realOptions))).toEqual([]);
  });

  it("IF-2 a command in the code that the spec does not describe", async () => {
    const options = new Map([...realOptions, ["purge", {}]]);
    expect(await codes(check(await cleanCatalog(), options))).toEqual([
      'IF-2 command "purge" is in the code but not described',
    ]);
  });

  it("IF-3 a flag parsed by the code but not described", async () => {
    const options = new Map(realOptions);
    options.set("status", { project: { type: "string" }, json: { type: "boolean" } });
    expect(await codes(check(await cleanCatalog(), options))).toEqual([
      "IF-3 --json is parsed by the code but not described",
    ]);
  });

  it("IF-3 a flag that is repeatable in the description only", async () => {
    const options = new Map(realOptions);
    options.set("run start", { ...realOptions.get("run start"), check: { type: "string" } });
    expect(await codes(check(await cleanCatalog(), options))).toEqual([
      "IF-3 --check is not repeatable in the code but in the description",
    ]);
  });

  it("IF-4 a spec version that is not the package's", async () => {
    const files = await cleanCatalog();
    files.version = "0.2.0";
    expect(await codes(check(files, realOptions))).toEqual([
      "IF-4 version 0.1.0 is not package.json's 0.2.0",
    ]);
  });

  it("IF-5 an environment variable read but not declared", async () => {
    const files = await cleanCatalog();
    files.envRead = [...files.envRead, "WORKFLOW_GRAPH_SECRET"];
    expect(await codes(check(files, realOptions))).toEqual([
      "IF-5 WORKFLOW_GRAPH_SECRET is read but not in ENVIRONMENT",
    ]);
  });

  it("IF-6 a generated section edited by hand", async () => {
    const files = await cleanCatalog();
    files.document = files.document.replace("| `COPILOT_HOME` |", "| `COPILOT_DIR` |");
    expect(await codes(check(files, realOptions))).toEqual([
      'IF-6 the "environment" section is not what its source generates; run: workflow-graph interfaces --write',
    ]);
  });

  it("IF-7 an API whose description file does not exist", async () => {
    const files = await cleanCatalog();
    files.files.delete("interfaces/workflow-graph.usage.kdl");
    expect(await codes(check(files, realOptions))).toEqual([
      "IF-7 API workflow-graph-cli: definition interfaces/workflow-graph.usage.kdl does not exist",
    ]);
  });

  it("IF-8 a schema file nobody lists", async () => {
    const files = await cleanCatalog();
    files.schemas = [...files.schemas, "schemas/orphan.schema.json"];
    expect(await codes(check(files, realOptions))).toEqual([
      "IF-8 interfaces/schemas/orphan.schema.json is not listed",
    ]);
  });
});

describe("CliDescription", () => {
  it("refuses a command path declared twice", () => {
    const info = { bin: "t", version: "1.0.0", about: "a" };
    const c = {
      path: "x",
      help: "",
      effect: undefined,
      args: [],
      flags: [],
      subcommands: [],
      examples: [],
      exitCodes: [],
      outputSchemas: [],
    };
    expect(CliDescription.of(info, [], [c, c])).toEqual({
      ok: false,
      error: 'command "x" is declared twice',
    });
  });

  it("merges a command's exit codes over the program's by number", async () => {
    const cli = await spec.load();
    expect(cli.ok && cli.value.exitCodesFor("hook guard").map((e) => e.code)).toEqual([0, 1, 2]);
    expect(cli.ok && cli.value.exitCodesFor("hook guard")[0]?.meaning).toMatch(/^always/);
  });
});
