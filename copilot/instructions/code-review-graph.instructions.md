---
name: Code review graph
description: Use code-review-graph MCP tools for token-efficient codebase exploration and code review, on any project with an indexed graph.
applyTo: "**"
---

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: Prefer the code-review-graph MCP tools over file/search tools when
the current project has an indexed knowledge graph.** The graph is faster,
cheaper (fewer tokens), and gives you structural context (callers,
dependents, test coverage) that file scanning cannot.

If a tool call reports no graph found for the current directory, fall back
to normal file/search tools — the project hasn't been indexed yet (run
`code-review-graph build` in that repo to index it).

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph`
- **Understanding impact**: `get_impact_radius`
- **Code review**: `detect_changes` + `get_review_context`
- **Finding relationships**: `query_graph` callers_of/callees_of
- **Architecture questions**: `get_architecture_overview`

Fall back to file/search tools **only** when the graph doesn't cover what
you need, or no graph exists for the current project.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Risk-scored change analysis |
| `get_review_context` | Token-efficient source snippets |
| `get_impact_radius` | Blast radius of a change |
| `get_affected_flows` | Impacted execution paths |
| `query_graph` | Trace callers, callees, imports, tests |
| `semantic_search_nodes` | Find functions/classes by keyword |
| `get_architecture_overview` | High-level structure |
| `refactor_tool` | Rename planning, dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks), once built for a
   project.
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
