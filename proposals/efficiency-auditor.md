# Proposal: Efficiency auditor — find token waste in real agent sessions

**Status:** Draft (2026-11-10). Nothing is built. V answers the decisions in section 12; phase 2 builds only what they approve.

**Scope:** Claude Code (terminal and desktop app), GitHub Copilot (CLI and the Copilot agent in VS Code, which share one log format) and Codex (CLI and the ChatGPT desktop app). The auditor reads the logs these tools already write on this machine.

## 1. The question this document answers

> The instructions were rebuilt on 2026-11-09 from measurements of test runs. How do we keep finding what wastes tokens in V's **real** sessions, across all three agents, so the instructions and setup keep improving, without spending model tokens to do it?

**Analogy:** the turn token report (`copilot/hooks/turn-tokens/`) is a till receipt after each round: it says what was spent. The auditor is the accountant who reads a week of receipts and the kitchen's order slips, and says "you paid for the same dish three times on Tuesday, and the oven was reheated from cold eleven times".

**Words used here:**

| Term | Plain meaning | Example |
|---|---|---|
| Request (model call) | One message the agent sends to the model and the reply it gets back. Every request re-sends the whole conversation | A turn that reads 8 files one by one makes at least 9 requests |
| Turn | Everything between one user message and the agent's final answer | "Fix the failing test" and all the steps until the answer |
| Context | Everything sent in one request; its size in tokens | 966,414 tokens in the largest Claude Code request found |
| Prompt cache | The provider's short memory of the start of recent requests; a cached start is billed at about a tenth, but writing it costs more than plain input | Copilot's log gives each call a `cacheExpiresAt`, a median of 4.9 minutes after the call |
| Cache rebuild | A request whose context is mostly written to the cache again instead of read from it, because the cache expired or something early in the context changed | Coming back to a 600,000-token Copilot session after 10 minutes |
| Detector | One rule the auditor checks, with a signal, a threshold and a fix | EA-1: three or more single-file reads in a row |
| Finding | One place a detector fired, with its evidence | "Claude Code session 1923722f, turn 12: 9 requests in a row each read one file" |
| Scripted session | A session started by a script (`claude -p`, `codex exec`, `copilot -p`), such as the measurement runs of 2026-11-09 | 93 of the 104 Claude Code sessions on disk |

## 2. What exists, and what is missing

| Exists | What it gives | What it cannot do |
|---|---|---|
| Turn token report (`turn-tokens.mjs`, schema `turn-tokens/v1`) | Per turn: requests, peak context, cache writes and reads, output, cost, tool names, subagent totals; history in `~/.{claude,codex,copilot}/turn-tokens/<session>.jsonl` | No file paths, no per-request rows, no tool output sizes: it cannot say *why* a turn was expensive |
| `measure-agent-tokens.md` scripts | Totals for one session | One session at a time; no patterns |
| Vendor views: Claude Code `/usage`, `/context`, `/insights`; Codex `/status`; Copilot `/context`, `/usage` | Totals, limits, some attribution | One tool each; no cross-tool view; nothing about instruction-driven reads |
| ccusage and similar (`token-saving-tools.md`) | Daily and session cost reports | Counts only; no detectors |

Missing: a **diagnosis** (which pattern wasted what, where), a **trend** (is it getting better after a change), and a **path back** into the instructions (knowledge doc rows and tracker items).

## 3. Prototype results (read-only, 2026-11-10)

Before designing, a throwaway script (no dependencies, no network, no model calls) read every local log and checked candidate detectors. It ran in 3.3 seconds. Its numbers are the basis for the thresholds below.

**Data on disk:**

| Source | Amount | Dates |
|---|---|---|
| Claude Code transcripts `~/.claude/projects/**/<session>.jsonl` | 104 sessions with requests (11 interactive, 93 scripted), 3,781 requests; 16 subagent files | to 2026-11-10; Claude Code keeps 30 days by default |
| Codex rollouts `~/.codex/sessions/**/rollout-*.jsonl` | 20 main threads, 487 requests (subagent threads excluded) | to 2026-11-09 |
| Copilot logs `~/.copilot/session-state/*/events.jsonl` | 44 sessions with requests, 2,172 requests; models: Claude Opus 5.5 (1,477), Claude Sonnet 5.5 (532), `gpt-6.1-sol` (163) | 2026-10-26 to 2026-11-09 |
| Turn token history `~/.{claude,codex,copilot}/turn-tokens/*.jsonl` | 162 Claude Code turns (97 sessions), 35 Codex turns (20), 134 Copilot turns (54) | 2026-10-31 to 2026-11-10 |

**From the history alone:**

| | Claude Code | Codex | Copilot |
|---|---:|---:|---:|
| Requests per turn: median / 90th percentile / largest | 4 / 32 / 125 | 4 / 35 / 85 | 5 / 29 / 110 |
| Largest peak context | 966,414 | 451,657 | 782,595 |
| Turns with peak context above 200,000 | 60 | 4 | 69 |
| Turns where subagents cost more than the main agent | 2 | 3 | 0 (not split in the history) |
| Cost per turn: median / 90th percentile / largest | $0.25 / $5.13 / $20.14 (list-price estimate) | 6.7 / 40.1 / 184.8 credits | 63.9 / 628.8 / 1,431.7 AI credits |

**What the detectors found in the raw logs** (interactive sessions; scripted runs apart):

| Detector (section 5) | Claude Code (11 sessions, 205 turns) | Codex (20, 58) | Copilot (44, 173) |
|---|---|---|---|
| EA-1 one file per request | 71 runs, 216 extra requests, 84.6 M context tokens re-sent | 4 runs, 12 extra, 0.9 M | 22 runs, 58 extra, 20.3 M |
| EA-2 instruction files read at session start | 0 (95 in scripted runs, which tested exactly this) | 4 reads in 2 sessions (the old pointer, before 2026-11-09) | 7 reads in 6 sessions (mostly `global-variables.md`) |
| EA-3 reference read with its condition false | 2 in 1 session | 6 in 5 sessions | 0 |
| EA-4 tool output above 40,000 characters | 5 in 3 sessions (largest: a 58,170-character deep dive read whole, twice) | 8 in 3 sessions (largest 53,383) | 0 |
| EA-5 same file read in full twice, no edit between | 479 in 8 sessions | 77 in 4 | 168 in 8 |
| EA-6a cache rebuilt after a pause | 28 rebuilds, 8.7 M tokens written, median pause 295 min | 4, 0.7 M uncached, median pause 1,285 min | **101 rebuilds costing 17,950 of 37,586 AI credits (47.8%)** |
| EA-6b cache rebuilt without a pause | 11, 1.3 M tokens written | 2 | 11, 3.5 M tokens written |
| EA-7 turns above 200,000 context / above 80% of the window / compactions | 137 / 16 / 11 | 7 / 3 / 1 | 99 / 3 / 4 |
| EA-9 10+ requests, final answer under 600 characters | 2 (both were work turns: false positives) | 0 | 1 (a work turn) |
| EA-10 unscoped search with output above 20,000 characters | 0 | 8 in 3 sessions (267,210 characters) | 0 |

How to read the biggest numbers:
- **EA-1, Claude Code.** In 71 places, 3 or more requests in a row each read exactly one file. Each request after the first re-sent the whole context: 84.6 million tokens in all. At Claude Opus 5.5's cache-read list price ($0.20 per million, `prices.mjs`), that is about $16.90. It is an upper bound: a read whose path comes from the previous read's content cannot be batched (IW-13). The largest single run: session `1923722f`, turn 12 (2026-11-09), 9 requests re-sending 4.08 M tokens.
- **EA-6a, Copilot.** Copilot's prompt cache lives about 5 minutes: each logged call carries `cacheExpiresAt`, a median of 4.9 minutes after the call was logged (2,128 calls; range 3.5 to 30). A pause longer than that makes the next request write the whole context to the cache again, at the cache-write price (Claude Opus 5.5: 500 AI credits per million tokens, against 20 for a cache read). The 101 such requests cost 17,950 AI credits ($179.50), 47.8% of every Copilot credit on disk. By length of pause: 5–15 minutes 8,576 credits, 15–60 minutes 5,755, over an hour 3,619. The costs come from Copilot's own per-call `copilotUsage.totalNanoAiu`, so they are exact, not estimates; the cause (an expired cache) is inferred from the timing and the write size.
- **EA-5** counts are high and probably overcounted: the prototype did not yet reset after a compaction, when re-reading is legitimate because the summary dropped the content.
- **EA-9** as defined found only turns that did real work with a short closing message. It needs a "no edits" condition before it is useful (D3).

## 4. Inputs and the common model

The auditor turns each tool's log into one shape, then runs every detector on that shape. Each detector is written once.

```
Session { tool, id, project folder, scripted?, models, window }
  └─ Turn { index, time, prompt (kept in memory only), compactions }
       └─ Request { time, context, new input, cache write, cache read, output, cost?, cacheExpiresAt? }
            └─ ToolCall { name, read paths, partial read?, edited paths, unscoped search?, output characters }
```

| Field | Claude Code transcript | Codex rollout | Copilot `events.jsonl` |
|---|---|---|---|
| Turn starts | `user` line that is not a tool result, not `isMeta`, not a compaction summary, not `<local-command…>` (TT-2) | `response_item` user `message` that is not environment or instruction text | `user.message` (TT-13) |
| Request | `assistant` line, counted once per `message.id` + `requestId`; `<synthetic>` skipped (TT-2) | `token_usage_record` (TT-3) | `session.usage_record` (TT-13) |
| Context, cache write, cache read | `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`; the two cache fields (TT-5) | `input_tokens`; no write; `cached_input_tokens` (TT-5) | `inputTokens`, `cacheWriteTokens`, `cacheReadTokens` (TT-13) |
| Cost | from `prices.mjs` (TT-9) | from `prices.mjs` (TT-9) | `copilotUsage.totalNanoAiu` ÷ 10⁹ (TT-15) |
| Window | model's window (1,000,000 for Claude Opus 5.5) | `token_count.info.model_context_window` | `maxPromptTokens` |
| Tool call | `tool_use` block: `name`, `input` | `function_call` / `custom_tool_call`: `name`, `namespace`, `arguments` or `input` | `tool.execution_start`: `toolName`, `arguments` |
| Read paths | `Read.file_path` (partial when `offset`/`limit`); `Bash.command` parsed for `cat`, `head`, `tail`, `nl`, `sed -n` | shell commands in `exec_command` arguments, or the `cmd:` strings inside a code-mode `exec` script (one `exec` can hold several reads: a batch) | `view.path` (partial when `view_range`); `bash.command` parsed as for Claude Code |
| Edited paths | `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | `apply_patch` file headers | `edit`, `create`, `str_replace` |
| Tool output size | `tool_result.content` in the next `user` line, by `tool_use_id` | `*_call_output.output`, by `call_id` | `tool.execution_complete.result`, by `toolCallId` |
| Compaction | `system` `compact_boundary` (`preTokens`, `postTokens`) | `compacted` line | `session.compaction_start` (`currentTokens`, `tokenLimit`) |
| Subagents | `<session>/subagents/*.jsonl` (TT-7) | child rollouts whose `session_meta.source.subagent.thread_spawn.parent_thread_id` names the thread (seen 2026-11-10) | usage records with `initiator: "sub-agent"` (44 of 2,172 calls on disk; the others are `agent` or `user`) |
| Scripted? | project folder under a temporary or scratch folder (seen); `entrypoint` field (to confirm in phase 2) | `session_meta.originator` and `source` (`Codex Desktop` / `vscode` seen; the `codex exec` values to confirm in phase 2) | to confirm in phase 2 |

The turn token history is read too, for what it already summarizes (cost per turn, subagent split) and to cover sessions whose raw logs were deleted.

The formats are undocumented and change with versions (`codex-usage-reference.md`, `agent-token-accounting.md`). A log line the auditor does not recognize is counted as "skipped" in the report, never guessed at.

## 5. Detector catalog

Thresholds are the starting values, chosen from section 3; each lives in one table at the top of the tool and changes only together with its scenario.

| Id | Pattern | Signal | Threshold | Evidence it reports | Fix it points to | Source of the pattern |
|---|---|---|---|---|---|---|
| EA-1 | One file per request, where the reads could have been batched | Consecutive requests in one turn, each with exactly one tool call that reads one file. A read whose path appeared in the previous tool output is *dependent* and ends the run | 3 or more in a row | Session, turn, the paths, extra requests (run − 1), context tokens re-sent, their cache-read cost | The batching line (IW-13, D14 of `instruction-loading.md`); if one agent keeps doing it, test a stronger wording and add the result to `instruction-wording-findings.md` | IW-13; `instruction-loading.md` 6.4 |
| EA-2 | Instruction files read with a tool at session start | A read, in the first 3 requests of the first turn, of a file the agent already loads by itself: `~/.copilot/instructions/*`, `AGENTS.md`, `CLAUDE.md`, `core.instructions.md` | 1 read | Session, the paths, the context of the request that followed | The pointer must go (D2 of `instruction-loading.md`); after 2026-11-09 any hit is a regression | IW-6; `instruction-loading.md` section 5 |
| EA-3 | A reference read although its trigger did not hold | A read of a file named by a core trigger, in a turn where the trigger's visible condition is false. Checked triggers (D5): `answer-patterns.md` needs a non-default `pattern:` tag or a deep-dive phrase; `code-review-graph.md` needs code-review-graph tools in the session; `global-variables.md` needs `{{` in the prompt or a file read before it; `companies/<x>/index.md` needs a known company repo or name. Triggers that need judgment ("a reply that reports work") are not checked | 1 read | Session, turn, the file, the trigger, why it was false, the cost of the extra request | Reword the trigger to something visible (IW-7 → IW-12) | IW-7, IW-12 |
| EA-4 | Very large tool output | Output of one tool call | above 40,000 characters (about 10,000 tokens) | Tool, path or the first 80 characters of the command, size, context after it | Read a range, search first, split the doc, or filter output (`token-saving-tools.md`: RTK, a `PreToolUse` filter) | `token-saving-tools.md` |
| EA-5 | The same file read in full twice | A full read of a path already read in full in this session, with no edit of it and no compaction in between | 3 or more in one session | Session, the files and how often, tokens re-added (output size × repeats) | Keep the first read's facts in the answer or plan; read only the needed range | New (prototype) |
| EA-6a | Cache rebuilt after a pause | A request (not the session's first) with context above 50,000 whose cache write is above half its context (Codex: cached part below half), after a pause longer than the cache lifetime: Copilot `cacheExpiresAt` of the previous call, else 5 minutes; Claude Code 1 hour for the main conversation on a subscription, 5 minutes otherwise | 1 rebuild | Session, pause length, tokens rewritten, cost; weekly share of the tool's cost | Before a pause, `/compact` or finish the task; start a new session for a new task; in Copilot, keep long sessions small or expect each return to cost a full rewrite | New (prototype); cache lifetimes in `agent-token-accounting.md` |
| EA-6b | Cache rebuilt mid-session without a pause | Same signal, pause shorter than the lifetime | 1 rebuild | Session, turn, what changed just before (model, MCP tools, compaction), tokens rewritten | Pick model, effort and MCP servers at session start (`agent-token-accounting.md`, Takeaways) | `agent-token-accounting.md`, Edge cases |
| EA-7 | Peak context near the window, or compaction | Peak context of a turn; compaction events | above 200,000, or above 80% of the window; any compaction | Turn, peak, window, compaction before and after sizes | Clear or compact at task boundaries; one session per task | `agent-token-accounting.md` |
| EA-8 | Subagent cost dominates a turn | History: `thisTurnSubagents.cost` above `thisTurn.cost` | 1 turn | Turn, both costs, subagent tool names | Was the delegation needed; a cheaper subagent model (`claude-code-usage-reference.md`, `codex-usage-reference.md`) | `turn-tokens` TT-7 |
| EA-9 | Many requests for a short answer (experimental) | A turn with many requests, no file edit, and a short final answer | 10 or more requests, final answer under 600 characters | Turn, requests, tools used | Answer from what is known; ask one focused question instead of exploring | `instruction-loading.md` section 6 ("A explored for 8 calls once") |
| EA-10 | Noisy repo-wide search | A search (`rg`, `grep -r`, `find`, `Grep` without a path, glob or type) | output above 20,000 characters | The command, output size | Scope the search; ignore generated folders (T-44: an `.rgignore` for the atlas map) | `instruction-loading.md` IW-14; T-44 |

**Outlier flags** (not detectors; they mark a session for a closer look): a turn whose cost is above the tool's 90th percentile in the history (today $5.13, 40.1 credits, 628.8 AI credits), or whose requests are above the 90th percentile (32, 35, 29).

## 6. Reports

Two reports, the same for all three tools, printed as text (default) or JSON (`--json`).

**Per session** (`efficiency-audit.mjs session <id or path>`). The numbers are the prototype's, for V's largest Copilot session:

```text
Copilot session ddf8c8e7 · started 2026-11-03 · 51 turns · 1,030 requests · 24,889.3 AI credits
  EA-6a cache rebuilt after a pause: 54 times, 12,460.3 AI credits (50.1%); pauses 5 min to 70 h
  EA-1  one file per request: 12 runs, 33 extra requests, 13.8 M tokens re-sent
  EA-7  peak 782,595 of 968,000 (81%); 2 compactions
  Outliers: turn 47 (29 requests, 1,431.7 AI credits)
```

**Per week** (`efficiency-audit.mjs week [--week 2026-11-09]`, weeks start on Monday): one block per tool, one line per detector with the count, the cost it points to, the rate per 100 turns, and the change from the previous 4 weeks; then the top 5 findings by cost, and the suggested records and tracker items (section 8).

Scripted sessions are listed on one separate line per tool and kept out of the totals (D2).

## 7. Learning over time

1. **History of detector results.** Each weekly run appends one line per tool and detector to a local history: week, turns, count, cost, rate per 100 turns, tool versions seen. Counts and costs only; no paths, no text (D6).
2. **Trends.** The weekly report compares each rate with the median of the previous 4 weeks. A change in the instructions has a date, so its effect shows as a step: for example, EA-1 before and after the batching line of 2026-11-09, or EA-2 for Codex before and after D2.
3. **Outlier flags.** A detector rate more than 2× its 4-week median, with at least 5 findings, is flagged. A first week has no baseline and flags nothing.
4. **Proposing new detectors (optional, D10).** For flagged outliers, the tool can write a bundle of numbers, tool names and file paths (never prompts or file contents) and ask a cheap model to propose new detector rules: `codex exec -m gpt-6-luna` or `copilot -p --model gpt-5.4-mini`, never Claude Code or a premium model. The proposals go into a draft file for V to approve; nothing is added to the catalog without V and a scenario.

## 8. Where findings go

| Finding | Goes to | How |
|---|---|---|
| A pattern seen across sessions that changes a fact about a tool (for example EA-6a: Copilot's 5-minute cache and its share of credits) | The matching knowledge doc: `copilot-usage-reference.md`, `claude-code-usage-reference.md`, `codex-usage-reference.md`, or `agent-token-accounting.md` (Edge cases) | The report prints a suggested dated row with its numbers and source; the agent writes it and runs `review-docs` (D7) |
| Evidence that an instruction wording works or fails in real use (EA-1, EA-2, EA-3) | `instruction-wording-findings.md`, as a new row or a dated note on the existing row ("observed in real sessions") | Same |
| Work to do (reword a trigger, split a large doc, add a filter hook) | `TRACKER.md` | The report prints `node copilot/tracker/tracker.mjs --add "<title>" --next "<step>"`; with `--tracker` it runs them, at most 3 per run, never the same detector and week twice (D8) |
| How to run the auditor | A new how-to `copilot/knowledge/ai-agents/audit-agent-efficiency.md`, and one step in `measure-agent-tokens.md` pointing to it (D11) | Written in phase 2 |

## 9. How it runs

| Option | Cost | When it fits |
|---|---|---|
| (a) On demand: `node copilot/efficiency-audit/efficiency-audit.mjs week` | None until run | First weeks, while thresholds settle |
| (b) A weekly macOS `launchd` job that writes the weekly report to a file | No model tokens; one system setting | Once the report is trusted |
| (c) A session-start hook that prints a summary | Adds text to every session's context (the tracker hook already costs 1,245 tokens, OS-1) | Not recommended |
| (d) Part of the `Stop` hook | Runs after every turn | Not needed: the turn report already covers one turn |

## 10. Cost and privacy

- **No model tokens**, except the optional step in section 7.4, which uses a cheap model through Codex or Copilot only.
- **Read-only** on the agents' logs. It writes only its own history file and, when asked, tracker items.
- **No network.** The tool imports no network module; a scenario checks the source for that.
- **What it prints:** tool names, counts, sizes, costs, session ids, file paths (with `~` for the home folder) and the first 80 characters of a command. Never prompt text, answer text or file contents. Prompt text is used in memory only, to check triggers (EA-3).
- **What it reads:** the logs hold whole conversations, and Claude Code transcripts hold full request bodies (`api-request` lines). The tool reads line by line and keeps only the fields in section 4.
- **Speed:** the prototype read all logs (about 840 MB of folders, of which the logs are a part) in 3.3 seconds.

## 11. Tests

As for the tracker and the turn token report: Cucumber scenarios in `tests/efficiency-audit/efficiency-audit.feature`, a `tool.mjs` that runs the tool on a fixture copy with the three home folders pointed inside it (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`) and a fixed "now", and `fixtures/base/` with small hand-made logs: one session per tool built to trigger each detector exactly once, and one clean session per tool that triggers none. Every number is worked out by hand. The rules get ids `EA-1` … in `copilot/efficiency-audit/efficiency-audit.schema.md`, and every id must be named by a scenario (TST-14), as in `tests/turn-tokens/tool.mjs`. Extra scenarios: an unknown log line is counted as skipped; scripted sessions stay out of totals; no network import; the weekly history line; tracker commands printed but not run without `--tracker`.

## 12. Decisions

| # | Question | Options | Recommended | V's answer | Lands in |
|---|---|---|---|---|---|
| D1 | Which inputs | (a) Raw logs plus the turn token history. (b) History only | (a): the history has no paths or per-request rows, so EA-1 to EA-6 and EA-10 need the raw logs | | `efficiency-audit.schema.md` (input rules) |
| D2 | Scripted sessions (`claude -p`, `codex exec`, `copilot -p`, temporary folders) | (a) Listed apart, kept out of totals and trends. (b) Included. (c) Ignored | (a): 93 of 104 Claude Code sessions are measurement runs that read instruction files on purpose | | Schema rule |
| D3 | Detectors in the first build | (a) EA-1 to EA-8 and EA-10 on; EA-9 only with the "no edits" condition and marked experimental. (b) All on as in section 3 | (a): EA-9 found only false positives as first defined | | Schema rules EA-1 … EA-10 |
| D4 | Thresholds | (a) The values in section 5, in one table in the tool, changed only with their scenario. (b) A config file V edits | (a); a config file can come later if values change often | | The tool and its schema |
| D5 | How EA-3 knows the triggers | (a) A small hand-kept trigger table beside the tool, with a scenario that checks each named file still appears in `core.instructions.md`. (b) Parse the core's prose | (a): prose parsing breaks on rewording | | `copilot/efficiency-audit/triggers.json` |
| D6 | Where the weekly history lives | (a) `~/.copilot/efficiency-audit/history.jsonl`, local, counts only. (b) Committed in the repo | (a): it is derived from private logs; what is worth keeping becomes a dated knowledge row (section 8) | | Schema rule; `SETUP.md` |
| D7 | Knowledge docs | (a) The report prints suggested rows; the agent writes them and runs `review-docs`. (b) The tool edits the docs | (a): the knowledge validator and `review-docs` apply to every change there | | Schema rule; the how-to |
| D8 | Tracker items | (a) Print the `--add` commands; run them only with `--tracker`, at most 3 per run, deduplicated by detector and week. (b) Always add | (a) | | Schema rule |
| D9 | How it runs | (a) On demand now; (b) a weekly `launchd` job later, if V wants it. (c) A session-start hook | (a), with (b) offered after 2–3 weeks; not (c) | | The how-to; `SETUP.md` if (b) |
| D10 | Cheap-model suggestions of new detectors | (a) Later: build `--suggest` once 3 weeks of history exist, with Codex `gpt-6-luna` or Copilot `gpt-5.4-mini` on a counts-and-paths bundle. (b) Build now. (c) Never | (a): with one week of history there are no trends to explain | | `TRACKER.md` item, then the tool |
| D11 | Where usage is documented | (a) New how-to `ai-agents/audit-agent-efficiency.md`, plus a step in `measure-agent-tokens.md`. (b) A section in `measure-agent-tokens.md` only | (a): that doc is about one session's numbers; the auditor is a separate workflow | | `copilot/knowledge/ai-agents/` |
| D12 | Where the tool lives | (a) `copilot/efficiency-audit/` (`efficiency-audit.mjs`, `.schema.md`, `triggers.json`), like `copilot/tracker/`. (b) Inside `copilot/hooks/turn-tokens/` | (a): it is not a hook; it can reuse the turn token report's log readers by import | | The atlas (`atlas.mjs --write`) |
| D13 | Act on the Copilot cache finding now (47.8% of AI credits in rebuilds after a pause)? The fact itself is already recorded in `copilot-usage-reference.md` (2026-11-10), as the knowledge rules require | (a) Track a follow-up now: test a habit or setting that cuts it (compact before a break, one session per task) and measure it. (b) Wait for the auditor | (a): it is the largest waste found and needs no tool to act on | | `TRACKER.md` |

## References

**Local artifacts:**
- `copilot/hooks/turn-tokens/turn-tokens.schema.md`, `turn-tokens.mjs`, `prices.mjs`: the history format, the per-tool counting rules (TT-2 … TT-16) and the prices.
- `copilot/knowledge/ai-agents/instruction-wording-findings.md`: IW-1 … IW-13.
- `proposals/instruction-loading.md`: sections 5 and 6, D1 … D14.
- `copilot/knowledge/ai-agents/agent-token-accounting.md`, `measure-agent-tokens.md`, `claude-code-usage-reference.md`, `codex-usage-reference.md`, `copilot-usage-reference.md`, `token-saving-tools.md`: the log formats and counting rules.
- `copilot/tracker/tracker.mjs`, `tests/turn-tokens/`: the shape of a tool and its scenarios.
- The prototype: a throwaway script run on 2026-11-10 over the local logs listed in section 3; not committed. Phase 2 rebuilds it as the tool, with scenarios.

**External authoritative sources:**
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching): cache lifetimes (1 hour for the main conversation on a subscription within limits, otherwise 5 minutes).
- [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals): 1 AI credit = $0.01.
- [Hooks](https://learn.chatgpt.com/docs/hooks): the Codex transcript format is not a stable interface.

## Related

- `proposals/README.md`: the proposal lifecycle and where each decision lands.
- `TRACKER.md` T-42 (tracker hook and skill list size) and T-44 (search noise from the atlas map): two fixes this auditor can measure.
