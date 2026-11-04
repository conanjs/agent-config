// The interface catalog's JSON Schemas against what the code really reads and writes (spec 021 FR-007): a field the
// code adds without its schema, or a schema that no longer accepts real data, fails here.
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compose, readConfig } from "#src/CompositionRoot.ts";
import type { HookDialect } from "#src/modules/coding-agents/domain/ports/HookDialect.ts";
import { ClaudeCodeHookDialect } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeHookDialect.ts";
import { CodexHookDialect } from "#src/modules/coding-agents/infrastructure/codex/CodexHookDialect.ts";
import { CopilotCliHookDialect } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliHookDialect.ts";
import type { RunSettingsData } from "#src/modules/runner/domain/RunSettings.ts";
import { FileRunSettingsStore } from "#src/modules/runner/infrastructure/FileRunSettingsStore.ts";
import { JsonlLaunchJournal } from "#src/modules/runner/infrastructure/JsonlLaunchJournal.ts";
import { RunFolderLayout } from "#src/modules/shared/infrastructure/RunFolderLayout.ts";

const tool = join(import.meta.dirname, "../../../..");
const schemas = join(tool, "interfaces/schemas");
const framework = join(tool, "../..");
const payloads = join(tool, "../../../../../tests/workflow-graph/fixtures/payloads");
const BASE =
  "https://github.com/conanjs/agent-config/blob/main/copilot/frameworks/agentic-sdlc/tools/workflow-graph/interfaces/schemas/";

const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
for (const f of readdirSync(schemas, { recursive: true }) as string[])
  if (f.endsWith(".json"))
    ajv.addSchema(JSON.parse(readFileSync(join(schemas, f), "utf8")) as Record<string, unknown>);

function valid(id: string, data: unknown): string {
  const check = ajv.getSchema(BASE + id);
  if (check === undefined) return `no schema ${id}`;
  return check(data) ? "valid" : JSON.stringify(check.errors);
}

const lines = (file: string): unknown[] =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as unknown);

describe("file schemas", () => {
  it("accepts the real workflow graph, YAML and generated JSON", () => {
    const yaml: unknown = YAML.parse(readFileSync(join(framework, "workflow.graph.yaml"), "utf8"));
    const json: unknown = JSON.parse(readFileSync(join(framework, "workflow.graph.json"), "utf8"));
    expect(valid("workflow-graph.schema.json", yaml)).toBe("valid");
    expect(valid("workflow-graph.schema.json", json)).toBe("valid");
  });

  it("accepts every ledger line record and the approval hook write", async () => {
    const project = mkdtempSync(join(tmpdir(), "wg-ledger-"));
    const env = {
      WORKFLOW_GRAPH_NOW: "2026-11-03T09:00:00.000Z",
      WORKFLOW_GRAPH_FRAMEWORK: framework,
    };
    const handlers = compose(readConfig(env, project));
    const run = async (command: string, args: string[], stdin = ""): Promise<number> =>
      (await handlers.get(command)!(args, () => Promise.resolve(stdin))).code;
    expect(
      await run("record", [
        "R-001",
        "--node",
        "P0",
        "--result",
        "new-feature",
        "--feature",
        "specs/023-cart",
        "--evidence",
        "a.md,b.md",
        "--role",
        "sdlc-orchestrator",
      ]),
    ).toBe(0);
    expect(await run("record", ["R-001", "--node", "P1", "--result", "done"])).toBe(0);
    const prompt = {
      prompt: "approve G0 R-001",
      session_id: "s1",
      cwd: project,
      transcript_path: "/t.jsonl",
    };
    expect(await run("hook", ["approve", "--agent", "claude-code"], JSON.stringify(prompt))).toBe(
      0,
    );
    const written = lines(new RunFolderLayout().ledger(project, "R-001"));
    expect(written).toHaveLength(3);
    for (const line of written) expect(valid("ledger-line.schema.json", line)).toBe("valid");
  });

  it("accepts the run settings and launch journal the runner writes", async () => {
    const project = mkdtempSync(join(tmpdir(), "wg-runner-"));
    const layout = new RunFolderLayout();
    const data: RunSettingsData = {
      run: "R-002",
      path: "new-feature",
      feature: "specs/023-cart",
      agent: "claude-code",
      overrides: { qa: "copilot-cli" },
      checks: ["pnpm test"],
      maxUsdPerLaunch: 2,
      timeoutMinutes: 30,
      mission: "Add a cart",
    };
    await new FileRunSettingsStore(layout).write(project, data);
    const journal = new JsonlLaunchJournal(layout);
    await journal.started(project, "R-002", "P1@1#0:product-spec:propose");
    await journal.finished(project, "R-002", "P1@1#0:product-spec:propose", "done");
    const settings: unknown = JSON.parse(readFileSync(layout.settings(project, "R-002"), "utf8"));
    expect(valid("run-settings.schema.json", settings)).toBe("valid");
    for (const line of lines(layout.launches(project, "R-002")))
      expect(valid("launch-journal-line.schema.json", line)).toBe("valid");
  });
});

const agents: Array<{ id: string; dialect: HookDialect }> = [
  { id: "claude-code", dialect: new ClaudeCodeHookDialect() },
  { id: "copilot-cli", dialect: new CopilotCliHookDialect("/home/.copilot") },
  { id: "codex", dialect: new CodexHookDialect() },
];

describe.each(agents)("$id hook schemas", ({ id, dialect }) => {
  it("accepts the recorded launch payload as guard input", () => {
    const launch: unknown = JSON.parse(readFileSync(join(payloads, id, "launch.json"), "utf8"));
    expect(valid(`hooks/${id}.schema.json#/$defs/guardInput`, launch)).toBe("valid");
  });

  it("accepts every reply the dialect prints", () => {
    const printed = [
      dialect.renderDecision({ kind: "deny", reason: "G2 not approved" }),
      dialect.renderDecision({ kind: "no-decision" }),
    ].filter((s) => s !== "");
    for (const reply of printed)
      expect(valid("hooks/guard-output.schema.json", JSON.parse(reply))).toBe("valid");
    const ack = dialect.renderPromptAcknowledgement();
    if (ack !== "")
      expect(valid("hooks/approve-output.schema.json", JSON.parse(ack))).toBe("valid");
  });
});
