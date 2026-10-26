---
schema: schema/v1
last-updated: 2026-10-25
---

# Schema: Stack Reference (`stack-reference/v1`)

**Applies to:** `stacks/<id>/reference/index.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** roles working on a component with this stack, and procedures that build code for it · **Loaded as:** ② (through the stack skill)

A stack reference is one small, runnable project that shows every choice of the stack in working code: folder layout, layer names, aliases, naming, doc comments, error handling, lint and tests. The rules stay in foundations, stack idioms and paradigm overlays; the reference shows what following all of them at once looks like. Analogy: the rules are the building code, the reference is the show home built to it.

The project files around `index.md` are an ordinary repo for this stack: its `docs/architecture.md` follows `repo-architecture/v2` and its decision records follow `decision-record/v2`, so `validate-project.mjs` checks the reference like any project.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes | Stack id; equals the parent folder name |
| `verified` | yes | Date `check` last passed, `YYYY-MM-DD` |

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

## How to check
<the one command that runs every check, and what a failure means>

## Using it in a repo
<what to copy, what to rename, what stays the repo's own decision>

## References
## Related
```

## Rules

- **Code wins over prose.** Every row in Choices points at a file that demonstrates it. A choice with no file is not stated.
- **No rule text.** Choices cite rule ids (`TSN-15`, `IMP-1`); the rule itself lives in its own file.
- **It must pass.** `check` (format, lint, typecheck, unit and integration tests, build, smoke) passes, and so does `validate-project.mjs` on the reference folder. `verified` is updated when this is re-run.
- **Lint must bite.** The folder records the seeded violations last used to prove each lint rule reports (in `docs/architecture.md` §9).
- One feature, every layer. Grow it only when a new stack choice needs a demonstration.

## Checks

| Check | Tool |
|---|---|
| `index.md` front-matter and sections | `validate.mjs` |
| The reference is a valid project | `validate-project.mjs <reference folder>` |
| The code passes its checks | `pnpm run check` (or the stack's equivalent), run by the maintainer |
