---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Claude Code 2.1.278–2.1.308 (local tests)", "Claude Code docs read 2026-10-30 (features up to v2.1.307)", "Claude Code 2.1.318 (local test 2026-11-09)", "Claude Code 2.1.319 (transcripts and docs read 2026-11-10)"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [claude-code, tokens, usage, cost, prompt-caching, compaction, opentelemetry, subagents, agent-teams, workflows]
---

# Claude Code usage, context and multi-agent controls

## Summary
**TL;DR:** Claude Code shows usage in `/usage` (session cost estimate, cache line, plan bars, attribution), in the status line JSON, in `claude -p --output-format json`, and through OpenTelemetry; on disk, each session's transcript holds per-request usage. Context is managed by prompt caching, auto-compaction and `/clear`; parallel work runs as subagents, forks, agent teams or dynamic workflows, and every extra agent adds its own requests to the bill.
**Use this when:** looking up which Claude Code command, field, setting or multi-agent option to use for tokens, cost, context size or throughput.
**Not this doc:** why the numbers mean what they mean → `agent-token-accounting.md`; scripts → `measure-agent-tokens.md`; third-party tools → `token-saving-tools.md`; where agents and skills load → `claude-code-agents-and-skills.md`.

## Scope
Claude Code's own usage reporting, context and cache controls, and multi-agent options, from the official docs read on 2026-10-30, plus the local transcript format observed with Claude Code 2.1.278 (VS Code) and 2.1.308 (desktop app). Many features below need a recent version: the docs mark them "requires v2.1.x". In the local test the `claude` on `PATH` was 2.1.129 while the desktop app ran 2.1.308, so check which binary a feature needs ✅[^14].

## Catalog

### Where usage is recorded

| Place | What it holds | Status |
|---|---|---|
| `~/.claude/projects/<cwd, "/" → "-">/<session-id>.jsonl` | The main transcript. Each assistant line carries `message.usage`; one response is split over several lines (one per content block) that repeat the same usage | ✅[^14] |
| `<session-id>/subagents/agent-<id>.jsonl` | One transcript per subagent. Lines written mid-stream (no `stop_reason`) carry a placeholder `output_tokens` | ✅[^14] |
| `cost-state` line in the main transcript | Claude Code's own running totals: `totalCostUSD`, `totalAPIDuration`, `totalToolDuration`, lines added/removed, and `modelUsage` per model (input, output, thinking, cache read/write, cost). Undocumented; includes helper-model calls | ✅[^14] |
| `system` line, `subtype: compact_boundary` | `compactMetadata.trigger` (`auto`/`manual`), `preTokens`, `postTokens` for each compaction | ✅[^14] |
| `~/.claude/usage-data/report.html` | The latest `/insights` report, plus timestamped copies | ✅[^1] |
| Retention | Session data older than `cleanupPeriodDays` (30 days by default) is deleted at startup | ✅[^1] |

### Usage fields (one API response)

| Field | Meaning | Status |
|---|---|---|
| `input_tokens` | Input that was neither read from nor written to the cache | ✅[^3] |
| `cache_creation_input_tokens` | Written to the cache, billed at the cache-write rate; split into `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` | ✅[^2] |
| `cache_read_input_tokens` | Read from the cache, billed at the cached rate | ✅[^2] |
| `output_tokens` | Text, tool calls and thinking; thinking is billed as output. The transcript also gives `output_tokens_details.thinking_tokens` | ✅[^1][^14] |
| Context size of the request | `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` (the status line's `used_percentage` uses this, without output) | ✅[^3] |

### Commands

| Command | Effect on tokens or what it shows | Status |
|---|---|---|
| `/usage` | Session block: total cost (estimate at list price, or at `modelPricing` rates), API and wall duration, usage by model; `Prompt cache (main)` line (v2.1.251+); on Pro/Max/Team/Enterprise: plan bars, attribution to skills/subagents/plugins/MCP servers, recommendations (≥ 10% share), `/loop` rows; `d`/`w` for 24 h / 7 days; `f` applies fixable recommendations (v2.1.305+) | ✅[^1] |
| `/context` | Shows what fills the context window | ✅[^1] |
| `claude -p "/context"` | Works in print mode too: prints the breakdown as Markdown tables, including a "Memory Files" table with each loaded `CLAUDE.md` or `AGENTS.md` and its token count (2.1.318) | ✅[^18] |
| `/clear` | Starts a new session; costs nothing; resets the `/usage` totals (v2.1.211+) | ✅[^1] |
| `/compact [focus]` | Replaces history with a summary; the summary request itself reads the whole conversation | ✅[^2] |
| `/autocompact <tokens>` / `auto` | Sets how full the context gets before auto-compaction, saved per model | ✅[^6] |
| `/rewind` | Truncates to an earlier turn (cache-friendly); can also summarize from or up to a message | ✅[^2][^7] |
| `/effort`, `/model` | Change effort level or model; a model change re-reads the whole history uncached | ✅[^2] |
| `/fast` | Fast mode on Opus: up to 2.5× faster, higher price; first enable re-reads the conversation at fast rates | ✅[^11] |
| `/recap` | Summary for display only; keeps the cache | ✅[^2] |
| `/insights` | HTML report on how you work, from up to 200 recent sessions; uses tokens itself | ✅[^1] |
| `/usage-credits` | Manage usage credits beyond plan limits (subscription login only) | ✅[^1] |
| `/subtask <task>` | Starts a fork in the background | ✅[^8] |

### Programmatic and telemetry outputs

| Output | Token and cost data | Status |
|---|---|---|
| `claude -p … --output-format json` | `total_cost_usd`, per-model breakdown, `usage` (incl. `cache_creation` 5m/1h split); on `--resume` the total includes earlier runs | ✅[^5][^2] |
| `--json-schema '<schema>'` | Final answer in `structured_output` | ✅[^5] |
| `--output-format stream-json --verbose --include-partial-messages` | Events as tokens arrive | ✅[^5] |
| `--max-budget-usd <n>` | Stops the run at that estimated spend | ✅[^5] |
| Agent SDK | Messages of one step share an ID: count each ID once; per-step `output_tokens` is a placeholder, read output from the result message | ✅[^12] |
| Status line stdin JSON | `cost.total_cost_usd`, `cost.total_duration_ms`, `cost.total_api_duration_ms`; `context_window.{context_window_size, used_percentage, remaining_percentage, total_input_tokens, current_usage}`; `prompt_cache`; `rate_limits.five_hour` / `seven_day` (`used_percentage`, `resets_at`); `transcript_path` | ✅[^3] |
| OpenTelemetry metrics | `claude_code.token.usage` (`type` = input, output, cacheRead, cacheCreation), `claude_code.cost.usage` (USD), plus session, lines-of-code, commit, PR, active-time counters; attributes include `model`, `effort`, `agent.name`, `skill.name`, `mcp_server.name` | ✅[^4] |
| OpenTelemetry events | `claude_code.api_request` (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `duration_ms`), `claude_code.tool_result` (sizes, duration), `api_error`, `user_prompt` (redacted by default) | ✅[^4] |
| Enable OpenTelemetry | `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_ENDPOINT`; metrics every 60 s, logs every 5 s by default; temporality `delta` by default | ✅[^4] |

### Hooks for per-turn reporting and for guarding subagent launches

| Hook or field | Behaviour | Status |
|---|---|---|
| `Stop` | Runs when the main agent finishes responding; not after a user interrupt; an API error fires `StopFailure` instead | ✅[^15] |
| `Stop` input | The common fields (`session_id`, `transcript_path`, `cwd`, …) plus `stop_hook_active`, `last_assistant_message` (text of the final reply), `background_tasks`, `session_crons` | ✅[^15] |
| Timing at `Stop` | The transcript is not guaranteed to hold the final message on every version: a script that reads it can miss the turn's last request | ✅[^15] |
| `SubagentStop` | Runs when a subagent finishes; input adds `agent_id`, `agent_type`, `agent_transcript_path` (the subagent's own file) | ✅[^15] |
| `systemMessage` (JSON output) | A message shown to the user; hook strings and plain output are capped at 10,000 characters | ✅[^15] |
| Where hooks are set | The `hooks` key of `settings.json`, by event and matcher | ✅[^1] |
| `PreToolUse` on `Agent` | The subagent tool is `Agent` (`tool_input`: `prompt`, `description`, `subagent_type`, optional `model`); a hook with matcher `Agent` can refuse the launch with `hookSpecificOutput.permissionDecision: "deny"` and a reason, or with exit code 2 (stderr becomes the error) | ✅[^15] |
| `SubagentStart` | Runs when a subagent starts (`agent_id`, `agent_type`); it can add context but cannot block the subagent | ✅[^15] |
| `PreToolUse` deny in `claude -p` | A project hook (`--setting-sources project`) with matcher `Agent` denied the launch in a non-interactive run; the agent received the reason verbatim; the input held `tool_name: "Agent"`, `tool_input` {`description`, `prompt`, `subagent_type`} | ✅[^17] |
| `UserPromptSubmit` | Input adds `prompt` (the typed text; a `/command` arrives as typed) and `session_title`; it can block the prompt (`decision: "block"` or exit 2) or add context | ✅[^15] |
| `claude -p --agent <name>` | Runs the prompt as that custom agent (tested with `sdlc-qa`) | ✅[^17] |
| Headless role runs | `claude -p "<launch prompt>" --agent sdlc-<role> --output-format json` returned a `message/v2` reply in `result`; with `--permission-mode acceptEdits --allowedTools "Read Write Edit Glob Grep Bash"` in a git worktree it wrote only there (agentic-sdlc workflow runner, live, 2026-11-03) | ✅[^17] |
| `UserPromptSubmit` in `claude -p` | Runs for the prompt of a non-interactive run too: a project hook recorded the typed text of `claude -p "approve G2 R-001 …"` (agentic-sdlc workflow guard, live test) | ✅[^17] |

### Settings and environment variables that change token use

| Setting / variable | Default | Effect | Status |
|---|---|---|---|
| `promptCacheTtl` / `CLAUDE_CODE_PROMPT_CACHE_TTL` | 1 h on a subscription within plan usage; else 5 m | Cache lifetime of the main conversation (`5m` or `1h`) | ✅[^2] |
| `subagentPromptCacheTtl` / `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` | 5 m | Cache lifetime for subagents, workflows, teammates, compaction, titles | ✅[^2] |
| `FORCE_PROMPT_CACHING_5M`, `ENABLE_PROMPT_CACHING_1H` | unset | Force 5 m for all, or ask 1 h for all | ✅[^2] |
| `DISABLE_PROMPT_CACHING` (and `_HAIKU`, `_SONNET`, `_OPUS`, `_FABLE`) | unset | Turn caching off (debugging only) | ✅[^2] |
| `autoCompactWindow` / `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | the model's context limit; a native 1M-token model compacts at about 967K | Compact at this many tokens (100k–1M), capped at the model's window. `/autocompact <tokens>` saves it per model, `/autocompact auto` restores the tuned default; the variable wins over the command and the setting | ✅[^6][^20] |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | model default | Compact at a lower percentage of the window (cannot raise it) | ✅[^13] |
| `MAX_THINKING_TOKENS` | model default | Thinking budget on fixed-budget models; adaptive models use effort instead | ✅[^1] |
| Effort level (`/effort`, `--effort`) | `medium` on Opus/Sonnet/Haiku 5.5; `high` on most others | `low`…`max` (`xhigh` on newer models): less effort, fewer thinking tokens | ✅[^6] |
| `idleCompaction` | on | Compacts a long idle conversation on the 1 h cache; `false` turns it off | ✅[^2] |
| `modelPricing` (managed settings only) | list price | Makes `/usage`, status line and OTel costs use contracted rates | ✅[^1] |
| `CLAUDE_CODE_SUBAGENT_MODEL` | inherit | One model for every subagent | ✅[^8] |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | 20 | Running subagents before spawning fails | ✅[^8] |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | off | Enables agent teams | ✅[^9] |
| `CLAUDE_CODE_GOAL_CHECKIN_MINUTES`, `crossSessionInbound` | on / deliver | `0` / `hold` stop idle goal check-ins and cross-session messages, which send the full context | ✅[^1] |

### What breaks the prompt cache

| Breaks it (next request re-reads everything after the change) | Keeps it | Status |
|---|---|---|
| Switching model (incl. `opusplan` plan-mode toggles, a skill with another `model`) | Editing repository files (a reminder is appended) | ✅[^2] |
| Changing effort (except Opus/Sonnet/Haiku 5.5 and Fable 5.1 on API key or subscription) | Editing `CLAUDE.md` mid-session (applies only after `/clear`, `/compact` or restart) | ✅[^2] |
| Turning fast mode on or off | Changing permission mode or output style | ✅[^2] |
| Adding or removing MCP tools when tool search is off | Invoking skills and commands, `/recap`, `/rewind` | ✅[^2] |
| Denying a whole tool when tool search is off; compaction; dropping old images; upgrading Claude Code | Spawning a subagent (its own cache); forks read the parent's cache | ✅[^2] |

### Multi-agent and throughput options

| Option | What runs | Token effect | Status |
|---|---|---|---|
| Subagent (Agent tool, `.claude/agents/*.md`) | A worker with its own context; returns a summary | Keeps large reads out of the main context, but its requests add to usage; set `model: haiku` for simple tasks | ✅[^1][^8] |
| Built-in Explore / Plan | Read-only research agents | Start without `CLAUDE.md` and git status, to stay cheap | ✅[^8] |
| Fork (`/subtask`, fork mode) | A subagent that inherits the whole conversation | Reads the parent's cache on its first request | ✅[^8][^2] |
| Background subagents | Subagents that run while you keep working | Same cost; runs in parallel | ✅[^8] |
| Agent teams (experimental) | A lead plus peer sessions with a shared task list and messages | Each teammate is a full instance: about 7× tokens when teammates run in plan mode | ✅[^1][^9] |
| Dynamic workflows | A script Claude writes that runs dozens to hundreds of agents | Intermediate results stay in script variables, not in a context; fan-outs wait up to 5 s so agents share the first one's cache | ✅[^10][^2] |
| Dynamic workflows: control | JavaScript with `agent()`, `pipeline()`, `parallel()`, `phase()`; no mid-run user input (a sign-off between stages needs one workflow per stage); a relaunch in the same session replays saved results; up to 16 concurrent agents by default, 1,000 per run | The script, not Claude, decides what runs next; Claude Code only | ✅[^10] |
| Parallel sessions in the same directory | Separate conversations | Same prefix, so they can share cache; other directories do not | ✅[^2] |
| Fast mode | Same Opus model, faster output | Opus 5.5 at $8 / $40 per million input / output tokens; on subscriptions only through usage credits | ✅[^11] |

### Built-in ways to spend fewer tokens (from the official cost guide)

| Lever | How | Status |
|---|---|---|
| Clear between tasks | `/clear`; `/rename` first, `/resume` later | ✅[^1] |
| Compact with a focus | `/compact Focus on …`, or a `# Compact instructions` section in `CLAUDE.md` | ✅[^1] |
| Right model | Sonnet for most coding, Opus for hard reasoning, `model: haiku` for simple subagents | ✅[^1] |
| Fewer MCP tools | Tool definitions are deferred by default; prefer CLIs such as `gh`; disable unused servers in `/mcp` | ✅[^1] |
| Code intelligence plugins | Go-to-definition instead of grep plus reading many files | ✅[^1] |
| Hooks that filter output | A `PreToolUse` hook rewrites test commands to keep only failures | ✅[^1] |
| Skills instead of a long `CLAUDE.md` | Skills load on demand; keep `CLAUDE.md` under about 200 lines | ✅[^1] |
| Lower effort or thinking | `/effort`, `MAX_THINKING_TOKENS` | ✅[^1] |
| Delegate verbose work | Tests, logs and doc fetches in a subagent | ✅[^1] |
| Specific prompts, plan mode, early `Esc` | Avoid broad scans and wrong paths | ✅[^1] |

## Lookup notes
- **Two kinds of automatic compaction show in the transcripts, both with `trigger: auto`.** In this machine's 11 compactions (2026-10-27 to 2026-11-09, Claude Opus 5.5, no `autoCompactWindow` set), 3 came 1–2 minutes after the previous reply at 966,631–973,626 tokens: the context-limit trigger at about 967K. The other 8 came after pauses of 62–428 minutes, at 215,804–825,912 tokens, which matches idle compaction on the 1-hour cache; the transcript does not say which kind it was, so that reading is an inference ✅[^20]. No command is documented that shows the current compaction point; with nothing set it is the model's default ✅[^20].
- **`@` imports of files outside the project are skipped in `claude -p`.** A project `CLAUDE.md` importing `@/Users/…/file.md` or `@~/…/file.md` loaded only its own lines: `/context` listed the `CLAUDE.md` (98 tokens) but none of the imported files. An import inside the project (`@AGENTS.md`) loaded. Imports in the user's `~/.claude/CLAUDE.md` load as usual (2.1.318) ✅[^18]. The docs say an import in a project `CLAUDE.md` that resolves outside the working directory needs a one-time approval, and stays disabled until approved; print mode shows no dialog ✅[^19]. Block-level HTML comments in a `CLAUDE.md` are stripped before the content reaches the model ✅[^19].
- **`--settings '{"claudeMdExcludes": ["<path to ~/.claude/CLAUDE.md>"]}'` drops the user `CLAUDE.md` and its imports for one run:** the first request fell by 5,672 tokens, the size of the three imported instruction files plus their wrapper (2.1.318) ✅[^18].
- **`--strict-mcp-config` without `--mcp-config` keeps every MCP server out, the claude.ai connectors included.** Without it, `claude -p` sessions connected those connectors in some runs and not others, moving the first request by about 4,000 tokens ✅[^18].
- `/usage`, the status line and OpenTelemetry costs are client-side estimates at list price unless `modelPricing` is set; the Claude Console or the org analytics page is the bill ✅[^1].
- The transcript format is not documented and changes between versions; read token totals from `cost-state`, `/usage` or OpenTelemetry when they must match Claude Code, and use the transcript for per-request detail (see `measure-agent-tokens.md`).
- On subscriptions, `rate_limits` in the status line appears only after the first response, and each window can be absent ✅[^3].
- The Claude desktop app (Code tab, Claude Code 2.1.308) does not run the `statusLine` command: in a new desktop session started with `statusLine` already in `~/.claude/settings.json`, the command never ran, while the `Stop` hook in the same file did. So status-line data, `rate_limits` included, comes only from a terminal session; in the desktop app, `/usage` shows the plan limits ✅[^16].

## Takeaways
- For a team dashboard, use OpenTelemetry (`claude_code.token.usage`, `claude_code.api_request`); for one session, `/usage`; for a script, `--output-format json` with `--max-budget-usd`.
- Choose model, effort and fast mode at the start of a session; each later change costs one full re-read.
- Use subagents to keep verbose output out of the main context, and a cheaper model for them; reserve agent teams for work that truly needs peers.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 95 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — Anthropic, living. Backs: `/usage`, `/insights`, levers, background usage, agent team costs, `modelPricing`. [^1]
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) — Anthropic, living. Backs: cache layers, TTL controls, cache-breaking and cache-keeping actions, compaction cost. [^2]
- [Customize your status line](https://code.claude.com/docs/en/statusline) — Anthropic, living. Backs: status line JSON fields, context formula. [^3]
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage) — Anthropic, living. Backs: metrics, events, environment variables. [^4]
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) — Anthropic, living. Backs: `--output-format json`, `--json-schema`, stream-json, `--max-budget-usd`. [^5]
- [Model configuration](https://code.claude.com/docs/en/model-config) — Anthropic, living. Backs: auto-compact window, effort levels and defaults. [^6]
- [Explore the context window](https://code.claude.com/docs/en/context-window) — Anthropic, living. Backs: what survives compaction, `/rewind` summarize. [^7]
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living. Backs: subagent models, Explore/Plan, forks, background, concurrency limit. [^8]
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) — Anthropic, living. Backs: experimental flag, teammates as full instances. [^9]
- [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows) — Anthropic, living. Backs: script-held orchestration, scale, script functions, no mid-run input, resume by replay, limits. [^10]
- [Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode) — Anthropic, living. Backs: 2.5× speed, Opus 5.5 pricing, usage-credits only. [^11]
- [Track cost and usage (Agent SDK)](https://code.claude.com/docs/en/agent-sdk/cost-tracking) — Anthropic, living. Backs: deduplicate by message ID, placeholder output. [^12]
- [Environment variables](https://code.claude.com/docs/en/env-vars) — Anthropic, living. Backs: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`. [^13]
- [Hooks reference](https://code.claude.com/docs/en/hooks) — Anthropic, living. Backs: `Stop`, `SubagentStop`, `SubagentStart`, `PreToolUse` on `Agent` and its deny output, `systemMessage`, and the timing warning. [^15]
- `~/.claude/projects/*/*.jsonl` — local test, 2026-10-30, Claude Code 2.1.278 and 2.1.308: transcript layout, `cost-state`, `compact_boundary`, placeholder outputs; `claude --version` on `PATH` printed 2.1.129. [^14]
- `~/.claude/turn-tokens/` — local test, 2026-10-31, Claude desktop app with Claude Code 2.1.308: a new session wrote its `Stop`-hook report there but no status-line file. [^16]
- `claude -p` runs (Claude Code 2.1.129 on PATH), local test, 2026-11-03: a `PreToolUse` hook denying `Agent`, the recorded hook input, and `--agent sdlc-qa` (`specs/019-workflow-graph/research.md`, capability spikes); the workflow guard's live check (a denied `Agent` launch, an approval recorded by `UserPromptSubmit` in `-p`, the launch then allowed). [^17]

- Local test, 2026-11-09, Claude Code 2.1.318 (terminal, signed in with a subscription): `claude -p` with `--output-format stream-json --verbose`, `--strict-mcp-config`, `--settings` with `claudeMdExcludes`, and `claude -p "/context"` in test folders whose `CLAUDE.md` imported files inside and outside the project; first-request `usage` compared. Numbers in agent-config `proposals/instruction-loading.md` section 6. [^18]

- [Model configuration](https://code.claude.com/docs/en/model-config) and [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) — Anthropic, living, read 2026-11-10 (the model-config page partly through a summary), with the `compact_boundary` lines of `~/.claude/projects/*/*.jsonl` and the time of the reply before each, Claude Code 2.1.308–2.1.319 — local check, 2026-11-10. Backs: the default point of about 967K for native 1M-token models, `/autocompact` per model and `auto`, the cap at the model's window, the variable's precedence, idle compaction on the 1-hour cache, and the two kinds seen in the transcripts. [^20]
- [Manage Claude's memory](https://code.claude.com/docs/en/memory) — Anthropic, living, read 2026-11-09. Backs: external imports in a project need a one-time approval and stay disabled if declined; user-scope memory files load without it; `claudeMdExcludes` skips files by absolute path or glob; block-level HTML comments are stripped. [^19]

## Related
- `ai-agents/agent-token-accounting.md`
- `ai-agents/measure-agent-tokens.md`
- `ai-agents/codex-usage-reference.md`
- `ai-agents/claude-code-agents-and-skills.md`
- `ai-agents/token-saving-tools.md`
