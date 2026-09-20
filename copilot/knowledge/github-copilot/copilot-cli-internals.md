---
title: Copilot CLI Internals — Knowledge Reference
description: Explains LLM API calls, token counting, context compaction, billing (AIC/AIU), and recommended metrics for performance measurement in Copilot CLI sessions.
author: GitHub Copilot CLI (claude-sonnet-4.6)
created: 2026-07-22T14:52:42+07:00
updated: 2026-07-23T20:10:37+07:00
---

# Copilot CLI Session Metrics — Knowledge Reference

## 1. What is an LLM API Call?

An **LLM API Call** is a real HTTP request sent over the internet to Anthropic's servers (e.g., Claude Sonnet). Every time Copilot needs to "think" — decide on next steps, process tool results, or generate a response — it makes one of these calls.

### When does it trigger?

- When you send a message → Copilot calls the API to begin processing
- After **every tool execution** (bash, view, grep, MCP tool, etc.) → Copilot calls the API again to decide what to do with the result

So **one user turn = multiple API calls**, one per tool use plus the final response.

### Example flow (1 user question → 17 API calls)

```
User: "Analyse service request submit"
    ↓
API Call 1  → decide to call tool_search_tool
    ↓ tool runs, result returned
API Call 2  → decide to call semantic_search_nodes
    ↓ tool runs, result returned
API Call 3  → decide to call query_graph_tool
    ↓ tool runs, result returned
API Call 4  → decide to call query_graph_tool again
    ↓ tool runs, result returned
API Call 5  → decide to call get_review_context_tool
    ↓ tool runs, returns 651KB of graph data
API Call 6  → decide to call view (read service file)
    ↓ file content returned
...
API Call 17 → write final analysis to file, done
```

Total: **17 API calls** for 1 user question.

---

## 2. Why Input Tokens Are Tricky (Context Window Is Stateless)

The LLM API is **stateless** — Anthropic's server has no memory between calls. Every API call must re-send the **entire conversation history** from scratch.

### What gets sent each time:

```
Call 1  input: [system prompt + user message]                             = 18,558 tokens
Call 2  input: [system prompt + user message + call1 output + tool result] = 18,881 tokens
Call 3  input: [... + call2 output + tool result]                         = 20,049 tokens
...
Call 17 input: [system prompt + full history of all 16 prior exchanges]   = 196,497 tokens
```

Each call _includes_ all prior calls. The context only grows.

### Simplified visual (what accumulates each call):

```
Call 1 input:  [ your message ]
                └─ 18,558 tokens

Call 2 input:  [ your message | call 1 result ]
                └─ 18,881 tokens

Call 3 input:  [ your message | call 1 result | call 2 result ]
                └─ 20,049 tokens

Call 17 input: [ your message | call 1 result | call 2 result | ... | call 16 result ]
                └─ 196,497 tokens
```

Each new API call appends the previous call's output + tool result to the context before sending.
Claude never "remembers" — it re-reads everything from scratch each time.

### The numbers:

| Metric                      | Value     | Meaning                                                                  |
| --------------------------- | --------- | ------------------------------------------------------------------------ |
| **Sum of all input_tokens** | 1,623,227 | Total tokens _sent_ across all 17 API calls (history re-sent every time) |
| **Peak input_tokens**       | 196,497   | Largest context window in the session (see caveat below)                 |
| **Sum of output_tokens**    | 11,014    | All unique text Claude generated (not repeated)                          |

> **Why summing input tokens is misleading**: The same message history is re-sent on every API call. Summing gives you 1.6M when your real content was ~196K tokens. The history is counted 17 times.

---

## 3. Context Compaction

### What it is

When the conversation grows near the model's **context window limit**, Copilot CLI automatically **summarizes** the conversation history into a condensed text block to free up space, then continues processing.

- **Trigger**: Automatic, when context usage crosses an internal threshold
- **What you see**: A message like _"Some of the conversation history has been summarized to free up context"_
- **You cannot control it** — it's handled by the runtime automatically

### What gets compacted?

Compaction replaces **both sides** of the prior conversation:

- All prior **input** (your messages, system prompts)
- All prior **output** (Claude's responses, tool results)

Everything is replaced by a single shorter summary text. The raw history is gone; the summary takes its place.

### Step-by-step example with compaction mid-processing:

```
Call 1 input:  [ your message ]                                   = 18,558 tokens
               └─ Claude outputs: "I'll call tool A"

Call 2 input:  [ your message | call 1 output | tool A result ]   = 95,000 tokens
               └─ Claude outputs: "I'll call tool B"

  ⚠️  Context is approaching the limit — compaction triggers!
      Raw history replaced with a summary (~5,000 tokens)

Call 3 input:  [ SUMMARY of calls 1-2 | call 2 output | tool B result ] = 42,000 tokens
               └─ Claude outputs: "I'll call tool C"

Call 4 input:  [ SUMMARY | call 3 output | tool C result ]        = 55,000 tokens  ← final call
```

In this example:

- **Call 2** had the largest context: 95,000 tokens → **true peak**
- **Call 4** (final) had only 55,000 tokens — much smaller after compaction

### ⚠️ Caveat: Peak context ≠ always the final call

Without compaction → the final call IS the peak (context only grows).

With compaction mid-processing → the peak was **before** compaction. The final call's `input_tokens` will be _smaller_ than the true peak, because compaction reset the context size.

**To find the true peak context size**, use `MAX(input_tokens)` across all API calls in the session, not just the last one:

```sql
SELECT MAX(input_tokens) as true_peak_context
FROM assistant_usage_events
WHERE session_id = '<your-session-id>' AND turn_index = 1;
```

This means very long sessions may lose granular turn history, but the summary preserves key decisions and outcomes.

---

## 4. Understanding `/context` — Context Window Breakdown

Running `/context` in Copilot CLI shows how the model's total context window is currently allocated. Example output:

```
claude-sonnet-4.6 · 34k/264k tokens (13%)

  System Prompt     8.3k   (3%)
  System Tools      9.7k   (4%)
  MCP Tools           0    (0%)
  Messages         15.6k   (6%)
  Free Space      156.4k  (59%)
  Buffer           74.0k  (28%)
```

### What each field means:

| Field             | What it is                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **System Prompt** | Fixed Copilot CLI instructions sent on every API call — rules, persona, tool guidance. Never changes during a session.                    |
| **System Tools**  | JSON schema definitions of all available tools (`bash`, `view`, `grep`, `edit`, etc.) so Claude knows what it can call.                   |
| **MCP Tools**     | Same as System Tools but for MCP (Model Context Protocol) servers. Zero if no MCP tools are loaded.                                       |
| **Messages**      | Your conversation history — all user messages + Claude responses + tool results so far. **This is what grows as the session progresses.** |
| **Free Space**    | Truly available room — new tool results and responses will fill this space.                                                               |
| **Buffer**        | Reserved safety margin. Explained in detail below.                                                                                        |

### How total usage percentage is calculated

The percentage shown (e.g., `34k/264k tokens (13%)`) is the **sum of all occupied slots**:

```
Total Used = System Prompt + System Tools + MCP Tools + Messages
           = 3% + 4% + 0% + 6%  =  13%  (in the example above)

Free Space + Buffer = remaining 87%
```

Another example — a session with MCP tools loaded:

```
System Prompt    3%
System Tools     4%
MCP Tools       12%   ← CRG and other MCP servers add tool schemas
Messages         ?%   ← depends on conversation length
─────────────────────
Static overhead: 19%  ← this is fixed before you even type anything
```

This means if MCP Tools = 12%, you've already "spent" 19% of the context window before your first message. Heavier MCP tool sets leave less room for Messages.

The Buffer (74k in the example) is a **reserved zone that is intentionally never used for regular conversation**. It exists as a safety guarantee.

**Why is it needed?** Consider this scenario:

- Free Space = 2k tokens remaining
- Next tool result comes back = 10k tokens
- There's no room → the API call would fail with a context overflow error

The Buffer prevents this. Compaction fires **before** Free Space reaches zero — specifically when Free Space is about to be consumed down into the Buffer zone.

**Does it wait until Free Space = 0?**

No. The trigger is approximately:

```
Compaction fires when:
  used_tokens  >  total_context  −  buffer_size
  i.e., when Free Space approaches 0
  (before it actually hits 0, because buffer is pre-reserved)
```

In numbers from the example:

```
Total context:    264k tokens
Buffer reserved:   74k tokens
Compaction zone:  264k − 74k = 190k tokens used  ← threshold
Current usage:     34k tokens (13%) — far from threshold, no compaction needed
```

**When does the Buffer itself get used?**

In practice, the Buffer should rarely be consumed. It's reserved space, not a "second free space." However in edge cases — such as a single tool result larger than Free Space — the runtime may dip into the buffer temporarily. If even the buffer is exhausted, the API call may fail.

Think of it like a car fuel gauge:

```
[──────────── TANK ────────────]
[  Used fuel  ][  Free  ][ ⚠️ Reserve ]
                              ↑
                    Don't let it reach here
                    Refuel (compact) before this
```

### Full layout visualized:

```
◄──────────────────── 264k total context window ───────────────────►

[System  ][System ][MCP  ][Messages          ][Free Space     ][Buffer  ]
[Prompt  ][Tools  ][Tools][grows →            ][← shrinks      ][74k     ]
[ 8.3k   ][ 9.7k  ][ 0   ][ 15.6k            ][ 156.4k        ][        ]

                            As Messages grows:
                            ──────────────────────────────────────────────
                            [Messages (growing)          ][Shrinking][74k ]
                                                               ↓
                            When Free Space ≈ 0, compaction fires:
                            ──────────────────────────────────────────────
                            [Messages → SUMMARY (small)  ][Restored  ][74k]
```

---

## 5. Session AIC (AI Credits) — What Gets Billed

**AIC = AI Credits** — GitHub's user-facing billing unit shown in your GitHub billing dashboard.

### AIC vs AIU — same thing or different?

| Term    | Stands for                | Where you see it                           |
| ------- | ------------------------- | ------------------------------------------ |
| **AIC** | AI Credits                | GitHub billing dashboard, plan limits      |
| **AIU** | AI Usage units (internal) | `total_nano_aiu` column in local SQLite DB |

They represent the **same underlying cost calculation** — AIU is the internal raw metric stored in the database, AIC is how GitHub surfaces it to you in billing. The relationship is:

```
nanoAIU  →  ÷ 1,000,000,000  →  AIU  ≈  AIC consumed
```

### Dollar cost — how much is 1 AIC?

GitHub Copilot is primarily a **subscription product** (flat monthly fee), not purely pay-per-token. The AIC/AIU numbers in the DB represent **consumption against your plan's included usage**, not a direct dollar amount. There is no public fixed "1 AIC = $X" conversion rate.

What matters:

- Each Copilot plan includes a quota of premium requests/credits per month
- Heavier models (e.g., Claude Sonnet) cost more credits per API call than lighter ones
- When you exceed your plan's quota, additional usage may be billed or blocked depending on your plan settings

> ⚠️ **For exact current pricing and AIC→dollar rates**, check: https://github.com/features/copilot#pricing

### Important: AIC ≠ just sum of input tokens

AIC is calculated from **both input AND output tokens**, weighted by the model's pricing:

- Output tokens are priced **higher per token** than input tokens
- Each API call contributes: `(input_tokens × input_rate) + (output_tokens × output_rate)` → stored as nanoAIU

So the formula is roughly:

```
Session AIC = Σ over all API calls of:
              (input_tokens_per_call × input_price) + (output_tokens_per_call × output_price)
```

### Where to find it:

- `assistant_usage_events.total_nano_aiu` — cost per API call, already weighted
- Sum `total_nano_aiu` for a session → divide by 1,000,000,000 → AIU ≈ AIC consumed

### Example (1 user turn, 17 API calls):

```
Sum of total_nano_aiu across all 17 rows: 200,266,920,000
÷ 1,000,000,000
= Session AIU / AIC consumed: 200.27
```

"Total nanoAIU" in this example simply means the **sum of the `total_nano_aiu` column** for all 17 API call rows in that session. It's not a special field — just the sum, giving you the session-level cost in nano units. Dividing by 1B gives you AIU ≈ AIC = **200.27** for that session.

### Can I see my total AIU across ALL sessions?

Yes — query the local SQLite without filtering by session_id:

```sql
-- Total AIU consumed across every session ever recorded locally
SELECT
  COUNT(DISTINCT session_id)            AS total_sessions,
  ROUND(SUM(total_nano_aiu) / 1e9, 3)  AS total_aiu_all_sessions
FROM assistant_usage_events;

-- Broken down per session, most recent first:
SELECT
  session_id,
  MIN(model)                            AS model,
  COUNT(*)                              AS api_calls,
  ROUND(SUM(total_nano_aiu) / 1e9, 3)  AS aiu_cost
FROM assistant_usage_events
GROUP BY session_id
ORDER BY aiu_cost DESC;
```

> Note: This only covers sessions recorded on your local machine. Cross-device history lives in the cloud store but `total_nano_aiu` is local-only.

---

## 6. Sum of Output Tokens

Each API call produces some output — Claude's "thinking" expressed as text:

- Intermediate calls: short output like "I'll use this tool next" + tool invocation JSON
- Final call: the actual answer/analysis written to the user

**Sum of output tokens** = total unique content generated by Claude across all API calls.

This IS additive and accurate — each call's output is new, non-repeated content.

```
Call 1  output:  230 tokens  (decided to search)
Call 2  output:   61 tokens  (decided to query graph)
...
Call 10 output: 2,017 tokens (wrote analysis section)
...
Total:          11,014 tokens
```

---

## 7. Recommended Metrics for Performance Measurement

| Metric                         | Easy for Copilot?                 | Accurate?              | Useful?                                                                                                                                                                                    |
| ------------------------------ | --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Output tokens (sum)**        | ✅ SQL, 1 query                   | ✅ Yes                 | ✅ Measures how much Claude wrote                                                                                                                                                          |
| **Peak context size**          | ✅ SQL, 1 query                   | ✅ Yes (see MAX note)  | ✅ How large conversation grew                                                                                                                                                             |
| **Cost (AIU)**                 | ✅ SQL, 1 query                   | ✅ True billing metric | ✅ Best single cost signal                                                                                                                                                                 |
| **LLM API call count**         | ✅ SQL, 1 query                   | ✅ Yes                 | ✅ Measures session "complexity"                                                                                                                                                           |
| **Wall time**                  | ✅ events.jsonl timestamps        | ✅ Yes                 | ✅ Total elapsed clock time from user sending message to Copilot finishing — includes tool execution time + LLM wait + overhead. NOT the same as `SUM(duration_ms)` which is LLM-only wait |
| **Tool call count by tool**    | ✅ events.jsonl, ~10 lines Python | ✅ Yes                 | ✅ Shows which tools were used                                                                                                                                                             |
| **Per-call latency (p50/p95)** | ✅ SQL, 1 query                   | ✅ Yes                 | ✅ Pinpoints slow API calls                                                                                                                                                                |
| **File read count**            | ⚠️ events.jsonl, ~20 lines Python | ✅ Yes                 | ✅ Useful for CRG vs non-CRG comparison                                                                                                                                                    |
| **Lines read (view tool)**     | ⚠️ events.jsonl, ~20 lines Python | ✅ Yes                 | ✅ Shows depth of file exploration                                                                                                                                                         |
| Sum of all input tokens        | ✅ SQL, 1 query                   | ⚠️ Misleading          | ❌ Double-counts history — avoid                                                                                                                                                           |

### How each metric is calculated

#### From `assistant_usage_events` table (local SQLite — simple SQL):

```sql
SELECT
  turn_index,
  COUNT(*)                              AS llm_api_call_count,
  SUM(output_tokens)                    AS output_tokens_total,    -- unique text generated
  MAX(input_tokens)                     AS peak_context_tokens,    -- true peak (handles compaction)
  ROUND(SUM(total_nano_aiu) / 1e9, 3)  AS cost_aiu,               -- actual billing cost
  SUM(duration_ms)                      AS total_latency_ms,
  model
FROM assistant_usage_events
WHERE session_id = '<session-id>'
GROUP BY turn_index, model
ORDER BY turn_index;
```

- `output_tokens`: each row is one API call; Claude's response for that call. Summing = total unique content generated.
- `MAX(input_tokens)`: takes the largest context window seen across all calls. Using MAX instead of the last row correctly handles cases where compaction occurred mid-turn (the final call would have a _smaller_ context than the true peak).
- `total_nano_aiu`: already computed per call as `(input × input_rate) + (output × output_rate)`. Summing then dividing by 1B gives AIU.
- `duration_ms`: time Copilot waited for each Claude API response (LLM-only wait). Sum = total LLM wait time. **This is NOT wall time** — it excludes the time tools actually ran (e.g., a bash command taking 30s adds to wall time but not to duration_ms). Can also compute p50/p95 per turn.

#### From `events.jsonl` (requires Python, ~10–20 lines):

**Wall time (per turn)** — elapsed clock time from when user sent the message to when Copilot finished its final response for that turn. This includes LLM wait time + time tools actually ran (bash, file reads, MCP calls):

```python
# Find the user.message timestamp for the turn (start)
# Find the last assistant.message timestamp before the next user.message (end)
# Difference = wall time for that turn
#
# Simplest approach: filter events between two consecutive user.message timestamps
user_msgs = sorted(
    [e for e in events if e['type'] == 'user.message'],
    key=lambda e: e['timestamp']
)
# Turn 1: user_msgs[0].timestamp → user_msgs[1].timestamp
# Turn N: user_msgs[N-1].timestamp → user_msgs[N].timestamp (or last event)
turn1_start = user_msgs[0]['timestamp']
turn1_end   = user_msgs[1]['timestamp']   # start of next turn = end of this turn
```

> **Wall time vs SUM(duration_ms)**:
>
> - `SUM(duration_ms)` from `assistant_usage_events` = time waiting for Anthropic API only
> - Wall time = `SUM(duration_ms)` + time tools ran (bash, file reads, MCP) + overhead
> - Example: if a bash command runs for 30s, that 30s adds to wall time but NOT to duration_ms

**Tool call count by tool** — count `tool.execution_start` events grouped by `toolName`:

```python
# Each tool.execution_start has: data.toolName, data.toolCallId, data.arguments
tool_counts = {}
for e in events:
    if e['type'] == 'tool.execution_start':
        name = e['data']['toolName']
        tool_counts[name] = tool_counts.get(name, 0) + 1
```

**File read count & lines read** — match `tool.execution_start` (has file path) with `tool.execution_complete` (has file content), filter to `toolName == 'view'`:

```python
# Build start map: toolCallId → file path
start_map = {e['data']['toolCallId']: e['data']['arguments'].get('path')
             for e in events if e['type'] == 'tool.execution_start'}

file_reads = []
for e in events:
    if e['type'] == 'tool.execution_complete':
        cid = e['data']['toolCallId']
        # Confirm this was a view call via matching start event
        path = start_map.get(cid, '')
        content = e['data'].get('result', {}).get('content', '')
        if content and path.endswith(('.ts', '.js', '.py', ...)):  # filter to source files
            file_reads.append({'path': path, 'lines': content.count('\n')})

print(f"Files read: {len(file_reads)}")
print(f"Lines read: {sum(r['lines'] for r in file_reads)}")
```

> **Scope**: All the metrics above — file reads, tool counts, wall time — operate on the **entire session** (all events in one `events.jsonl`). The session is the top-level unit.
>
> **To narrow to a specific turn**, you have two options:
>
> **Option 1 — SQL (easiest)**: Use `WHERE turn_index = N` in `assistant_usage_events`. The `turn_index` column is already set per row — no manual searching needed.
>
> **Option 2 — events.jsonl by `turnId`**: Tool events (`tool.execution_start`) have a `data.turnId` integer field (0-based). Filter events where `turnId == N-1` for turn N.
>
> **Option 3 — events.jsonl by timestamps**: Find the `user.message` event for your turn (each has a unique `interactionId`). Events between that timestamp and the next `user.message` timestamp all belong to that turn. This is what "bookend" means — a bookend is the physical object placed at each _end_ of a row of books on a shelf to stop them falling. Here, the two `user.message` events act as bookends: one marks where the turn _starts_, the next marks where it _ends_ — everything in between belongs to that turn.
>
> For most measurement tasks, **Option 1 (SQL `turn_index`)** is the simplest.

---

## 8. What is a Session?

A **session** is one continuous Copilot CLI conversation — from when you start it to when you close it or start a new one. Everything that happens (your messages, tool calls, LLM API calls, responses) is recorded under a single **session ID** (a UUID like `d951e0a4-549a-4bf7-81a6-5bfab8734bc9`).

### When does a session start and end?

| Event                          | What happens                                       |
| ------------------------------ | -------------------------------------------------- |
| You open Copilot CLI           | A new session is created with a fresh UUID         |
| You type messages, I use tools | All events appended to this session                |
| Context compaction occurs      | Still the same session — compact event is recorded |
| You close the CLI              | Session ends; all data already persisted           |
| You open CLI again             | A **new** session starts with a new UUID           |

### What is a Turn?

A **turn** = one user message + Copilot's complete response (including all tool calls made to answer it).

```
Turn 1:  [your message] → [tool call 1] → [tool call 2] → ... → [final response]
Turn 2:  [your next message] → [tool call] → [final response]
```

- `turn_index` in `assistant_usage_events` increments by 1 for each new user message
- Within one turn there are multiple LLM API call rows (one per tool use + final response)
- The `user.message` event in `events.jsonl` marks the start of each new turn

### Real examples — `turn_index`, `interactionId`, `turnId`

#### `turn_index` (in `assistant_usage_events`) — which user question triggered this API call

All rows with the same `turn_index` belong to answering the same user question. Real rows from this session:

```
turn_index | input_tokens | output_tokens | aiu    | duration_ms   ← what this API call did
───────────────────────────────────────────────────────────────────────────────────────────
    1      |  18,558      |  230          | 3.515  | 6,134 ms    ← decided: call tool_search_tool
    1      |  18,881      |   61          | 0.770  | 2,834 ms    ← decided: call semantic_search
    1      |  20,049      |  121          | 1.186  | 3,428 ms    ← decided: call query_graph
    1      |  22,451      |  103          | 1.657  | 2,904 ms    ← decided: call query_graph again
    1      |  23,335      |  523          | 1.790  | 6,118 ms    ← decided: call get_review_context
    1      | 190,250      | 2,017         | 68.289 | 34,012 ms   ← context jumped (651KB result), wrote analysis
    1      | 194,450      | 2,087         | 69.969 | 43,485 ms   ← wrote more analysis
    ... (17 rows total — all turn_index = 1, all for the SAME first question)
───────────────────────────────────────────────────────────────────────────────────────────
    2      |  24,480      |  314          | 9.651  | 8,870 ms    ← 2nd question (/diagnose)
    2      |  27,042      |  862          | 2.629  | 17,496 ms
    2      |  25,523      | 1,423         | 3.261  | 21,593 ms
───────────────────────────────────────────────────────────────────────────────────────────
    3      |  28,040      | 1,121         | 2.867  | 22,827 ms   ← 3rd question (one API call)
    4      |  29,371      |  731          | 12.110 | 19,436 ms   ← 4th question
    5      |  30,329      |  503          | 12.128 | 14,912 ms   ← 5th question (3 API calls)
    5      |  30,858      | 2,433         | 4.759  | 41,231 ms
    5      |  33,318      |  186          | 2.128  |  5,478 ms
```

#### `interactionId` (in `user.message` events) — identifies one specific user interaction

From the actual `events.jsonl` of this session:

```
#  | timestamp              | interactionId  | message (truncated)
───┼────────────────────────┼────────────────┼───────────────────────────────────────────────────
01 | 07:02:47.566Z          | 32c29608...    | "This question is used to measure Copilot CLI..."
02 | 07:02:47.689Z          | 32c29608...    | ""  ← SAME ID, empty, 0.123s later (system-generated, see note)
03 | 07:06:43.796Z          | 8b2f52cf...    | "Diagnose: I'm doing performance measurement..."
04 | 07:15:43.071Z          | fecfe59b...    | "the total input tokens and output tokens..."
05 | 07:20:16.024Z          | 18b6c143...    | "You are copilot right?..."
06 | 07:32:39.263Z          | 01298962...    | "Explain more about LLM API call..."
07 | 07:52:42.017Z          | b8a6e727...    | "Then, how about compact context..."
...
13 | 10:24:52.932Z          | e534fe13...    | "I don't understand the turnIndex..."
14 | 10:28:34.439Z          | 0a84e646...    | "yes, but as I inspect, the new message..."
```

> **⚠️ Why do messages #01 and #02 share the same `interactionId`?**
>
> Message #02 is **empty** and arrived only 0.123 seconds after #01 — it was **not typed by the user**. It is a system-generated injection (likely the runtime delivering prior context or compaction state at session start). System-injected messages piggyback on the `interactionId` of the triggering real message.
>
> **Normal rule**: every message you actually type gets a **new unique** `interactionId`.
> **Exception**: auto-generated system messages (empty, injected < 1s after a real message) may share the same `interactionId` as the message that triggered them.

#### `turnId` (in `tool.execution_start` events) — which LLM API call triggered this tool

`turnId` is a **0-based counter of LLM API calls** within the session. Different from `turn_index` (which counts user questions):

```
timestamp    | turnId | tool                              | what it means
─────────────┼────────┼───────────────────────────────────┼──────────────────────────────────────
07:02:53.962 |   0    | tool_search_tool                  | 1st LLM call decided to run this tool
07:02:53.962 |   0    | bash                              | same 1st call ran two tools in parallel
07:02:56.910 |   1    | tool_search_tool                  | 2nd LLM call (after seeing results)
07:03:00.388 |   2    | semantic_search_nodes_tool        | 3rd LLM call
07:03:03.500 |   3    | tool_search_tool                  | 4th LLM call ran two tools
07:03:03.500 |   3    | tool_search_tool                  |   ↑ same call, parallel
07:03:10.105 |   4    | query_graph_tool                  | 5th LLM call ran three tools
07:03:10.105 |   4    | query_graph_tool                  |   ↑ same call, parallel
07:03:10.106 |   4    | get_review_context_tool           |   ↑ same call, parallel
07:03:16.606 |   5    | bash                              | 6th LLM call
```

#### Summary: three different IDs, three different scopes

```
turn_index  (SQL)      = "which user question"    → 1, 2, 3...  (1-based, per user message)
interactionId (events) = "which interaction UUID"  → unique UUID  (new UUID per user-typed message)
turnId      (events)   = "which LLM API call"      → 0, 1, 2...  (0-based, counts all API calls in session)
```

### Storage — two layers

```
┌─────────────────────────────────────────────────────────┐
│  LOCAL (on your machine)                                │
│                                                         │
│  ~/.copilot/session-state/<session-id>/                 │
│    ├── events.jsonl    ← append-only event log          │
│    │                     every event written in real-   │
│    │                     time as it happens             │
│    └── (other metadata files)                           │
│                                                         │
│  ~/.copilot/session-state/ (shared SQLite DB)           │
│    └── assistant_usage_events  ← per-call token data    │
│        turns, checkpoints, session_files, etc.          │
└─────────────────────────────────────────────────────────┘
                         ↕ syncs
┌─────────────────────────────────────────────────────────┐
│  CLOUD (GitHub servers)                                 │
│                                                         │
│  Same structured tables: sessions, turns, checkpoints, │
│  session_files, session_refs, events, tool_requests     │
│  Accessible across devices via session_store_sql tool   │
└─────────────────────────────────────────────────────────┘
```

### How `events.jsonl` works

It is an **append-only newline-delimited JSON file** — each line is one event, written immediately as it happens:

```jsonl
{"type":"user.message","timestamp":"2026-07-22T07:01:41.214Z","data":{...}}
{"type":"tool.execution_start","timestamp":"...","data":{"toolName":"view","toolCallId":"abc123","arguments":{"path":"..."}}}
{"type":"tool.execution_complete","timestamp":"...","data":{"toolCallId":"abc123","result":{"content":"..."},"toolTelemetry":{...}}}
{"type":"assistant.message","timestamp":"...","data":{...}}
```

Key event types:
| Event type | What it records |
|-----------|----------------|
| `session.start` | Session created — has `sessionId` |
| `session.model_change` | Model set/changed |
| `system.message` | System prompt injected — static instructions sent to Claude |
| `user.message` | Your typed message, OR a system injection (see below) |
| `assistant.turn_start` | LLM API call begins — has `turnId`, `model`, `interactionId` |
| `assistant.message` | LLM's response for this API call — has `toolRequests` (what tools Claude wants to run) |
| `assistant.turn_end` | LLM API call complete — marks the end of this `turnId` cycle |
| `tool.execution_start` | A tool was invoked — has `toolName`, `toolCallId`, `arguments` |
| `tool.execution_complete` | Tool finished — has matching `toolCallId`, `result.content` |
| `session.usage_checkpoint` | Cost snapshot after a full interaction completes — has `totalNanoAiu` |

### Full event lifecycle — annotated with real lines from this session

Here is the **exact sequence** from this session's `events.jsonl`. Each line number maps directly to what you see in the file:

```
L01  session.start          sessionId=d951e0a4...
L02  session.model_change   model=claude-sonnet-4.6
L03  system.message         role=system  ← full Copilot system prompt injected
L04  user.message           iid=32c29608  "This question is used to measure..."  ← YOUR REAL MESSAGE
L05  assistant.turn_start   turnId=0  iid=32c29608  ← LLM API call #1 begins
L06  user.message           iid=32c29608  content=""  ← SYSTEM INJECTION (see note below)
L07  assistant.message      turnId=0  iid=32c29608  tools=[tool_search_tool, bash]  ← LLM response: "run these tools"
L08  tool.execution_start   toolCallId=toolu_01Hjc...  tool=tool_search_tool  turnId=0  ← tool A starts
L09  tool.execution_start   toolCallId=toolu_01S2g...  tool=bash              turnId=0  ← tool B starts in parallel
L10  tool.execution_complete toolCallId=toolu_01Hjc...  success=True           ← tool A done
L11  tool.execution_complete toolCallId=toolu_01S2g...  success=True           ← tool B done
L12  assistant.turn_end     turnId=0   ← API call #1 lifecycle complete
L13  assistant.turn_start   turnId=1   ← LLM API call #2 begins (with tool results as new input)
L14  assistant.message      turnId=1   tools=[tool_search_tool]
L15  tool.execution_start   toolCallId=toolu_016UM...  tool=tool_search_tool  turnId=1
L16  tool.execution_complete toolCallId=toolu_016UM...  success=True
L17  assistant.turn_end     turnId=1
L18  assistant.turn_start   turnId=2   ← LLM API call #3
L19  assistant.message      turnId=2   tools=[code-review-graph-semantic_search_nodes_tool]
L20  tool.execution_start   ... semantic_search_nodes_tool  turnId=2
L21  tool.execution_complete ...  success=True
L22  assistant.turn_end     turnId=2
L23  assistant.turn_start   turnId=3   ← LLM API call #4
L24  assistant.message      turnId=3   tools=[tool_search_tool, tool_search_tool]  ← SAME tool called twice in parallel
L25  tool.execution_start   toolCallId=toolu_011vy...  tool=tool_search_tool  turnId=3
L26  tool.execution_start   toolCallId=toolu_01Efe...  tool=tool_search_tool  turnId=3  ← different toolCallId, same toolName
L27  tool.execution_complete toolCallId=toolu_011vy...
L28  tool.execution_complete toolCallId=toolu_01Efe...
L29  assistant.turn_end     turnId=3
L30  assistant.turn_start   turnId=4
L31  assistant.message      turnId=4   tools=[query_graph_tool, query_graph_tool, get_review_context_tool]  ← 3 tools parallel
...  (turnId 5, 6, 7 — more tool cycles)
L58  assistant.turn_start   turnId=8
L59  assistant.message      turnId=8   tools=[]   ← no tools: final text response only
L60  assistant.turn_end     turnId=8   ← last API call of first user question complete
L61  session.usage_checkpoint  totalNanoAiu=22,583,670,000  ← SNAPSHOT after full interaction
L62  system.message         role=system  ← system prompt re-injected for next interaction
L63  user.message           iid=8b2f52cf  "Diagnose: I'm doing performance measurement..."  ← YOUR 2nd REAL MESSAGE
L64  assistant.turn_start   turnId=0   iid=8b2f52cf  ← turnId RESETS to 0 for new interaction
```

---

### Explaining each event in detail

#### `user.message` with empty content + `transformedContent` (L06) — system injection

This is **not your message**. It is a system-generated event injected by the Copilot runtime **after** `assistant.turn_start` fires, to inform Claude about tools that were deferred (not included in the initial system prompt to save context space):

```
content:           ""        ← empty, you didn't type this
transformedContent: "<system_reminder> IMPORTANT: The tools listed below are deferred
                    — their full definitions are injected here just-in-time..."
interactionId:     32c29608  ← same as your real message (piggybacked)
```

**Why deferred tools?** Full tool schemas (especially MCP tools with large parameter definitions) are expensive in tokens. Instead of always including them in the system prompt, they are injected once per interaction, right before the first LLM call that might need them.

**How to tell it apart from your real message**: content is empty AND it arrives within milliseconds of `assistant.turn_start` — not from user keyboard input.

---

#### `assistant.turn_start` → `assistant.message` → tools → `assistant.turn_end` — one full LLM API cycle

```
assistant.turn_start (turnId=N)
  │  ← LLM API call begins. Claude receives: system prompt + full conversation history
  │
  ▼
assistant.message (turnId=N, interactionId=X)
  │  ← LLM response arrives. Contains toolRequests[] = tools Claude wants to run
  │    Same turnId and interactionId confirm this response belongs to the same call
  │
  ▼
tool.execution_start  (toolCallId=abc, toolName=X)   ┐ run in parallel
tool.execution_start  (toolCallId=def, toolName=Y)   ┘ if Claude requested multiple
  │
  ▼
tool.execution_complete (toolCallId=abc)  ┐ matched back by toolCallId
tool.execution_complete (toolCallId=def)  ┘
  │
  ▼
assistant.turn_end (turnId=N)
  │  ← This LLM API lifecycle is closed. Tool results are now added to context.
  │
  ▼
assistant.turn_start (turnId=N+1)   ← NEXT LLM API call begins with updated context
```

The tool results from the `tool.execution_complete` events become part of the input context for the **next** `assistant.turn_start`. This is the loop that repeats until Claude produces a final response with no `toolRequests` (empty tools list = done).

**Same `toolName`, different `toolCallId`** — completely normal. Claude can request the same tool multiple times in one `assistant.message` (e.g., two `tool_search_tool` calls with different search queries). Each gets a unique `toolCallId` to track them independently.

---

#### `session.usage_checkpoint` (L61) — cost snapshot after a complete interaction

Triggered automatically **after the final `assistant.turn_end`** of an interaction, just before the next `user.message`. This session had **14 checkpoints** (one per user question). Each checkpoint's `totalNanoAiu` is **cumulative** — it keeps growing:

```
Checkpoint  | Line | timestamp        | totalNanoAiu        | = AIU    | premiumReqs
────────────┼──────┼──────────────────┼─────────────────────┼──────────┼────────────
After Q1    |  L61 | 07:04:01Z        | 22,583,670,000      |  22.58   |  1
After Q2    | L103 | 07:08:18Z        | 200,266,920,000     | 200.27   |  2
After Q3    | L119 | 07:16:31Z        | 215,807,265,000     | 215.81   |  3
After Q4    | L125 | 07:20:38Z        | 218,674,395,000     | 218.67   |  4
...
After Q13   | L386 | 10:29:59Z        | 486,053,955,000     | 486.05   | 13
After Q14   | L420 | (next day)       | 547,017,645,000     | 547.02   | 14  ← LAST
```

**Cost per individual interaction = difference between consecutive checkpoints:**

```
Q1 cost:  22.58 AIU         (= checkpoint1 − 0)
Q2 cost: 177.69 AIU         (= 200.27 − 22.58)  ← large because /diagnose had big context
Q3 cost:  15.54 AIU         (= 215.81 − 200.27)
Q4 cost:   2.87 AIU         (= 218.67 − 215.81)
...
Session total: 547.02 AIU   (last checkpoint value)
```

**Which value is trusted — checkpoint or SQL?**

| Source                                  | Computed by             | Includes caching discounts? | Trust level                                                        |
| --------------------------------------- | ----------------------- | --------------------------- | ------------------------------------------------------------------ |
| `session.usage_checkpoint.totalNanoAiu` | GitHub's billing server | ✅ Yes                      | ✅ **Authoritative** — matches what GitHub charges                 |
| `assistant_usage_events.total_nano_aiu` | Local machine           | ❌ No                       | ⚠️ Estimate — useful for per-call breakdown, but not exact billing |

**The checkpoint is what GitHub actually bills.** Use it when you need the real charged amount. Use the SQL table when you need per-call breakdown (which tool cost what, latency per call, etc.).

**To get the total charged AIC for a session:**

1. Find the **last** `session.usage_checkpoint` event in the session's `events.jsonl`
2. Read its `totalNanoAiu` value — divide by 1,000,000,000 → AIU = AIC for the entire session

```python
checkpoints = [e for e in events if e['type'] == 'session.usage_checkpoint']
last_cp = sorted(checkpoints, key=lambda e: e['timestamp'])[-1]
session_aiu = last_cp['data']['totalNanoAiu'] / 1_000_000_000
print(f"Session AIC: {session_aiu:.4f} AIU")
```

**To get total across all local sessions (this machine only):**

```python
import os, json, glob

total_aiu = 0
session_dir = os.path.expanduser('~/.copilot/session-state')
for events_file in glob.glob(f'{session_dir}/*/events.jsonl'):
    checkpoints = []
    with open(events_file) as f:
        for line in f:
            try:
                e = json.loads(line.strip())
                if e.get('type') == 'session.usage_checkpoint':
                    checkpoints.append(e)
            except: pass
    if checkpoints:
        last = sorted(checkpoints, key=lambda e: e['timestamp'])[-1]
        total_aiu += last['data'].get('totalNanoAiu', 0) / 1_000_000_000

print(f"Total AIC across all local sessions: {total_aiu:.4f} AIU")
```

**What about another laptop / cross-device?**

| Scenario                          | What's available                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Same machine                      | Local `events.jsonl` + SQLite — full detail, exact checkpoint values                                                     |
| Another laptop                    | Its own local files — no overlap, completely separate                                                                    |
| Both devices, same GitHub account | **GitHub billing dashboard** at `github.com/settings/billing` — shows total AIC consumed across ALL devices, server-side |

The local files only track sessions that ran **on that specific machine**. If you use the same GitHub account on two laptops:

- Laptop A's sessions → only in Laptop A's `~/.copilot/session-state/`
- Laptop B's sessions → only in Laptop B's `~/.copilot/session-state/`
- Neither laptop can see the other's local data
- The **only** cross-device authoritative source is GitHub's billing/usage dashboard

The cloud `session_store_sql` has session metadata (summaries, turns, files) synced across devices, but `assistant_usage_events` and `events.jsonl` are **local-only** and never synced to the cloud.

---

#### `system.message` (L62) — context reset between interactions

After the usage checkpoint, the runtime re-injects the full system prompt. This happens at the boundary between interactions to ensure the next LLM call starts with fresh, current instructions (especially useful if the system prompt changes, e.g., different tools available).

---

#### `turnId` resets to 0 per interaction

Notice L64: `assistant.turn_start turnId=0` — this is the **second user interaction** but `turnId` resets back to 0. The `turnId` is a **per-interaction counter** of LLM API calls, not a global session counter. Combined with `interactionId`, it uniquely identifies any API call:

```
interactionId=32c29608, turnId=0  →  1st LLM call of 1st user question
interactionId=32c29608, turnId=5  →  6th LLM call of 1st user question
interactionId=8b2f52cf, turnId=0  →  1st LLM call of 2nd user question (resets!)
```

---

#### Filtering by `interactionId` — narrowing to one user question

Every event produced while processing your message carries `interactionId` = the UUID of your specific message. System injections (L06) borrow the same ID. So filtering `events.jsonl` by `interactionId` gives you exactly the events for one question:

```python
my_interaction = "32c29608-0a9f-4baf-b99c-b45af46f8169"

# All events for just this one user question:
relevant = [
    e for e in events
    if e.get('data', {}).get('interactionId') == my_interaction
    or e.get('data', {}).get('interactionId', '').startswith(my_interaction[:8])
]
```

> **Important**: `interactionId` is the ID of the interaction being **actively processed**. Later interactions send their own `interactionId` — they do NOT carry a previous interaction's ID even though the prior conversation is part of their input context. Each interaction's ID is clean and exclusive to that interaction's processing events.

### How the local SQLite DB works

`assistant_usage_events` is populated **after each LLM API call completes**, with one row per call:

- `session_id` + `turn_index` links back to the session and turn
- `input_tokens`, `output_tokens` come directly from Anthropic's API response headers
- `total_nano_aiu` is computed locally from the token counts and model pricing rates
- `duration_ms` is the wall-clock time waiting for the API response

### Why two stores (local + cloud)?

- **Local** (`events.jsonl` + SQLite): available instantly, offline, highest fidelity — includes `assistant_usage_events` which is **not** in the cloud store
- **Cloud**: cross-device access, queryable with `session_store_sql` (cloud), used by GitHub for billing and session history UI

> ⚠️ `assistant_usage_events` (the table with per-call token data) exists **only in the local SQLite store**. It is not synced to the cloud. Always use `source: "local"` when querying it.

---

## 9. Where Is This Data Stored?

| Data                                | Location                                | Query                        |
| ----------------------------------- | --------------------------------------- | ---------------------------- |
| Per-call token usage, cost, latency | `assistant_usage_events` (local SQLite) | `session_store_sql` tool     |
| Tool call names & arguments         | `events.jsonl` in session folder        | Parse JSON lines             |
| Wall time                           | `events.jsonl` timestamps               | First/last `timestamp` field |
| Conversation turns                  | `turns` table (cloud/local store)       | `session_store_sql` tool     |

### Session folder path:

```
~/.copilot/session-state/<session-id>/events.jsonl
```

### Key SQL query (per-turn summary):

```sql
SELECT
  turn_index,
  COUNT(*) as api_calls,
  MAX(input_tokens) as peak_context_tokens,
  SUM(output_tokens) as total_output_tokens,
  ROUND(SUM(total_nano_aiu) / 1e9, 3) as aiu_cost,
  SUM(duration_ms) as total_latency_ms,
  model
FROM assistant_usage_events
WHERE session_id = '<your-session-id>'
GROUP BY turn_index, model
ORDER BY turn_index;
```

---
