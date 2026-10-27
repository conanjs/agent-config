---
schema: schema/v1
last-updated: 2026-10-27
---

# Schema: Deep Dive (`deep-dive/v1`)

**Applies to:** `knowledge/<topic>/[<sub>/]<slug>.md` whose front-matter says `schema: deep-dive/v1` · **Store:** B · **Written by:** humans, or agents answering a "deep dive" / "thorough" / "in detail" request · **Read by:** humans; agents synthesizing it (§Synthesis); agents via a task's `refs:` · **Loaded as:** ③ (only when referenced)

A deep dive is a **long, free-form investigation** of one subject. Its structure follows the subject's depth, not a template: a timeline, then a matrix, then a code walk-through, whatever the subject needs. This schema fixes only a thin **envelope** (front-matter, a Summary at the top, and References and Related at the bottom). The body is free.

A deep dive is connected to the structured system through **synthesis**: an agent reads it, analyses it, and distils it into `knowledge-doc/v1` docs (concept, how-to, reference, case-study). The deep dive keeps the full narrative. The derived docs are the small, typed pieces that rules (`Source:`), stack Reference topics and task `refs:` cite.

Analogy: the deep dive is a **lab notebook**; the derived docs are the **textbook pages** written from it. You keep the notebook, but students read the pages.

| | `knowledge-doc/v1` | `deep-dive/v1` | Legacy (no `schema:`) |
|---|---|---|---|
| Body structure | fixed per type | **free** | free |
| Envelope (front-matter, Summary, References, Related) | yes | **yes** | no |
| May be synthesized | n/a | yes, and tracked both ways | yes, tracked only on the derived side (legacy is never edited) |
| Preferred target of a rule's `Source:` | **yes** | allowed; validator warns if it has already been synthesized | allowed |

## Front-matter

| Key | Required | Values / meaning |
|---|---|---|
| `schema` | yes | `deep-dive/v1` |
| `topic` | yes | Folder path, e.g. `grpc` |
| `status` | yes | `draft` · `verified` · `stale` (same lifecycle as knowledge-doc) |
| `applies-to` | yes | Versions or scope, e.g. `["grpc-js ≥ 1.8"]` or `["any"]` |
| `last-updated` | yes | Date of the last content change |
| `last-verified` | yes if verified | Date of the last source re-check |
| `synthesized-into` | yes | List of `{ path, on }`: each derived doc and the date it was synthesized; `[]` until synthesized |
| `tags` | no | Free keywords |

## Required structure

````markdown
# <Title — a noun phrase>

## Summary
**TL;DR:** <2–3 sentences>
**Use this when:** <situations in which a reader/agent should open this doc>
**Depth:** <what the dive covers end to end, e.g. "client + server keepalive options, all cross-side interactions, failure matrix">

<!-- ───── free body: any headings, any order, any depth ───── -->

## References
## Related
````

## Recommended body content (not checked)

These come from the global "deep dive" instruction. They make a dive easier to synthesize, but none is required:

| Element | Becomes, on synthesis |
|---|---|
| Each option or actor defined, with defaults and unset behaviour | `reference` doc → Catalog |
| Cross-side interactions (what one side's change does to the others) | `concept` doc → How it works / Edge cases |
| Worked example and a step-by-step flow | `concept` doc → Worked example |
| Edge-case / failure matrix | `concept` doc → Edge cases |
| A real incident | `case-study` doc |
| Setup or operating steps | `how-to` doc |
| Verified (✅) / unverified (⚠️) claim markers (`_system.md` §3) | carried over unchanged |

## Rules

| Id | Rule | Holds when | Enforced by |
|---|---|---|---|
| DD-1 | The envelope is present: front-matter keys, `## Summary` first, `## References` and `## Related` last | heading check passes | script |
| DD-2 | The body is never forced into a knowledge-doc type. Restructuring a deep dive to fit a type is a synthesis, not an edit | — | llm |
| DD-3 | Every `synthesized-into` path exists and has `derived-from` pointing back here | both sides agree | script |
| DD-4 | If `last-updated` is later than a `synthesized-into` entry's `on`, that derived doc is flagged for re-synthesis | — | script (warn) |
| DD-5 | KB-1 … KB-6 (`_system.md` §4) apply. In particular, company-specific facts are anonymized here or moved to store C | — | llm / script |

## Synthesis

**Trigger:** someone asks to "synthesize", "distil", or "connect" a deep dive, or a rule or stack wants to cite one of its claims. The source may be a `deep-dive/v1` doc **or a legacy doc**.

**Steps:**

1. **Read** the whole source. List its claims, and keep each claim's ✅ / ⚠️ marker.
2. **Classify** each part by what it answers (table above): mechanism → `concept`, option or value tables → `reference`, steps → `how-to`, incident → `case-study`. Route content that does not belong in B elsewhere:
   - company facts → store C (`companies/<co>/…`);
   - must-rules → a `[rule-candidate]` takeaway, which becomes a store A rule only in the learning loop;
   - one-off notes → dropped.
3. **Check for overlap** in the topic's `index.md`. Extend an existing v1 doc rather than creating a near-duplicate.
4. **Write** each derived doc to `knowledge-doc/v1` in full, with `derived-from: [<source path>]`. Re-check claims against the **original** sources and cite those. The deep dive is listed as a local artifact under References, never as the source of a fact.
5. **Link back.** If the source is `deep-dive/v1`, add `{ path, on }` entries to its `synthesized-into`. If the source is legacy, do not touch it; the link lives only in the derived doc's `derived-from`.
6. **Index** each new doc in the topic `index.md`, and list the deep dive itself with Type `deep-dive`.
7. **Validate** with `validate-knowledge.mjs` (DD-3, KD-7).

**Done when:** every claim in the source has a home (a derived doc, store C, a rule candidate, or "dropped" with a reason), and the source's verified/unverified counts carry over without loss.

## Example

**Source (legacy, unchanged):** `knowledge/grpc/stale-connection-keepalive.md`, the gRPC keepalive deep dive (client vs. server options, cascade effects, edge-case matrix).

**Synthesized into:**

| Derived doc | Type | Takes from the source |
|---|---|---|
| `grpc/keepalive-options.md` | reference | the definitions of `keepaliveTimeMs`, `keepaliveTimeoutMs` and `keepalivePermitWithoutCalls`, with defaults |
| `grpc/keepalive-mechanism.md` | concept | the ping/ack flow, client↔server interactions (e.g. GOAWAY `too_many_pings`), edge-case matrix |
| `grpc/stale-connection-incident.md` | case-study | the anonymized incident and its generalized lesson |

Front-matter of a derived doc:

```yaml
---
schema: knowledge-doc/v1
type: reference
topic: grpc
status: verified
applies-to: ["grpc-js ≥ 1.8"]
derived-from: [grpc/stale-connection-keepalive.md]
last-verified: 2026-10-04
last-updated: 2026-10-04
---
```

A **new** deep dive written later would instead carry the link both ways:

```yaml
---
schema: deep-dive/v1
topic: js-runtime
status: draft
applies-to: ["V8 ≥ 9"]
last-updated: 2026-10-04
synthesized-into:
  - { path: js-runtime/v8-hidden-classes.md, on: 2026-10-04 }
---
```

## Checks

| Check | Tool |
|---|---|
| DD-1 envelope; DD-3 two-way links; DD-4 staleness warning; URLs resolve (KB-3) | `validate-knowledge.mjs` |
| DD-2, DD-5; the synthesis "Done when" | LLM review: `{{AGENT_HOME}}/procedures/review-docs.procedure.md`, before committing changes under `knowledge/` |

## References

**Local artifacts:**
- `{{AGENT_HOME}}/knowledge/grpc/stale-connection-keepalive.md`: the precedent deep dive used in the example.
- Global instructions, "deep dive" trigger: source of the recommended body content.

**External authoritative sources:**
- [Diátaxis](https://diataxis.fr/): Daniele Procida, living. Backs the derived-doc types and the idea of keeping explanation, reference and how-to apart.

## Related

- `knowledge-doc.schema.md`: the target shape of synthesis (`derived-from`, KD-7).
- `topic-index.schema.md`: Type `deep-dive`.
- `_system.md` §6: legacy docs as synthesis sources.
