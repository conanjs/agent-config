---
schema: schema-system/v1
last-updated: 2026-10-29
---

# Knowledge Framework: Schema System

The same meta-schema as `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/_system.md` §2: a header line, Front-matter, Required structure, Rules, Example, Checks. This file adds what is specific to store B.

## 1. Shared front-matter

Every file in `{{AGENT_HOME}}/knowledge/` starts with:

```yaml
---
schema: knowledge-doc/v1 | deep-dive/v1 | topic-index/v1
last-updated: YYYY-MM-DD
---
```

Only the keys listed in each schema's Front-matter table are allowed; any other key (e.g. `revision:`) fails `KB-10` in `validate-knowledge.mjs`. To track something new, add the key to the schema first.

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
| KB-7 | **Stands alone.** The doc reads correctly without the conversation it was drafted in: no answer to a question the doc never states, no "as discussed", "you asked", "in my previous answer", no sentence that only makes sense as a reply to someone. Applies with extra care to text drafted in another AI chat and pasted in | script (heuristic warn) + llm |
| KB-8 | **One canonical copy.** A diagram, code block, table or paragraph that already exists in another doc is linked, not copied; a doc does not repeat its own paragraphs. A short summary next to the link is fine | script (identical 5+-line blocks, repeated paragraphs: warn) + llm |
| KB-9 | **Front-matter values are valid.** Every required key is present; `status` is `draft`, `verified` or `stale`; `applies-to` is a list; dates are `YYYY-MM-DD`; `topic` equals the doc's folder; a knowledge doc's `type` is one of its schema's types; a verified deep dive has `last-verified` (for a knowledge doc that case is KD-2) | script |
| KB-10 | **Only defined front-matter keys.** A key not listed in the schema's Front-matter table fails; to track something new, add the key to the schema first | script |
| KB-11 | **Title and Summary head.** Every v1 file has a `# Title` line. Knowledge docs and deep dives open with `## Summary` holding `**TL;DR:**` and `**Use this when:**` (a deep dive also has `**Depth:**`, DD-1) | script |
| KB-12 | **References and Related are real.** `## References` has at least one entry, `## Related` has at least one entry (`- _None yet._` when empty), and every footnote used in the body (`[^n]`) has a References entry carrying it | script |

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
