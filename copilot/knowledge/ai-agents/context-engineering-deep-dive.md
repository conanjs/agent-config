---
schema: deep-dive/v1
topic: ai-agents
status: verified
applies-to: ["LLM agents with tool use and multi-turn context (Claude, OpenAI, Gemini and similar)", "sources read 2026-10-30"]
last-verified: 2026-10-30
last-updated: 2026-10-30
synthesized-into: []
tags: [context-engineering, context-window, context-rot, compaction, memory, subagents, prompt-caching, rag]
---

# Context engineering, end to end

## Summary
**TL;DR:** Context engineering decides which tokens the model sees on each call: instructions, tools, history, tool results, retrieved documents, notes and memory. It is needed because the window is finite, and because quality drops as it fills, even on easy tasks ("context rot"). The work is four moves: **write** information outside the window, **select** what comes back in, **compress** what is there, and **isolate** work into separate windows. Every move trades something: cost, cache hits, lost detail or conflicting decisions.
**Use this when:** an agent forgets earlier decisions, repeats itself, slows down or gets worse on long tasks; you design a system prompt, tool set, `CLAUDE.md`/`AGENTS.md`, memory or retrieval; you decide between one agent and sub-agents; you want to cut token cost.
**Depth:** every part of a context and what happens when it is missing or bloated; why long contexts fail (attention budget, position effects, distractors, the four named failure modes); the write/select/compress/isolate catalogue mapped to concrete features; cache economics; the cross-part interaction matrix; a worked session timeline; a failure and edge-case matrix.

---

## 1. Words first

| Term | Plain English | Analogy | Concrete artifact |
|---|---|---|---|
| Context window | Everything the model reads for one call, measured in tokens | The model's desk: only what is on it can be used | A 200k-token limit on one request |
| Context engineering | Choosing and maintaining the best set of tokens for each call ✅[^ant_ctx] | Packing a small backpack for a long hike, and repacking at each stop | Deciding that the `CLAUDE.md`, three tool schemas and the last test output go in, but the old 4 MB log does not |
| Tool definition | Name, description and input schema of a tool the model may call; sent with every request | The labels on a toolbox's drawers | `{"name": "read_file", "description": "…", "input_schema": {…}}` |
| Tool result | What a tool returned, appended to the history | A delivery note left on the desk | 300 lines of `pytest` output |
| Memory (in context terms) | Notes kept *outside* the window and loaded back when needed ✅[^langchain_ctx] | A notebook in your bag | `CLAUDE.md`, `NOTES.md`, `todo.md`, a memory tool directory |
| Retrieval (RAG) | Fetching relevant documents into the window, either before inference or on demand ✅[^ant_ctx] | Going to the library vs. bringing the whole library | Embedding search; or `grep` then `read_file` |
| Compaction | Summarising a nearly full context and continuing in a new window with the summary ✅[^ant_ctx] | Rewriting a messy notebook into a one-page summary | Claude Code auto-compact |
| Sub-agent | A separate model call with its own clean window that returns a short result ✅[^ant_ctx] | Sending an assistant to research and come back with a memo | A search sub-agent returning a 1,000–2,000-token summary ✅[^ant_ctx] |
| KV cache / prompt cache | The provider keeps the computed prefix of a prompt, so a repeated prefix is cheaper and faster ✅[^ant_cache] ✅[^manus] | A pre-heated oven | `cache_control` on the system prompt |
| Context rot | Accuracy falls as the input grows, even on simple tasks ✅[^chroma] | Finding one note on a desk that keeps getting more cluttered | Same question, same answer present, worse result at 100k tokens than at 1k |

---

## 2. What it is, and why the term appeared

- **Definitions.** Anthropic calls context engineering the set of strategies for "curating and maintaining the optimal set of tokens" during inference, and the natural next step after prompt engineering ✅[^ant_ctx]. Karpathy's widely quoted line calls it "the delicate art and science of filling the context window with just the right information for the next step". Tobi Lutke describes it as providing all the context for the task to be "plausibly solvable" by the model ✅[^willison].
- **Why the term caught on.** Simon Willison expects it to stick because most people read "prompt engineering" as typing into a chatbot ✅[^willison]. Cognition calls context engineering "effectively the #1 job of engineers building AI agents" ✅[^cognition].
- **What it covers.** LangChain lists three kinds of context ✅[^langchain_ctx]:
  - *instructions*: prompts, memories, few-shot examples, tool descriptions;
  - *knowledge*: facts and memories;
  - *tools*: feedback from tool calls.

**How it relates to the neighbours:**
- A prompt is one input among many (see [prompt-engineering-deep-dive.md](prompt-engineering-deep-dive.md)).
- The harness is the code that assembles the context on every call and acts on the output (see [harness-engineering-deep-dive.md](harness-engineering-deep-dive.md); its §3 compares all five disciplines).

---

## 3. Why long contexts fail

| Effect | What the source found | Source |
|---|---|---|
| Attention budget | Every token attends to every other: *n²* pairwise relationships for *n* tokens, so attention spreads thinner as context grows | ✅[^ant_ctx] |
| Context rot | 18 models tested; performance "varies significantly as input length changes, even on simple tasks" | ✅[^chroma] |
| Distractors | "Even a single distractor reduces performance"; four make it worse; Claude models abstained more, GPT models hallucinated more | ✅[^chroma] |
| Focused vs. full | On LongMemEval, every model scored much higher on a focused prompt than on the full ~113k-token one | ✅[^chroma] |
| Position | Models use information at the start and end of a long input better than in the middle, even long-context models | ✅[^lost] |
| Too many tools | On the Berkeley Function-Calling Leaderboard every model did worse with more than one tool; a small model failed with 46 tools and succeeded with 19 | ✅[^breunig] |
| Size threshold | A Databricks study saw correctness start falling around 32k tokens for Llama 3.1 405b, sooner for smaller models | ✅[^breunig] |

### The four named failure modes (Drew Breunig)

| Mode | Definition | Evidence the source cites |
|---|---|---|
| Context poisoning | A hallucination or error enters the context and is referenced again and again | Gemini playing Pokémon chased impossible goals written into its own notes ✅[^breunig] |
| Context distraction | The context grows so long that the model over-focuses on it instead of what it learned in training | The same agent repeated past actions past about 100k tokens ✅[^breunig] |
| Context confusion | Superfluous content is used to produce a low-quality response | The tool-count results above ✅[^breunig] |
| Context clash | Parts of the context disagree | Prompts split into multi-turn "shards" lost 39% on average; o3 fell from 98.1 to 64.1, because early wrong attempts stayed in context ✅[^breunig] |

---

## 4. The parts of a context, one by one

| Part | Who writes it | Enters the window | When missing | When bloated |
|---|---|---|---|---|
| System prompt | Builder | Every call, first | Model uses generic defaults | Brittle if-then logic, or vague. Anthropic: aim for the "right altitude" between the two, start minimal and add from observed failures ✅[^ant_ctx] |
| Tool definitions | Builder | Every call, near the start | The agent cannot act | Overlapping tools confuse the choice ✅[^ant_ctx] ✅[^breunig]; every schema costs tokens on every call |
| Examples | Builder | With the instructions | Format drift | Copying: uniform context makes the agent "brittle" ✅[^manus] |
| Instruction / memory files | Team or agent | Session start (Claude Code: files above the working folder at launch, sub-folders on demand) ✅[^cc_memory] | The agent rediscovers conventions every session | Lower adherence: Claude Code advises under 200 lines per `CLAUDE.md` ✅[^cc_memory]; OpenAI found a giant `AGENTS.md` "crowds out the task" ✅[^openai_harness] |
| Message history | Conversation | Accumulates | No continuity | Rot, distraction, clash (§3) |
| Tool results | Tools | After each call | The agent acts blind | Floods the window. Claude Code caps a tool response at 25,000 tokens by default ✅[^ant_tools] |
| Retrieved documents | Retrieval step or the agent's own reads | Up front, or just in time ✅[^ant_ctx] | Answers from training data | Distractors (§3) |
| Notes / scratchpad / state | The agent | Read back on demand | Lost progress after a reset | Stale notes become poisoning ✅[^breunig] |
| Sub-agent results | Sub-agents | As one condensed message | Lead agent must do everything itself | Rarely: designed to be 1,000–2,000 tokens ✅[^ant_ctx] |

---

## 5. The four moves: write, select, compress, isolate

LangChain groups the techniques into four strategies ✅[^langchain_ctx]. Anthropic's long-horizon techniques fit inside them ✅[^ant_ctx].

| Move | Technique | What it does | Concrete feature | Cost or risk |
|---|---|---|---|---|
| **Write** (save outside the window) | Scratchpad | The agent writes working notes to a file or a state field | `NOTES.md`; a to-do list ✅[^ant_ctx] | Notes can go stale |
| | Long-term memory | Facts kept across sessions | Memory tool (file-based) ✅[^ant_ctx]; Claude Code auto memory ✅[^cc_memory] | Wrong memories persist |
| | Recitation | Rewrite the goal list as you go, so it sits in the recent context | Manus `todo.md` over a ~50-tool-call task ✅[^manus] | A few tokens per update |
| **Select** (pull into the window) | Just-in-time retrieval | Keep paths, queries and links; load the content with tools when needed ✅[^ant_ctx] | `glob` and `grep`, then read | Slower; needs good tools |
| | Pre-retrieval | Embedding search before inference ✅[^ant_ctx] | Classic RAG | Wrong chunks become distractors |
| | Hybrid | Some context up front, the rest on demand | Claude Code loads `CLAUDE.md` up front and greps for the rest ✅[^ant_ctx] | — |
| | Tool selection | Retrieve only relevant tool descriptions ✅[^langchain_ctx] | RAG over tool descriptions | Changes the prefix, so the cache breaks (§6) |
| **Compress** (keep fewer tokens) | Compaction | Summarise and restart. Tune for recall first, then precision ✅[^ant_ctx] | Claude Code auto-compact ✅[^langchain_ctx] | Lost detail; a wrong summary becomes poisoning, as in the Pokémon agent's goals and summary sections ✅[^breunig] |
| | Tool-result clearing | Drop old raw tool outputs: "one of the safest lightest touch forms" ✅[^ant_ctx] | Context editing on the Claude platform ✅[^ant_ctx] | Re-fetch if needed again |
| | Restorable compression | Drop the content, keep the pointer (URL, path) ✅[^manus] | Keep the URL, drop the page | Re-read cost |
| | Trimming | Heuristics such as dropping old messages ✅[^langchain_ctx] | Sliding window | Silent loss of early decisions |
| **Isolate** (split it up) | Sub-agents | Each gets a clean window and returns a summary ✅[^ant_ctx] | Research sub-agents | About 15× the tokens of a chat; conflicting decisions (§6) ✅[^ant_multi] ✅[^cognition] |
| | Sandbox | Heavy objects stay in the environment; only selected results return ✅[^langchain_ctx] | Code execution holds a dataframe | Needs a runtime |
| | State object | Fields hidden from the model until needed ✅[^langchain_ctx] | A typed graph state | Builder must choose the fields |

---

## 6. Cross-part interactions

Changing one part of the context has effects on the others. The matrix lists each change, what it does to the model, and what it costs elsewhere.

| Change | Direct effect | Knock-on effect on other parts |
|---|---|---|
| **Add or remove a tool mid-task** | New capability, or one fewer | The tool list sits near the front of the prefix, so a change invalidates the cache for everything after it. Earlier turns that mention a removed tool can produce schema violations. Manus therefore *masks* tools during decoding instead of removing them ✅[^manus] ✅[^ant_cache] |
| **Put a timestamp or other changing value in the system prompt** | Fresher information | One changed token invalidates the cache from that point on ✅[^manus]; cached input cost 0.30 vs. 3 USD/MTok uncached on Claude Sonnet (10×) ✅[^manus] |
| **Serialise JSON without stable key order** | None visible | Silent cache misses ✅[^manus] |
| **Compact the history** | Room to continue | Fine detail is gone. Errors the model needed to learn from may vanish: Manus keeps failed actions and traces in context so the model does not repeat them ✅[^manus] |
| **Split work across sub-agents** | Clean windows; parallel speed. Anthropic's multi-agent research system beat single-agent Opus 4 by 90.2% on its research eval ✅[^ant_multi] | About 15× chat tokens ✅[^ant_multi]. Sub-agents make implicit decisions that may conflict (Cognition's Flappy Bird example) ✅[^cognition]. Poor fit where all agents need the same context, and for most coding tasks ✅[^ant_multi] |
| **Grow the instruction file** | More rules available | Every session pays the tokens; adherence drops ✅[^cc_memory]; rules rot and contradict each other ✅[^openai_harness]; contradictions are resolved arbitrarily ✅[^cc_memory] |
| **Return verbose tool results** | More detail available | Pushes other parts toward the middle of the window or out of it ✅[^lost]; use pagination, filtering and a concise/detailed `response_format` ✅[^ant_tools] |
| **Retrieve up front instead of just in time** | Faster first answer | More distractors for every later step ✅[^chroma] |

**Synthesis (this doc's reading of the sources):** context engineering is a budget problem with three currencies: *attention* (quality), *money* (tokens and cache hits) and *coherence* (one view of the decisions so far). Most moves spend one currency to save another. Sub-agents spend money and coherence to buy attention. Compaction spends detail to buy attention. A stable prefix spends flexibility to buy money.

---

## 7. Worked example: a coding agent's context over one session

The flow follows the Claude Code behaviour described in the sources. The task is illustrative.

1. **Session start.** The window holds:
   - the system prompt and tool definitions;
   - the `CLAUDE.md` files from the folders above the working folder ✅[^cc_memory].

   This prefix is stable, so it caches ✅[^ant_cache].
2. **Turn 1, the task.** The user asks: "Fix the failing date-parsing test."
3. **Select, just in time.** The agent greps for the test name, then reads only the matching test file and the parser ✅[^ant_ctx]. When it reads a file in a sub-folder that has its own `CLAUDE.md`, that file loads too ✅[^cc_memory].
4. **Tool results pile up.** Test runs append output. A huge log is cut at the tool's limit (25,000 tokens by default in Claude Code) ✅[^ant_tools].
5. **Write.** The agent keeps a short to-do list and updates it as items finish. This is recitation: the goals stay in recent context ✅[^manus] ✅[^ant_ctx].
6. **Isolate.** "Where else is this parser used?" goes to a sub-agent. It reads 40 files in its own window and returns a short list ✅[^ant_ctx].
7. **Keep the failure.** The first fix fails a second test. The failing output stays in context, so the next attempt avoids the same mistake ✅[^manus].
8. **Compress.** Near the limit, the history is compacted. The summary keeps decisions and unresolved bugs, and drops redundant tool output ✅[^ant_ctx]. Old raw test logs are the safest to clear ✅[^ant_ctx].
9. **Resume.** The new window holds:
   - the same cached prefix;
   - the summary;
   - the to-do list, read back from its file.

   Work continues with little loss.

---

## 8. Design checklist

1. **Make the prefix stable and append-only.** System prompt and tools first, nothing that changes per call in them, deterministic serialisation ✅[^manus] ✅[^ant_cache].
2. **Write the system prompt at the "right altitude".** Start minimal, and add instructions only for failures you have seen ✅[^ant_ctx].
3. **Keep a small, distinct tool set.** Each tool self-contained, with a clear purpose and no overlap ✅[^ant_ctx]. Namespace related tools ✅[^ant_tools]. Return high-signal, paginated results ✅[^ant_tools].
4. **Treat instruction files as a map, not an encyclopedia.** A short entry point that points to deeper docs ✅[^openai_harness]; under 200 lines per `CLAUDE.md` ✅[^cc_memory].
5. **Prefer just-in-time retrieval for agents**, with a little loaded up front ✅[^ant_ctx].
6. **Plan for long tasks from the start:** notes file, compaction policy, which tool results to clear ✅[^ant_ctx].
7. **Use sub-agents for wide, parallel and separable work** (research, search), not for tightly coupled work like most coding ✅[^ant_multi] ✅[^cognition].
8. **Measure:** cache hit rate ✅[^manus], tokens per task ✅[^ant_multi], and the eval score as context grows ✅[^chroma].

---

## 9. Edge-case and failure matrix

| Situation | What happens | Fix |
|---|---|---|
| The answer is in context, but on page 40 of 80 | Missed: position effect ✅[^lost] | Put it near the start or end; retrieve a focused excerpt |
| A summary records a wrong conclusion | Poisoning: later turns build on it ✅[^breunig] | Keep sources and pointers alongside summaries; let the agent re-verify |
| The agent loops on the same actions after a long run | Distraction ✅[^breunig] | Compact or restart from a notes file |
| 40 MCP tools loaded "just in case" | Confusion; worse tool choice ✅[^breunig] | Fewer tools, consolidated, namespaced ✅[^ant_tools]; mask instead of removing ✅[^manus] |
| Two instruction files disagree | Clash; arbitrary pick ✅[^cc_memory] | Audit and delete the stale rule |
| Batch of similar items processed in a row | The agent copies its own earlier pattern ✅[^manus] | Add controlled variation in wording and order ✅[^manus] |
| Errors cleaned out of history | The same mistake repeats ✅[^manus] | Keep failures and traces |
| Two sub-agents build parts that do not fit | Implicit decisions conflict ✅[^cognition] | Share full traces, or use one linear agent ✅[^cognition] |
| Costs jump after a "harmless" prompt tweak | Cache prefix invalidated ✅[^ant_cache] | Move changing content after the cached prefix |
| The window is cleared between sessions | Fresh start may beat a compacted one when state lives in files and git ✅[^ant_bp] | Store progress in files, structured state in JSON, history in git ✅[^ant_bp] |

---

## 10. Verification

- **Verified on 2026-10-30:** every ✅ claim, against the sources in References: vendor posts and docs read live, the Chroma report, and arXiv.
- **Synthesis, not a sourced claim:** the "three currencies" reading in §6, and the ordering of the checklist in §8.
- **Illustrative:** the task in §7. Its steps follow documented behaviour, but no measurement was taken.
- **Diagnostic guidance:** in §9 every fix is sourced; the pairing of situation and cause follows the cited failure modes.
- **Not covered:**
  - how to build retrieval: chunking, embeddings, re-ranking;
  - the numbers for model-specific context windows, which change too often to pin here.

## References

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic Applied AI team, 2025. Backs: §1, §2 definition; §3 attention budget; §4–§9 techniques. [^ant_ctx]
- [LangChain: Context engineering for agents](https://www.langchain.com/blog/context-engineering-for-agents) — LangChain, 2025. Backs: §1 memory; §2 kinds of context; §5 write/select/compress/isolate. [^langchain_ctx]
- [Manus: Context Engineering for AI Agents: Lessons from Building Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) — Yichao Ji, 2025. Backs: §1 KV cache; §4, §5, §6, §9 caching, masking, recitation, keeping errors, few-shot ruts. [^manus]
- [Chroma: Context Rot](https://www.trychroma.com/research/context-rot) — Hong, Troynikov, Huber, 2025. Backs: §1, §3, §6, §8. [^chroma]
- [Drew Breunig: How Long Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html) — 2025. Backs: §3 four failure modes; §9. [^breunig]
- [Liu et al., Lost in the Middle](https://arxiv.org/abs/2307.03172) — TACL, 2023. Backs: §3 position; §6; §9. [^lost]
- [Simon Willison: Context engineering](https://simonwillison.net/2025/Jun/27/context-engineering/) — 2025. Backs: §2 Karpathy and Lutke quotes; why the term stuck. [^willison]
- [Cognition: Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) — Walden Yan, 2025. Backs: §2; §6, §8, §9 sub-agent conflicts. [^cognition]
- [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic, 2025. Backs: §5, §6, §8 sub-agent gains, token cost, poor fits. [^ant_multi]
- [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — Ken Aizawa, 2025. Backs: §4 25,000-token limit; §6, §8 tool results and namespacing. [^ant_tools]
- [Anthropic: Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — Anthropic, living. Backs: §1; §6 prefix order tools → system → messages, invalidation. [^ant_cache]
- [Claude Code: How Claude remembers your project](https://code.claude.com/docs/en/memory) — Anthropic, living. Backs: §4 load order, 200-line guidance; §6, §9 contradictions. [^cc_memory]
- [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) — Ryan Lopopolo, 2026. Backs: §4, §6, §8 the map-not-manual `AGENTS.md`. [^openai_harness]
- [Anthropic: Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — Anthropic, living. Backs: §9 fresh window vs. compaction; state in files and git. [^ant_bp]
- `copilot/atlas/` — this repo's own "map, not manual" for agents: one registry and generated pages that point to every file.

## Related

- [Prompt engineering deep dive](prompt-engineering-deep-dive.md) — the instruction part of the context.
- [Harness engineering deep dive](harness-engineering-deep-dive.md) — the code that builds the context; §3 compares all five disciplines.
- [Loop Engineering](loop-engineering.md) — how the context grows turn by turn inside the agent loop.
- [Graph Engineering study guide](graph-engineering-study-guide.md) — explicit state objects and routing.
