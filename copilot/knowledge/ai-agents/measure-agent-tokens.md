---
schema: knowledge-doc/v1
type: how-to
topic: ai-agents
status: verified
applies-to: ["Claude Code 2.1.278–2.1.308", "Codex CLI 0.164.0-alpha.11.1", "Python ≥ 3.8", "macOS or Linux"]
last-verified: 2026-10-31
last-updated: 2026-10-31
tags: [tokens, measurement, claude-code, codex, transcripts, jsonl, sqlite]
---

# Measure tokens in a Claude Code or Codex session

## Summary
**TL;DR:** Both tools write every model request's token usage to a local JSON Lines file. Two short Python scripts turn one session file into the numbers worth reporting: requests, peak context, output, cache-hit ratio and the tool's own total. For scripted runs, read the usage straight from `claude -p --output-format json` or `codex exec --json`.
**Use this when:** comparing two runs (for example with and without a code-graph tool), auditing why a session was expensive, or building a report without telemetry.
**Not this doc:** what each number means → `agent-token-accounting.md`; every field and command → `claude-code-usage-reference.md`, `codex-usage-reference.md`; dashboards for a team → OpenTelemetry in those two docs.

## Goal & prerequisites
**End state:** a printed token report for one Claude Code session and one Codex thread, checked against each tool's own counter.

**Needs:**
- `python3` (no extra packages); `jq` and `sqlite3` for the optional one-liners.
- Read access to `~/.claude/projects/` (Claude Code) and `~/.codex/sessions/` (Codex; `CODEX_HOME` if moved).
- Tested with Claude Code 2.1.278 and 2.1.308, and Codex CLI 0.164.0-alpha.11.1 ✅[^1][^2]. The file formats are undocumented, so re-check the Verify step after an upgrade.

## Steps
1. Find the Claude Code session file. The newest transcripts:
   ```bash
   ls -t ~/.claude/projects/*/*.jsonl | head -5
   ```
   Inside a session, the status line JSON also gives it as `transcript_path` ✅[^3].
2. Save this script as `cc_tokens.py`. It counts each API response once (the transcript repeats the usage on every line of one response ✅[^1][^4]) and flags placeholder output from lines written mid-stream ✅[^1]:
   ```python
   #!/usr/bin/env python3
   """Token report for one Claude Code session, read from its local transcript.

   Usage: python3 -I cc_tokens.py <session>.jsonl
   Reads <session>.jsonl plus <session>/subagents/*.jsonl next to it.
   Counts each API response once: the transcript writes one line per content
   block, and every line of one response repeats the same usage object.
   """
   import collections
   import glob
   import json
   import os
   import sys

   FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


   def read(path):
       with open(path, encoding="utf-8") as f:
           for line in f:
               if line.strip():
                   yield json.loads(line)


   def main(path):
       files = [path] + sorted(glob.glob(os.path.join(path[:-6], "subagents", "*.jsonl")))
       seen, calls = set(), []
       last_cost, compactions = None, []
       for f in files:
           who = "main" if f == path else "subagent"
           for e in read(f):
               t = e.get("type")
               if t == "assistant":
                   m = e.get("message") or {}
                   key = (m.get("id"), e.get("requestId"))
                   if key in seen or not m.get("usage") or m.get("model") == "<synthetic>":  # skip locally written stubs
                       continue
                   seen.add(key)
                   u = m["usage"]
                   row = {k: u.get(k) or 0 for k in FIELDS}
                   # No stop_reason = the line was written mid-stream; its output_tokens is a placeholder.
                   row["placeholder_output"] = 0 if m.get("stop_reason") else 1
                   calls.append((who, m.get("model"), row))
               elif t == "cost-state" and f == path:
                   last_cost = e
               elif t == "system" and e.get("subtype") == "compact_boundary" and f == path:
                   compactions.append(e.get("compactMetadata") or {})

       totals = collections.defaultdict(lambda: collections.Counter())
       peak = 0
       for who, model, u in calls:
           totals[(who, model)].update(u)
           totals[(who, model)]["api_calls"] += 1
           context = u["input_tokens"] + u["cache_creation_input_tokens"] + u["cache_read_input_tokens"]
           if who == "main":
               peak = max(peak, context)

       print(f"files read: {len(files)} (1 main + {len(files) - 1} subagent)")
       for (who, model), c in sorted(totals.items()):
           sent = c["input_tokens"] + c["cache_creation_input_tokens"] + c["cache_read_input_tokens"]
           hit = c["cache_read_input_tokens"] / sent if sent else 0
           print(f"{who:8} {model}: calls={c['api_calls']} output={c['output_tokens']:,} "
                 f"input(uncached)={c['input_tokens']:,} cache_write={c['cache_creation_input_tokens']:,} "
                 f"cache_read={c['cache_read_input_tokens']:,} cache_hit={hit:.1%} "
                 f"placeholder_output={c['placeholder_output']}")
       print(f"peak context (main): {peak:,} tokens")
       for c in compactions:
           print(f"compaction: trigger={c.get('trigger')} {c.get('preTokens', 0):,} -> {c.get('postTokens', 0):,} tokens")
       if last_cost:
           print(f"cost-state (Claude Code's own estimate): ${last_cost.get('totalCostUSD', 0):.2f}, "
                 f"API time {last_cost.get('totalAPIDuration', 0) / 1000:.0f}s, "
                 f"tool time {last_cost.get('totalToolDuration', 0) / 1000:.0f}s")
           for model, mu in (last_cost.get("modelUsage") or {}).items():
               print(f"  {model}: output={mu.get('outputTokens', 0):,} cache_read={mu.get('cacheReadInputTokens', 0):,} "
                     f"cost=${mu.get('costUSD', 0):.2f}")


   if __name__ == "__main__":
       main(sys.argv[1])
   ```
3. Run it on the session file:
   ```bash
   python3 -I cc_tokens.py ~/.claude/projects/<project>/<session-id>.jsonl
   ```
4. Find the Codex thread file. The newest rollouts:
   ```bash
   ls -t ~/.codex/sessions/*/*/*/rollout-*.jsonl | head -5
   ```
5. Save this script as `codex_tokens.py`. It never adds cached to input, because OpenAI counts cached tokens inside `input_tokens` ✅[^2]:
   ```python
   #!/usr/bin/env python3
   """Token report for one Codex thread, read from its local rollout file.

   Usage: python3 -I codex_tokens.py ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl
   OpenAI counts cached tokens INSIDE input_tokens, and reasoning tokens INSIDE
   output_tokens, so never add them on top.
   """
   import collections
   import json
   import sys


   def main(path):
       calls, last_info, limits, turns = [], None, None, collections.Counter()
       for line in open(path, encoding="utf-8"):
           if not line.strip():
               continue
           e = json.loads(line)
           t, p = e.get("type"), e.get("payload") or {}
           if t == "token_usage_record":          # one row per model response (newer rollouts)
               calls.append(p.get("usage") or {})
           elif t == "event_msg" and p.get("type") == "token_count":
               last_info = p.get("info") or last_info
               limits = p.get("rate_limits") or limits
           elif t == "event_msg" and p.get("type") in ("task_started", "task_complete"):
               turns[p["type"]] += 1

       print(f"turns: {turns['task_started']} started, {turns['task_complete']} completed")
       if calls:
           inp = sum(c.get("input_tokens", 0) for c in calls)
           cached = sum(c.get("cached_input_tokens", 0) for c in calls)
           out = sum(c.get("output_tokens", 0) for c in calls)
           reasoning = sum(c.get("reasoning_output_tokens", 0) for c in calls)
           peak = max(c.get("input_tokens", 0) for c in calls)
           print(f"model calls: {len(calls)}  input={inp:,} (of which cached {cached:,} = {cached / inp:.1%})  "
                 f"output={out:,} (of which reasoning {reasoning:,})  peak context={peak:,}")
       if last_info:
           tot, last = last_info.get("total_token_usage", {}), last_info.get("last_token_usage", {})
           window = last_info.get("model_context_window") or 0
           used = last.get("input_tokens", 0)
           print(f"thread total (Codex's own counter): input={tot.get('input_tokens', 0):,} "
                 f"cached={tot.get('cached_input_tokens', 0):,} output={tot.get('output_tokens', 0):,}")
           if window:
               print(f"context now: {used:,} / {window:,} ({used / window:.0%})")
       if limits:
           for name in ("primary", "secondary"):
               w = limits.get(name) or {}
               if w:
                   print(f"rate limit {name}: {w.get('used_percent')}% of a {w.get('window_minutes')}-minute window")


   if __name__ == "__main__":
       main(sys.argv[1])
   ```
6. Run it on the rollout file:
   ```bash
   python3 -I codex_tokens.py ~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread-id>.jsonl
   ```
7. For a scripted Claude Code run, read the usage from the result instead of a transcript ✅[^5]:
   ```bash
   claude -p "summarize README.md" --output-format json | jq '{cost: .total_cost_usd, usage: .usage}'
   ```
8. For a scripted Codex run, sum the per-turn usage from the JSON Lines stream ✅[^6]:
   ```bash
   codex exec --json "summarize README.md" | jq -s '[.[] | select(.type=="turn.completed") | .usage] | {input: (map(.input_tokens)|add), cached: (map(.cached_input_tokens)|add), output: (map(.output_tokens)|add)}'
   ```
9. For per-thread Codex totals, query a copy of the state database (the live file is locked while Codex runs) ✅[^2]:
   ```bash
   cp ~/.codex/state_5.sqlite* /tmp/ && sqlite3 /tmp/state_5.sqlite "select id, model, reasoning_effort, tokens_used from threads order by rowid desc limit 10;"
   ```
10. To get these numbers after every turn without running anything, install the turn token report: a `Stop` hook for each tool that applies the same counting rules, shows the turn, its tools and subagents, the session total and the plan limits, and keeps a history in `~/.claude/turn-tokens/` and `~/.codex/turn-tokens/`. Its rules and report format: `copilot/hooks/turn-tokens/turn-tokens.schema.md` in agent-config; setup: that repo's `SETUP.md`, step 12.

## Verify
Expected output shape, from real runs on 2026-10-30 ✅[^1][^2]:

```text
$ python3 -I cc_tokens.py <session>.jsonl
files read: 10 (1 main + 9 subagent)
main     claude-sonnet-5: calls=266 output=217,075 input(uncached)=532 cache_write=2,061,548 cache_read=62,270,818 cache_hit=96.8% placeholder_output=0
subagent claude-sonnet-5: calls=155 output=5,373 input(uncached)=310 cache_write=340,701 cache_read=5,053,293 cache_hit=93.7% placeholder_output=117
peak context (main): 459,251 tokens
compaction: trigger=manual 462,728 -> 16,471 tokens
cost-state (Claude Code's own estimate): $26.60, API time 3889s, tool time 434s
  claude-sonnet-5: output=310,373 cache_read=67,389,171 cost=$26.60

$ python3 -I codex_tokens.py rollout-….jsonl
turns: 3 started, 3 completed
model calls: 54  input=6,600,222 (of which cached 6,493,440 = 98.4%)  output=67,911 (of which reasoning 8,367)  peak context=188,056
thread total (Codex's own counter): input=6,600,222 cached=6,493,440 output=67,911
context now: 188,056 / 258,400 (73%)
rate limit primary: 15.0% of a 300-minute window
```

Checks that prove the numbers are right:
- **Codex:** `model calls … input/cached/output` equals `thread total (Codex's own counter)` exactly. It did in all 4 threads tested ✅[^2].
  *Why a match proves it:* the rollout file holds two kinds of numbers: one record per model call (`token_usage_record`, like single receipts) and Codex's own running total (`total_token_usage`, like the bank statement). The script adds up the receipts and prints the statement next to them. When they agree, no receipt is missing and the adding is right, so a per-turn report can trust the per-call records. In the run above, 54 records added up to input 6,600,222, cached 6,493,440 and output 67,911, the same three numbers as Codex's total ✅[^2].
- **Claude Code, input side:** main + subagent `cache_read` is within about 0.5% of the `cost-state` cache read (67,324,111 vs 67,389,171 above); the gap is compaction and helper requests that are not in the transcript ✅[^1].
- **Claude Code, output side:** when `placeholder_output` is above 0, the transcript under-counts output; report the `cost-state` output instead (310,373 above, against 222,448 in the transcripts) ✅[^1].

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Claude Code totals 2–8× too high in your own script | Counting every transcript line | Count each `message.id` + `requestId` once ✅[^4] |
| Subagent output far too low | Lines written mid-stream carry a placeholder `output_tokens` | Use `cost-state`, `/usage` or OpenTelemetry for output totals ✅[^1] |
| No `cost-state` line | The session did not exit normally, or an older version | Use `/usage` in the session, or OpenTelemetry |
| Codex input twice the context | `cached_input_tokens` added to `input_tokens` | Cached is already inside input ✅[^2] |
| No `token_usage_record` lines | Older Codex rollout format | The script falls back to the last `token_count` total; per-request rows are missing |
| `sqlite3` says `unable to open database file` | The live database is in WAL mode and locked | Query a copy, as in step 9 ✅[^2] |
| A Codex thread's subagent work is missing | Subagents run in their own threads and files | Find child threads in `thread_spawn_edges`, run the script on each ✅[^2] |
| Per-turn numbers, read from a `Stop` hook, miss the turn's last request | The final reply's line can be written after the hook starts (Claude Code, some versions) | Check that the turn's last line has a stop reason such as `end_turn`; if not, wait briefly and read again, or count that request at the start of the next turn ✅[^8] |
| Session file missing | Deleted after `cleanupPeriodDays` (Claude Code, 30 days by default) or run with `--ephemeral` (Codex) | Raise the retention, or measure during the run ✅[^7][^6] |

## Takeaways
- Measure a change (a new tool, a new prompt) by running the same task twice and comparing peak context, output and cache reads from these scripts, not the summed input.
- Cross-check every custom report against the tool's own counter (`cost-state`, the Codex thread total) before trusting it.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 20 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-31

## References
- `~/.claude/projects/*/*.jsonl` — local test, 2026-10-30, Claude Code 2.1.278 and 2.1.308: `cc_tokens.py` run on two sessions; split lines, placeholder outputs, `cost-state` comparison. [^1]
- `~/.codex/sessions/2026/10/*/rollout-*.jsonl`, `~/.codex/state_5.sqlite` — local test, 2026-10-30, Codex CLI 0.164.0-alpha.11.1: `codex_tokens.py` run on 4 threads; sums equal thread totals; locked live database; `thread_spawn_edges`. [^2]
- [Customize your status line](https://code.claude.com/docs/en/statusline) — Anthropic, living. Backs: `transcript_path`. [^3]
- [Track cost and usage (Agent SDK)](https://code.claude.com/docs/en/agent-sdk/cost-tracking) — Anthropic, living. Backs: count each message ID once. [^4]
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) — Anthropic, living. Backs: `--output-format json` with `total_cost_usd` and usage. [^5]
- [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) — OpenAI, living. Backs: `turn.completed.usage`, `--ephemeral`. [^6]
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — Anthropic, living. Backs: `cleanupPeriodDays` default. [^7]
- [Hooks reference](https://code.claude.com/docs/en/hooks) — Anthropic, living. Backs: the transcript may not hold the final message when the `Stop` hook runs. [^8]

## Related
- `ai-agents/agent-token-accounting.md`
- `ai-agents/claude-code-usage-reference.md`
- `ai-agents/codex-usage-reference.md`
- `github-copilot/copilot-cli-internals.md` — the same measurements for GitHub Copilot CLI (legacy, SQLite based)
