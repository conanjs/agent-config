---
schema: schema/v1
last-updated: 2026-10-27
---

# Schema: Stack Reference (`stack-reference/v1`)

**Applies to:** `stacks/<id>/reference.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** roles working on a component with this stack, and procedures that build code for it · **Loaded as:** ② (through the stack skill)

A stack reference is one small, runnable project that shows every choice of the stack in working code: folder layout, layer names, aliases, naming, doc comments, error handling, lint and tests. The rules stay in foundations, stack idioms and paradigm overlays; the reference shows what following all of them at once looks like. Analogy: the rules are the building code, the reference is the show home built to it.

**The project lives in its own repo.** One repo per stack (e.g. `conanjs/agentic-sdlc-reference-typescript-node`); this file is the framework's pointer to it, pinned by release tag **and** full commit SHA. The repo is an ordinary project for its stack: its `docs/architecture.md` follows `repo-architecture/v2`, its constitution carries the framework sections (`constitution-sdlc/v1`), its decision records follow `decision-record/v2`, and its CI runs the stack's `check` plus `validate-project.mjs` at a pinned framework commit. Architecture, constitution and glossary live **only** in the repo; this file never copies them. Roles clone it read-only into `{{REFERENCE_REPOS_ROOT}}/<stack>` (`{{AGENT_HOME}}/global-variables.md`).

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes | Stack id; equals the parent folder name |
| `repo` | yes | `owner/name` of the reference repo on GitHub |
| `pinned` | yes | The release tag roles should read, e.g. `v1.0.0` |
| `commit` | yes | The full 40-character SHA that `pinned` pointed to when verified (a tag can move; a SHA cannot) |
| `verified` | yes | Date the pinned commit last passed its `check` and `validate-project.mjs`, `YYYY-MM-DD` |
| `layout` | no | Packaging of the pinned code (`feature-first` or `layer-first`, MOD-9); required when `variants` is present |
| `variants` | no | Other maintained layouts, one flow mapping per line: `- { layout: layer-first, branch: layout/layer-first, pinned: v1.2.0, commit: <40-char SHA>, verified: YYYY-MM-DD }`. Each is kept current on its own branch with its own tag series (`patterns/maintained-variant.pattern.md`) |
| `last-updated` | no | Date of the last change to this file |

## Required structure

```markdown
# Reference: <stack display name>

## What it shows
<one paragraph: the feature, and that it exists to be copied, not deployed>

## Choices
| Concern | Choice | Rule | Where |
|---|---|---|---|

## File map
| Path | Role | Shows |
|---|---|---|

## How to fetch
<clone once into {{REFERENCE_REPOS_ROOT}}/<stack>; fetch tags and check out the pinned commit; read only; the blob URL form for one file>

## How to check
<the one command that runs every check, and what a failure means>

## Which layout                ← required when variants is present
<one row per layout: when to copy it (MOD-9), its tag, its commit>

## Using it in a repo
<what to copy, what to rename, what stays the repo's own decision>

## References
## Related
```

## Rules

- **Code wins over prose.** Every row in Choices points at a file that demonstrates it. A choice with no file is not stated.
- **No rule text.** Choices cite rule ids (`TSN-15`, `IMP-1`); the rule itself lives in its own file.
- **It must pass.** `check` (format, lint, typecheck, unit and integration tests, build, smoke) passes, and so does `validate-project.mjs` on the reference repo — both in the reference repo's CI. `verified` is updated when this is re-run at the pinned commit.
- **Pinned, not floating.** `pinned`, `commit` and `verified` change together, in the same commit. "How to fetch" checks out `commit`, never a branch, and so does each variant's line.
- **Changes come in pairs.** A rule change the reference must show is a pull request in the reference repo (its CI can target the framework branch) and one here that changes the rule and bumps the pin.
- **One copy of each record.** Architecture, constitution, glossary and decision records stay in the reference repo; this file links to them by path at the pin.
- **Not in the deployed config.** No reference project lives under `stacks/<id>/` (it would put its dependencies under `{{AGENT_HOME}}/frameworks`); clones go to `{{REFERENCE_REPOS_ROOT}}`.
- **Lint must bite.** The repo records the seeded violations last used to prove each lint rule reports (in `docs/architecture.md` §9).
- One feature, every layer. Grow it only when a new stack choice needs a demonstration.

## Checks

| Check | Tool |
|---|---|
| `reference.md` front-matter (repo, pinned, full-SHA commit, verified) and sections; "How to fetch" checks out the commit; no in-tree `stacks/<id>/reference/` folder | `validate.mjs` |
| Each variant has layout, branch, pinned, full-SHA commit and verified; its commit appears in the body; "## Which layout" exists | `validate.mjs` |
| `verified` older than 90 days | `validate.mjs` (warn) |
| A newer release tag exists in the reference repo | `validate.mjs --upstream` (warn; weekly in this repo's CI) |
| The reference is a valid project | `validate-project.mjs`, in the reference repo's CI at a pinned framework commit |
| The code passes its checks | `pnpm run check` (or the stack's equivalent), in the reference repo's CI |

## Changelog

| Version | Change | Breaking? |
|---|---|---|
| 1.0.0 | The whole reference project lived under `stacks/<id>/reference/`, with `index.md` as this file | No |
| 1.1.0 | The project moved to its own repo; this file became `stacks/<id>/reference.md`, a pointer pinned by `repo`, `pinned` and full-SHA `commit`, with a new "How to fetch" section. Reason: with dependencies installed the in-tree project made the deployed `{{AGENT_HOME}}/frameworks` 141 MB, and nothing ran its checks (`{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-repos-and-procedures.md`, Part A) | Breaking in substance (new path, new required keys), but not bumped: the framework is unpublished, so it stays `stack-reference/v1` (`../conventions.md`, Versioning) |
| 1.2.0 | Optional `layout` and `variants` keys and a "Which layout" section, so one pointer pins both the feature-first `main` and the maintained layer-first branch (`{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-feature-first.md` §A4) | No (additive) |
