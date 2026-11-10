---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["GitHub Copilot CLI 1.0.105", "Copilot agent in VS Code 1.143.0 (Copilot SDK runtime 1.0.100)", "docs read 2026-11-02", "GitHub Copilot CLI 1.0.105 (local test 2026-11-09)", "Copilot session logs of 2026-10-26 to 2026-11-09 (read 2026-11-10)"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [github-copilot, copilot-cli, vscode, tokens, ai-credits, hooks, instructions]
---

# GitHub Copilot usage, AI credits and hooks

## Summary
**TL;DR:** The Copilot CLI and the Copilot agent in VS Code share one agent runtime: both log every model call to `~/.copilot/session-state/<session id>/events.jsonl` with its tokens and its exact cost in AI credits (1 AI credit = $0.01), and both read hooks from `~/.copilot/hooks/*.json`. The end-of-turn hook (`agentStop`) gets the log's path but cannot show a message field; progress lines it prints appear in the CLI but not in VS Code. VS Code runs one Copilot runtime for all its windows; it keeps the copy of the user instructions it first read for a workspace folder until VS Code quits, and Developer: Reload Window does not refresh it.
**Use this when:** measuring or reporting Copilot token use and credits, writing a Copilot hook, or finding out why Copilot ignores a newly added instruction.
**Not this doc:** the same for Claude Code and Codex → `claude-code-usage-reference.md`, `codex-usage-reference.md`; counting rules → `agent-token-accounting.md`; the older SQLite-based notes → `../github-copilot/copilot-cli-internals.md` (legacy).

## Scope
GitHub Copilot's local usage records, its AI-credit billing, its hooks and how VS Code loads user instructions: from the docs read on 2026-11-02 and from this machine's logs (Copilot CLI 1.0.105; a VS Code session whose system message reads "You are an AI assistant using Copilot SDK in VS Code", runtime 1.0.100; VS Code 1.143.0 probes on 2026-11-05).

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
| `cacheExpiresAt` | When the prompt cache written or read by this call expires, usually about 5 minutes later. In 2,128 calls it was a median of 4.9 minutes after the record's own time (range 3.5 to 30) | ✅[^11] |

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
| `preToolUse` in the session log | The session log groups the tool calls of one model reply into one hook invocation: every `hook.start` event for `preToolUse` logs its input as `{sessionId, cwd, toolCalls: [{id, name, args}]}`, and `hook.end` keys any deny by tool-call id. In an interactive Copilot CLI 1.0.105 session (2026-11-04, 75 calls), 9 of the 75 invocations covered two or more tool calls at once (for example two parallel `task` launches). `copilot -p` sessions log the same shape, and so does every CLI version in the local logs back to 1.0.73 | ✅[^6][^7] |
| Hook stdin is one call at a time | The log's `toolCalls` array is not what a config-file command hook reads: Copilot runs the command once per tool call, with `{sessionId, timestamp, cwd, toolName, toolArgs}` on stdin, in `copilot -p` and in an interactive session (`copilot -i`) alike. A deny blocks only its own call: with two parallel `bash` calls in one reply, the hook denied the first and the second ran. A hook that reads only `toolName` therefore checks every call in a batch | ✅[^7] |
| Sub-agent tool name in VS Code | VS Code's Copilot harness names it `task`, as the CLI does (✅[^6]): a user-level `preToolUse` hook received `{sessionId, timestamp, cwd, toolName: "task", toolArgs: {name, agent_type, description, prompt}}`, and its deny stopped the launch; the chat showed a "Delegating task" step with "Tool execution failed: Denied by preToolUse hook: <reason>" | ✅[^8] |
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
| Progress lines in VS Code | Not shown. A `preToolUse` hook whose run succeeded printed a progress line before its decision, and the chat showed only the tool step and the answer. Progress lines from `agentStop` (the probe's and the turn token report's, which did run and save its record) did not show either; there the whole `agentStop` run was marked failed because another hook (`desktop-notify`) crashed | ✅[^8] |
| Order at the end of a turn | The last `session.usage_record`, then the final `assistant.message` (no `toolRequests`), then `assistant.turn_end`, then the `agentStop` hook | ✅[^5] |

### User instructions in VS Code

| Item | Fact | Status |
|---|---|---|
| Location | Copilot user instructions live in `~/.copilot/instructions`; VS Code also reads the folders in `chat.instructionsFilesLocations` | ✅[^3] |
| `applyTo` | A file is attached automatically when its `applyTo` pattern matches a file the agent creates or modifies; a `description` lets the agent load it on demand | ✅[^3] |
| A stale copy | A VS Code session on 2026-11-02 had the version of `personal-defaults.instructions.md` from before 29 Oct 15:18 (no "Pin Before You Change", no tracker rule), although the file had changed three times since; VS Code had been running since 29 Oct 08:58 | ✅[^5] |
| Why | VS Code runs one Copilot runtime process (`copilot-runtime`, under VS Code's agent host) for all its windows, started with VS Code. It reads the user instructions the first time a workspace folder starts a session and gives later sessions in that folder the same copy: after the file changed, a new chat and a Developer: Reload Window (which restarts only the window's extension host) still got the old text, while a newly opened folder got the new text, and quitting and reopening VS Code gave the first folder the new text too | ✅[^8] |

## Lookup notes
- **`--no-custom-instructions` turns off every custom instruction source**, the user's `~/.copilot/instructions` and the project's `.github/copilot-instructions.md` alike: the first request fell by the instruction files' size, and adding a project file under the flag changed nothing (1.0.105) ✅[^10].
- **To test other global instructions without touching `~/.copilot`,** point `COPILOT_HOME` at a temporary folder holding a link to `~/.copilot/config.json` and an `instructions/` folder. Copilot CLI signed in and loaded that folder's instructions (1.0.105) ✅[^10]. `copilot help environment` describes `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` as additional folders to search, "in addition to git root and current working directory", so it cannot remove the user's instructions ✅[^10].
- Copilot's `inputTokens` already contains the cache reads and writes, as Codex's `input_tokens` does; Claude Code's `input_tokens` does not (`agent-token-accounting.md`).
- **After a pause longer than about 5 minutes, the next request usually writes the whole context to the cache again**, at the cache-write rate (Claude Opus 5.5: 500 AI credits per million tokens, against 20 for a cache read). In this machine's logs on 2026-11-10 (44 sessions, 2,172 calls, 2026-10-26 to 2026-11-09), 101 calls came more than 5 minutes after the previous one and wrote more than half of a context above 50,000 tokens to the cache. They cost 17,950 of 37,586 AI credits (47.8%): 8,576 after pauses of 5–15 minutes, 5,755 after 15–60 minutes, 3,619 after more than an hour. The costs are Copilot's own per-call figures; that the cache had expired is inferred from the timing and the write size ✅[^11]. In a long session, finish or compact before a break, and start a new session for a new task.
- To report Copilot usage after every turn, use the turn token report: `copilot/hooks/turn-tokens/turn-tokens.schema.md` in agent-config (TT-13 … TT-16).
- After changing a file in `~/.copilot/instructions`, quit and reopen VS Code (Cmd+Q) before trusting that its Copilot uses the change; Developer: Reload Window is not enough. A hook file newly added to `~/.copilot/hooks` was used by the next session in a newly opened folder without a restart.
- VS Code hooks run with the PATH of that runtime: the environment VS Code read from the login shell when it started from the Dock. If reading it takes longer than `application.shellEnvironmentResolutionTimeout` (10 seconds by default), VS Code starts without the shell's environment[^9]. Then nvm's `node` is missing: two VS Code sessions on 2026-11-02 and 2026-11-03 failed their `node` hooks with `/bin/bash: node: command not found`, and VS Code's log has "Unable to resolve your shell environment in a reasonable time" on 2026-10-26. A hook that needs Node should find it itself, as `turn-tokens-hook.sh` does.

## Takeaways
- Copilot's log carries its own exact cost per call: sum `copilotUsage.totalNanoAiu`, do not price tokens yourself.
- A Copilot end-of-turn hook can only talk to the user through progress lines, and only the CLI shows them; in VS Code it has no way to show the user anything.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 42 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) — GitHub, living. Backs: hook locations, format, `agentStop` input and output, progress lines, `preToolUse` deny, the `task` subagent tool and subagent events. [^1]
- [Hooks (VS Code)](https://code.visualstudio.com/docs/copilot/customization/hooks) — Microsoft, living. Backs: one hook format across VS Code, the Copilot app and the CLI. [^2]
- [Custom instructions (VS Code)](https://code.visualstudio.com/docs/copilot/customization/custom-instructions) — Microsoft, living. Backs: `~/.copilot/instructions`, `applyTo`, `description`. [^3]
- [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals) — GitHub, living. Backs: 1 AI credit = $0.01, monthly allowances. [^4]
- `~/.copilot/session-state/*/events.jsonl`, `copilot -p` with Copilot CLI 1.0.105, and the VS Code process start time — local test, 2026-11-02: event types and fields, per-call credits summing exactly to the checkpoint (182.21 AI credits), the quota snapshot, the CLI showing progress lines and a 9.22-credit turn that matches its own footer, and the stale instruction copy in a VS Code session. [^5]
- `copilot -p` runs (Copilot CLI 1.0.105), local test, 2026-11-03: a `preToolUse` hook denying `task` in a folder outside and inside the trusted folders, the recorded `toolArgs`, and `--agent sdlc-qa` (`specs/019-workflow-graph/research.md`, capability spikes); the workflow guard's live check the same day (user-level `preToolUse` deny then allow, `userPromptSubmitted` in `-p`); an interactive session's `events.jsonl` (1.0.105, 2026-11-04: `hook.start` inputs). [^6]
- Batched `preToolUse` probe (Copilot CLI 1.0.105), local test, 2026-11-05: a repository hook in a temporary trusted folder wrote each stdin to a file and denied any call containing `DENYME`; the prompt asked for two parallel `bash` calls (`echo DENYME-…` and `echo allowed-…`). Run once with `copilot -p --trust-folder` (session `9ffebe8b`) and once interactively with `copilot -i` on a pseudo-terminal (session `97a68944`). Each run logged one `hook.start` with two `toolCalls`; the hook ran twice with `{toolName, toolArgs}`; the first call was denied and the second printed its output. Also: a count of the `hook.start` input shapes in all local session logs (CLI 1.0.73 to 1.0.105). [^7]
- VS Code probes (VS Code 1.143.0, Copilot runtime 1.0.100-1), local test with V, 2026-11-05: a temporary user-level hook (`preToolUse` recorded stdin and PATH and denied sub-agent launches; both it and `agentStop` printed a progress line) and a temporary user instruction file with a marker, in two throwaway folders opened with `code -n` and prompted with `code chat -m agent`. Sessions `4d8dada9` (marker A, `task` denied), `83ab9839` (file changed to B, same folder: A), `f725a133` (after Reload Window at 07:42:40, same `copilot-runtime` process 2571 started 2026-11-04: A), `bbe0a9a4` (new folder: B), `44c03b4f` (after quitting VS Code, new runtime process 88398: B). V watched the chat and saw no progress line. [^8]
- [Resolving shell environment fails (VS Code FAQ)](https://code.visualstudio.com/docs/supporting/faq#_resolving-shell-environment-fails) — Microsoft, living. Backs: VS Code started from the Dock resolves the shell environment and, after `application.shellEnvironmentResolutionTimeout` (10 seconds), starts without it. [^9]
- `copilot/hooks/turn-tokens/turn-tokens.schema.md`, `specs/018-turn-tokens-copilot/` in agent-config — the report built on these facts.

- Local test, 2026-11-09, GitHub Copilot CLI 1.0.105 (`copilot -p --output-format json`, `claude-sonnet-5.5`): first-request input from `session.usage_checkpoint` with and without `--no-custom-instructions`, with a project `.github/copilot-instructions.md`, and with `COPILOT_HOME` set to a temporary folder; `copilot help environment` read for `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`. Numbers in agent-config `proposals/instruction-loading.md` section 6. [^10]

- `~/.copilot/session-state/*/events.jsonl` — local read-only scan, 2026-11-10: every `session.usage_record` (2,172 calls in 44 sessions, Claude Opus 5.5, Claude Sonnet 5.5 and `gpt-6.1-sol`); `cacheExpiresAt` against the record time (2,128 calls carry it); calls with input above 50,000, cache write above half the input and more than 5 minutes after the previous call, summed by `copilotUsage.totalNanoAiu`. Method and the other patterns in agent-config `proposals/efficiency-auditor.md` section 3. [^11]

## Related
- `ai-agents/agent-token-accounting.md`
- `ai-agents/claude-code-usage-reference.md`
- `ai-agents/codex-usage-reference.md`
- `ai-agents/measure-agent-tokens.md`
- `github-copilot/copilot-cli-internals.md` — the older notes (legacy)
