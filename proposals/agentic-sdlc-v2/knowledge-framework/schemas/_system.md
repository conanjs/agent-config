---
schema: schema-system/v1
last-updated: 2026-10-04
---

# Knowledge Framework: Schema System

The same meta-schema as `agentic-sdlc-v2/schemas/_system.md` §2: a header line, Front-matter, Required structure, Rules, Example, Checks. This file adds what is specific to store B.

## 1. Shared front-matter

Every file in `{{AGENT_HOME}}/knowledge/` starts with:

```yaml
---
schema: knowledge-doc/v1 | deep-dive/v1 | topic-index/v1
last-updated: YYYY-MM-DD
---
```

## 2. Shared sections

Every file ends with these, in this order:

| Section | Content | Empty form |
|---|---|---|
| `## References` | External sources (URL, title, what it backs) **and** local artifacts cited | Not allowed: at least one entry |
| `## Related` | Other knowledge docs or topics to read next | `- _None yet._` |

### Reference entry format

```markdown
- [<Title>](<url>) — <publisher/author>, <year or "living">. Backs: <section or claim>.
- `<local path>` — <what it is>.
```

Example:

```markdown
- [Fast properties in V8](https://v8.dev/blog/fast-properties) — V8 team, 2017. Backs: How it works §2.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-12.
```

## 3. Claim marking

Inline markers, used in any body section:

| Marker | Meaning |
|---|---|
| `✅` + footnote or link | Verified against the cited source on `last-verified` |
| `⚠️ unverified` | General knowledge, not checked. A hypothesis. |

The **Verification status** section (knowledge-doc) counts these.

## 4. Content rules

| Id | Rule | Enforced by |
|---|---|---|
| KB-1 | Own words; quotes ≤ 2 sentences, cited | llm |
| KB-2 | No company names, hosts or secrets (store B is company-neutral) | script (deny-list) + llm |
| KB-3 | Every external URL resolves (HTTP < 400) at `last-verified` | script |
| KB-4 | `Used by` matches the real backlinks from store A | script |
| KB-5 | One type per doc | llm |
| KB-6 | Technical/abstract terms get an analogy + one concrete artifact (global instruction) | llm |

## 5. Registry

| Schema | File | Applies to |
|---|---|---|
| `knowledge-doc/v1` | `knowledge-doc.schema.md` | `knowledge/<topic>/[<sub>/]<slug>.md`: structured, typed docs |
| `deep-dive/v1` | `deep-dive.schema.md` | `knowledge/<topic>/[<sub>/]<slug>.md`: free-form deep dives (envelope only), synthesized into knowledge-docs |
| `topic-index/v1` | `topic-index.schema.md` | `knowledge/index.md`, `knowledge/<topic>/[<sub>/]index.md` |

### 5.1 Structured vs. deep dive

| Question | Structured (`knowledge-doc/v1`) | Deep dive (`deep-dive/v1`) |
|---|---|---|
| Shape | fixed sections per type | free body; only the envelope is fixed |
| Size | small, one type per doc | as long as the subject needs |
| Who cites it | rules (`Source:`), Reference topics, `refs:` | humans; `refs:` when the whole story is needed |
| How they connect | `derived-from:` → the deep dive | `synthesized-into:` → the derived docs |

Write a deep dive when the subject's depth would break a type template (many actors, cross-side interactions, long matrices). Then **synthesize** it (`deep-dive.schema.md` §Synthesis) so that rules have small, typed docs to cite.

## 6. Legacy docs (no retrofit)

The schemas apply to **new docs only**. Existing docs stay as they are.

| | New doc | Legacy doc |
|---|---|---|
| How it is recognized | Front-matter `schema: knowledge-doc/v1`, `deep-dive/v1` or `topic-index/v1` | No such `schema:` key. It may still have other front-matter, e.g. `title:` |
| Must follow the schema | yes | **no**: never retrofitted, split or renamed for compliance |
| When edited | Keeps complying | Keeps its own existing shape; normal content edits are fine |
| Checked by `validate-knowledge.mjs` | yes | skipped |
| May be cited by a rule's `Source:` or a task's `refs:` | yes | yes |
| `Used by` backlinks (KB-4) | required | not required |
| Listed in a topic `index.md` | required | optional, with Type `legacy` |
| May be a **synthesis source** (`deep-dive.schema.md`) | yes, if `deep-dive/v1` | yes: the derived doc records `derived-from:`, and the legacy doc itself is not edited |

**Example:**
- `grpc/stale-connection-keepalive.md` (concept + case study in one file, no `schema:`) stays exactly as it is.
- A new `grpc/keepalive-options.md` written next to it must be a `knowledge-doc/v1` `reference` doc. The folder then gets a `topic-index/v1` `index.md` listing the new doc, and optionally the legacy one as `legacy`.

**Converting** a legacy doc is never required. If someone rewrites one from scratch anyway, the result is a new doc and must comply in full; no half-converted docs.

## References

- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: type split.
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`: the host schema-system style. Note that store B deliberately does **not** copy company-kb's retrofit rule (§6).

## Related

- `knowledge-doc.schema.md`, `deep-dive.schema.md`, `topic-index.schema.md`
