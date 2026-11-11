---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Claude Code (docs read 2026-11-11)", "Copilot CLI and VS Code Copilot (docs read 2026-11-11)", "Codex (docs read 2026-11-11)"]
last-verified: 2026-11-11
last-updated: 2026-11-11
tags: [plugins, mcp, tools, context, token-cost]
---

# Plugins and MCP servers: what they add to each session

## Summary
**TL;DR:** An enabled plugin costs context in every session, even one that never uses it: its model-invocable skills and agents are listed on every turn. MCP servers cost far less where tools are deferred (Claude Code's tool search, Copilot CLI's `deferTools`), and a lot where they are not. Turn plugins on per project, and keep rarely used MCP servers inside the one subagent that needs them.
**Use this when:** installing a plugin or MCP server, choosing between global and per-project enabling, or finding why a session's tool or skill list grew.
**Not this doc:** the whole start-up block per agent → [What each coding agent loads at session start](session-start-context-by-agent.md); third-party tools that trim MCP output → [Tools that cut agent tokens](token-saving-tools.md).

## Scope
Plugins (installable bundles of skills, agents, hooks and MCP server configurations) and MCP servers (Model Context Protocol: a standard plug that connects an agent to an outside tool, like a power socket that any appliance fits). Example: a Postman plugin brings 19 skills and an MCP server; once enabled, its 19 skill descriptions are in every Claude Code request. Covers Claude Code, Copilot CLI, VS Code Copilot and Codex, as documented on 2026-11-11.

## Catalog

### Plugins

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| What a plugin can bring | Skills, subagents, commands, hooks, MCP servers | Skills, agents, hooks, MCP server configurations, LSP servers; Agent Plugins 1.0 standardizes skills and MCP servers, other parts are client-specific | Skills, MCP servers, custom agents, hooks, canvases, automation templates | Skills and MCP servers | ✅[^ccpl][^ghpl][^vspl][^cxpl] |
| Context cost when enabled | Name and description of each model-invocable skill, agent and command, on every turn, even when nothing from the plugin runs; full text only when used | Not stated; plugin skills appear in the skill list like other skills | Not stated; plugin skills appear with local ones | Installed plugins add skills and MCP tools to new chats | ✅[^ccpl][^ghref][^vspl][^cxpl] |
| See the cost before installing | Official marketplace shows a **Context cost** estimate in `/plugin`; `/skill-doctor` reports per-skill cost and use | — | — | — | ✅[^ccpl][^ccsk] |
| Turn off without uninstalling | `/plugin` or `claude plugin disable`; `enabledPlugins` per settings scope (user, project, local); `"<name>@synced": false` for one synced plugin | Manage the plugin; plugin skills cannot be removed with `/skills remove` | `chat.plugins.enabled` turns plugin support on or off | — | ✅[^ccpl][^ccset][^ghsk][^vspl] |
| Skill controls that skip plugins | `skillOverrides` does not apply to plugin skills | — | — | — | ✅[^ccsk] |
| Plugin agents' limits | `hooks`, `mcpServers` and `permissionMode` are ignored in plugin subagents | — | `model-policy` is not forwarded when plugin agents are converted | — | ✅[^ccsub][^vsref] |

### MCP tool loading

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| Deferred loading | Tool search is the default: only tool names and server instructions load at start; definitions load when searched | Tool search; each server's `deferTools` is `auto` (default) or `never` (always visible) | Agent field `deferred-tool-loading` (Copilot schema); virtual tools above `github.copilot.chat.virtualTools.threshold` | Not stated | ✅[^ccmcp][^ghref][^vsref][^vstools] |
| Hard limit | None per server; the context window is the limit | Not stated | 128 tools per request | Not stated | ✅[^ccmcp][^vstools] |
| Limit tools per server | `allowedMcpServers` / `deniedMcpServers` (managed policy) | `--disable-mcp-server`, `--available-tools`, `--excluded-tools`, `--disable-builtin-mcps` | Deselect tools or servers in the tools picker | `enabled_tools`, then `disabled_tools` | ✅[^ccsub][^ghref][^vstools][^cxmcp] |
| Keep a server out of the main session | Define it inline in a subagent's `mcpServers`: "the subagent gets the tools; the parent conversation doesn't" | Agent field `mcp-servers` | Agent field `mcp-servers` | Not stated | ✅[^ccsub][^ghref][^vsref] |

## Lookup notes
- **Measured here:** the Postman plugin's 19 skills cost about 2,870 tokens and product-management's 9 about 900 in every Claude Code session (2026-11-10). Disabling them globally and enabling them in a project's `.claude/settings.json` `enabledPlugins` keeps them where they are used. See [What each coding agent loads at session start](session-start-context-by-agent.md) for the full breakdown.
- **claude.ai connectors are MCP servers too.** In Claude Code they arrive with the account and moved the first request by about 4,000 tokens between runs; `--strict-mcp-config` keeps them out of a measurement run.

## Takeaways
- Enable a plugin in the projects that use it, not in user settings. [rule-candidate]
- Put an MCP server used by one workflow in that workflow's subagent definition.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-11

## References
- [Plugins](https://code.claude.com/docs/en/plugins) — Anthropic, living, read 2026-11-11. Backs: what an enabled plugin adds, context cost estimate, disabling. [^ccpl]
- [Settings reference](https://code.claude.com/docs/en/settings-reference) — Anthropic, living, read 2026-11-11. Backs: `enabledPlugins`, `@synced`. [^ccset]
- [Extend Claude with skills](https://code.claude.com/docs/en/skills) — Anthropic, living, read 2026-11-11. Backs: `skillOverrides` skips plugin skills, `/skill-doctor`. [^ccsk]
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living, read 2026-11-11. Backs: inline `mcpServers`, plugin-agent limits, MCP policies. [^ccsub]
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) — Anthropic, living, read 2026-11-11. Backs: tool search. [^ccmcp]
- [Plugins for GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins) — GitHub, living, read 2026-11-11. Backs: plugin components, Agent Plugins 1.0. [^ghpl]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — GitHub, living, read 2026-11-11. Backs: plugin skill location, `deferTools`, tool flags, agent `mcp-servers`. [^ghref]
- [Adding agent skills for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) — GitHub, living, read 2026-11-11. Backs: plugin skills are managed through the plugin. [^ghsk]
- [Agent plugins in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-plugins) — Microsoft, living, read 2026-11-11. Backs: plugin components, `chat.plugins.enabled`. [^vspl]
- [Custom agent file reference](https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference) — Microsoft, living, read 2026-11-11. Backs: `deferred-tool-loading`, `mcp-servers`, `model-policy` conversion. [^vsref]
- [Use tools with agents](https://code.visualstudio.com/docs/agent-customization/tools) — Microsoft, living, read 2026-11-11. Backs: 128-tool limit, virtual tools, tools picker. [^vstools]
- [Plugins](https://learn.chatgpt.com/docs/plugins) — OpenAI, living, read 2026-11-11. Backs: Codex plugin contents. [^cxpl]
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp) — OpenAI, living, read 2026-11-11. Backs: `enabled_tools`, `disabled_tools`. [^cxmcp]

## Related
- [What each coding agent loads at session start](session-start-context-by-agent.md)
- [Subagent execution boundaries](subagent-execution-boundaries.md)
- [Tools and techniques that cut agent tokens](token-saving-tools.md)
