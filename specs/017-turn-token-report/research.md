# Research: The turn token report

## What the sources say (read 2026-10-31)

| Source | Fact used | Where |
|---|---|---|
| Claude Code hooks | `Stop` runs when the main agent finishes responding; its input has `session_id`, `transcript_path`, `last_assistant_message`; `systemMessage` in JSON output is shown to the user; "the transcript file isn't guaranteed to include the final message at Stop time on all versions" | [Hooks reference](https://code.claude.com/docs/en/hooks) |
| Claude Code status line | The status line command gets `rate_limits.five_hour` / `seven_day` (`used_percentage`, `resets_at`), `context_window.context_window_size` and `cost.total_cost_usd`; `rate_limits` only for Pro and Max, after the first response | [Customize your status line](https://code.claude.com/docs/en/statusline) |
| Claude Code cost record | The session totals are saved to the transcript "when the process exits normally" (the `cost-state` line), so they are not there after every turn | [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking) |
| Claude Code folder | Claude Code sweeps only the paths it lists under "Cleaned up automatically"; a `turn-tokens/` folder is not one of them | [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory) |
| Anthropic prices | Per model: base input, 5-minute and 1-hour cache writes (1.25× and 2×), cache reads (0.1×; 0.05× Opus and Sonnet 5.5; 0.025× Fable 5.1), output; fast mode for Opus 5.5 ($8 / $40) and Opus 5 / 4.8 ($10 / $50), with the cache multipliers on top; Haiku 5.5 has a higher tier over 100,000 prompt tokens; `inference_geo: "us"` costs 1.1× on 4.6 and later | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Streaming | `message_start` carries a starting `output_tokens` and `stop_reason: null`; the final count comes in `message_delta` | [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) |
| Codex hooks | `Stop` input has `session_id`, `transcript_path`, `turn_id`, `last_assistant_message`; on exit 0 it must print JSON; `systemMessage` shows as a warning; a new or changed hook runs only after the user trusts it in `/hooks` | [Hooks](https://learn.chatgpt.com/docs/hooks) |
| Codex credits | Credits per million input / cached input / output tokens per model (GPT-6 Astra 250 / 25 / 1,250 …); Fast mode bills credits at 2× | [Pricing](https://learn.chatgpt.com/docs/pricing), [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed) |

## What the logs hold (Claude Code 2.1.308, Codex 0.164.0-alpha.11.1, this machine)

| Need | Claude Code transcript | Codex rollout |
|---|---|---|
| Turn boundary | A `user` line that is not a tool result, not `isMeta`, not a compaction summary | `turn_context` with `turn_id`; `token_usage_record.turn_id` |
| Per-call usage | `message.usage` on `assistant` lines, repeated on every line of one reply | `token_usage_record.usage` |
| Tool names | `tool_use` / `server_tool_use` blocks, `name` | `response_item` `custom_tool_call` / `function_call`, `namespace` + `name` |
| Subagents | `<session>/subagents/agent-<id>.jsonl` | Child rollouts whose `session_meta.session_id` is the parent and `thread_source` is `subagent` |
| Final reply written | Last reply has a final `stop_reason` (`end_turn` …) | An assistant `message` followed by a `token_usage_record` |
| Limits | Not in the transcript | `event_msg` `token_count` → `rate_limits.primary` / `secondary` (`window_minutes` 300 / 10080) |
| Model | `message.model` per reply | `turn_context.model` per turn |
| Speed | `usage.speed` (`standard`, `fast`) | `thread_settings_applied.service_tier` (`default` seen) |

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | Where does the history go? | `~/.copilot`; each tool's own folder; the repo | Each tool's own folder (V's suggestion): `~/.claude/turn-tokens/`, `~/.codex/turn-tokens/`. The report sits next to the log it summarizes, follows `CLAUDE_CONFIG_DIR` / `CODEX_HOME`, and Claude Code does not sweep it. The repo is wrong: logs are machine data, not shared content |
| D-2 | Claude Code's 5-hour and weekly limits | Read Claude Code's credentials and call its usage endpoint; status line; leave out | Status line. The hook input has no limits, and reading credentials is off limits. The status line gets them on every update; `--statusline` saves them for the hook. Where no status line runs, the report says the limits are unknown |
| D-3 | Dollars for Claude Code | `cost-state`; status line `cost.total_cost_usd`; price table | Price table (`prices.mjs`, from the pricing page). `cost-state` is written only when the process exits, and the status line cost is the whole session, not the turn. Labelled "at list price": subscriptions are billed against limits, not dollars |
| D-4 | Money for Codex | Dollars; credits | Credits at Standard rates (2× in Fast mode). Credits have no fixed dollar price |
| D-5 | Subagent output with placeholders | Leave out; count as is; "at least N" | "At least N", on the turn and on the session, so the number is never read as exact (V asked whether it applies to the turn too: yes) |
| D-6 | A late final reply | Report without it; wait; count it in the next turn | Wait 3 s (V), reading every 250 ms; then say it is missing. The session total is re-read from the whole log every time, so it includes the call from the next report on |
| D-7 | Where the tool lives | Own folder `copilot/turn-tokens/` (like the tracker); `copilot/hooks/turn-tokens/` | `copilot/hooks/turn-tokens/`: `copilot/hooks` is already linked to `~/.copilot/hooks`, so no new link is needed on any machine. Copilot CLI reads only `~/.copilot/hooks/*.json`, so the sub-folder is not read as hook configuration |
| D-8 | Plain text or JSON | One JSON object; plain text | JSON (`{"systemMessage": …}`) for both hooks: Codex requires JSON from `Stop`. `--text` prints the same report as plain text, for people and the scenarios |

## Found while building

- Codex model slugs seen in rollouts: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-5.5`. The other price rows use the display name lowercased with hyphens (`gpt-6.1-terra`), which is not confirmed; an unknown model is named in the report instead of priced.
- `gpt-5.5` has no row on the Codex pricing page, so it is reported as unpriced.
- Real logs showed a turn count of 64 where 29 was right: the printed output of a local command (`<local-command-stdout>` after `/compact`) looked like a prompt, and a command with no reply after it counted as a turn. TT-2 now leaves both out (two scenarios added first).
- The first CI run failed although every local check passed: `.gitignore` ignores `*.jsonl` (session logs must never be committed), so the fixture logs were never committed, and the local run read them from the working tree. `.gitignore` now re-includes `tests/*/fixtures/**/*.jsonl`; the CI run on GitHub is the check that sees what was really committed.
- `codex exec` waits for more input on stdin when stdin is not a terminal ("Reading additional input from stdin..."): a scripted run needs `< /dev/null`.
- Editing `~/.claude/settings.json` stays the user's step, as for the tracker (specs/015): the seed `claude/settings.json` carries the hook and the status line for new machines.

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | `tests/turn-tokens/turn-tokens.feature` run before `turn-tokens.mjs` existed | 32 of 32 failed (no tool); the other 491 passed |
| Scenarios | `tests/turn-tokens`, then the whole suite (`scripts/check-docs.sh`) | 37 turn-tokens scenarios pass; 528 in all |
| Sabotage | 46 breaks of the TT rules in `turn-tokens.mjs` and `prices.mjs`, each run against the TT scenarios | 46 of 46 caught. Before the run, 3 gaps were found by reading (peak = last call, server-side tools, a subagent outside an earlier Codex turn) and got scenarios; the first run left 2 alive (prompt detection), and got 2 more |
| Codex counter (SC-003) | The Codex hook command from `codex/hooks.json` on a real thread | Session line = Codex's own thread total: 54 calls, new input 106,782, cache read 6,493,440, output 67,911; 273.92 credits |
| Claude Code counter (SC-003) | The hook on a real transcript cut where Claude Code wrote its `cost-state` | 1,270 calls ≈ $165.88 at list price against Claude Code's own $169.13 for the same model (98%); the rest is calls that never reach the transcript |
| Speed | The hook on a 14,899-line transcript | 0.3 s |
| Launcher | `turn-tokens-hook.sh` with `env -i PATH=/usr/bin:/bin`, and with no Node to be found | Found nvm's Node and printed valid JSON; with no Node it prints `{}` |
| Status line | The `statusLine` command from the seed on a status-line payload | "5h 12% · week 30% · context 46%", and the hook then showed the limits "from the status line" |
| Live Codex turn (2026-10-31) | A plain `codex exec` (Codex 0.164.0-alpha in the ChatGPT app) in agent-config, with the `Stop` hook trusted by V in `/hooks` | The hook wrote `~/.codex/turn-tokens/<thread>.jsonl`: 2 calls, new input 19,792, cache read 19,328, output 49, which equals the turn's own `turn.completed` usage (input 39,120 of which cached 19,328); tools `exec`; 5-hour 6% and weekly 5% used; not pending |
