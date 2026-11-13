---
schema: topic-index/v1
kind: topic
topic: documentation
last-updated: 2026-11-13
---

# Documentation

Technical explanation design, learning prompts, and team-document conventions. Artifact-format references are in formats/; this topic does not define company-specific product requirements.

## Docs

| Doc | Type | Summary | Status |
| --- | --- | --- | --- |
| [Learning Explanation Framework](learning-explanation-framework.md) | how-to | Scale and draft an explanation; prompts, worked example, evidence checks, and recall notes | draft |
| [Interface description standards](interface-description-standards.md) | reference | Which machine-readable format describes each kind of interface (HTTP, events, JSON-RPC, CLI, JSON data, TypeScript library) and how a repo catalogs them | verified |
| [OpenCLI: the two specifications that share one name](opencli-deep-dive.md) | deep-dive | opencli.org (draft 0.1, Spectre.Console, .NET) versus opencli.dev (alpha, `ocli`): every object, one command in both, edge-case matrix | verified |
| [usage (jdx): a CLI described once, checked and generated](usage-spec-deep-dive.md) | deep-dive | KDL nodes, `effect`, outputs with JSON Schema, exit codes, env and config; lint, diff, generators, exporters; CI flow, edge cases | verified |
| [Describing a command-line program: every format compared](cli-description-formats-deep-dive.md) | deep-dive | docopt, Fig/Amazon Q, carapace-spec, argc, .NET `--cli-schema`, POSIX and clig.dev; feature matrix, decision guide, failure modes | verified |
| [Markdown link targets in VS Code](markdown-link-targets-in-vscode.md) | reference | How `/`, `./` and unprefixed link targets resolve in VS Code; why a relative target reaches a file outside the workspace | verified |
| [Doc template base](doc-template-base.md) | legacy | Existing team-facing language and structure conventions | — |
| [Lessons learned](lessons-learned.md) | legacy | Existing lessons from preparing team documents | — |

## Subtopics

| Subtopic | Summary |
| --- | --- |
| [formats/](formats/) | Existing Markdown, HTML, Word, PDF, and Excel format guides |

## References

- `../../frameworks/knowledge/schemas/_system.md` — document types, claim marking, and index conventions.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: explanation and how-to serve different documentation needs.

## Related

- [Global knowledge](../index.md).
