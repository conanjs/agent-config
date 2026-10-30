# Implementation Plan: A navigation map and coordinator for agent-config

**Branch**: `feat/mod-11-and-coordinator` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A registry, `copilot/atlas/atlas.yaml`, names every **area** (a branch of the tree) and every **kind** of file (a glob, its schema, index, validator, scenarios and install target), for agent-config and for each stack reference repo. A dependency-free tool, `copilot/atlas/tools/atlas.mjs`:

- **validates** (default): every file belongs to exactly one kind, every named path exists, every kind and area hangs from the root, and the generated map is current;
- **writes** (`--write`): `copilot/atlas/index.md` (the tree down to kinds, and the chains between kinds) and `copilot/atlas/map/<repo>/<area>.md` (every file, under its kind);
- **explains** (`--explain <path>`): a file's path up the tree to the root, its kind's facts, and the files that link to it.

A new `coordinator` role owns the registry and answers "where is it, what checks it, where do I start", with a navigation tree (`NAV`) that routes a request to the right entry point.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 24 (`.nvmrc`); no runtime dependencies (it is installed under `~/.copilot` without `node_modules`)
**Testing**: Cucumber scenarios in `tests/atlas/` (TST-14)
**Scale**: 557 tracked files in agent-config today; the reference repo is mapped when its clone is passed with `--repo`

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. One source of truth | The registry is the only hand-written map; every map page is generated from it | Pass |
| II. Typed and validated | `atlas.schema.md` defines the registry with rule ids `AT-n`; the tool prints those ids | Pass |
| IV. Tools have requirements and tests | Cucumber scenarios for every `AT-n`, plus the traceability scenarios | Pass |
| V. Options, not overwrites | Spec options A–C and the coordinator comparison are kept in `spec.md` | Pass |

## Project Structure

```text
copilot/atlas/                      # deployed to ~/.copilot/atlas (mapping.yaml)
├── atlas.yaml                      # the registry (hand-written)
├── schemas/atlas.schema.md         # atlas/v1: fields and AT-n rules
├── tools/atlas.mjs                 # validate | --write | --explain <path> | --repo <id>=<path>
├── index.md                        # generated: the tree down to kinds, and the chains
└── map/<repo>/<area>.md            # generated: every file under its kind
copilot/frameworks/agentic-sdlc/
├── agents/coordinator.md           # the new role
└── trees/navigation.tree.md        # NAV: where a request starts
copilot/agents/sdlc-coordinator.agent.md, claude/agents/sdlc-coordinator.md, codex/agents/sdlc-coordinator.toml
skills/sdlc-coordinator-preset/SKILL.md
tests/atlas/{tool.mjs, atlas.feature, fixtures/base/}
```

## Complexity Tracking

> _No constitution violations._
