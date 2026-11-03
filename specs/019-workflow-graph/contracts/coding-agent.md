# Contract: the coding-agent port

> As built (2026-11-03): `src/modules/coding-agents/domain/ports/HookDialect.ts` and `SessionLog.ts` are the source; errors are plain `string` results, a launch carries `prompt` and `cwd`, and a write lists every path it touches (`file-write`). The sketch below kept its original names where they differ.

What the `workflow` module needs from "a coding agent", and what each adapter must do to plug in. The interfaces are owned by the consumer (Dependency Inversion, Interface Segregation): each port has only the operations a use case calls. Erasable TypeScript only (plan D15): no parameter properties, no `enum`.

## Ports (in `coding-agents/domain/ports/`)

```ts
import type { Result } from '../../../shared/domain/Result.ts';

/** What a pre-tool-use hook was asked about, in neutral terms. */
export type ToolCallRequest =
  | { readonly kind: 'subagent-launch'; readonly launchPrompt: string; readonly sessionId: string }
  | { readonly kind: 'file-write'; readonly paths: readonly string[]; readonly cwd: string }
  | { readonly kind: 'other-tool' };

/** The guard's answer, in neutral terms. */
export type GuardDecision =
  | { readonly kind: 'no-decision' }
  | { readonly kind: 'deny'; readonly reason: string };

export type HookInputError = { readonly code: 'unreadable-hook-input'; readonly detail: string };

/** Translates one agent's hook JSON to and from the neutral shapes. */
export interface HookDialect {
  readToolCall(raw: string): Result<ToolCallRequest, HookInputError>;
  readSubmittedPrompt(raw: string): Result<SubmittedPrompt, HookInputError>;
  renderDecision(decision: GuardDecision): string;      // exact stdout for this agent
  renderPromptAcknowledgement(): string;                // '' or '{}'
}

export type SubmittedPrompt = { readonly text: string; readonly sessionId: string; readonly sessionLogPath: string | null };

/** Finds what the human really typed in one session (approval evidence). */
export interface SessionLog {
  containsUserMessage(sessionId: string, exactText: string): Promise<boolean>;
}

/** Phase 2 only: starts the agent headless with a launch prompt. */
export interface HeadlessLauncher {
  launch(prompt: LaunchPromptText, policy: WorkerPolicy, signal: AbortSignal): Promise<Result<RoleReply, LaunchFailure>>;
}
```

## Value objects (in `coding-agents/domain/`)

```ts
export class AgentId {
  static readonly #known = new Set(['claude-code', 'copilot-cli', 'codex']);
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(text: string): Result<AgentId, { code: 'unknown-agent'; text: string }> {
    return AgentId.#known.has(text) ? { ok: true, value: new AgentId(text) } : { ok: false, error: { code: 'unknown-agent', text } };
  }
  toString(): string { return this.#value; }
}
```

`AgentCapabilities` is an immutable value object; code asks it questions instead of comparing agent names:

| Capability | Claude Code | Copilot CLI | Codex | Evidence |
|---|---|---|---|---|
| `canDenySubagentLaunch` | yes | yes | yes, with matcher `*` and the `task_name` convention (the spawn arrives as `collaborationspawn_agent` with an encrypted message) | tested · tested · tested |
| `subagentToolName` | `Agent` | `task` | `spawn_agent` (matched as `Agent`) | tested · tested · docs |
| `promptHookSeesText` | yes (`prompt`) | yes (`prompt`) | yes (`prompt`) | docs · docs · tested |
| `promptHookCanReply` | yes | no (config-file hook output dropped) | unverified | docs · docs · — |
| `repositoryHooksNeedTrustedFolder` | no | **yes** | unverified | — · tested · — |
| `hooksNeedUserTrust` | no | no | **yes** (`/hooks`) | — · — · docs |
| `supportsNamedAgentHeadless` | yes (`-p --agent`) | yes (`-p --agent`) | no | tested · tested · help output |

An unverified capability is `unknown`, and a use case that needs it refuses with an explicit message instead of assuming.

## The registry (in `coding-agents/application/`)

```ts
export class CodingAgentRegistry {
  readonly #entries: ReadonlyMap<string, CodingAgentAdapters>;
  constructor(entries: ReadonlyMap<string, CodingAgentAdapters>) { this.#entries = entries; }
  resolve(id: AgentId): Result<CodingAgentAdapters, { code: 'not-registered'; id: string }> { /* map lookup */ }
}
export type CodingAgentAdapters = {
  readonly capabilities: AgentCapabilities;
  readonly hookDialect: HookDialect;
  readonly sessionLog: SessionLog;
};
```

Only `CompositionRoot.ts` builds the registry's entries (`new ClaudeCodeHookDialect()`, …): PDM-class-modeled-R9.

## What every adapter must pass (the shared contract suite, D17)

Run once per registered agent with that agent's recorded payloads in `tests/workflow-graph/fixtures/<agent>/`:

| Case | Input fixture | Must hold |
|---|---|---|
| Reads a launch | the agent's real subagent-launch payload | `readToolCall` → `subagent-launch` with the exact prompt text |
| Ignores other tools | a real non-launch tool payload | → `other-tool` |
| Sees a ledger edit | an edit/write payload on `.specify/runs/R-001.jsonl` | → `ledger-edit` with that path |
| Bad input | `not json` | → `unreadable-hook-input` (the guard turns it into a deny: fail closed) |
| Denies | `deny("G2 not approved in run R-001")` | output equals the agent's documented deny JSON, byte for byte against the fixture |
| No decision | `no-decision` | output is the agent's documented "no decision" (`''` or `{}`) |
| Reads a prompt | the agent's real prompt-submit payload | `text` equals what was typed |
