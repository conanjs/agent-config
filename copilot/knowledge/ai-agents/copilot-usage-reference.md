---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: draft
applies-to: ["GitHub Copilot CLI 1.0.105", "Copilot agent in VS Code (Copilot SDK runtime 1.0.100)", "docs read 2026-11-02"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [github-copilot, copilot-cli, vscode, tokens, ai-credits, hooks, instructions]
---

# GitHub Copilot usage, AI credits and hooks

## Summary
**TL;DR:** The Copilot CLI and the Copilot agent in VS Code share one agent runtime: both log every model call to `~/.copilot/session-state/<session id>/events.jsonl` with its tokens and its exact cost in AI credits (1 AI credit = $0.01), and both read hooks from `~/.copilot/hooks/*.json`. The end-of-turn hook (`agentStop`) gets the log's path but cannot show a message field; progress lines it prints appear in the CLI. VS Code's Copilot kept using the copy of the user instructions it read when VS Code started.
**Use this when:** measuring or reporting Copilot token use and credits, writing a Copilot hook, or finding out why Copilot ignores a newly added instruction.
**Not this doc:** the same for Claude Code and Codex → `claude-code-usage-reference.md`, `codex-usage-reference.md`; counting rules → `agent-token-accounting.md`; the older SQLite-based notes → `../github-copilot/copilot-cli-internals.md` (legacy).

## Scope
GitHub Copilot's local usage records, its AI-credit billing, its hooks and how VS Code loads user instructions: from the docs read on 2026-11-02 and from this machine's logs (Copilot CLI 1.0.105; a VS Code session whose system message reads "You are an AI assistant using Copilot SDK in VS Code", runtime 1.0.100).

## Catalog

### Where usage is recorded

| Place | What it holds | Status |
|---|---|---|
| `~/.copilot/session-state/<session id>/events.jsonl` | One line per event, for CLI and VS Code sessions alike; `COPILOT_HOME` moves `~/.copilot` | ✅[^5][^1] |
| `session.usage_record` event | One per model call: `data.usage` with the tokens, the model and `copilotUsage` (cost) | ✅[^5] |
| `session.usage_checkpoint` event | Copilot's own running totals: `totalNanoAiu`, `totalPremiumRequests`, tokens per model; the per-call `totalNanoAiu` values add up to it exactly | ✅[^5] |
| `model.model_call_success` event | `quotaSnapshots`: `premium_interactions` with `entitlementRequests`, `usedRequests`, `remainingPercentage`, `resetDate` (the monthly allowance); not present in every session (none in a `copilot -p` run) | ✅[^5] |
| `user.message`, `assistant.message` (`toolRequests`), `tool.execution_start` (`toolName`) | Turn boundaries, whether the model asked for tools, and the tools run | ✅[^5] |

### Usage fields of one call (`data.usage`)

| Field | Meaning | Status |
|---|---|---|
| `inputTokens` | All input of the request, cache reads and writes included: the context size | ✅[^5] |
| `cacheReadTokens`, `cacheWriteTokens` | The parts of `inputTokens` read from and written to the cache; the rest is new input | ✅[^5] |
| `outputTokens`, `reasoningTokens` | Output, and its reasoning part | ✅[^5] |
| `maxPromptTokens` | The prompt limit of the model in this session (968,000 for Claude Opus 5.5 in VS Code; 200,000 in the CLI run) | ✅[^5] |
| `copilotUsage.totalNanoAiu` | The call's cost in billionths of an AI credit; `tokenDetails` gives the rate per token type (`costPerBatch` per 1,000,000 tokens) | ✅[^5] |

### Billing

| Item | Fact | Status |
|---|---|---|
| AI credit | 1 AI credit = $0.01; plans include a monthly allowance, extra usage is billed per credit | ✅[^4] |
| From the log | AI credits = `totalNanoAiu` ÷ 10⁹. For Claude Opus 5.5 the rates in the log are its list prices in cents (input 400, cache read 20, cache write 500, output 2,000 credits per million tokens) | ✅[^5] |

### Hooks

| Item | Fact | Status |
|---|---|---|
| Shared runtime | VS Code, the GitHub Copilot app and the Copilot CLI share the hook format | ✅[^2] |
| VS Code status | Hooks are in Preview in VS Code. The Copilot harness reads the same user files (`~/.copilot/hooks/`, or `$COPILOT_HOME/hooks/`); the setting `chat.useHooks` controls only the older Local harness, not the shared Copilot runtime. A `preToolUse` deny is `{"permissionDecision":"deny","permissionDecisionReason":"…"}` and `{}` means no decision, as in the CLI (read 2026-11-04) | ✅[^2] |
| Sub-agent tool name in VS Code | The VS Code page does not name the tool a `preToolUse` hook sees when the agent launches a sub-agent (the CLI's is `task`, ✅[^6]); whether VS Code's Copilot harness also sends `task` is not tested | ⚠️ unverified |
| Locations | `~/.copilot/hooks/*.json` (user), `.github/hooks/*.json` (repository), a `hooks` block in `~/.copilot/settings.json` or `.github/copilot/settings.json`, plugins | ✅[^1] |
| Format | `{"version": 1, "hooks": {"<event>": [{"type": "command", "bash": …, "powershell": …, "timeoutSec": …}]}}` | ✅[^1] |
| `agentStop` input | camelCase: `sessionId`, `timestamp`, `cwd`, `transcriptPath`, `stopReason`, `stop_hook_active`; the VS Code-style name `Stop` gives the same in snake_case | ✅[^1] |
| `agentStop` output | Only `decision` / `reason` (to make the agent go on); no message field for the user | ✅[^1] |
| Progress lines | A hook may print `{"type": "progress", "message": "…"}` lines; the CLI shows each one in its output (seen as "● …" lines) | ✅[^1][^5] |
| `preToolUse` | camelCase input `toolName`, `toolArgs`; denies with `{"permissionDecision": "deny", "permissionDecisionReason": …}` (the reason is required); the PascalCase `PreToolUse` form uses `tool_name`, `tool_input` | ✅[^1] |
| Subagent launch | The tool is `task` ("Run subagent tasks"), matched as `Agent` in the PascalCase form; `subagentStart` can only add context, `subagentStop` can block; the built-in `general-purpose` agent emits neither | ✅[^1] |
| `task` arguments seen by `preToolUse` | `toolArgs`: `name`, `prompt`, `agent_type`, `description`, `mode` (`sync`) | ✅[^6] |
| A denied `task` call | The CLI prints "Denied by preToolUse hook: <reason>" and the agent receives the reason | ✅[^6] |
| Repository hooks and folder trust | `.github/hooks/*.json` did **not** run in a folder outside the trusted folders (`trustedFolders` in `~/.copilot/config.json`); the same file ran in a trusted folder. User hooks in `~/.copilot/hooks/` ran in both | ✅[^6] |
| `userPromptSubmitted` | Input `sessionId`, `timestamp`, `cwd`, `prompt`; a config-file hook's output is dropped (only SDK hooks may return `modifiedPrompt`) | ✅[^1] |
| `copilot -p --agent <name>` | Runs the prompt as that custom agent (tested with `sdlc-qa`) | ✅[^6] |
| `userPromptSubmitted` in `copilot -p` | A user-level hook (`~/.copilot/hooks/*.json`) received the prompt of a non-interactive run, with `sessionId` and `cwd`; a user-level `preToolUse` hook denied `task` and then allowed it (agentic-sdlc workflow guard, live test) | ✅[^6] |
| Progress lines in VS Code | Not documented and not yet seen | ⚠️ unverified |
| Order at the end of a turn | The last `session.usage_record`, then the final `assistant.message` (no `toolRequests`), then `assistant.turn_end`, then the `agentStop` hook | ✅[^5] |

### User instructions in VS Code

| Item | Fact | Status |
|---|---|---|
| Location | Copilot user instructions live in `~/.copilot/instructions`; VS Code also reads the folders in `chat.instructionsFilesLocations` | ✅[^3] |
| `applyTo` | A file is attached automatically when its `applyTo` pattern matches a file the agent creates or modifies; a `description` lets the agent load it on demand | ✅[^3] |
| A stale copy | A VS Code session on 2026-11-02 had the version of `personal-defaults.instructions.md` from before 29 Oct 15:18 (no "Pin Before You Change", no tracker rule), although the file had changed three times since; VS Code had been running since 29 Oct 08:58 | ✅[^5] |
| Why | VS Code keeps the copy it read when it started; a reload or restart makes it read the file again | ⚠️ unverified |

## Lookup notes
- Copilot's `inputTokens` already contains the cache reads and writes, as Codex's `input_tokens` does; Claude Code's `input_tokens` does not (`agent-token-accounting.md`).
- To report Copilot usage after every turn, use the turn token report: `copilot/hooks/turn-tokens/turn-tokens.schema.md` in agent-config (TT-13 … TT-16).
- After changing a file in `~/.copilot/instructions` or `~/.copilot/hooks`, reload VS Code (Developer: Reload Window) before trusting that its Copilot uses the change.

## Takeaways
- Copilot's log carries its own exact cost per call: sum `copilotUsage.totalNanoAiu`, do not price tokens yourself.
- A Copilot end-of-turn hook can only talk to the user through progress lines.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 32 claims (✅) · Unverified: 3 claims (⚠️) · Last verified: 2026-11-04

## References
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) — GitHub, living. Backs: hook locations, format, `agentStop` input and output, progress lines, `preToolUse` deny, the `task` subagent tool and subagent events. [^1]
- [Hooks (VS Code)](https://code.visualstudio.com/docs/copilot/customization/hooks) — Microsoft, living. Backs: one hook format across VS Code, the Copilot app and the CLI. [^2]
- [Custom instructions (VS Code)](https://code.visualstudio.com/docs/copilot/customization/custom-instructions) — Microsoft, living. Backs: `~/.copilot/instructions`, `applyTo`, `description`. [^3]
- [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals) — GitHub, living. Backs: 1 AI credit = $0.01, monthly allowances. [^4]
- `~/.copilot/session-state/*/events.jsonl`, `copilot -p` with Copilot CLI 1.0.105, and the VS Code process start time — local test, 2026-11-02: event types and fields, per-call credits summing exactly to the checkpoint (182.21 AI credits), the quota snapshot, the CLI showing progress lines and a 9.22-credit turn that matches its own footer, and the stale instruction copy in a VS Code session. [^5]
- `copilot -p` runs (Copilot CLI 1.0.105), local test, 2026-11-03: a `preToolUse` hook denying `task` in a folder outside and inside the trusted folders, the recorded `toolArgs`, and `--agent sdlc-qa` (`specs/019-workflow-graph/research.md`, capability spikes); the workflow guard's live check the same day (user-level `preToolUse` deny then allow, `userPromptSubmitted` in `-p`). [^6]
- `copilot/hooks/turn-tokens/turn-tokens.schema.md`, `specs/018-turn-tokens-copilot/` in agent-config — the report built on these facts.

## Related
- `ai-agents/agent-token-accounting.md`
- `ai-agents/claude-code-usage-reference.md`
- `ai-agents/codex-usage-reference.md`
- `ai-agents/measure-agent-tokens.md`
- `github-copilot/copilot-cli-internals.md` — the older notes (legacy)
