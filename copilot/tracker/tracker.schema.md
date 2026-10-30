---
schema: schema/v1
last-updated: 2026-10-30
---

# Schema: Tracker (`tracker/v1`)

**Applies to:** `TRACKER.md` at the root of any repo (or of a folder that is not a repo) · **Written by:** agents at the end of a turn, and people · **Read by:** agents at session start (through the session-start hooks), people, and `tracker.mjs` · **Deployed to:** `~/.copilot/tracker/` (`mapping.yaml`)

A tracker is the list of work a repo still owes: what is left, its next step, and what it is waiting on. It lives in the repo, so it outlasts any one chat. A hook reads it at the start of every session and shows you what is still open, so nothing depends on anyone remembering.

Analogy: the job sheet clipped to a car in a workshop. Whoever picks the car up next reads what was done, what is left and which part is still on order.

## Format

```markdown
# Tracker

<free text: what this file is>

## Open

### T-4 Merge the stacked PRs into main
- status: waiting
- priority: high
- next: Update PR #3's description, then merge #1, #2 and #3 in that order
- waiting-on: V's approval
- done-when: merged feat/mod-11-and-coordinator into main
- from: 2026-10-30 · 1b631c6

## Done

### T-3 Fix the broken link
- status: done
- from: 2026-10-01
- closed: 2026-10-02 · a1b2c3d
```

- **Sections.** `## Open` comes first, then `## Done`. Items are oldest first in Open; the latest closed item is first in Done.
- **Items.** Each item is a `### T-<n> <title>` heading followed by `- key: value` lines. Blank lines are allowed. Ids never get reused.
- **Free text.** Anything above `## Open` is free text and is kept as written.

| Key | Required | Values |
|---|---|---|
| `status` | always | `open` · `doing` · `waiting` (in Open) · `done` · `dropped` (in Done) |
| `next` | open, doing, waiting | The next concrete step, one line |
| `waiting-on` | waiting | Who or what the item waits for |
| `from` | always | `YYYY-MM-DD`, optionally ` · <commit, PR or context>` |
| `updated` | no | `YYYY-MM-DD` of the last change. Staleness counts from it, else from `from` |
| `closed` | done, dropped | `YYYY-MM-DD`, optionally ` · <commit or note>` |
| `why` | dropped | Why the item was dropped |
| `priority` | no | `high` · `normal` (default) · `low` |
| `due` | no | `YYYY-MM-DD` |
| `done-when` | no | A check the tool can run (below) |
| `note`, `links` | no | Free text |

### `done-when` checks

The tool runs these checks without changing anything. When an open item's check holds, it is reported as **looks done**; a person or agent then closes it.

| Check | Holds when |
|---|---|
| `merged <ref> into <ref>` | The first commit is an ancestor of the second (`git merge-base --is-ancestor`); each ref is tried as written, then as `origin/<ref>` |
| `exists <path>` / `gone <path>` | The path, relative to the tracker's folder, exists / does not exist |
| `commit <text>` | A commit reachable from `HEAD` has `<text>` in its message |
| `no-stash <text>` | No stash entry's message contains `<text>` |

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| TR-1 | The file has `## Open` then `## Done` and no other level-2 section; every other line under them is an item heading, a `- key: value` line or blank | the shape parses | script |
| TR-2 | Every item heading is `### T-<n> <title>`, with a title, and no id is used twice | ids unique | script |
| TR-3 | Every key is one of the keys above, used once per item, and every key its status requires is present | fields complete | script |
| TR-4 | `status` and `priority` take a listed value; `from`, `updated`, `closed` and `due` start with a real date | values valid | script |
| TR-5 | `open`, `doing` and `waiting` items are under Open; `done` and `dropped` items are under Done | sections match | script |
| TR-6 | Every `done-when` is one of the listed checks | it parses | script |
| TR-7 | An open item whose `done-when` holds is reported as looking done, with the evidence | — | script (warn) |
| TR-8 | An open item past its `due` date is reported as overdue | — | script (warn) |
| TR-9 | An open item with no change for more than 14 days (`updated`, else `from`) is reported as stale | — | script (warn) |
| TR-10 | A `done-when` that cannot be run (not a git repo, an unknown ref) is reported, so it can be fixed | — | script (warn) |

## How agents use it

The global instruction (`copilot/instructions/personal-defaults.instructions.md`) says:
1. **At session start**, the hook puts the open items in context. Mention an item that **looks done**, and close it once the user agrees.
2. **At the end of a turn that leaves work undone**, add one item per piece of work with `--add`. Write the next step as something a newcomer could start on.
3. **When a turn finishes an item**, close it with `--close`. Drop it with `--why` when it is no longer wanted. Items are never deleted, so the Done section is the history.

A new `TRACKER.md` is **local by default**: `--add` lists it in `.git/info/exclude`, so it never shows up in a work repo's `git status`. To share it with the repo, run `git add -f TRACKER.md` once. After that git tracks it like any other file.

## Checks

| Check | Tool |
|---|---|
| TR-1 … TR-10 | `node copilot/tracker/tracker.mjs [file or folder]` (this repo's own `TRACKER.md` also in `scripts/check-docs.sh`) |
| The open items, most urgent first | `node copilot/tracker/tracker.mjs --brief` |
| Session-start reminder | `tracker-hook.sh --hook claude` (Claude Code `SessionStart`), `--hook copilot` (Copilot CLI `sessionStart`) |
| Add, update, close, drop | `--add "<title>" --next "<step>" […]`, `--update T-<n> […]`, `--close T-<n> [--note <text>]`, `--drop T-<n> --why <text>` |

## References

- `copilot/tracker/tracker.mjs`, `copilot/tracker/tracker-hook.sh` — the tool and the hook launcher.
- `specs/015-tracker/` — why the tracker exists, its options and decisions.
- `copilot/knowledge/ai-agents/harness-engineering-deep-dive.md` — a guide (the instruction) plus a sensor (the hook), as in §5 there.
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — a progress file and a feature list read at the start of every session.
- [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) — plans and a tech-debt tracker kept in the repo.
- [Claude Code: hooks reference](https://code.claude.com/docs/en/hooks) — `SessionStart` output: `additionalContext` reaches the model, `systemMessage` is shown to the user.
- [Copilot CLI: hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference) — `sessionStart` consumes only `additionalContext`; user hooks load from `~/.copilot/hooks/`.
- [git: gitignore](https://git-scm.com/docs/gitignore) — `$GIT_COMMON_DIR/info/exclude` holds patterns for one clone that are not shared; files already tracked are not affected.
- [git add: `-f`](https://git-scm.com/docs/git-add) — "Allow adding otherwise ignored files."

## Related

- `copilot/atlas/schemas/atlas.schema.md` — the same registry-plus-checker shape.
