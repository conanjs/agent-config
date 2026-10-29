---
schema: schema/v1
last-updated: 2026-10-29
---

# Schema: Topic Index (`topic-index/v1`)

**Applies to:** `knowledge/index.md` (root) and `knowledge/<topic>/[<sub>/]index.md` · **Store:** B · **Written by:** whoever adds a doc · **Read by:** humans browsing; agents following a Reference topic pointer · **Loaded as:** on demand

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `topic-index/v1` |
| `kind` | yes | `root` · `topic` · `subtopic` |
| `topic` | yes (not root) | Folder path relative to `knowledge/`, kebab-case, same as the docs' `topic` (e.g. `js-runtime`, `software-design/ddd`) |
| `last-updated` | yes | Date |

## Required structure

```markdown
# <Topic title>

<one paragraph: what this topic covers and what it does NOT cover>

## Docs                          <!-- topic/subtopic only -->
| Doc | Type | Summary | Status |
|---|---|---|---|

## Subtopics                     <!-- optional; required if subfolders exist -->
| Subtopic | Summary |
|---|---|

## Topics                        <!-- root only; replaces Docs/Subtopics -->
| Topic | Summary | Docs |
|---|---|---|

## References
## Related
```

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| TI-1 | The file is named `index.md`; `kind` is `root`, `topic` or `subtopic`, and `root` exactly at `knowledge/index.md`; `topic` equals the folder path (not root); `last-updated` is set | front-matter matches the location | script |
| TI-2 | The index ends with `## References`, `## Related` | last two headings | script |
| TI-3 | The root index has `## Topics`, lists every topic folder, and lists no folder that does not exist | Topics table ↔ folders | script |
| TI-4 | A topic or subtopic index has `## Docs`. Every **v1** doc in the folder (front-matter `schema: knowledge-doc/v1` or `deep-dive/v1`) has exactly one Docs row, and every row's file exists | Docs table ↔ files | script |
| TI-5 | `Type` and `Status` copy the doc's front-matter. Deep dives use Type `deep-dive`. Legacy docs may be listed, with Type `legacy` and Status `—` | each row matches its doc | script |
| TI-6 | Subfolders go at most one level deep: a subtopic has none, and a topic lists each of its subfolders in `## Subtopics` | folders ↔ Subtopics table | script |
| TI-7 | A topic folder needs an `index.md` (`topic-index/v1`) once it holds or contains a v1 doc (knowledge-doc or deep-dive), up to the root | every v1 doc has an index chain | script |

## Example

```markdown
---
schema: topic-index/v1
kind: topic
topic: js-runtime
last-updated: 2026-10-04
---

# JavaScript runtime internals

How JS engines (mainly V8) and Node.js run code, and what that means for writing fast code.
Not covered: framework-level performance (see `web-performance/`).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [v8-hidden-classes.md](v8-hidden-classes.md) | concept | Object shapes and inline caches; why property order matters | draft |
| [event-loop-phases.md](event-loop-phases.md) | concept | Node.js event loop phases and microtasks | draft |
| [v8-object-model-deep-dive.md](v8-object-model-deep-dive.md) | deep-dive | Shapes, ICs, dictionary mode and GC interplay, end to end; synthesized into v8-hidden-classes.md | draft |

## References
- [V8 blog](https://v8.dev/blog) — V8 team, living. Backs: topic scope.

## Related
- `software-design/functional-modeling/` — immutability costs in V8
```

## Checks

| Check | Tool |
|---|---|
| TI-1 … TI-7, plus the shared KB-11 (title) | `validate-knowledge.mjs`, run by `scripts/check-docs.sh` |
