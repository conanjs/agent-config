---
schema: framework-index/v1
last-updated: 2026-10-04
---

# Knowledge Framework (store B)

> **Plain English:** store B is the **textbook shelf**. It explains *how things work* (V8 hidden classes, gRPC keepalive, DDD aggregates) in our own words, with links to the original sources.
> It does **not** give orders (that is store A, the framework rules). It does **not** describe one company's systems (that is store C, the Company KB).

## 1. Where this sits

```
 A  agentic-sdlc framework      RULES       "must / must not"      foundations/, stacks/, paradigms/
 │   Source: + Reference topics
 ▼
 B  knowledge framework (this)  REFERENCES  "how it works, why"    {{AGENT_HOME}}/knowledge/<topic>/
 ▲
 │   links to general concepts
 C  company-kb framework        FACTS       "what our system is"   {{AGENT_HOME}}/companies/<co>/
 ▲
 │   company-kb: front-matter
 D  project repo                FACTS       "what this repo is"    docs/architecture.md, docs/integrations/
```

| Link | Mechanism | Example |
|---|---|---|
| A → B | A rule's `Source:` column; a stack's *Reference topics* table | `TSN-12` → `knowledge/js-runtime/v8-hidden-classes.md` |
| C → B | A Company KB doc's References section | `companies/ots/flows/shipment-import.md` → `knowledge/grpc/stale-connection-keepalive.md` |
| B → A | A knowledge doc's **Used by** section (backlinks) | `v8-hidden-classes.md` → Used by: `TSN-12` |
| B → C/D | **Never.** Store B stays company-neutral. | — |

## 2. What goes in B (and what doesn't)

| Put it in B if… | Put it elsewhere if… |
|---|---|
| It is true for anyone using that technology | It is about *our* system → C or D |
| It explains, teaches or catalogs | It is a check that must pass → A (rule, with `Source:` back to B) |
| You'd cite it from more than one repo or stack | It is a one-off note for one task → the PR or spec |

## 3. Layout

```
{{AGENT_HOME}}/knowledge/
├── index.md                       list of topics (topic-index schema, kind: root)
├── <topic>/                       e.g. grpc/, js-runtime/, software-design/
│   ├── index.md                   topic-index schema
│   ├── <slug>.md                  knowledge-doc schema
│   └── <subtopic>/                optional, one level deep at most
│       ├── index.md
│       └── <slug>.md
```

## 4. Doc types (adapted from Diátaxis)

| Type | Answers | Example | Diátaxis form |
|---|---|---|---|
| `concept` | *Why / how does it work?* | `js-runtime/v8-hidden-classes.md` | Explanation |
| `how-to` | *How do I do X?* | `gcp/bigquery-export-to-gcs.md` | How-to guide |
| `reference` | *What exactly is the value or option?* | `grpc/keepalive-options.md` | Reference |
| `case-study` | *What happened once, and what did we learn?* | `grpc/2025-ots-stale-connection.md` | (our addition) |

Diátaxis also has *tutorials* (learning by doing). They are left out on purpose: agents don't need lessons, and humans can use the official tutorials.

### 4.1 Deep dives: free shape, connected by synthesis

Some subjects are too deep for one type, for example the gRPC keepalive deep dive (client vs. server options, cascade effects, edge-case matrix). Those are written as **deep dives** (`schemas/deep-dive.schema.md`): only an envelope (front-matter, Summary, References, Related) is fixed, and the body follows the subject.

A deep dive joins the structured system through **synthesis**: read → classify each part by type → write or extend `knowledge-doc/v1` docs → link both ways.

```
deep dive (free, long)                       structured docs (typed, small)
 grpc/keepalive-deep-dive.md  ──synthesize──► grpc/keepalive-options.md     (reference)
   synthesized-into: [...]                     grpc/keepalive-mechanism.md   (concept)
             ▲                                 grpc/stale-conn-incident.md   (case-study)
             └──────────── derived-from ───────────┘          ▲
                                         rules' Source: / Reference topics cite these
```

Legacy docs can be synthesis sources too. They are never edited, so the link lives only in the derived doc's `derived-from`.

## 5. Lifecycle

```
draft ──(sources checked, claims marked)──► verified ──(applies-to version outdated)──► stale ──► verified | removed
```

- `last-verified` is the date each external claim was re-checked against its source.
- A rule in A that cites a `stale` doc is flagged by `validate.mjs`. It is a warning, not an error.

## 6. Writing rules (summary; details in `schemas/_system.md`)

1. Write in your own words. Short quotes only, always cited. Never paste book text.
2. Mark every claim as **verified** (with a link) or **unverified**.
3. Prefer free, official sources: specs, vendor docs, the author's own site.
4. One doc, one type. A concept doc that grows a how-to section gets split. If the subject resists splitting, write a deep dive and synthesize it (§4.1).
5. These rules and the schemas apply to **new docs only**. Existing (legacy) docs are kept as they are and never retrofitted (`schemas/_system.md` §6).

## 7. Files

| File | Purpose |
|---|---|
| `schemas/_system.md` | Shared rules, registry, legacy-doc rule (no retrofit) |
| `schemas/knowledge-doc.schema.md` | Shape of every structured `<slug>.md` |
| `schemas/deep-dive.schema.md` | Envelope of free-form deep dives, and the synthesis procedure |
| `schemas/topic-index.schema.md` | Shape of every `index.md` |
| `tools/validate-knowledge.mjs` | Checks every v1 doc and index (legacy skipped): `node tools/validate-knowledge.mjs [knowledge-root] [--urls]` |

## References

- Diátaxis — https://diataxis.fr/
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-v2-structure.md` §6 (Knowledge architecture), decision D10 (deep dives)
- `{{AGENT_HOME}}/frameworks/company-kb/index.md`

## Related

- `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` — the framework that consumes B
- `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` — team docs (a different audience)
