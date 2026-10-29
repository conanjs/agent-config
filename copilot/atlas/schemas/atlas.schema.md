---
schema: schema/v1
last-updated: 2026-10-29
---

# Schema: Atlas registry (`atlas/v1`)

**Applies to:** `copilot/atlas/atlas.yaml` · **Written by:** the `coordinator` role, or whoever adds a new kind of file · **Read by:** the coordinator, any agent or person looking for where something is, and `tools/atlas.mjs` · **Generated from it:** `copilot/atlas/index.md` and `copilot/atlas/map/<repo>/<area>.md` (never edited by hand)

The atlas is the map of everything: every repo, every **area** (a branch of the tree), every **kind** of file (one glob with its schema, index, validator, scenarios and install target), and the **chains** between kinds. It is a tree: root → repo → area → (sub-area …) → kind → file. Every file sits under exactly one kind, so every file is linked from a page above it and nothing is reachable only by knowing its name.

Analogy: a library catalogue. Floors are repos, rooms are areas, shelves are kinds, books are files; the catalogue card for a shelf says what belongs there, which rules it follows and who checks it.

## Format

One flow mapping per line, under four top-level keys, like `mapping.yaml` and the `roles:` block of `agentic-sdlc/conventions.md`. Values with commas or colons are quoted. `—` means "none".

```yaml
repos:
  - { id: <repo id>, root: <path, relative to agent-config, or {{REFERENCE_REPOS_ROOT}}/…>, ref: <git ref to list, or —>, url: <web base for links, or —>, title: "<name>", summary: "<one line>" }
areas:
  - { id: <area id>, repo: <repo id>, parent: <root | area id>, title: "<name>", summary: "<one line>" }
kinds:
  - { id: <kind id>, area: <area id>, home: "<glob, relative to the repo root>", title: "<name>", summary: "<one line>", schema: <path | —>, index: <path | —>, checked-by: "<tool and codes | —>", tests: <path | —>, deploy: "<install target | —>" }
edges:
  - { from: <kind id>, to: <kind id>, via: "<what links them>", checked-by: "<check | —>" }
```

- `ref`: for a repo other than agent-config, the git ref whose files are listed (`git ls-tree`), so the map does not change with what is checked out. agent-config is listed from its working tree (tracked and untracked files, ignored ones left out).
- `home` globs: `*` (no `/`), `**` (any depth), `{a,b}` (either). A file belongs to the **first** kind, in file order, whose `home` matches, so specific kinds come before general ones.
- Paths in `schema`, `index`, `tests` are relative to the kind's repo root.

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| AT-1 | Every file of a present repo belongs to a kind | no file is left without a kind | script |
| AT-2 | Every kind of a present repo matches at least one file | no kind is empty | script |
| AT-3 | Every path a kind names (`schema`, `index`, `tests`) exists, or is `—` | each one resolves | script |
| AT-4 | The tree is whole: every kind's `area` is an area of the kind's repo, and every area's `parent` is `root` or an area of the same repo, without cycles | each kind reaches its repo by parent links | script |
| AT-5 | The generated pages are current: `index.md` and `map/<repo>/<area>.md` equal what `--write` produces | no difference | script |
| AT-6 | Ids are unique in their list, every entry has its required fields, and every edge names existing kinds | — | script |
| AT-7 | A repo whose root or `ref` is not present is skipped with a warning, and its pages are left as they are | — | script (warn) |

## Checks

| Check | Tool |
|---|---|
| AT-1 … AT-7 | `node copilot/atlas/tools/atlas.mjs` (also run by `scripts/check-docs.sh`: pre-commit, Claude Code hook, CI) |
| Where is a file or folder, what checks it, what names it, what depends on it | `node copilot/atlas/tools/atlas.mjs --explain <path>` |
| Regenerate the pages after editing the registry | `node copilot/atlas/tools/atlas.mjs --write` |

## References

- `copilot/atlas/atlas.yaml` — the registry this schema defines.
- `specs/009-navigation-map/` — why the atlas exists, its options and decisions.
- [git ls-files](https://git-scm.com/docs/git-ls-files) — `--cached --others --exclude-standard`: tracked and untracked files, ignored ones left out.
- [git ls-tree](https://git-scm.com/docs/git-ls-tree) — `-r --name-only <ref>`: the files of one commit, whatever is checked out.

## Related

- `copilot/frameworks/agentic-sdlc/agents/coordinator.md` — the role that owns the atlas.
- `copilot/patterns/artifact-types.pattern.md` — which kind of artifact something is.
