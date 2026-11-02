# Research: The turn token report for GitHub Copilot

## What the sources say (read 2026-11-02)

| Source | Fact used |
|---|---|
| [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) | `agentStop` fires when the main agent finishes a turn; input `sessionId`, `transcriptPath`, `stopReason` (snake_case under the VS Code name `Stop`); output only `decision`/`reason`; `{"type":"progress"}` lines go to the timeline; user hooks in `~/.copilot/hooks/*.json` |
| [Hooks (VS Code)](https://code.visualstudio.com/docs/copilot/customization/hooks) | VS Code, the Copilot app and the CLI share the Copilot runtime and its hook format and locations |
| [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals) | 1 AI credit = $0.01 |

## What the logs hold (this machine)

| Need | Copilot `events.jsonl` |
|---|---|
| Turn boundary | `user.message` |
| Per call | `session.usage_record` → `data.usage`: `inputTokens` (cache included), `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `maxPromptTokens`, `copilotUsage.totalNanoAiu` |
| Tools | `tool.execution_start` → `toolName` |
| Final reply written | The last `assistant.message` has no `toolRequests`; it comes after the last usage record and before `agentStop` |
| Allowance | `model.model_call_success` → `quotaSnapshots.premium_interactions` |

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | Cost | Price table; Copilot's own `totalNanoAiu` | Copilot's own: it is what Copilot charges, and it sums exactly to its checkpoint |
| D-2 | How the user sees it | `systemMessage`; `decision: block`; progress lines | Progress lines: `agentStop` has no message field, and `block` would start another turn |
| D-3 | Limits | 5-hour/weekly; monthly allowance | Monthly allowance: that is the limit Copilot logs |
| D-4 | Subagents | Split; count with the main agent | Count with the main agent: no field was confirmed to separate them |

## Found while building

- `.gitignore` ignores every `session-state/` folder, which would have dropped the Copilot fixture as `*.jsonl` dropped the specs/017 fixtures; it now re-includes `tests/*/fixtures/**/session-state/`.
- The sabotage run that ignores `COPILOT_HOME` wrote into the real `~/.copilot/turn-tokens/`; the file was removed and that break now writes to a temporary folder.
- The VS Code Copilot session of 2026-11-02 still had the instructions as they were when VS Code started (29 Oct), so it never saw the tracker rule; no Copilot session wrote a `TRACKER.md` (`copilot-usage-reference.md`).

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | The Copilot scenarios run before `--hook copilot` existed | 9 of 9 failed; the others passed |
| Scenarios | `tests/turn-tokens`, then the whole suite | 48 turn-tokens scenarios; all pass |
| Sabotage | 17 breaks of the Copilot code | 17 of 17 caught (2 more scenarios added after the first run) |
| Real log (SC-002) | `--hook copilot --text` on a real VS Code Copilot session | Per-call credits sum to Copilot's checkpoint exactly: 182.21 AI credits |
| Live CLI (SC-003) | `copilot -p "Reply with only the word ok."` (Copilot CLI 1.0.105) with the hook installed | The report printed as "● Turn 1 · 1 call · … ≈ 9.22 AI credits ($0.092)"; Copilot's footer said "AI Credits 9.22"; `~/.copilot/turn-tokens/<session>.jsonl` written |
