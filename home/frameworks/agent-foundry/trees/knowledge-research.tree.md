---
schema: tree/v2
last-updated: 2026-10-25
prefix: KRS
owner: knowledge-researcher
phases: [research]
feeds: one deep-dive/v1 doc in the knowledge base (status draft until a human checks it), plus a list of open questions
---

# Knowledge Research (KRS)

Turns one subject into a deep dive whose every claim is traced to an authoritative source, and which shows the subject was understood, not only collected. It does NOT commit, mark claims verified without a source, edit rules, or edit legacy docs. **Default is "not yet":** a claim without a good source is marked unverified, and a dive that has not passed the understanding check goes back to research.

## Overview

```
KRS-Q1 Is the subject scoped, and does the knowledge base already cover it?
├─ NOT SCOPED → ask one focused question → stop
├─ COVERED    → extend the existing doc (or say nothing new is needed) → KRS-Q2
└─ NEW        → KRS-Q2
KRS-Q2 Is there a research plan: sub-questions, actors, options, flows, edge cases?
└─ write it (start wide, then narrow) → KRS-Q3
KRS-Q3 Is each source authoritative enough for the claim it backs?
├─ T1/T2 → keep
├─ T3    → orientation only; find the original → KRS-Q4
└─ T4    → drop
KRS-Q4 Is each claim traced to its original context, and do the sources agree?
├─ AGREE    → ✅ with footnote → KRS-Q5
├─ CONFLICT → record both, apply the conflict table → KRS-Q5
└─ NO GOOD SOURCE → test it if testable, else ⚠️ unverified → KRS-Q5
KRS-Q5 Does the draft show understanding at every level?
├─ NO  → research the gap → KRS-Q2
└─ YES → KRS-Q6
KRS-Q6 Is research saturated or the budget spent?
├─ NO  → KRS-Q2 (next sub-question)
└─ YES → KRS-Q7
KRS-Q7 Does the doc pass the schema and the validator?
├─ NO  → fix → KRS-Q7
└─ YES → hand over: path, counts, open questions, synthesis offer
```

## Nodes

### KRS-Q1 — Is the subject scoped, and does the knowledge base already cover it?
- **Criteria:** the requester's questions, the depth wanted, the audience. Then read `knowledge/index.md` and the topic `index.md` for docs on the same subject.
- **Branches:**
  - NOT SCOPED → ask one focused question and stop
  - COVERED → extend the existing doc, or report that the existing doc already answers it → KRS-Q2. Extending follows `{{AGENT_HOME}}/patterns/revise-without-erasing.pattern.md`:
    - edit the existing text in place;
    - change only what is wrong, unverifiable or outdated;
    - keep all other content at its level of detail, and add next to it.
    When a section moves into a new dedicated doc, the original keeps that section's key content plus a "Full treatment:" link.
  - NEW → KRS-Q2
- **Default:** NEW, when the subject is clear and no doc matches by title or tags.
- **Escalate when:** the subject is company-specific (it belongs in `companies/<co>/`, not in `knowledge/`; KB-2).

### KRS-Q2 — Is there a research plan?
- **Criteria:** a written list of sub-questions covering: origin and authors; each named option or actor, with its default and unset behaviour; every cross-side interaction; one end-to-end flow; edge cases and failures; criticism and alternatives; how it applies to the requester's code, if any. Start with broad queries, then narrow.
- **Branches:**
  - Plan written → KRS-Q3
- **Default:** the global "deep dive" checklist is the plan's skeleton.
- **Escalate when:** the plan has more than about 15 sub-questions. Ask the requester which to cut, or split into several dives.

### KRS-Q3 — Is each source authoritative enough for the claim it backs?
- **Criteria:** apply SIFT: stop; investigate the source; find better coverage; trace to the original. Then place the source in a tier:

  | Tier | What | Use for |
  |---|---|---|
  | T1 | The originator: author's own text, spec, RFC, official docs, source code, changelog | Definitions and behaviour |
  | T2 | Recognised experts, peer-reviewed papers, maintainers' blogs, standards bodies' guides | Analysis, interpretation, critique |
  | T3 | Tertiary summaries (encyclopedias, course notes) | Orientation and leads; a fact rests on T3 only when T1/T2 cannot be reached, and the doc says so |
  | T4 | SEO content farms, unattributed posts, AI-generated summaries, forum answers without evidence | Nothing; drop |

  A source can be T1 for one claim and T3 for another.
- **Branches:**
  - T1/T2 → keep
  - T3 → keep as a lead; look for the original → KRS-Q4
  - T4 → drop
- **Default:** an unknown source is T4 until investigated.
- **Escalate when:** the only T1 source is paywalled or unreachable (a book, a closed spec). Say what was not read; claims from it stay ⚠️ unless a T2 source quotes them.

### KRS-Q4 — Is each claim traced to its original context, and do the sources agree?
- **Criteria:** the cited page actually says it, in context (not a secondary paraphrase). Quotes are 2 sentences or fewer (KB-1). Version-dependent behaviour names the version.
- **Branches:**
  - AGREE → mark ✅ with a footnote to the best source → KRS-Q5
  - CONFLICT → record both views with sources and resolve by the table below → KRS-Q5
  - NO GOOD SOURCE → if it is tool behaviour and a scratch sandbox is available, test it and record the test as local evidence; else mark ⚠️ unverified → KRS-Q5
- **Default:** ⚠️ unverified.
- **Escalate when:** two T1 sources contradict each other on a fact the requester will act on.

### KRS-Q5 — Does the draft show understanding at every level?
- **Criteria:** each level below is present for the subject's main ideas. The levels follow the revised Bloom taxonomy.

  | Level | Evidence in the doc |
  |---|---|
  | Remember | Terms defined, each with its source |
  | Understand | Own-words explanation, plus an analogy and one concrete artifact (KB-6) |
  | Apply | A worked example on a real or realistic case |
  | Analyze | A step-by-step flow, cross-side interactions, and an edge-case matrix |
  | Evaluate | Trade-offs, criticism, and where sources disagree |
  | Create | A synthesis the sources do not state outright, marked as the author's analysis; and self-check questions with answers |
- **Branches:**
  - NO (any level missing) → research that gap → KRS-Q2
  - YES → KRS-Q6
- **Default:** NO.
- **Escalate when:** a level cannot be reached without the requester's own code or data.

### KRS-Q6 — Is research saturated or the budget spent?
- **Criteria:** saturation means the last two new T1/T2 sources added no new claim. The budget is the requester's limit, or the run's context limit; before the limit, save notes and continue from them.
- **Branches:**
  - NO → next sub-question → KRS-Q2
  - YES → KRS-Q7
- **Default:** NO, while any sub-question from KRS-Q2 has no answer.
- **Escalate when:** the budget ends with sub-questions open; list them in the hand-over.

### KRS-Q7 — Does the doc pass the schema and the validator?
- **Criteria:** `deep-dive/v1` envelope (DD-1); `status: draft` while any ⚠️ remains (KD-2); a verification count that matches the markers; every external URL resolves (KB-3); References and Related present; the topic `index.md` lists the doc; `validate-knowledge.mjs` passes. **For a revision:** a diff of old vs. new is done, and every removed block has a reason (wrong, unverifiable, true duplicate). A shrink without a reason goes back in.
- **Branches:**
  - NO → fix → KRS-Q7
  - YES → hand over
- **Default:** NO.
- **Escalate when:** the validator fails on a rule the doc cannot meet without changing the schema.

## Trade-off tables

**Conflicts between sources (KRS-Q4):**

| Conflict about… | Prefer | Also record |
|---|---|---|
| What a term or pattern means | The originator (T1) | Later reinterpretations, as a "variants" note |
| How a versioned tool behaves | The newest official doc or changelog for the stated version, or a test | The older behaviour, with its version |
| Whether a practice is good | Neither; present both with reasons | Which one the framework's rules choose, if any |

**Hand-over contents:** the doc path; ✅/⚠️ counts; for a revision, the removal list with reasons and a version comparison per `{{AGENT_HOME}}/patterns/compare-every-version.pattern.md`; sources dropped as T4 and why; open questions; `[rule-candidate]` takeaways; an offer to synthesize (`deep-dive.schema.md` §Synthesis).

## Recording

One deep dive per run, plus a scratch notes file while the run is long (outside the knowledge base). The agent keeps no memory between runs (FP-7). A human's verdict on a source ("this site is a content farm"; "this blog is the maintainer's") goes to the Observer. That can become a Lens lesson through `lesson-promotion.tree.md`, scoped to `path:knowledge/<topic>/**`.

## References

**Local artifacts:**
- `charters/knowledge-researcher.charter.md`, `../principles.md`, `../resolver.md`.
- `{{AGENT_HOME}}/frameworks/knowledge/schemas/deep-dive.schema.md`, `_system.md` (KB-1 … KB-6), `knowledge-doc.schema.md` (KD-2).

**External authoritative sources:**
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic, 2025. Backs: start wide then narrow (KRS-Q2); scale effort to complexity; agents preferring SEO content farms (T4, KRS-Q3); saving plans to memory before the context limit (KRS-Q6).
- [SIFT (The Four Moves)](https://hapgood.us/2019/06/19/sift-the-four-moves/) — Mike Caulfield, 2019. Backs: KRS-Q3 and KRS-Q4.
- [Wikipedia: No original research](https://en.wikipedia.org/wiki/Wikipedia:No_original_research) — living. Backs: primary/secondary/tertiary tiers.
- [Bloom's taxonomy](https://en.wikipedia.org/wiki/Bloom%27s_taxonomy) — living (Anderson & Krathwohl 2001 revision). Backs: KRS-Q5 levels.
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic, 2025. Backs: structured note-taking (Recording).

## Related

- `ci-triage.tree.md`, `lesson-promotion.tree.md`.
