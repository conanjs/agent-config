---
schema: schema/v1
last-updated: 2026-10-26
---

# Schema: Pattern (`pattern/v1`)

**Applies to:** `copilot/patterns/<slug>.pattern.md` whose front-matter says `schema: pattern/v1` · **Written by:** humans, or agents when a recurring shape or a lesson shows up · **Read by:** any agent designing a new mechanism, writing a document, or revising one (the catalog `index.md` is checked first)

A pattern is **one named, reusable way of doing something**, learned from a real case. It is not a rule that fails a review (that is a framework foundation) and not an explanation of a technology (that is knowledge). See `artifact-types.pattern.md`.

Analogy: a pattern is a **family recipe card**. It has a name, says when to cook it, gives the steps, and on the back it says *who taught it and what went wrong the first time*. That back side is what makes people trust it and remember it.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `pattern/v1` |
| `last-updated` | yes | Date of the last content change |
| `origin` | yes | `YYYY-MM-DD` plus one line: what happened and who raised it, e.g. `2026-10-25 — user restored an over-shortened deep dive and asked for a merge` |
| `related-patterns` | no | Slugs of patterns this one builds on or pairs with |

## Required structure

````markdown
# Pattern: <Name>

**Use when:** <the situation, concrete enough to recognise>
**Not for:** <optional: near-misses>

## The pattern
<numbered rules; each rule one sentence plus its reason or example>

## Why this exists
<the origin: date, trigger, the real incident. If a person raised it, their own words, quoted. If a feeling or intuition drove it, name the feeling.>

## Worked example
<a real case from this repo or session, with real excerpts (file text, code, commands), not descriptions of them. If the pattern is about change, a version comparison per `compare-every-version.pattern.md`.>

## Checklist            (optional)
## References           (local artifacts + authoritative external sources)
## Related
````

## Rules

| Id | Rule | Why |
|---|---|---|
| PAT-1 | One pattern per file; listed in `index.md` with a "Use when" | The catalog is how agents find it |
| PAT-2 | `## Why this exists` names the origin: date, trigger, and the incident. A pattern raised by a person quotes their words | Without the story, a pattern reads as arbitrary and gets skipped |
| PAT-3 | Examples are **concrete**: they quote the real text, code or command. A description such as "short names, one check column" is not an example; the quoted line is | People and agents imagine and remember concrete cases, not summaries |
| PAT-4 | A pattern about change shows a before/after (or all versions) comparison | The difference is the lesson |
| PAT-5 | A pattern does not restate another pattern; it links to it | One authoritative home (`index.md`) |
| PAT-6 | References include local artifacts and, where a concept has an authoritative external source, that source | Global instruction: trace knowledge to its origin |

## Legacy

Pattern files without `schema:` front-matter (written before 2026-10-26) are legacy, the same rule as the knowledge framework: they are not retrofitted unless someone asks. Today these are `shared-procedure-thin-wrapper`, `backup-before-overwrite`, `explaining-mechanisms` and `artifact-types`.

## Checks

| Check | Tool |
|---|---|
| PAT-1 … PAT-6 | LLM review on PRs that touch `copilot/patterns/` (no script yet) |

## References

**Local artifacts:**
- `index.md` — the catalog.
- `artifact-types.pattern.md` — what a pattern is, compared with other artifact types.
- `copilot/frameworks/knowledge/schemas/_system.md` §6 — the legacy rule this file reuses.

## Related

- `revise-without-erasing.pattern.md`, `compare-every-version.pattern.md` — the first two `pattern/v1` files.
