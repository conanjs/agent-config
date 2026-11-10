---
schema: schema/v1
last-updated: 2026-11-10
---

# Schema: Turn token report (`turn-tokens/v1`)

**Applies to:** the report `turn-tokens.mjs` shows after every turn of Claude Code, Codex or GitHub Copilot (the CLI and the Copilot agent in VS Code), and the history file it appends to · **Written by:** the `Stop` hook of each tool · **Read by:** the person working, and anyone comparing runs

After every turn, the report says what the turn used, what the session has used so far, and how much of the plan's 5-hour and weekly limits is gone. It reads the tool's own log file, so it needs no network and no account access.

Analogy: the till receipt after each round at a bar, with the running tab printed under it.

## The report

Claude Code (`--hook claude`):

```text
Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037
  tools: Bash ×2, Read
  subagents: 2 calls · output at least 152 · ≈ $0.005 · tools: Grep
Session · 4 calls · new input 20 · cache write 23,500 · cache read 65,000 · output 2,200 · ≈ $0.097 at list price
  subagents: 3 calls · output at least 202 · ≈ $0.006
Limits · unknown: Claude Code shares them only with its status line (turn-tokens --statusline)
```

Codex (`--hook codex`):

```text
Turn 2 · 3 calls · peak context 26,000 of 258,400 (10%) · new input 11,000 · cache read 60,000 · output 1,000 · ≈ 5.50 credits
  tools: exec ×2, collaboration.spawn_agent
  subagents: 2 calls · output 160 · ≈ 0.01 credits · tools: exec
Session · 5 calls · new input 14,000 · cache read 78,000 · output 1,160 · ≈ 6.90 credits
  subagents: 2 calls · output 160 · ≈ 0.01 credits
Limits · 5-hour 15% used, resets 31 Oct 14:00 · weekly 2% used, resets 3 Nov 09:00
```

GitHub Copilot (`--hook copilot`, added by specs/018):

```text
Turn 2 · 3 calls · peak context 15,000 of 968,000 (2%) · new input 30 · cache write 4,970 · cache read 36,000 · output 900 · ≈ 6.73 AI credits ($0.067)
  tools: bash ×2, view
Session · 4 calls · new input 40 · cache write 14,960 · cache read 36,000 · output 1,000 · ≈ 11.73 AI credits ($0.117)
Limits · monthly 3% used (1,920 of 60,000), resets 1 Dec 00:00
```

| Word | Meaning |
|---|---|
| call | One request to the model and its reply |
| peak context | The largest request of the turn: everything sent in it. "of N (P%)" when the window size is known |
| new input | Input that was not read from the cache |
| cache write / cache read | Input written to / read from the prompt cache (Codex has no cache-write charge, so no column) |
| output | Text, tool calls and thinking or reasoning the model wrote |
| at least | Some replies in the sum still carry a placeholder count, so the true number is higher |
| ≈ $ / credits | An estimate from the price table, `prices.mjs`; not a bill |
| AI credits | Copilot's own per-call cost (`copilotUsage.totalNanoAiu` ÷ 10⁹); 1 AI credit = $0.01 |
| Cache · … cached until | When the prompt cache of the last request expires; a pause past it makes the next request write the whole context again (`copilot/knowledge/ai-agents/copilot-usage-reference.md`) |

## The history record

One JSON line per report, appended to `turn-tokens/<session id>.jsonl` in the tool's own folder (`$CLAUDE_CONFIG_DIR` or `~/.claude`; `$CODEX_HOME` or `~/.codex`; `$COPILOT_HOME` or `~/.copilot`):

```json
{"schema":"turn-tokens/v1","at":"2026-10-31T09:20:00.000Z","tool":"claude","session":"s1","turn":2,"pending":false,"unit":"usd","contextWindow":null,"thisTurn":{"calls":3,"peakContext":23502,"newInput":10,"cacheWrite":3500,"cacheRead":65000,"output":1200,"outputAtLeast":false,"cost":0.03677,"unpriced":[],"tools":{"Bash":2,"Read":1}},"thisTurnSubagents":{…},"sessionTotal":{…},"sessionSubagents":{…},"limits":null}
```

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| TT-1 | Hook mode reads the hook's JSON from stdin, prints one JSON object `{"systemMessage": "<report>"}` (for Copilot, whose `agentStop` output has no message field: one `{"type":"progress","message":…}` line per report line, then `{}`; or the report as text with `--text`) and exits 0 every time; a payload that is not JSON, or a log that cannot be read, gives a one-line message instead of a report | the turn never fails because of the report | scenarios |
| TT-2 | A Claude Code turn is the main-transcript replies after the last prompt line (a `user` line that is not a tool result, not `isMeta`, not a compaction summary); each reply counts once (`message.id` + `requestId`); `<synthetic>` stubs are skipped. The printed output of a local command (`<local-command-…>`) is not a prompt. The turn number counts the prompt lines a reply follows, plus the last one | the turn matches what was asked | scenarios |
| TT-3 | A Codex turn is the `token_usage_record` lines with the hook's `turn_id` (the last turn when none is given); its tools and model come from the lines after that turn's `turn_context`. The turn number is the count of distinct turns so far | — | scenarios |
| TT-4 | When the turn's final reply is not yet in the log (Claude Code: the last reply has no final `stop_reason`; Codex: no `token_usage_record` after the turn's last assistant message; Copilot: the turn's last `assistant.message` still has `toolRequests`, or there is none), the tool reads again every 250 ms for up to 3 s (`TURN_TOKENS_WAIT_MS`); if it is still missing, the report adds a note | — | scenarios |
| TT-5 | Per call: Claude Code new input = `input_tokens`, cache write = `cache_creation_input_tokens`, cache read = `cache_read_input_tokens`, context = their sum; Codex new input = `input_tokens − cached_input_tokens`, cache read = `cached_input_tokens`, context = `input_tokens`. Output is `output_tokens` for both. Peak context is the largest context of the turn | sums match each tool's own counter | scenarios |
| TT-6 | A Claude Code reply with no `stop_reason` carries a placeholder output; a sum that includes one is shown as "output at least N" | — | scenarios |
| TT-7 | Subagents are counted apart from the main agent. Claude Code: replies in `<session>/subagents/*.jsonl`; Codex: child rollouts whose `session_meta.session_id` is the thread and `thread_source` is `subagent`. Those from the turn's start until the next turn's start count for the turn; all count for the session | — | scenarios |
| TT-8 | Tools are the distinct tool-call names of the turn in order of first use, `×N` when used more than once. Claude Code: `tool_use` and `server_tool_use` blocks; Codex: `custom_tool_call` and `function_call` items, as `namespace.name` when there is a namespace | — | scenarios |
| TT-9 | Claude Code cost is dollars at list price from `prices.mjs`: 5-minute and 1-hour cache writes priced apart, fast speed at fast prices with the cache multipliers on top, the Haiku 5.5 tier over 100,000 prompt tokens, and 1.1× for `inference_geo: "us"` where the model has it. Codex cost is credits at Standard rates, 2× when the service tier is `fast` or `priority`. A model without a price row is named after the amount ("+ unpriced: <model>"), or alone when no call has a price ("price unknown: <model>") | — | scenarios |
| TT-10 | Limits: Codex from the latest `rate_limits` in the rollout (a 300-minute window is "5-hour", 10080 is "weekly", other windows "N-minute"); Claude Code from the status-line file of the session, else the newest one, with the time it was saved; without either, "unknown" | — | scenarios |
| TT-11 | Every report is appended as one `turn-tokens/v1` JSON line to `turn-tokens/<session id>.jsonl` in the tool's own folder (`~/.claude`, `~/.codex`, `~/.copilot`); the folder is created when missing | — | scenarios |
| TT-12 | `--statusline` reads Claude Code's status-line JSON from stdin, saves `rate_limits`, `context_window.context_window_size` and the time to `turn-tokens/statusline-<session id>.json`, and prints one line: the limits and the context use it has | — | scenarios |
| TT-13 | A Copilot turn is the `session.usage_record` events after the last `user.message` of `events.jsonl` (the hook's `transcriptPath`/`transcript_path`, else `session-state/<session id>/events.jsonl` in Copilot's folder). Per call: context = `inputTokens`, cache read = `cacheReadTokens`, cache write = `cacheWriteTokens`, new input = the rest of `inputTokens`, output = `outputTokens`; the window is `maxPromptTokens`. The turn number is the count of `user.message` events | — | scenarios |
| TT-14 | Copilot tools are the `toolName` of the turn's `tool.execution_start` events, in order of first use, `×N` when used more than once | — | scenarios |
| TT-15 | Copilot cost is the sum of each call's `copilotUsage.totalNanoAiu` ÷ 10⁹, shown as AI credits with their dollar value (1 AI credit = $0.01); a call without `copilotUsage` names its model as unpriced | sums match Copilot's own `session.usage_checkpoint` | scenarios |
| TT-16 | Copilot limits come from the latest `quotaSnapshots.premium_interactions` in the log: "monthly P% used (used of entitlement), resets <date>", "monthly allowance unlimited" when unlimited, "unknown" without one | — | scenarios |
| TT-17 | When the session's last request (Copilot: the last call not made by a sub-agent) sent 100,000 tokens or more, the report adds, before the Limits line, `Cache · <tokens> tokens cached until <hh:mm> · before a longer break: /compact`. The expiry: Copilot's `cacheExpiresAt` of that call, else 5 minutes after it; Claude Code 1 hour after the last request when the latest cache write was a 1-hour write (`ephemeral_1h_input_tokens` above 0), else 5 minutes. Codex has no Cache line: its cache lifetime is not in the log | — | scenarios |
| TT-18 | With a Cache line, the hook writes `turn-tokens/reminder-<session id>.json` (`kind: cache-reminder`, the log, `lastCallAt`, `context`, `expiresAt`, `notifyAt` = `expiresAt` − `TURN_TOKENS_REMIND_LEAD_MIN`, default 2 minutes) when `notifyAt` is still ahead, replacing any earlier one, and starts a detached `turn-tokens.mjs --remind <file>`. That process waits until `notifyAt`, then shows a desktop notification (`osascript` on macOS, `notify-send` on Linux) titled "<tool>: cache expires in N min" only when the file still holds its `lastCallAt`, the log's last request is still that one, and the cache has not expired; it then removes the file. `TURN_TOKENS_REMIND=off` turns this off; `record` writes the file without starting the process, and `TURN_TOKENS_NOTIFY=print` prints the notification (tests) | the notification reaches VS Code users too, where hook messages do not show | scenarios |

## Lookup notes

- The report is a lower bound for Claude Code: compaction summaries, session titles and prompt suggestions are model calls that never reach the transcript (`copilot/knowledge/ai-agents/agent-token-accounting.md`, Edge cases).
- Prices change. `prices.mjs` names the pages and the date it was read; update both together.
- Claude Code's limits reach the report only from a terminal session: the Claude desktop app does not run the `statusLine` command (tested 2026-10-31, Claude Code 2.1.308), so a desktop report says the limits are unknown; `/usage` shows them there.

## Checks

| Check | Tool |
|---|---|
| TT-1 … TT-18 | `tests/turn-tokens/turn-tokens.feature`, run by `scripts/check-docs.sh` |

## References

**Local artifacts:**
- `copilot/hooks/turn-tokens/turn-tokens.mjs`, `prices.mjs`, `turn-tokens-hook.sh` — the tool, its price table and its launcher.
- `specs/017-turn-token-report/` — the spec, the research and the decisions.
- `copilot/knowledge/ai-agents/agent-token-accounting.md`, `measure-agent-tokens.md` — the counting rules this tool applies.

**External authoritative sources:**
- [Hooks reference](https://code.claude.com/docs/en/hooks) and [Hooks](https://learn.chatgpt.com/docs/hooks) — the `Stop` hook input and output of each tool.
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) — `agentStop` input (`transcriptPath`), its output fields, and progress lines.
- [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals) — 1 AI credit = $0.01.
- [Customize your status line](https://code.claude.com/docs/en/statusline) — the status-line fields TT-12 saves.
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) and [Pricing (Codex)](https://learn.chatgpt.com/docs/pricing) — the rates in `prices.mjs`.

## Related

- `copilot/tracker/tracker.schema.md` — the other hook-driven tool, built the same way.
