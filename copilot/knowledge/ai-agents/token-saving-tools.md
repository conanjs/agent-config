---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: draft
applies-to: ["Claude Code and Codex, as of 2026-10-30", "GitHub activity read through the GitHub API on 2026-10-30"]
last-verified: 2026-10-30
last-updated: 2026-10-30
tags: [tokens, tools, claude-code, codex, mcp, hooks, rtk, ccusage, serena, repomix, context7]
---

# Tools and techniques that cut agent tokens

## Summary
**TL;DR:** Third-party tools save tokens in five ways: they report usage (ccusage), shrink command output before the agent reads it (RTK), retrieve only the code that matters (Serena, code-review-graph, LSP plugins), pack or reformat data (Repomix, TOON), or remember across sessions (claude-mem). The vendors' own techniques (tool search, code execution with MCP, subagents, skills) often save more. Every savings figure from a tool's README is the vendor's own measurement: measure on your work before relying on it.
**Use this when:** choosing a tool to make Claude Code or Codex use fewer tokens, or checking whether a tool is maintained and how it plugs in.
**Not this doc:** the built-in settings and commands → `claude-code-usage-reference.md`, `codex-usage-reference.md`; how to measure before and after → `measure-agent-tokens.md`.

## Scope
Open-source tools that work with Claude Code, Codex or both, plus the token-saving techniques Anthropic and OpenAI have published. Stars, last push and licence were read through the GitHub API on 2026-10-30 ✅[^1]. Integration details come from each project's README on the same day ✅[^2].

## Catalog

### Third-party tools

| Tool | What it does | Works with / how it plugs in | Savings evidence | GitHub (stars · last push · licence) |
|---|---|---|---|---|
| [ccusage](https://github.com/ccusage/ccusage) | Daily, monthly and session token and cost reports from local agent logs; cache reads and writes shown apart; a status line mode ✅[^2] | Claude Code, Codex (`ccusage codex daily`), GitHub Copilot CLI, Gemini CLI and more; CLI via `npx ccusage` ✅[^2] | Measures only | 19.3k · 2026-10-30 · Other |
| [Claude Code Usage Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) | Live terminal monitor with burn-rate predictions and warnings ✅[^1] | Claude Code; CLI | Measures only | 8.8k · 2026-07-05 · MIT |
| [ccstatusline](https://github.com/sirmalloc/ccstatusline) | Configurable status line (context, cost, git) ✅[^1] | Claude Code `statusLine` setting | Measures only | 13.5k · 2026-10-30 · MIT |
| [RTK](https://github.com/rtk-ai/rtk) | Filters and compresses shell output (git, ls, test runners) before it reaches the context ✅[^2] | Claude Code: `rtk init -g` installs a `PreToolUse` hook; Codex: `rtk init -g --codex`; `rtk gain` shows savings ✅[^2] | "Up to 90% smaller" bash output; RTK estimates tokens as bytes ÷ 4 ⚠️ unverified | 85.1k · 2026-10-30 · Apache-2.0 (full edition also BUSL-1.1; `rtk-oss` is Apache-only) |
| [Serena](https://github.com/oraios/serena) | Symbol-level code retrieval and editing through language servers (LSP) ✅[^2] | MCP server; Claude Code, Codex and the Codex app named in the README ✅[^2] | No figure in the README | 30.9k · 2026-10-28 · Other |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | Tree-sitter graph of the code; answers "callers, dependents, tests" with a small slice ✅[^2] | MCP server plus hooks and skills; `--platform claude-code` or `codex` ✅[^2] | 208,821 source tokens → about 3,190 per question in the project's own capture ⚠️ unverified | 32.5k · 2026-10-29 · MIT |
| [Claude Context](https://github.com/zilliztech/claude-context) | Semantic (vector) code search ✅[^2] | MCP server; needs a Milvus or Zilliz Cloud vector database ✅[^2] | No figure checked | 12.7k · 2026-07-14 · MIT |
| [ast-grep](https://github.com/ast-grep/ast-grep) | Structural code search and rewrite on syntax trees ✅[^1] | CLI the agent can call | Fewer, more precise matches than text search ⚠️ unverified | 16.4k · 2026-10-30 · MIT |
| [Context7](https://github.com/upstash/context7) | Current library docs on demand, instead of the agent guessing or crawling ✅[^2] | CLI plus a skill (no MCP), or an MCP server; needs an API key; backend is closed source ✅[^2] | No figure checked | 64.0k · 2026-10-30 · MIT |
| [Repomix](https://github.com/yamadashy/repomix) | Packs a repository into one file with per-file token counts; `--compress` keeps code structure only; `--token-budget` fails above a limit ✅[^2] | CLI or MCP | Token counts are measured with a named tokenizer (default `o200k_base`) ✅[^2] | 29.1k · 2026-10-28 · MIT |
| [TOON](https://github.com/toon-format/toon) | A compact text encoding of JSON data for prompts ✅[^2] | Library; use when feeding large uniform tables to a model | README example: about 117 → 66 tokens (−43.6%); for deeply nested or uneven data, compact JSON can win ✅[^2] | 25.6k · 2026-10-09 · MIT |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Captures what the agent did through lifecycle hooks, compresses it, and brings it back in later sessions ✅[^2] | Claude Code plugin hooks; a local worker with SQLite; the installer also offers a sign-in that provisions a key for a hosted service ✅[^2] | "Token cost visibility" only; no figure checked | 105.7k · 2026-10-30 · Apache-2.0 |
| [Claude Code Router](https://github.com/musistudio/claude-code-router) | Routes requests to other models or providers (for example a cheaper model for background work) ✅[^1] | Local proxy in front of Claude Code | Saves money, not tokens | 37.9k · 2026-10-10 · MIT |
| [LiteLLM](https://github.com/BerriAI/litellm) | Gateway that tracks spend per key ✅[^1] | `ANTHROPIC_BASE_URL` for Claude Code; Anthropic's cost guide names it as used by enterprises, unaffiliated and not audited ✅[^3] | Measures and caps spend | 62.4k · 2026-10-30 · Other |
| [LLMLingua](https://github.com/microsoft/LLMLingua) | Research method that compresses prompts with a small model ✅[^1] | Python library for your own pipeline; no agent integration | Paper results, not agent sessions ⚠️ unverified | 6.8k · 2026-09-10 · MIT |

### Vendor techniques

| Technique | Where | Published effect | Status |
|---|---|---|---|
| Tool search (load tool definitions only when needed) | Anthropic API; Claude Code defers MCP tool definitions by default | 85% fewer tokens in Anthropic's test | ✅[^4][^3] |
| Programmatic tool calling (the model writes code that calls tools; results stay out of context) | Anthropic API | 43,588 → 27,297 tokens on average (−37%) on complex research tasks | ✅[^4] |
| Code execution with MCP (MCP servers as code APIs) | Any agent with a code sandbox | 150,000 → 2,000 tokens (−98.7%) in Anthropic's example | ✅[^5] |
| Skills (only name and description load until used) | Claude Code; Codex caps the skill list at 2% of the window | Moves rarely used instructions out of every request | ✅[^3][^6] |
| Subagents for verbose work | Claude Code, Codex | Keeps logs and file reads out of the main context; the subagent's own tokens still count | ✅[^3][^6] |
| A `PreToolUse` hook that filters command output | Claude Code | Official example keeps only test failures | ✅[^3] |
| Code intelligence (LSP) plugins | Claude Code | One go-to-definition call instead of grep plus several file reads | ✅[^3] |

## Lookup notes
- **Which to try first:** usage reports → ccusage; long test or git output → a `PreToolUse` filter hook, or RTK; many file reads to find code → Serena, code-review-graph or an LSP plugin; stale or guessed library APIs → Context7; one-shot review of a whole repo → Repomix with `--compress`.
- **Overlap:** RTK and a hand-written `PreToolUse` filter both rewrite Bash commands; use one.
- **Tools cost context too:** every MCP server adds to each request in Codex ✅[^6]. In Claude Code only tool names load until a tool is used ✅[^3].
- **Trust:** these tools run hooks or proxies on your commands, and some send data to hosted services (Context7, Claude Context, claude-mem's sign-in); read what leaves the machine before installing.
- **Prove it:** run the same task with and without the tool and compare peak context, output and cache reads (`measure-agent-tokens.md`).

## Takeaways
- Start with the free built-ins (clear, compact, subagents, hooks, skills, deferred MCP tools), then add one tool at a time and measure it.
- Prefer tools that keep large data out of the context (filters, symbol-level retrieval) over tools that only make it shorter.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 36 claims (✅) · Unverified: 4 claims (⚠️) · Last verified: 2026-10-30

## References
- GitHub REST API `repos/<owner>/<repo>` (via `gh api`) — read 2026-10-30. Backs: descriptions, stars, last push, licence for every tool row. [^1]
- Each tool's `README.md` on its default branch (via `gh api repos/<owner>/<repo>/readme`) — read 2026-10-30. Backs: what each tool does, how it plugs in, and the vendor's own savings figures. [^2]
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — Anthropic, living. Backs: deferred MCP tools, LiteLLM note, hooks example, skills, subagents, code intelligence plugins. [^3]
- [Introducing advanced tool use for Claude](https://www.anthropic.com/engineering/advanced-tool-use) — Anthropic, 2025. Backs: tool search 85%, programmatic tool calling 37%. [^4]
- [Code execution with MCP for efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp) — Anthropic, 2025. Backs: 150,000 → 2,000 tokens. [^5]
- [Pricing](https://learn.chatgpt.com/docs/pricing) (Codex docs), [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) and [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) — OpenAI, living. Backs: MCP servers add context; skills budget; subagents return summaries and cost extra tokens. [^6]

## Related
- `ai-agents/measure-agent-tokens.md`
- `ai-agents/agent-token-accounting.md`
- `ai-agents/context-engineering-deep-dive.md`
- `ai-agents/harness-engineering-deep-dive.md`
