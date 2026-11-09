---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["OpenAI, Anthropic, Google and GitHub Copilot docs read 2026-11-09", "tiktoken 0.14.0", "Claude Code 2.1.318", "GitHub Copilot CLI 1.0.105", "Codex CLI 0.166.0-alpha.6", "gpt-6.1-sol, claude-sonnet-5.5, claude-opus-5.5 (measured 2026-11-09)"]
last-verified: 2026-11-09
last-updated: 2026-11-09
tags: [tokenizer, tokens, tiktoken, count-tokens, o200k_base, claude, gemini, copilot, codex, measurement]
---

# Counting tokens for the models behind coding agents

## Summary
**TL;DR:** Each model vendor counts tokens with its own tokenizer, so measure text with the tokenizer of the model that will read it. OpenAI publishes a local tokenizer (`tiktoken`) and a count endpoint. Anthropic publishes only a count endpoint, free but rate-limited. Google publishes a count endpoint and a local tokenizer in its SDK. GitHub Copilot publishes no tokenizer; it runs other vendors' models. Measured on 2026-11-09: `gpt-6.1-sol` counts exactly as `tiktoken`'s `o200k_base`, and Claude Opus 5.5 and Claude Sonnet 5.5 count Markdown instructions at about 1.60 times that, in Claude Code and in Copilot CLI. A tokenizer measures the size of a file. The agent's own usage records measure what a session really sent.
**Use this when:** measuring how many tokens an instruction file, skill or prompt costs in Claude Code, Codex, GitHub Copilot or another coding agent, or comparing counts across vendors.
**Not this doc:** what each usage field means → `agent-token-accounting.md`; where each agent records usage → `claude-code-usage-reference.md`, `codex-usage-reference.md`, `copilot-usage-reference.md`; scripts → `measure-agent-tokens.md`.

## Scope
Covered: the counting tools that OpenAI, Anthropic and Google document for their models, and what GitHub Copilot documents about the models it runs. Official pages were read on 2026-11-09, and `tiktoken` 0.14.0 was tested on macOS the same day. Not yet covered: the other providers Copilot lists (Microsoft, Moonshot AI, xAI).

**Analogy:** each vendor's tokenizer is a different set of scissors for cutting text into tokens. The same page gives a different number of pieces with each pair of scissors. Count with the scissors the model will use.

## Catalog

### Official counting tools per vendor

| Vendor | Local tokenizer | Count endpoint | Exact or estimate | Cost and limits | Status |
|---|---|---|---|---|---|
| OpenAI | `tiktoken`: "a fast BPE tokeniser for use with OpenAI's models"; `get_encoding("o200k_base")` or `encoding_for_model(<model>)` | `POST /v1/responses/input_tokens`: the same input format as the Responses API (text, messages, images, files, tools, conversations) | The endpoint returns "the exact count the model will receive" | Not stated; the examples send an API key | ✅[^1][^2] |
| Anthropic | None published; the docs give the endpoint as the way to count | `POST /v1/messages/count_tokens`: system prompts, tools, images and PDFs, as for creating a message. Images and PDFs must be base64. Server tools (web search, web fetch, code execution, tool search) and the MCP connector are rejected | "An estimate"; the real count "might differ by a small amount". It may include tokens Anthropic adds, which are not billed | Free; requests per minute by usage tier (5,000 / 10,000 / 20,000), separate from message limits; needs an API key | ✅[^3] |
| Google (Gemini) | `LocalTokenizer` in the `google-genai` SDK (`from google.genai.local_tokenizer import LocalTokenizer`), documented on the Agent Platform pages (preview); token listing accepts text only | `POST /v1beta/models/{model}:countTokens`: "Runs a model's tokenizer on input `Content`" | Media counts (images, video, audio) are estimates; billing truth is the response's `usage_metadata` | Agent Platform: "no charge or quota restriction", maximum 3,000 requests per minute | ✅[^4][^5] |
| GitHub Copilot | None | None | — | Each token is priced per model and converted to AI credits (1 credit = $0.01) | ✅[^6][^7] |

### Which tokenizer a model uses

| Model family | Tokenizer | Status |
|---|---|---|
| OpenAI GPT-4o and GPT-5.6 models | `tiktoken.encoding_for_model` returns `o200k_base` (tested: `gpt-4o`, `gpt-5.6-sol`) | ✅[^8] |
| OpenAI GPT-6 family | `tiktoken` 0.14.0 cannot map the names: `encoding_for_model("gpt-6.1-sol")` raises `KeyError` (tested). No official page names the encoding. Issue #608 asking for it was "Closed as not planned" with no maintainer reply; one comment reports an experiment suggesting GPT-6 uses GPT-5's tokenizer | ✅[^8][^9] |
| OpenAI `gpt-6.1-sol` (measured) | Counts text exactly as `o200k_base`: 3,432 tokens for a 14,778-character Markdown file in Codex, 3,430–3,432 in Copilot, against 3,432 from `tiktoken` | ✅[^13] |
| Claude 4.7 and later, Claude Mythos Preview | A newer tokenizer: "approximately 30% more tokens for the same text" than earlier models; the exact increase depends on the content | ✅[^3][^10] |
| Claude Fable 5, Fable 5.1, Mythos 5, Mythos 5.1 | Share the tokenizer introduced with Claude Opus 4.7: a prompt counts the same on all four | ✅[^3] |
| Claude Sonnet 4.6 and earlier | The previous tokenizer | ✅[^10] |
| Claude Opus 5.5 and Claude Sonnet 5.5 (measured) | The same 14,778-character Markdown file. Claude Code 2.1.318: 5,478 (Opus 5.5) and 5,471 (Sonnet 5.5). Copilot CLI 1.0.105: 5,494 (Opus 5.5) and 5,502 (Sonnet 5.5). That is 1.59–1.60 times `o200k_base`; the two models agree within 8 tokens in each agent | ✅[^13] |
| Gemini | "A token is equivalent to about 4 characters"; "100 tokens is equal to about 60-80 English words" | ✅[^4] |
| Models in GitHub Copilot | Copilot lists models from OpenAI, Anthropic, Google, Microsoft, Moonshot AI and xAI. No page says which tokenizer Copilot's counts follow | ✅[^6] |

### What each coding agent shows about its own context

| Agent | Command | What it shows | Status |
|---|---|---|---|
| Claude Code | `/context` (`/context all` expands it) | Context usage as a colored grid, with suggestions for context-heavy tools and memory bloat | ✅[^11] |
| Claude Code | `/usage` (`/cost` is an alias) | Session token statistics; session cost computed locally from token counts at list price | ✅[^11] |
| Copilot CLI | `/context` | Active model and tokens in use, then: System Prompt, Custom Instructions (only when present), System Tools, MCP Tools, Messages, Free Space, Buffer | ✅[^12] |
| Codex | `/status`, `codex exec --json` | See `codex-usage-reference.md` | — |

### Local test, 2026-11-09 (tiktoken 0.14.0, macOS 26.1)

| Text | Bytes | `o200k_base` tokens | Status |
|---|---:|---:|---|
| `copilot/instructions/personal-defaults.instructions.md` | 11,285 | 2,599 | ✅[^8] |
| `copilot/instructions/answer-patterns.instructions.md` | 1,546 | 372 | ✅[^8] |
| `copilot/instructions/code-review-graph.instructions.md` | 1,942 | 460 | ✅[^8] |

## Lookup notes
- **A tokenizer measures text, not a request.** The OpenAI guide says local tokenizers work for plain text, but images, files, tools and schemas "add tokens that are hard to count locally", and the request includes formatting tokens for roles and boundaries ✅[^1]. An agent also sends its own system prompt and tool list, and each extra model request sends the context again. Use a tokenizer for the size of a file or clause. Use the agent's usage records for the real cost of a session.
- **Order of preference when measuring a file for one model:**
  1. The vendor's local tokenizer, when it maps that model.
  2. The vendor's count endpoint.
  3. The agent's own breakdown (`/context`).
  4. Another vendor's tokenizer, labeled as a reference only.

  Never compare raw counts across vendors.
- **Copilot:** count with the tokenizer of the vendor whose model is selected. Copilot runs other vendors' models and documents no tokenizer of its own ✅[^6].
- **Claude:** recount for each model. Counts from before Claude 4.7 do not carry over ✅[^3].
- **GPT-6:** `encoding_for_model` fails, so use `get_encoding("o200k_base")` ✅[^8]. OpenAI has not documented the encoding ✅[^9], but for `gpt-6.1-sol` the service's own counts matched `o200k_base` exactly ✅[^13]. Check other GPT-6 models the same way before relying on it.
- **No API key, only a subscription:** measure a file's size in the model's own tokenizer from the agent's usage records. Run the same one-word prompt in a fresh folder twice, once with a one-line project instructions file and once with that line plus the file under test. The difference in the first request's input tokens is the file's size. It repeated within 2 tokens, while the rest of the context moved by up to 14 tokens between runs ✅[^13]. Copilot adds the file once: with `gpt-6.1-sol` the difference equals the `o200k_base` count ✅[^13].
- **Claude Code: hold MCP servers fixed.** In `claude -p`, the claude.ai connectors (remote MCP servers linked to the account) were connected in some sessions and not in others. That moved the first request by about 4,000 tokens between otherwise identical runs ✅[^13]. Pass `--strict-mcp-config` with no `--mcp-config`: then no MCP server loads, and the pairs repeated within 3 tokens ✅[^13].
- **Converting a count between vendors:** for Markdown instructions, Claude Opus 5.5 and Claude Sonnet 5.5 count 1.59–1.60 times `o200k_base`, in Claude Code and in Copilot CLI ✅[^13]. Measure the ratio on your own text, because it depends on the content ✅[^3].
- **API keys:** every count endpoint here needs the vendor's API key. A subscription to the agent (Claude Pro, ChatGPT, Copilot) does not provide one.

## Takeaways
- Count a file with the tokenizer of the model that reads it, and label which tokenizer produced every number. [rule-candidate]
- Measure a design change with the agent's own usage records. Tokenizer counts only explain where the difference comes from.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 31 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-09

## References
- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting) and [Get input token counts](https://developers.openai.com/api/reference/python/resources/responses/subresources/input_tokens/methods/count) — OpenAI, living, read 2026-11-09. Backs: `POST /v1/responses/input_tokens`, its inputs, "exact count", the limits of local tokenizers, formatting tokens. [^1]
- [tiktoken README](https://github.com/openai/tiktoken/blob/main/README.md) — OpenAI, living, read 2026-11-09. Backs: what `tiktoken` is, `get_encoding`, `encoding_for_model`. [^2]
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) and [Count tokens in a Message](https://platform.claude.com/docs/en/api/messages/count_tokens) — Anthropic, living, read 2026-11-09. Backs: the endpoint, inputs and exceptions, "estimate", free use, rate limits, system-added tokens, the shared Fable and Mythos tokenizer, recounting per model. [^3]
- [Understand and count tokens](https://ai.google.dev/gemini-api/docs/tokens) (now served at aistudio.google.com/docs/tokens) and [Counting tokens API](https://ai.google.dev/api/tokens) — Google, living, read 2026-11-09. Backs: `countTokens`, about 4 characters per token, 60–80 words per 100 tokens. [^4]
- [List and count tokens](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/list-token) and [Use the Count Tokens API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/get-token-count) — Google Cloud, preview, read 2026-11-09. Backs: `LocalTokenizer`, text-only token listing, no charge, 3,000 requests per minute, media estimates, `usage_metadata`. [^5]
- [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models) — GitHub, living, read 2026-11-09. Backs: the six model providers; no tokenizer statement. [^6]
- [Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing) — GitHub, living, read 2026-11-09. Backs: per-model token prices converted to AI credits, 1 credit = $0.01. [^7]
- Local test, 2026-11-09, macOS 26.1, Python `tiktoken` 0.14.0: `encoding_for_model` on `gpt-4o`, `gpt-5.6-sol`, `gpt-6.1-sol`, `gpt-6-astra`; `get_encoding("o200k_base")` on the three `copilot/instructions` files. [^8]
- [tiktoken issue #608: Update for gpt-6 models](https://github.com/openai/tiktoken/issues/608) — opened 2026-09-24, closed as not planned, read 2026-11-09. Backs: no GPT-6 mapping in 0.14.0, no maintainer reply, a commenter's experiment. [^9]
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Anthropic, living, read 2026-11-09. Backs: the newer tokenizer from Claude 4.7, about 30% more tokens, Sonnet 4.6 and earlier on the previous one. [^10]
- [Commands](https://code.claude.com/docs/en/commands) and [Manage costs effectively](https://code.claude.com/docs/en/costs) — Anthropic, living, read 2026-11-09. Backs: `/context`, `/usage`, `/cost` alias, local cost estimate. [^11]
- [Managing context for GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/context-management) — GitHub, living, read 2026-11-09. Backs: the `/context` categories. [^12]

- Local measurement, 2026-11-09:
  - **Agents and models:** Codex CLI 0.166.0-alpha.6 with `gpt-6.1-sol`, read from its rollout files. GitHub Copilot CLI 1.0.105 with `gpt-6.1-sol`, `claude-sonnet-5.5` and `claude-opus-5.5`, read from its `session.usage_checkpoint`. Claude Code 2.1.318 (`claude -p --output-format stream-json`, with and without `--strict-mcp-config`) with `claude-opus-5-5` and `claude-sonnet-5-5`, read from the first assistant message's `usage`.
  - **Setup:** each with a project instructions file of one line, or that line plus the three `copilot/instructions` files (14,778 characters). Prompt "Reply with the single word OK.", two runs per variant.
  - **Details:** method and numbers in agent-config `proposals/instruction-loading.md` section 6.1. [^13]

## Related
- `ai-agents/agent-token-accounting.md` — why one agent turn is many requests.
- `ai-agents/codex-usage-reference.md` — the 2026-11-07 benchmark of instruction files pointed to from `AGENTS.md`.
- `ai-agents/copilot-usage-reference.md` — per-call tokens and AI credits in Copilot's logs.
- `ai-agents/measure-agent-tokens.md` — scripts that read an agent's usage records.
