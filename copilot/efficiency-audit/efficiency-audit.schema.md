---
schema: schema/v1
last-updated: 2026-11-10
---

# Schema: Efficiency audit (`efficiency-audit/v1`)

**Applies to:** the reports `efficiency-audit.mjs` prints and the weekly history it keeps · **Written by:** `copilot/efficiency-audit/efficiency-audit.mjs` · **Read by:** V, and the agent that turns findings into knowledge rows and tracker items

The auditor reads the session logs that Claude Code, Codex and GitHub Copilot already write on this machine, finds patterns that waste tokens, and reports them per session and per week. It is read-only on those logs, uses no network and calls no model. The design and the numbers behind each threshold are in `proposals/efficiency-auditor.md` (approved 2026-11-10).

Analogy: the turn token report is the till receipt after each round; the auditor is the accountant who reads a week of receipts and order slips and says "you paid for the same dish three times on Tuesday, and the oven was reheated from cold eleven times".

## The reports

```text
$ node copilot/efficiency-audit/efficiency-audit.mjs session ddf8c8e7
Copilot session ddf8c8e7 · started 2026-11-03 · 51 turns · 1,030 requests · 24,889.3 AI credits
  EA-6a cache rebuilt after a pause: 55 findings · 12,641.2 AI credits
        turn 2: after a 9-minute pause, 256,065 tokens written to the cache again
        …
        fix: before a break, finish or compact; start a new session for a new task

$ node copilot/efficiency-audit/efficiency-audit.mjs week --week 2026-11-02
Efficiency audit · week of 2026-11-02 (Monday) to 2026-11-08
Claude Code · 7 sessions · 58 turns · 1,287 requests · ≈ $220.87 at list price
  EA-1  one file per request: 4 findings · 6.9 per 100 turns · ≈ $1.45 · median of the last 1 week 7.44
  …
Suggested records (write them, then run review-docs):
Tracker (run with --tracker <repo folder> to add):
```

| Word | Meaning |
|---|---|
| request | One call to the model and its reply; every request re-sends the whole conversation |
| turn | Everything between one user message and the agent's final answer |
| context | Everything sent in one request, in tokens |
| finding | One place a detector fired, with its evidence and, where it has one, its cost |
| cost | The requests a finding points to: Copilot's own `copilotUsage.totalNanoAiu` (exact); Claude Code at list price from `prices.mjs` (an estimate, standard speed); Codex credits at Standard rates (2× for a fast tier) |
| per 100 turns | Findings ÷ the tool's turns that week × 100; can exceed 100 when a turn has several findings |
| scripted | A session started by a script: listed apart, never counted (AU-2) |

## The history record

`$COPILOT_HOME/efficiency-audit/history.jsonl` (default `~/.copilot/efficiency-audit/history.jsonl`), one line per week, tool and detector:

```json
{"schema":"efficiency-audit/v1","week":"2026-11-02","tool":"claude","detector":"EA-1","turns":58,"findings":4,"rate":6.9,"cost":1.450635,"unit":"usd","baseline":7.44,"baselineWeeks":1,"flagged":false}
```

## Rules

### Detectors

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| EA-1 | **One file per request.** 3 or more requests in a row in one turn, each with exactly one tool call that reads exactly one file (a Codex `exec` holding several commands is a batch, not a single read). A read whose file name appears in the previous read's output is *dependent* and starts a new run. Evidence: the run's length, extra requests (length − 1), the context they re-sent, their cost, the file names | — | scenarios |
| EA-2 | **Instruction file read at session start.** In the first 3 requests of the first turn, a read of a file the agent loads by itself: `~/.copilot/instructions/*`, `core.instructions.md`, `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, or `AGENTS.md` / `CLAUDE.md` in the session's working folder. Cost: the request after the read | — | scenarios |
| EA-3 | **Reference read with its trigger false.** A read of a file listed in `triggers.json`, in a turn where its condition does not hold: `pattern-tag-or-deep-dive` (the message starts with a `pattern:` tag other than `default`, or has a deep-dive phrase), `graph-tools` (a code-review-graph tool was used in the session), `placeholder` (`{{` in the message or in an earlier tool output of the turn), `words` (one of the words in the message or the working folder). Cost: the request after the read | the check of `graph-tools` uses "used", because the logs do not list the tools a session had | scenarios |
| EA-4 | **Very large tool output.** One tool call's output above 40,000 characters (about 10,000 tokens). Evidence: the tool, the size, the file or the first 80 characters of the command | — | scenarios |
| EA-5 | **Same file read in full again.** A full read (no range, not piped, `cat`/`nl`/`less` or a read tool without offset) of a file already read in full in the session, with no edit of it, no shell command that may change files (`sed -i`, a redirect, `git checkout`, a package manager, …) and no compaction in between. Reported only when a session has 3 or more | — | scenarios |
| EA-6a | **Cache rebuilt after a pause.** A request, not the session's first and not the first after a compaction, with context above 50,000, whose cache write is above half its context (Codex: whose cached part is below half), that comes after the cache expired: Copilot's `cacheExpiresAt` of the previous request when the log has it, else a pause longer than 60 minutes (Claude Code) or 5 minutes (Codex, Copilot). Cost: that request | — | scenarios |
| EA-6b | **Cache rebuilt without a pause.** The same signal as EA-6a, before the cache expired. Cost: that request | — | scenarios |
| EA-7 | **Large context or compaction.** A turn whose largest context is above 200,000 tokens (marked "near the window" above 80% of the window), or that had a compaction. One finding per turn. Window: Copilot `maxPromptTokens`; Codex `model_context_window`; Claude Code 1,000,000 for Claude Opus or Sonnet 5 models and `[1m]` models, else 200,000 | — | scenarios |
| EA-8 | **Subagents cost more than the main agent**, from the turn token history (`turn-tokens/v1`): `thisTurnSubagents.cost` above `thisTurn.cost`, with at least one subagent call | — | scenarios |
| EA-9 | **Many requests for a short answer (experimental).** A turn with 10 or more requests, no file edited and no file-changing shell command, and a final answer under 600 characters | — | scenarios |
| EA-10 | **Large unscoped search.** A search (`rg`, `grep -r`, `find`, or a Grep / Glob tool) with no glob, type, include or path, whose output is above 20,000 characters | — | scenarios |

### The tool

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| AU-1 | **Inputs.** Claude Code: `projects/**/<session>.jsonl` in `$CLAUDE_CONFIG_DIR` or `~/.claude` (subagent files are not sessions). Codex: `sessions/**/rollout-*.jsonl` in `$CODEX_HOME` or `~/.codex` (subagent threads are not sessions). Copilot: `session-state/*/events.jsonl` in `$COPILOT_HOME` or `~/.copilot` (sub-agent calls are not counted). The turn token history in each folder's `turn-tokens/`. Turns, requests and tool calls follow TT-2, TT-3, TT-5, TT-13 and TT-14 of `turn-tokens.schema.md`. A line that is not JSON, or a file that cannot be read, is counted as skipped and named in the report; nothing is guessed | — | scenarios |
| AU-2 | **Scripted sessions** — a Codex rollout with `originator: codex_exec`, or a session whose working folder is under `/tmp`, `/private/tmp`, `/var/folders` or the system temporary folder — are listed apart in the weekly report ("scripted: N sessions, M turns (not counted)") and kept out of every count, rate and history line. The session report marks them "(scripted)" | — | scenarios |
| AU-3 | **`session <id, id prefix or log path> [--json]`** prints one session: tool, id, start date, turns, requests, cost; then per detector the count, the cost, up to 3 findings with their turn, and the fix; then the turn outliers (AU-6). An id that matches no session or several sessions exits 2 with a message | — | scenarios |
| AU-4 | **`week [--week <date>] [--json]`** reports the Monday-to-Sunday week (UTC) holding the date, by default the week holding "now". A turn belongs to the week its first message was sent in; a finding to the week of its turn. Per tool: sessions, turns, requests, cost; one line per detector with findings (count, rate per 100 turns, cost, the median of up to 4 earlier weeks in the history, "flagged"); the 3 costliest findings; the turn outliers; the scripted line | — | scenarios |
| AU-5 | **History.** Every `week` run writes one `efficiency-audit/v1` line per tool with turns that week and per detector, zero findings included, to `$COPILOT_HOME/efficiency-audit/history.jsonl`, replacing that week's earlier lines. Counts, rates and costs only: no paths, no text | — | scenarios |
| AU-6 | **Flags and outliers.** A detector is flagged when it has at least 5 findings and its rate is above 2× the median of its earlier weeks (at least one earlier week needed). A turn is an outlier when its cost or its request count is above the 90th percentile of that tool's interactive turns on disk (at least 10 turns needed) | — | scenarios |
| AU-7 | **Records and tracker items.** For each flagged detector, and for any EA-2 finding (a regression since 2026-11-09), the week report prints a suggested dated record naming the knowledge doc it belongs in, and, for at most 3 of them, the `node copilot/tracker/tracker.mjs --add "<title>" --next "<step>"` command. It never edits a knowledge doc. With `--tracker <repo folder>` it runs those commands in that folder, skipping a title already in its `TRACKER.md` | — | scenarios |
| AU-8 | **Privacy and cost.** The tool prints tool names, counts, sizes, costs, session ids, file paths (`~` for the home folder) and at most the first 80 characters of a command; never message text, answer text or file contents. It writes only its history file and, with `--tracker`, tracker items. It imports no network module and calls no model | — | scenarios |
| AU-9 | **`--json`** prints the same report as one JSON object (`schema: efficiency-audit/v1`, `kind: session` or `week`), findings with their `evidence` text | — | scenarios |
| AU-10 | **`check-triggers`** checks that the `core` text of every entry in `triggers.json` appears in `copilot/instructions/core.instructions.md`; exit 0 and "PASS" when all do, else exit 1 with one `fail AU-10` line per missing entry | — | scenarios |

## Lookup notes

- The thresholds are a table at the top of `efficiency-audit.mjs`. Change one only together with its scenario and this table.
- The log formats are undocumented and change with versions (`copilot/knowledge/ai-agents/codex-usage-reference.md`). After an upgrade, a sudden drop to zero findings, or many skipped lines, is the first sign that a reader needs updating.
- Trends need history: run `week --week <date>` once for each earlier week to fill it (oldest first, so each week's median sees the weeks before it).
- Raw logs age out: Claude Code deletes transcripts after `cleanupPeriodDays` (30 days by default). The history keeps the counts.

## Checks

| Check | Tool |
|---|---|
| EA-1 … EA-10, AU-1 … AU-10 | `tests/efficiency-audit/efficiency-audit.feature`, run by `scripts/check-docs.sh` |

## References

**Local artifacts:**
- `proposals/efficiency-auditor.md` — the design, the prototype numbers and the decisions D1–D13.
- `copilot/hooks/turn-tokens/turn-tokens.schema.md`, `prices.mjs` — the counting rules and the prices reused here.
- `copilot/knowledge/ai-agents/audit-agent-efficiency.md` — how to run it and act on the report.

**External authoritative sources:**
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) — cache lifetimes behind EA-6a.
- [Usage-based billing for individuals](https://docs.github.com/copilot/concepts/billing/usage-based-billing-for-individuals) — 1 AI credit = $0.01.

## Related

- `copilot/tracker/tracker.schema.md` — where AU-7's items go.
