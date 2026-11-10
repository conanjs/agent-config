---
schema: knowledge-doc/v1
type: how-to
topic: ai-agents
status: verified
applies-to: ["agent-config efficiency-audit.mjs (efficiency-audit/v1)", "Claude Code 2.1.308–2.1.318", "Codex CLI and ChatGPT desktop app 0.164–0.166", "GitHub Copilot CLI 1.0.100–1.0.107", "Node.js ≥ 18", "macOS or Linux"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [tokens, efficiency, audit, claude-code, codex, copilot, prompt-caching, instructions]
---

# Audit agent sessions for token waste

## Summary
**TL;DR:** `copilot/efficiency-audit/efficiency-audit.mjs` in agent-config reads the session logs Claude Code, Codex and GitHub Copilot already write on this machine. It finds ten patterns that waste tokens: one file per request, needless instruction and reference reads, huge tool output, repeated reads, cache rebuilds, huge contexts, costly subagents, long hunts for short answers, and noisy searches. It reports them per session and per week, with trends. It is read-only, needs no network, and calls no model. Run `week` once a week; act on what is flagged by recording it in the knowledge base or the tracker.
**Use this when:** checking whether a change to the instructions or the setup really saved tokens, finding out why a week cost more than usual, or looking for the next waste to fix.
**Not this doc:** one session's raw numbers → `measure-agent-tokens.md`; what the numbers mean → `agent-token-accounting.md`; the rules and the report format → agent-config `copilot/efficiency-audit/efficiency-audit.schema.md`; the design and its decisions → agent-config `proposals/efficiency-auditor.md`.

## Goal & prerequisites
**End state:** a weekly report for all three agents, a history of detector rates that shows trends, and the flagged findings turned into dated knowledge rows or tracker items.

**Analogy:** the turn token report is the till receipt after each round. The auditor is the accountant who reads a week of receipts and order slips and says "you paid for the same dish three times on Tuesday, and the oven was reheated from cold eleven times".

**Needs:**
- Node.js 18 or later, and the agent-config repo (the tool imports its price table from `copilot/hooks/turn-tokens/prices.mjs`).
- Read access to `~/.claude/projects/`, `~/.codex/sessions/` and `~/.copilot/session-state/` (or the folders `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `COPILOT_HOME` name).
- Optionally, the turn token history in each folder's `turn-tokens/` (installed with the turn token report), for EA-8.

**Words:**

| Term | Plain meaning | Example |
|---|---|---|
| Request | One call to the model and its reply; every request re-sends the whole conversation | A turn that reads 3 files one by one makes at least 4 requests |
| Cache rebuild | A request that writes most of its context to the prompt cache again, because the cache expired or something early in the context changed | Coming back to a 700,000-token Copilot session after 8 minutes |
| Detector | One pattern the tool checks, with a threshold | EA-1: 3 or more single-file reads in a row |
| Flagged | A detector whose rate this week is above twice the median of earlier weeks, with at least 5 findings | Copilot EA-6a in the week of 2026-11-09 |
| Scripted session | A session started by a script (`codex exec`, or any session in a temporary folder); listed apart and never counted | The measurement runs of 2026-11-09 |

## Steps
1. Check that the triggers the tool knows still match the core instructions:
   ```bash
   node copilot/efficiency-audit/efficiency-audit.mjs check-triggers
   ```
   It prints `PASS: 4 triggers named in core.instructions.md`. When a trigger in `copilot/instructions/core.instructions.md` is reworded, update `copilot/efficiency-audit/triggers.json` with it.
2. The first time, fill the history with the earlier weeks the logs still hold, oldest first, so each week is compared with the weeks before it:
   ```bash
   for w in 2026-10-26 2026-11-02; do node copilot/efficiency-audit/efficiency-audit.mjs week --week $w > /dev/null; done
   ```
3. Each week, run the report for the week (by default, the week holding today; weeks run Monday to Sunday, UTC):
   ```bash
   node copilot/efficiency-audit/efficiency-audit.mjs week
   ```
4. Read the flagged lines and the `top:` lines. To see one session in full, take its id from a `top:` line:
   ```bash
   node copilot/efficiency-audit/efficiency-audit.mjs session ddf8c8e7
   ```
5. Act on what was flagged:
   - **A fact about a tool or an instruction:** the report prints a `Suggested records` line naming the knowledge doc. Add it there as a dated row or note with its numbers and the command as the source, then run the `review-docs` skill.
   - **Work to do:** the report prints `tracker.mjs --add` commands (at most 3). To add them to a repo's `TRACKER.md`, run the report again with `--tracker <repo folder>`; a title already in that tracker is skipped.
6. For scripts or a dashboard, add `--json` to `week` or `session`.

## Verify
Expected output shape, from the real logs on 2026-11-10 ✅[^1]. The numbers of a week still in progress grow while its sessions run:

```text
$ node copilot/efficiency-audit/efficiency-audit.mjs week --week 2026-11-09
Efficiency audit · week of 2026-11-09 (Monday) to 2026-11-15
Claude Code · 3 sessions · 24 turns · 527 requests · ≈ $65.64 at list price
  EA-3  reference read with its trigger false: 1 finding · 4.17 per 100 turns · ≈ $0.173 · median of the last 2 weeks 2.97
  …
Copilot · 1 session · 11 turns · 328 requests · 8,153.2 AI credits
  EA-6a cache rebuilt after a pause: 16 findings · 145.45 per 100 turns · 3,877.9 AI credits · median of the last 2 weeks 67.95 · flagged
  …
  scripted: 16 sessions, 16 turns (not counted)
Suggested records (write them, then run review-docs):
  copilot/knowledge/ai-agents/copilot-usage-reference.md: week of 2026-11-09, Copilot: EA-6a …
```

Checks that the numbers are right:
- **Copilot costs are exact.** They are the sum of Copilot's own `copilotUsage.totalNanoAiu` per call, which adds up exactly to Copilot's own checkpoint (`copilot-usage-reference.md`). Claude Code costs are list-price estimates from `prices.mjs`; Codex costs are credits at Standard rates.
- **Every number in the test fixture was worked out by hand**, and 17 scenarios in agent-config `tests/efficiency-audit/efficiency-audit.feature` check them ✅[^2].
- **A history line per tool and detector** is in `~/.copilot/efficiency-audit/history.jsonl` after each `week` run, zero findings included.

What the first three weeks showed (interactive sessions only) ✅[^1]:

| Week of | Claude Code EA-1 (one file per request) | Copilot EA-6a (cache rebuilt after a pause) |
|---|---|---|
| 2026-10-26 | 9 findings in 121 turns, ≈ $2.43 | 18 findings in 23 turns, 2,807.0 AI credits |
| 2026-11-02 | 4 in 58 turns, ≈ $1.45 | 68 in 118 turns, 11,445.9 AI credits |
| 2026-11-09 (to 2026-11-10) | 0 in 24 turns | 16 in 11 turns, 3,877.9 AI credits (flagged) |

- **EA-1 fell to zero** in the week the core instructions gained the batching line (IW-13, deployed 2026-11-09). Two days and 24 turns are too few to call it a result: keep watching the weekly rate.
- **Copilot's cache rebuilds stay the largest waste.** Across the three weeks they cost 18,130.8 AI credits ($181.31). The cause and the habit that cuts it are in `copilot-usage-reference.md`.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| A detector drops to zero right after an agent upgrade | The log format changed and a reader no longer recognizes a field | Check the `skipped:` line and a known session with `session <id>`; update the reader and its scenario |
| `check-triggers` fails | A trigger in `core.instructions.md` was reworded or moved | Update `triggers.json`, then re-run step 1 |
| A week shows "no sessions this week" for an old week | Claude Code deletes transcripts after `cleanupPeriodDays`, 30 days by default (`measure-agent-tokens.md`, Troubleshooting) | The history keeps that week's counts once it has been run; run `week` every week |
| Many EA-5 findings in one long session | Re-reading after a file changed through the shell in a way the tool cannot follow | The tool forgets earlier reads after an edit, a compaction or a command that may change files (`sed -i`, a redirect, `git checkout`, a package manager); read the findings before acting |
| `session <id>` says the id matches several sessions | Two logs start with the same characters | Give more of the id, or the log's path |

## Takeaways
- Measure a change to the instructions by its weekly detector rate before and after the date it was deployed, not by one run.
- Before a break in a long Copilot session, finish or compact: a pause of more than about 5 minutes makes the next request rewrite the whole context to the cache.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- Local run, 2026-11-10 — `efficiency-audit.mjs week` for the weeks of 2026-10-26, 2026-11-02 and 2026-11-09 over this machine's logs (Claude Code 2.1.308–2.1.318, Codex 0.164–0.166, Copilot CLI and VS Code runtime 1.0.100–1.0.107): the report shape, the history lines and the weekly numbers in the table. [^1]
- agent-config `tests/efficiency-audit/efficiency-audit.feature` and its fixture — 17 scenarios, run by `scripts/check-docs.sh`, all passing on 2026-11-10. [^2]

## Related
- `ai-agents/measure-agent-tokens.md` — the numbers for one session.
- `ai-agents/agent-token-accounting.md` — why each extra request re-sends the whole context.
- `ai-agents/instruction-wording-findings.md` — where findings about instruction wordings are recorded.
- `ai-agents/copilot-usage-reference.md` — Copilot's cache lifetime and the cost of rebuilds.
