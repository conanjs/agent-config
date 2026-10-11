---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Knowledge Doc (`knowledge-doc/v1`)

**Applies to:** **new** docs at `knowledge/<topic>/[<sub>/]<slug>.md` (legacy docs without `schema:` are exempt: `_system.md` §6) · **Store:** B · **Written by:** humans or agents (when seeding or learning) · **Read by:** agents via a rule's `Source:`, a stack's Reference topics, or a task's `refs:`; humans · **Loaded as:** ③ (only when referenced)

The **patterned named sections** every future knowledge file follows. The shape is: a common head, a type-specific body, a common tail.

```
┌──────────── COMMON HEAD ────────────┐
│ front-matter · # Title · ## Summary │
├──────────── TYPE BODY ──────────────┤
│ concept | how-to | reference | case │
├──────────── COMMON TAIL ────────────┤
│ Takeaways · Used by · Verification  │
│ status · References · Related       │
└─────────────────────────────────────┘
```

## Front-matter

| Key | Required | Values / meaning |
|---|---|---|
| `schema` | yes | `knowledge-doc/v1` |
| `type` | yes | `concept` · `how-to` · `reference` · `case-study` |
| `topic` | yes | Folder path, e.g. `js-runtime` or `software-design/ddd` |
| `status` | yes | `draft` · `verified` · `stale` |
| `applies-to` | yes | Versions or scope, e.g. `["V8 ≥ 9", "Node ≥ 18"]` or `["any"]` |
| `last-verified` | yes if verified | Date of the last source re-check |
| `last-updated` | yes | Date |
| `tags` | no | Free keywords for search |
| `derived-from` | yes if synthesized | Paths (relative to `knowledge/`) of the deep dive(s) or legacy doc(s) this doc was distilled from (`deep-dive.schema.md` §Synthesis) |

## Common head

```markdown
# <Title — a noun phrase, not a question>

## Summary
**TL;DR:** <2–3 sentences: the one thing to remember>
**Use this when:** <situations in which a reader/agent should open this doc>
**Not this doc:** <optional: near topics and where they live>
```

## Type bodies

Section names are fixed. Sections marked *(opt)* may be omitted, but **not renamed or reordered**.

### `concept`: why and how it works

| # | Section | Content |
|---|---|---|
| 1 | `## Problem` | What goes wrong or is confusing without this knowledge |
| 2 | `## Mental model` | A plain-English analogy **plus** one concrete artifact (code, config, a diagram) |
| 3 | `## How it works` | The mechanism. If more than one actor acts in sequence, follow `patterns/explaining-mechanisms.pattern.md` |
| 4 | `## Worked example` | One end-to-end run with real values |
| 5 | `## Edge cases` | Table: Case · What happens · Why |
| 6 | `## Trade-offs` *(opt)* | Table: Option · Gains · Costs |
| 7 | `## Case studies` *(opt)* | 1–3 lines each, linking to a `case-study` doc |

### `how-to`: do one task

| # | Section | Content |
|---|---|---|
| 1 | `## Goal & prerequisites` | End state; tools, access and versions needed |
| 2 | `## Steps` | Numbered; one action per step; exact commands |
| 3 | `## Verify` | How to confirm it worked (a command plus its expected output) |
| 4 | `## Troubleshooting` | Table: Symptom · Cause · Fix |
| 5 | `## Rollback` *(opt)* | How to undo it |

### `reference`: look up exact facts

| # | Section | Content |
|---|---|---|
| 1 | `## Scope` | What the catalog covers and which versions |
| 2 | `## Catalog` | One or more tables (option · default · range · effect …), with no narrative |
| 3 | `## Lookup notes` *(opt)* | Gotchas when reading the tables |

### `case-study`: one real incident or decision, generalized

| # | Section | Content |
|---|---|---|
| 1 | `## Context` | System and situation, **anonymized** (store B rule KB-2) |
| 2 | `## Symptom` | What was observed |
| 3 | `## Root cause` | Why it happened |
| 4 | `## Fix` | What changed |
| 5 | `## Timeline` *(opt)* | Table: When · Event |
| 6 | `## Generalized lesson` | The rule of thumb, with a link to the `concept` doc that explains it |

## Common tail

```markdown
## Takeaways
- <short, actionable statement> [rule-candidate]   ← tag = could become a rule in store A

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-12 | Source: |
| stack Reference topics | stacks/typescript-node | Attach when: hot-path |
<!-- or "- _Not cited by any rule yet._" -->

## Verification status
- Verified: <n> claims (✅) · Unverified: <n> claims (⚠️) · Last verified: <date>

## References
## Related
```

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| KD-1 | Section names and order match the type table | Headings diff is empty | script |
| KD-2 | `status: verified` ⇒ zero `⚠️ unverified` markers and `last-verified` set | — | script |
| KD-3 | A `[rule-candidate]` takeaway turns into a rule in A, or the tag is removed, within one learning cycle | — | llm (learning loop, open question 2) |
| KD-4 | `Used by` lists exactly the store A files whose `Source:` points here | — | script |
| KD-5 | The Mental model has both an analogy and an artifact | — | llm |
| KD-6 | Concept docs ≤ ~400 lines; split by sub-mechanism if longer. A long, free-form treatment belongs in a `deep-dive/v1` doc instead | — | script (warn) |
| KD-7 | Every `derived-from` path exists; if it is a `deep-dive/v1` doc, its `synthesized-into` lists this doc. Facts cite the original sources, not the deep dive | links agree both ways | script |

## Example (full `concept` doc)

````markdown
---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: draft          # 1 claim is still ⚠️ unverified (KD-2)
applies-to: ["V8 ≥ 9 (Node ≥ 16, Chrome ≥ 90)"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [performance, v8, objects]
---

# V8 hidden classes and inline caches

## Summary
**TL;DR:** V8 gives every object a hidden "shape". Code that always sees objects of the same shape stays fast; mixing shapes at one call site makes it slow.
**Use this when:** writing hot-path code that creates many objects, or a profile shows "megamorphic" sites.
**Not this doc:** garbage-collection tuning → `js-runtime/v8-gc.md`.

## Problem
Two objects with the same fields can run at very different speeds because they were built in a different order.

## Mental model
**Analogy:** a warehouse where every box type has a printed map ("field `x` at slot 0"). Workers who always get the same box type grab items without looking. Mixed box types force them to read the map each time.
**Artifact:**
```ts
const a = { x: 1, y: 2 };   // shape S1: x→0, y→1
const b = { y: 2, x: 1 };   // shape S2: different order → different shape
```

## How it works
1. Each object points to a hidden class (V8 calls it a "Map") ✅[^1]
2. Adding a property creates a transition to a new hidden class ✅[^1]
3. Each property-access site caches the shapes it has seen: 1 = monomorphic, 2–4 = polymorphic, more = megamorphic ✅[^2]

## Worked example
`function len(p) { return p.x + p.y }` called 1M times with only S1 objects stays monomorphic. Called with S1, S2 and three more shapes, it becomes megamorphic, and the slowdown is measurable ⚠️ unverified (exact factor depends on workload)

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `delete obj.x` | Object may fall back to dictionary mode | Shape can no longer be shared ✅[^1] |
| Class with fields set in constructor | Same shape for every instance | Same property order every time |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Classes/factories with fixed field order | Stable shapes | Less ad-hoc flexibility |
| Spread-copy for immutability | Simple FP style | New objects; shapes stable only if keys stay in the same order |

## Takeaways
- Initialize all fields in one place (constructor or factory), always in the same order. [rule-candidate]
- Don't `delete` properties on hot objects; set them to `undefined`. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-12 | Source: |

## Verification status
- Verified: 4 · Unverified: 1 · Last verified: 2026-10-04

## References
- [Fast properties in V8](https://v8.dev/blog/fast-properties) — V8 team, 2017. Backs: How it works 1–2, Edge cases. [^1]
- [What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html) — Vyacheslav Egorov, 2015. Backs: How it works 3. [^2]

## Related
- `js-runtime/event-loop-phases.md`
- `software-design/functional-modeling/immutability-costs.md`
````

## Checks

| Check | Tool |
|---|---|
| KD-1, KD-2, KD-4, KD-6, KD-7; front-matter enums; URLs resolve (KB-3) | `validate-knowledge.mjs` |
| KD-3, KD-5, KB-1, KB-5 | LLM review on PRs that touch `knowledge/` |

## References

- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: type split.
- [Fast properties in V8](https://v8.dev/blog/fast-properties), [What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html) — the example's sources.
- `{{AGENT_HOME}}/patterns/explaining-mechanisms.pattern.md` — the How it works structure.

## Related

- `_system.md`, `topic-index.schema.md`
- `deep-dive.schema.md`: free-form docs that are synthesized into this shape
- `../../schemas/stack.schema.md` — Reference topics (A → B)
