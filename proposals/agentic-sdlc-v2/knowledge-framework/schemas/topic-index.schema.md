---
schema: schema/v1
last-updated: 2026-10-04
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

- Every **v1** doc in the folder (front-matter `schema: knowledge-doc/v1` or `deep-dive/v1`) has exactly one Docs row, and every row's file exists. Deep dives use Type `deep-dive`. Legacy docs may be listed with Type `legacy` and Status `—`.
- A topic folder needs an `index.md` only once it contains a v1 doc (knowledge-doc or deep-dive).
- `Type` and `Status` copy the doc's front-matter.
- Subfolders go at most one level deep.

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
| Docs table ↔ folder contents; Type/Status match | `validate-knowledge.mjs` |
