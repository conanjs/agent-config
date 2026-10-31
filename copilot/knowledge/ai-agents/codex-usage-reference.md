---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Codex CLI 0.164.0-alpha.11.1 (bundled with the ChatGPT desktop app)", "Codex docs read 2026-10-30"]
last-verified: 2026-10-31
last-updated: 2026-10-31
tags: [codex, openai, tokens, usage, rate-limits, prompt-caching, compaction, opentelemetry, subagents]
---

# Codex usage, context and multi-agent controls

## Summary
**TL;DR:** Codex shows usage in `/status` (context left and plan limits) and `/usage` (daily, weekly, cumulative tokens), in `codex exec --json` (`turn.completed.usage`), and through OpenTelemetry; on disk, each thread's rollout file holds a usage record per model response and a running thread total. OpenAI counts cached tokens inside `input_tokens` and reasoning inside `output_tokens`. Context is managed by prompt caching and automatic compaction; parallel work runs as subagents.
**Use this when:** looking up which Codex command, field, config key or multi-agent option to use for tokens, limits, context size or throughput.
**Not this doc:** why the numbers mean what they mean → `agent-token-accounting.md`; scripts → `measure-agent-tokens.md`; third-party tools → `token-saving-tools.md`; the Claude Code counterpart → `claude-code-usage-reference.md`.

## Scope
The Codex harness (CLI, IDE extension and the Codex part of the ChatGPT desktop app share it ✅[^1]): local usage records as observed with Codex CLI 0.164.0-alpha.11.1, and the official docs read on 2026-10-30. The docs moved from `developers.openai.com/codex` to `learn.chatgpt.com/docs` (HTTP 308 redirect) ✅[^9]. When Codex comes with the ChatGPT desktop app, `codex` may not be on `PATH` (it was not in the local test); the binary ships inside the app at `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex` ✅[^9].

## Catalog

### Where usage is recorded

| Place | What it holds | Status |
|---|---|---|
| `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread-id>.jsonl` | One file per thread (`CODEX_HOME` moves `~/.codex`) | ✅[^9] |
| `session_meta` line | `cli_version`, `originator` (e.g. `Codex Desktop`), model provider | ✅[^9] |
| `turn_context` line | Per turn: `model`, `effort`, sandbox and approval policy | ✅[^9] |
| `token_usage_record` line | Per model response: `usage`, `turn_token_usage`, `thread_token_usage`, `response_id`, `turn_id` | ✅[^9] |
| `event_msg` with `type: token_count` | `info.total_token_usage` (thread so far), `info.last_token_usage` (last response), `info.model_context_window`; `rate_limits` | ✅[^9] |
| `rate_limits` | `primary` and `secondary` windows with `used_percent`, `window_minutes` (300 and 10080 observed), `resets_at`; `plan_type`; `credits` | ✅[^9] |
| `event_msg` `task_started` / `task_complete` | Start and end of each user turn | ✅[^9] |
| `~/.codex/state_<n>.sqlite`, table `threads` | `tokens_used` (= thread input + output), `model`, `reasoning_effort`, `rollout_path`; table `thread_spawn_edges` links subagent threads to their parent | ✅[^9] |
| `~/.codex/history.jsonl` | Prompt history; `history.persistence = "none"` turns it off, `history.max_bytes` caps it | ✅[^4] |
| `codex exec --ephemeral` | Runs without writing rollout files | ✅[^2] |

### Usage fields (one model response)

| Field | Meaning | Status |
|---|---|---|
| `input_tokens` | All input of the request, cached part included: the context size | ✅[^9] |
| `cached_input_tokens` | The part of `input_tokens` served from the cache | ✅[^9] |
| `cache_write_input_tokens` | Present in the record; 0 in every response observed. Credit billing has no cache-write charge | ✅[^9][^5] |
| `output_tokens` | All output, reasoning included | ✅[^9] |
| `reasoning_output_tokens` | The reasoning part of `output_tokens` | ✅[^9] |
| `total_tokens` | `input_tokens + output_tokens` | ✅[^9] |

### Commands

| Command | Effect on tokens or what it shows | Status |
|---|---|---|
| `/status` | Active model, approval policy, writable roots, token usage and remaining context; also the remaining plan limits | ✅[^3][^5] |
| `/usage [daily\|weekly\|cumulative]` | Account token activity, or redeem an earned rate-limit reset | ✅[^3] |
| `/statusline` | Footer items: model, reasoning, context stats, rate limits, token counters (saved to `tui.status_line`) | ✅[^3] |
| `/compact` | Summarizes the chat so far to free context | ✅[^3] |
| `/new`, `/fork` | Fresh chat in the same session; copy of the chat to try another path | ✅[^3] |
| `/model`, `/fast` | Change model; toggle the Fast service tier | ✅[^3] |
| `/agents`, `/subagents` | Agent command center; steer subagents | ✅[^3] |
| `/debug-config` | Shows which config layer set each value | ✅[^3] |

### Programmatic and telemetry outputs

| Output | Token data | Status |
|---|---|---|
| `codex exec --json "<task>"` | JSON Lines: `thread.started`, `turn.started`, `turn.completed` with `usage` {`input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`}, `turn.failed`, `item.*`, `error` | ✅[^2] |
| `-o <file>` / `--output-last-message`, `--output-schema <schema.json>` | Final message to a file; final answer that matches a JSON Schema | ✅[^2] |
| `codex exec resume --last` / `<SESSION_ID>` | Continue a non-interactive thread | ✅[^2] |
| `[otel]` `exporter = "otlp-http"` or `"otlp-grpc"` | Log events: `codex.conversation_starts`, `codex.api_request`, `codex.sse_event` (token counts on `response.completed`), `codex.user_prompt` (redacted unless enabled), `codex.tool_decision`, `codex.tool_result` | ✅[^6] |
| OTel metrics | `codex.api_request`, `codex.api_request.duration_ms`, `codex.sse_event`, `codex.tool.call`, `codex.tool.call.duration_ms`, websocket counters; tags `auth_mode`, `originator`, `model`, `app.version` | ✅[^6] |
| `analytics.enabled = false` | Stops anonymous usage metrics, and custom OTLP metrics exporters too | ✅[^6][^4] |

### Hooks for per-turn reporting

| Hook or field | Behaviour | Status |
|---|---|---|
| Where hooks are set | `hooks.json` or inline `[hooks]` tables in `config.toml`, next to each config layer; usually `~/.codex/hooks.json` or `~/.codex/config.toml`; plugins can bundle hooks | ✅[^11] |
| Trust | A non-managed hook runs only after you review and trust it in `/hooks`; trust is tied to the hook's hash, so a changed hook is skipped until trusted again | ✅[^11] |
| Events during a turn | `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop` | ✅[^11] |
| Common input | `session_id` (subagent hooks get the parent's), `transcript_path`, `cwd`, `hook_event_name`, `model`; turn hooks add `turn_id` | ✅[^11] |
| `Stop` input and output | Adds `turn_id`, `stop_hook_active`, `last_assistant_message`. On exit 0 it must print JSON (plain text is invalid); `systemMessage` is shown as a warning in the UI | ✅[^11] |
| Transcript format | "isn't a stable interface for hooks and may change over time" | ✅[^11] |
| `notify = ["python3", "/path/to/notify.py"]` | Runs a program on `agent-turn-complete` with one JSON argument: `type`, `thread-id`, `turn-id`, `cwd`, `input-messages`, `last-assistant-message` (no token counts) | ✅[^6] |

### Config keys that change token use (`~/.codex/config.toml`)

| Key | Default | Effect | Status |
|---|---|---|---|
| `model_auto_compact_token_limit` | model default | Token count that triggers automatic compaction | ✅[^4] |
| `model_auto_compact_token_limit_scope` | `total` | `body_after_prefix` counts only growth after the carried prefix | ✅[^4] |
| `compact_prompt` | built-in | Replaces the compaction prompt | ✅[^4] |
| `model_context_window` | model value | Context window Codex assumes | ✅[^4] |
| `tool_output_token_limit` | not stated | Tokens kept per tool output in history | ✅[^4] |
| `mcp_servers.<id>.tools.<tool>.output_token_limit` | model truncation | Output budget for one MCP tool | ✅[^4] |
| `skills.max_context_tokens` | 2% of the context window, max 10,000 | Budget for the list of available skills | ✅[^4] |
| `project_doc_max_bytes` | 32 KiB | Combined size of `AGENTS.md` files read, root to current directory | ✅[^7] |
| `model_reasoning_effort`, `plan_mode_reasoning_effort` | model / preset | `low` … `ultra`; less effort, fewer reasoning tokens | ✅[^4] |
| `model_reasoning_summary`, `model_verbosity`, `hide_agent_reasoning` | auto / model | Shorter or no reasoning summaries; terser answers | ✅[^4] |
| `web_search` | `cached` (`live` with full access) | `disabled` removes web results from context | ✅[^4] |
| `service_tier = "fast"` with `[features] fast_mode = true` | standard | Fast mode by default | ✅[^8] |
| `[agents] max_concurrent_threads_per_session` (legacy `max_threads`) | Codex chooses | Open subagent threads per session | ✅[^4][^10] |
| `[agents] default_subagent_model`, `default_subagent_reasoning_effort` | inherit | Cheaper model or effort for subagents | ✅[^10] |

### What breaks the prompt cache

| Cause | Why | Status |
|---|---|---|
| Tools change mid-conversation (an MCP server sends `tools/list_changed`) | Tool definitions are part of the prefix | ✅[^1] |
| Model changes | The model-specific instructions are early in the prompt | ✅[^1] |
| Sandbox, approval mode or working directory changes | Codex appends a new message instead of editing the old one, to limit the damage | ✅[^1] |
| Compaction | Codex calls `/responses/compact`; the history is replaced by a list with an encrypted `compaction` item | ✅[^1] |

### Multi-agent and throughput options

| Option | What runs | Token effect | Status |
|---|---|---|---|
| Subagents (on by default, `agents.enabled = true`) | Built-in `default`, `worker`, `explorer`; custom ones in `~/.codex/agents/` or `.codex/agents/` (TOML: `name`, `description`, `developer_instructions`, optional `model`, `model_reasoning_effort`) | Each does its own model and tool work: more tokens than one agent; summaries return to the parent. Best for read-heavy parallel work | ✅[^10] |
| Subagent permissions | Inherit the parent turn's sandbox and approvals | A new approval that cannot be shown fails back to the parent | ✅[^10] |
| `codex exec` in scripts and CI | Non-interactive runs, with `--json` usage per turn | Usage counts against the same plan or API key | ✅[^2] |
| Fast mode (`/fast`) | Faster supported models (1.5× for GPT-5.6) | Uses included limits at 2.5× the Standard rate; credits at 2× | ✅[^8] |
| Ultrafast | Up to 8× faster on GPT-6 Astra (Pro $500, eligible Enterprise and Edu) | 8× included limits; 6× credits | ✅[^8] |

### Billing

| Item | Fact | Status |
|---|---|---|
| Plans | ChatGPT plans include Codex; limits run in a short window and a weekly window (300 and 10080 minutes in the local records) | ✅[^5][^9] |
| Where to check | Usage dashboard at chatgpt.com/codex/settings/usage, or `/status` | ✅[^5] |
| Credits per million tokens (Standard speed) | GPT-6 Astra 250 input / 25 cached / 1,250 output; GPT-6.1 Sol 50 / 2.5 / 250; GPT-6 Luna 2.5 / 0.25 / 12.5 | ✅[^5] |
| API key | API token pricing instead of plan limits | ✅[^8] |
| Official tips | Precise prompts, fewer source files, outputs sized to the need, smaller or nested `AGENTS.md`, fewer MCP servers | ✅[^5] |

## Lookup notes
- Never add `cached_input_tokens` to `input_tokens`: it is already inside. `threads.tokens_used` and `total_tokens` measure processed volume, not cost.
- The rollout format is not documented and changes with versions (`token_usage_record` is newer than `token_count`); the per-response records summed to exactly Codex's own thread total in all 4 threads tested ✅[^9].
- Subagent threads have their own rollout files; find them through `thread_spawn_edges` ✅[^9].

## Takeaways
- For one thread, `/status`; for a script, `codex exec --json` and sum `turn.completed.usage`; for a fleet, `[otel]`.
- Keep the tool set and model fixed during a thread; add MCP servers only when needed.
- Use subagents for read-heavy parallel work and give them a cheaper `default_subagent_model`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 70 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-31

## References
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) — OpenAI (Michael Bolin), 2026. Backs: shared harness, cache-miss causes, appended config messages, `/responses/compact`. [^1]
- [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) — OpenAI, living. Backs: `codex exec --json` events and usage, `-o`, `--output-schema`, `--ephemeral`, `resume`. [^2]
- [Developer commands](https://learn.chatgpt.com/docs/developer-commands) — OpenAI, living. Backs: `/status`, `/usage`, `/statusline`, `/compact`, `/new`, `/fork`, `/fast`, `/agents`, `/debug-config`. [^3]
- [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) — OpenAI, living. Backs: config keys and defaults. [^4]
- [Pricing](https://learn.chatgpt.com/docs/pricing) (Codex docs) — OpenAI, living. Backs: limits, dashboard, credit rates, no cache-write charge, tips. [^5]
- [Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) — OpenAI, living. Backs: OTel events and metrics, analytics opt-out, `notify` payload. [^6]
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) — OpenAI, living. Backs: discovery order, 32 KiB limit. [^7]
- [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed) — OpenAI, living. Backs: Fast and Ultrafast rates, API-key billing. [^8]
- `~/.codex/sessions/2026/10/*/rollout-*.jsonl`, `~/.codex/state_5.sqlite` (read from a copy), `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex --version` — local test, 2026-10-30, Codex CLI 0.164.0-alpha.11.1: record types, fields, rate-limit windows, `tokens_used` = input + output, per-response sums = thread totals in 4 threads; docs URL redirect checked with `curl`. [^9]
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) — OpenAI, living. Backs: built-in agents, TOML fields, `[agents]` keys, inheritance, token warning. [^10]
- [Hooks](https://learn.chatgpt.com/docs/hooks) — OpenAI, living. Backs: hook locations, trust, events, input and output fields, transcript stability warning. [^11]

## Related
- `ai-agents/agent-token-accounting.md`
- `ai-agents/measure-agent-tokens.md`
- `ai-agents/claude-code-usage-reference.md`
- `ai-agents/token-saving-tools.md`
