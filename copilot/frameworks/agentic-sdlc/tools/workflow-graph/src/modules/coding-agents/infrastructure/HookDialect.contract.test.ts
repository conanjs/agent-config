// The shared adapter contract suite (specs/019 D17): the same cases run against every coding agent's dialect,
// with that agent's recorded launch payload, so each adapter is proven to stand in for the others.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HookDialect } from "#src/modules/coding-agents/domain/ports/HookDialect.ts";
import { ClaudeCodeHookDialect } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeHookDialect.ts";
import { CodexHookDialect } from "#src/modules/coding-agents/infrastructure/codex/CodexHookDialect.ts";
import { CopilotCliHookDialect } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliHookDialect.ts";

const payloads = join(
  import.meta.dirname,
  "../../../../../../../../../tests/workflow-graph/fixtures/payloads",
);

// Each agent: its dialect, its recorded launch, how it asks to write a file, and its documented output forms.
const agents: Array<{
  id: string;
  dialect: HookDialect;
  write: object;
  noDecision: string;
  deny: (reason: string) => string;
}> = [
  {
    id: "claude-code",
    dialect: new ClaudeCodeHookDialect(),
    write: {
      tool_name: "Write",
      cwd: "/p",
      tool_input: { file_path: "/p/.specify/runs/R-001.jsonl" },
    },
    noDecision: "",
    deny: (r) =>
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: r,
        },
      }),
  },
  {
    id: "copilot-cli",
    dialect: new CopilotCliHookDialect("/home/.copilot"),
    write: { toolName: "edit", cwd: "/p", toolArgs: { path: "/p/.specify/runs/R-001.jsonl" } },
    noDecision: "{}",
    deny: (r) => JSON.stringify({ permissionDecision: "deny", permissionDecisionReason: r }),
  },
  {
    id: "codex",
    dialect: new CodexHookDialect(),
    write: {
      tool_name: "apply_patch",
      cwd: "/p",
      tool_input: {
        command: "*** Begin Patch\n*** Update File: /p/.specify/runs/R-001.jsonl\n*** End Patch",
      },
    },
    noDecision: "",
    deny: (r) =>
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: r,
        },
      }),
  },
];

describe.each(agents)("$id hook dialect", ({ id, dialect, write, noDecision, deny }) => {
  const launch = readFileSync(join(payloads, id, "launch.json"), "utf8");

  it("reads the recorded subagent launch with its exact prompt", () => {
    const call = dialect.readToolCall(launch);
    expect(call).toEqual({
      ok: true,
      value: { kind: "subagent-launch", prompt: "say hi", cwd: "/Users/example/project" },
    });
  });

  it("leaves a tool that is neither a launch nor a write alone", () => {
    const shell = JSON.stringify({
      tool_name: "Bash",
      toolName: "bash",
      cwd: "/p",
      tool_input: { command: "ls" },
      toolArgs: { command: "ls" },
    });
    expect(dialect.readToolCall(shell)).toEqual({ ok: true, value: { kind: "other-tool" } });
  });

  it("sees a write to a ledger file", () => {
    const call = dialect.readToolCall(JSON.stringify(write));
    expect(call.ok && call.value.kind === "file-write" && call.value.paths).toContain(
      "/p/.specify/runs/R-001.jsonl",
    );
  });

  it("reports input that is not JSON instead of throwing", () => {
    expect(dialect.readToolCall("not json")).toEqual({
      ok: false,
      error: "hook input is not JSON",
    });
  });

  it("writes a deny in the agent’s documented form", () => {
    expect(dialect.renderDecision({ kind: "deny", reason: "G2 not approved" })).toBe(
      deny("G2 not approved"),
    );
  });

  it('writes the agent’s documented "no decision"', () => {
    expect(dialect.renderDecision({ kind: "no-decision" })).toBe(noDecision);
  });

  it("reads a submitted prompt with its text and session", () => {
    const raw = JSON.stringify({
      prompt: "approve G2 R-001",
      session_id: "s1",
      sessionId: "s1",
      cwd: "/p",
    });
    const read = dialect.readSubmittedPrompt(raw);
    expect(read.ok && { text: read.value.text, session: read.value.session }).toEqual({
      text: "approve G2 R-001",
      session: "s1",
    });
  });
});
