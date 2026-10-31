---
schema: knowledge-doc/v1
type: concept
topic: ai-agents
status: verified
applies-to: ["Claude Code 2.1.278–2.1.308", "Codex CLI 0.164 (ChatGPT desktop app)", "docs read 2026-10-30"]
last-verified: 2026-10-31
last-updated: 2026-10-31
tags: [tokens, prompt-caching, compaction, claude-code, codex, cost, multi-agent]
---

# Token accounting in coding agents (Claude Code and Codex)

## Summary
**TL;DR:** A coding agent sends one model request per step, and every request carries the whole conversation again. Prompt caching makes the repeated part cheap, but it is still counted, so "tokens used" can mean three different numbers: the size of one request (the context), the sum over all requests (mostly cache reads), and the output. Claude Code reports input *without* the cached part; Codex reports input *with* the cached part inside it.
**Use this when:** reading token numbers from `/usage`, `/status`, a transcript or telemetry; comparing two runs; explaining why a long session uses up a plan's limits.
**Not this doc:** exact commands, fields and settings → `claude-code-usage-reference.md`, `codex-usage-reference.md`; scripts that compute the numbers → `measure-agent-tokens.md`; tools that cut tokens → `token-saving-tools.md`; GitHub Copilot CLI → `../github-copilot/copilot-cli-internals.md` (legacy).

## Problem
Three numbers, all called "tokens", can differ by a factor of 100 for the same work. One real Codex thread showed 6,668,133 "tokens used", while its context was 188,056 tokens and its output was 67,911 tokens ✅[^7]. Adding up input over all requests counts the same history again and again. In Claude Code, `input_tokens` can read `2` for a request that sent 80,393 tokens, because cached tokens sit in other fields ✅[^3]. Reports built on the wrong number make a cheap run look expensive, or hide the part that really costs.

## Mental model
**Analogy:** a reader who must re-read a growing binder before writing each new page. Every step, the agent hands the model the whole binder plus one new page. The prompt cache is a bookmark: pages read in the last few minutes are skimmed at about a tenth of the price, but if any early page changes (other tools, another model), everything after that page must be read in full again.

**Artifact:** the usage object of one request, as each tool writes it to disk (real values, trimmed):

```jsonc
// Claude Code — ~/.claude/projects/<project>/<session>.jsonl, one assistant line
"usage": {
  "input_tokens": 2,                      // NOT cached: only the new part
  "cache_creation_input_tokens": 37995,   // written to the cache by this request
  "cache_read_input_tokens": 42396,       // read from the cache
  "output_tokens": 461,                   // includes thinking
  "output_tokens_details": { "thinking_tokens": 60 }
}
// context of this request = 2 + 37,995 + 42,396 = 80,393

// Codex — ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl, one token_usage_record
"usage": {
  "input_tokens": 30694,                  // ALL input; the cached part is inside
  "cached_input_tokens": 23168,
  "output_tokens": 120,                   // includes reasoning
  "reasoning_output_tokens": 0,
  "total_tokens": 30814                   // = input + output
}
// context of this request = 30,694 (uncached part = 7,526)
```

### Words this doc uses

| Term | Plain meaning | Like | Real example |
|---|---|---|---|
| Request (model call) | One message the agent sends to the model, and the reply it gets back | One question to a consultant who forgets you after every answer | One Claude Code session made 1,407 requests in a day ✅[^8] |
| Turn | Everything between your message and the agent's final answer; usually many requests | One errand with many stops | One Codex thread: 3 turns, 54 requests ✅[^7] |
| Session / thread | One whole conversation. Claude Code says *session*, Codex says *thread* | One meeting | A thread's id is the last part of its file name |
| Transcript (Claude Code) | The log file Claude Code writes for each session, line by line, while it happens: your messages, the model's replies, tool calls, token counts | Meeting notes written during the meeting | `~/.claude/projects/<folder>/<session-id>.jsonl` ✅[^8] |
| Rollout file (Codex) | Codex's log file for each thread, with the same kind of content | The same meeting notes, another note-taker | `~/.codex/sessions/2026/10/29/rollout-<time>-<thread-id>.jsonl` ✅[^7] |
| Context | Everything sent in one request: instructions, tool list, history and the new message | The binder handed over each time | 188,056 tokens at the end of the Codex thread ✅[^7] |
| Prompt cache | The provider's short memory of the start of recent requests; a start it has seen recently is billed at about a tenth | A copy shop's discount for pages it copied minutes ago | `cached_input_tokens: 23168` |
| Subagent | A helper agent the main agent starts for a side task, with its own context and its own log file | Sending an assistant to search the archive | `<session-id>/subagents/agent-<id>.jsonl` ✅[^8] |
| Placeholder | A starting value written before the real one is known | Writing "to be decided" in a form field | `output_tokens: 1` next to `stop_reason: null` ✅[^10] |
| Hook | A script the tool runs at a fixed moment, such as the end of a turn | A doorbell wired to switch on a light | The `Stop` hook in Claude Code and in Codex ✅[^11][^12] |

## How it works
**4 actors:**
- **You** — your job: start a turn, via a prompt in the terminal, IDE or desktop app.
- **The harness** (Claude Code or Codex) — its job: build each request and run tools, via the Messages API (Anthropic) or the Responses API (OpenAI).
- **The model API** — its job: process the request and report usage, via the `usage` object of each response.
- **The prompt cache** — its job: reuse the already-processed start of a request, via an exact prefix match on the server.

```
[You]        [Harness — local]                          ║  [Model API + cache — remote]
prompt ──▶ build request 1: system + tools + memory      ║
           files (CLAUDE.md / AGENTS.md) + prompt  ─────╫──▶ prefix new → processed in full
                                                         ║    usage: cache write / uncached input
           ◀──────────── tool call ──────────────────────╫─── output
           run tool locally (shell, read, MCP)           ║
           build request 2 = request 1 + output + result ╫──▶ prefix of request 1 matches → cache read
           ... repeat until the model answers ...        ║    only the new tail is processed
           context nears the limit → compaction request ─╫──▶ summary replaces history
           next request has a new, short prefix ─────────╫──▶ cache rebuilt for the summary only
```

1. **Harness (local):** builds the first request in a fixed order: system prompt and tool definitions first, then project memory (`CLAUDE.md` or `AGENTS.md`), then the conversation ✅[^2][^1].
2. **Harness → API (network):** sends the whole request; the API keeps no conversation state between calls. Codex does not use `previous_response_id`, to stay stateless and support zero data retention ✅[^1].
3. **API (remote):** looks for a cached prefix. A hit is billed at the cached rate; a miss writes the prefix to the cache ✅[^2]. Claude Code sets a 1-hour cache lifetime for the main conversation on a subscription within plan limits, otherwise 5 minutes ✅[^2].
4. **API → harness (network):** returns the output and a `usage` object. Anthropic reports uncached input, cache writes and cache reads in separate fields ✅[^3]; OpenAI reports cached tokens as part of `input_tokens` and reasoning as part of `output_tokens` ✅[^7].
5. **Harness (local):** runs any tool call, appends the output and the result to the conversation, and goes back to step 2. One user turn is therefore many requests, each a little longer than the last ✅[^1].
6. **Harness (local → network):** when the context nears its limit, it sends one extra request that summarizes the history, then continues from the summary. Claude Code records each compaction with the token count before and after ✅[^8]; Codex calls the `/responses/compact` endpoint, which returns an encrypted compaction item ✅[^1].

**Counting rules that follow from this:**

| Question | Claude Code (Anthropic usage) | Codex (OpenAI usage) |
|---|---|---|
| How big was one request (its context)? | `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` ✅[^3] | `input_tokens` ✅[^7] |
| How much new input was processed? | `input_tokens + cache_creation_input_tokens` | `input_tokens − cached_input_tokens` |
| How much did the model write? | sum of `output_tokens` (thinking included) ✅[^5] | sum of `output_tokens` (reasoning included) ✅[^7] |
| Largest context in a run | maximum of the per-request context, not the last one | same |
| "Tokens used" shown by the tool | dollar estimate in `/usage` at list price ✅[^5] | `total_tokens` = input + output, summed per thread ✅[^7] |

### Cached tokens sit inside Codex's input: one call, right and wrong
In Codex, the cached tokens are *part of* `input_tokens`, both in the count and in what is paid, only at a lower price. A receipt that says "10 items, 7 of them on discount" means 10 items bought, not 17. One real call ✅[^7]:

| Field | Value | Meaning |
|---|---|---|
| `input_tokens` | 30,694 | Everything sent in this call |
| `cached_input_tokens` | 23,168 | The part of those 30,694 that came from the cache |
| New (not cached) | 7,526 | 30,694 − 23,168 |

*Counting it twice* means writing 30,694 + 23,168 = 53,862: the 23,168 are then counted once inside the 30,694 and once more on top. In credits at GPT-6 Astra's rates (250 / 25 / 1,250 per million new input / cached / output tokens ✅[^4]):

```
right: 7,526 × 250 + 23,168 × 25 + 120 × 1,250   (per million) = 1.88 + 0.58 + 0.15 = 2.61 credits
wrong: 30,694 × 250 + 23,168 × 25 + 120 × 1,250  (per million) = 7.67 + 0.58 + 0.15 = 8.40 credits  (about 3× too high)
```

Claude Code is the other way round: its `input_tokens` is only the new part and the cached part sits in separate fields, so there the three must be added (2 + 37,995 + 42,396 = 80,393 tokens sent) ✅[^3].

### When the final numbers reach the file
Both log files are written *while* the reply is produced, so a reader can open the file at a moment when a number is not final yet. Two such moments matter.

**A placeholder, written before the reply ends.** The model writes its reply a piece at a time ("streaming"). The first piece already carries a token count, but only a starting value; the final count comes with the last piece ✅[^10]:

1. **API → Claude Code (network):** the first piece (`message_start`) of a subagent's reply: `"stop_reason": null, "usage": {"output_tokens": 1}`. `stop_reason: null` means the reply has no reason to stop yet: it is still going.
2. **Claude Code → subagent transcript (local):** writes a line with that starting value.
3. **API → Claude Code (network):** the last piece (`message_delta`): `"stop_reason": "tool_use"` and the final, cumulative `"output_tokens": 89`.
4. **The file (local):** keeps the starting value on that line, so adding up such lines gives too little output.

In one session (Claude Code 2.1.278), 117 of 155 subagent replies had `stop_reason: null`, and their files showed 5,373 output tokens in total. Claude Code's own total was 310,373, of which the main conversation had 217,075 ✅[^8]. The main transcripts tested had final values: in one session only 2 of 1,407 replies had no stop reason ✅[^8].

**A read that comes before the last write.** Claude Code can run a script when a turn ends (a `Stop` hook) and passes it the transcript's path. Its docs warn that at that moment the transcript is not guaranteed to hold the final message on every version ✅[^11]:

1. **Model → Claude Code (network):** the final reply of the turn arrives.
2. **Claude Code (local):** starts the `Stop` hook with `transcript_path` in its input.
3. **Hook script (local):** reads the transcript.
4. **Claude Code (local):** writes the final reply's line, on some versions only after step 3.

A per-turn report read at step 3 can therefore miss the last request of the turn, like asking for the bill while the waiter is still adding the last dish. A reader of the file has to check that the turn's last line has a stop reason such as `end_turn`, wait and read again if not, or count that request at the start of the next turn. Codex passes `transcript_path` to its hooks too, and warns that the transcript format "isn't a stable interface for hooks" ✅[^12].

**Several agents:** each subagent or teammate runs its own conversation, with its own context and cache, and its requests add to the same bill ✅[^2]. Anthropic measured that agents use about 4× the tokens of a chat and multi-agent systems about 15× ✅[^6]; Claude Code's own docs put agent teams in plan mode at about 7× a normal session ✅[^5].

## Worked example
One real Codex thread from the local test: 3 user turns, model GPT-6 Astra, on a ChatGPT Plus plan ✅[^7].

| Step | Value | How it was read |
|---|---|---|
| Model requests | 54 | `token_usage_record` lines in the rollout file |
| Sum of `input_tokens` | 6,600,222 | the per-request rows, added up |
| … of which cached | 6,493,440 (98.4%) | sum of `cached_input_tokens` |
| Sum of `output_tokens` | 67,911 (reasoning 8,367) | sum of `output_tokens`, `reasoning_output_tokens` |
| Thread total shown by Codex | 6,668,133 | `threads.tokens_used` in `~/.codex/state_5.sqlite` = 6,600,222 + 67,911 |
| Context at the end | 188,056 of 258,400 (73%) | `last_token_usage.input_tokens`, `model_context_window` |

What it would cost in credits at GPT-6 Astra's Standard rates (250 / 25 / 1,250 credits per million input / cached / output tokens ✅[^4]):

```
uncached input  (6,600,222 − 6,493,440) =   106,782 × 250   / 1M =  26.70   (10%)
cached input                              6,493,440 × 25    / 1M = 162.34   (59%)
output                                       67,911 × 1,250 / 1M =  84.89   (31%)
                                                           total ≈ 273.92 credits
```

The cached reads cost only a tenth per token, yet they are 59% of the total, because the same history was read 54 times: there were about 60× more cached tokens (6,493,440) than new ones (106,782). It is like a copy shop that charges 10 cents a page, or 1 cent for a page it copied a few minutes ago: bring the same binder 54 times with a few new pages each time, and the cheap old pages still make most of the bill. That is the main reason a long session uses up a limit faster than its visible activity suggests ✅[^5].

The same shape in a one-day Claude Code session (Opus, 1,407 requests): 2,920 uncached input tokens, 4.8 million cache writes, 541 million cache reads (99.1% hit ratio), 1.66 million output tokens, a peak context of 962,130 tokens, and 7 automatic compactions, the largest from 966,631 down to 28,425 tokens ✅[^8].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Summing input over all requests | A number many times the real context (1.6M for a 196k context in the Copilot CLI doc) | The history is re-sent with every request ✅[^1] |
| Claude Code `input_tokens` is 2 | Looks like nothing was sent | Cached tokens are in `cache_read_input_tokens` and `cache_creation_input_tokens` ✅[^3] |
| Adding `cached_input_tokens` to Codex `input_tokens` | Counts the cached part twice | It is already inside `input_tokens`: `total_tokens` = input + output ✅[^7] |
| Several transcript lines carry the same Claude Code usage | Totals 2–8× too high | The transcript writes one line per content block and repeats the usage; count each `message.id` + `requestId` once ✅[^8][^9] |
| Claude Code subagent transcript, line with no `stop_reason` | `output_tokens` of 1–4 | The line was written while the response was still streaming: a placeholder. In one 2.1.278 session, 117 of 155 subagent responses had one ✅[^8] |
| A compaction happened mid-run | The last request is smaller than the peak | The summary replaced the history; use the maximum, not the last value ✅[^8] |
| Model, effort, fast mode or tool set changed mid-session | One slow turn that re-reads everything | Each model and speed has its own cache; tools sit in the cached prefix ✅[^2][^1] |
| First message after a long break | Full context written to the cache again | The cache lifetime (5 minutes or 1 hour) ran out ✅[^2] |
| Claude Code `/usage` cost on a subscription | A dollar figure you are not billed | It is an estimate at list price; plans bill against usage limits ✅[^5] |
| A `Stop` hook reads the transcript to report the turn | The turn's last request can be missing | The final reply's line may be written after the hook starts ✅[^11] |
| Requests that are not in the main transcript | Claude Code's own total is a few percent higher than the transcript sum | Compaction, titles, prompt suggestions and helper-model calls are counted in `cost-state` only ✅[^8] |

## Trade-offs
| Number to report | Gains | Costs |
|---|---|---|
| Output tokens (sum) | Additive and stable; shows how much the model wrote | Says nothing about context cost |
| Peak context | Shows how close the run came to compaction | One request only |
| Cache-hit ratio (cache read ÷ all input) | Shows whether the prefix stayed stable | High even in a wasteful long session |
| Processed tokens (sum of all input) | Matches what limits and credits are charged on | Grows with the square of the session length; misleading as "content" |
| Tool's own cost or limit % (`/usage`, `/status`) | Closest to the bill | An estimate (Claude Code) or a plan percentage (Codex) |

## Takeaways
- Report per run: requests, peak context, output tokens, cache-hit ratio, and the tool's own cost or limit percentage. Never report summed input as "content size". [rule-candidate]
- Pick the model, effort level and MCP servers at the start of a session; changing them mid-task throws away the cache.
- Clear or compact at task boundaries: every later request pays to re-read what stays in the context.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 51 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-31

## References
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) — OpenAI (Michael Bolin), 2026. Backs: How it works 1, 2, 5, 6; cache-miss causes. [^1]
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) — Anthropic, living. Backs: request layers, prefix match, cache lifetime, invalidating actions, subagent caches. [^2]
- [Customize your status line](https://code.claude.com/docs/en/statusline) — Anthropic, living. Backs: context = input + cache writes + cache reads; `input_tokens` excludes the cache. [^3]
- [Pricing](https://learn.chatgpt.com/docs/pricing) (Codex docs) — OpenAI, living. Backs: credit rates per million input, cached and output tokens; no cache-write charge. [^4]
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — Anthropic, living. Backs: thinking billed as output, `/usage` estimate, agent teams ~7×, why usage climbs in long sessions. [^5]
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic, 2025. Backs: agents ~4× and multi-agent ~15× chat tokens. [^6]
- `~/.codex/sessions/2026/10/*/rollout-*.jsonl` and `~/.codex/state_5.sqlite` — local test, 2026-10-30, Codex CLI 0.164.0-alpha.11.1: in 4 rollouts, `total_tokens` = input + output, the per-request sums equal Codex's own thread total exactly, and `threads.tokens_used` equals that total. [^7]
- `~/.claude/projects/*/<session>.jsonl` and `<session>/subagents/*.jsonl` — local test, 2026-10-30, Claude Code 2.1.278 and 2.1.308: usage repeated on split lines, placeholder outputs in subagent transcripts, `cost-state` and `compact_boundary` records; deduplicated cache reads came within 0.5% of `cost-state`. [^8]
- [Track cost and usage (Agent SDK)](https://code.claude.com/docs/en/agent-sdk/cost-tracking) — Anthropic, living. Backs: messages of one step share an ID; count each ID once. [^9]
- [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) — Anthropic, living. Backs: `message_start` carries a starting `output_tokens` and `stop_reason: null`; `message_delta` carries the final, cumulative count and the stop reason. [^10]
- [Hooks reference](https://code.claude.com/docs/en/hooks) — Anthropic, living. Backs: `Stop` hook input (`transcript_path`), and the warning that the transcript may not hold the final message at `Stop` time. [^11]
- [Hooks](https://learn.chatgpt.com/docs/hooks) — OpenAI, living. Backs: Codex hooks get `transcript_path`; the transcript format is not a stable interface for hooks. [^12]
- `../github-copilot/copilot-cli-internals.md` — the GitHub Copilot CLI counterpart (legacy), source of the 1.6M-vs-196k example.

## Related
- `ai-agents/claude-code-usage-reference.md`
- `ai-agents/codex-usage-reference.md`
- `ai-agents/measure-agent-tokens.md`
- `ai-agents/token-saving-tools.md`
- `ai-agents/context-engineering-deep-dive.md`
