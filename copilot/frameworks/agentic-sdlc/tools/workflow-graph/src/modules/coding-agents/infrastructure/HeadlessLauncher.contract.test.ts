// Every headless launcher gives write access only in execute mode, and never a bypass or allow-all mode (specs/020 US4).
import { describe, expect, it } from "vitest";
import type {
  HeadlessLaunch,
  HeadlessLauncher,
} from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import { ClaudeCodeHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeHeadlessLauncher.ts";
import { CodexHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/codex/CodexHeadlessLauncher.ts";
import { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";
import { CopilotCliHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliHeadlessLauncher.ts";

const runner = new CommandRunner();
const base: HeadlessLaunch = {
  prompt: "run: R-001",
  role: "engineering",
  mode: "execute",
  cwd: "/w",
  maxUsd: 2,
  timeoutMs: 1000,
};
const launchers: Array<{ id: string; launcher: HeadlessLauncher; writes: string[] }> = [
  {
    id: "claude-code",
    launcher: new ClaudeCodeHeadlessLauncher(runner, "claude"),
    writes: ["acceptEdits", "Read Write Edit Glob Grep Bash"],
  },
  {
    id: "copilot-cli",
    launcher: new CopilotCliHeadlessLauncher(runner, "copilot"),
    writes: ["--allow-tool=write", "--allow-tool=shell"],
  },
  {
    id: "codex",
    launcher: new CodexHeadlessLauncher(runner, "codex", "/home/.copilot"),
    writes: ["workspace-write"],
  },
];
const forbidden = /bypass|dangerously|--allow-all|yolo/i;

describe.each(launchers)("$id headless launcher", ({ launcher, writes }) => {
  it("may write in execute mode", () => {
    const args = launcher.commandFor(base);
    for (const w of writes) expect(args).toContain(w);
  });

  it.each(["propose", "decide", "review"])("may not write in %s mode", (mode) => {
    const args = launcher.commandFor({ ...base, mode });
    for (const w of writes) expect(args).not.toContain(w);
  });

  it("never uses a bypass or allow-all mode", () => {
    for (const mode of ["execute", "review"])
      expect(launcher.commandFor({ ...base, mode }).join(" ")).not.toMatch(forbidden);
  });
});
