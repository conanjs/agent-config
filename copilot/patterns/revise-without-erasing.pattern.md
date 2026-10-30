---
schema: pattern/v1
last-updated: 2026-10-26
origin: 2026-10-25 — the user restored an over-shortened Clean Architecture deep dive by hand and asked for the old and new versions to be merged
related-patterns: [compare-every-version, backup-before-overwrite]
---

# Pattern: Revise Without Erasing

**Use when:** you revise a document that already exists, especially one a human has read and liked. This includes moving one section out into its own dedicated document. It applies to knowledge docs, deep dives, guides and READMEs: any prose a human learns from.
**Not for:** code refactoring (tests guard that), or a doc the owner explicitly asked to cut down.

## The pattern

1. **Start from the existing text, not from a blank page.** Edit it in place. A rewrite from scratch drops detail without anyone noticing, because the new version always "reads fine" on its own.
2. **Change only three kinds of content:**
   - **Wrong:** replace it with the correct statement and its source.
   - **Unverified:** verify it, trying other routes first. If it still cannot be verified, remove *that claim only*, not the table, example or section around it.
   - **Outdated:** update it.
3. **Everything else stays, at the same level of detail:**
   - sections, table columns and worked examples;
   - analogies and rules of thumb;
   - emphasis, such as full names (**Independent of frameworks**) rather than shortened ones (**Frameworks**).
   New material is **added** next to it.
4. **The result is the union, not a replacement:** old ∪ new − (wrong + unverifiable).
5. **Moving a section into a dedicated document keeps the section.** The original keeps its key content (the table, the example tree, the rule of thumb) and gains one line: "Full treatment: `<new doc>`". It never shrinks to a bare pointer, and must still read well on its own.
6. **Before handing over, compare the versions** with `compare-every-version.pattern.md`. List every removed block with a reason: wrong, unverifiable, or a true duplicate. If something shrank and has no reason, put it back.
7. **Do not trust length.** A rewrite can be *longer* and still have lost content (see the line counts below). Compare unit by unit, not by size.

## Why this exists

### The feeling: regret and greed

Two feelings, named by the user, are the whole reason for this pattern:

| Feeling | What the reader experiences | What it tells the writer |
|---|---|---|
| **Regret** (for the old) | "I liked that table, that analogy, that full wording. Where did it go?" The old version felt "more emphasized, satisfied, and comfortable" | Something of value was destroyed. Bring it back |
| **Greed** (to covet more) | "The new parts are good too. I want them *and* the old ones" | The answer is never "pick one version"; it is "keep both" |

When a revision makes a reader feel either one, the revision was a replacement instead of an improvement. A good revision leaves no regret (nothing good is lost) and satisfies the greed (everything good is added).

### Origin, in the user's own words (2026-10-25 and 2026-10-26)

> "From my viewpoint, the old one is already perfect, this new one is also perfect."

> "The previous one is more emphasized, satisfied, and comfortable, as it used the full `Independent of frameworks` in Property to emphasize. Looking at the new one, it's boring, shorter."

> "I see that the new one is often concise and shorter, make me have the feeling of kinda want to combine them."

> "If later another dedicated document is created, that part in the previous document should still mention it, might not restate everything, but keeping the old mention, only modify if something is not correct, or add to complement, but not remove it entirely or too concise/compact, because most often, the old exists will carry enough details."

> "It's like the feeling of regret about the old content and being greedy to covet more."

What happened:
1. An agent rewrote `clean-architecture-deep-dive.md` to fix real errors and to move the packaging section into a new `screaming-architecture-deep-dive.md`.
2. The fixes were right, but the rewrite silently dropped good content.
3. The user undid the change in the editor (Ctrl+Z), saved the old text as `clean-architecture-deep-dive-previous.md`, and asked for a merge.
4. The merge is what the user wanted from the start.

## Worked example

Three versions of `copilot/knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md`, all on 2026-10-25 and none committed:
- **v1:** the first deep dive, later saved by the user as `-previous` (since deleted).
- **v2:** the agent's rewrite.
- **v3:** the merge, which is the current file.

Excerpts are quoted exactly; `·` separates table cells.

| Unit | v1: first deep dive | v2: rewrite (erased) | v3: merge (kept + added) | Verdict |
|---|---|---|---|---|
| Independence table, first row | `Independent of frameworks · The framework is a library you call, not a cage you live in · Delete the express import from src/domain and src/application: nothing breaks, because there is none` | `Frameworks · No express import under src/domain or src/application` | `**Independent of frameworks** · The framework is a library you call, not a cage you live in · Delete the express import from src/domain and src/application: nothing breaks, because there is none` | v2 erased the full name and the plain meaning: **regret**. v3 restores v1 and bolds the name |
| Circles table header | `Ring (inside → out) · Holds · Changes when… · May depend on · In the stack reference` | `Circle (in → out) · Holds · In the stack reference` | `Circle (inside → out) · Holds · Changes when… · May depend on · In the stack reference` | v2 fixed "Ring" → "Circle" (a valid fix) but dropped two columns. v3 keeps the fix *and* the columns |
| Packaging section | A 4-row table, e.g. `Package by component · coarse business components, each hiding its adapters · documents/ exposes one public API · Yes`, then `Rule of thumb: layers inside features once the app has more than a handful of features: src/documents/{domain,application,infrastructure,interface}/` | `The book's chapter 34 (Simon Brown) has sections titled Package by Layer, Package by Feature, …` then `Full treatment: screaming-architecture-deep-dive.md.` (no table, no rule of thumb) | The 4-row table, with the component example now taken from Brown (`orders/ exposes only OrdersComponent`), plus a 5th column of verified quotes: `A component is "a grouping of related functionality behind a well-defined interface". Only OrdersComponent is public…`. The rule of thumb is kept, plus `Full treatment: screaming-architecture-deep-dive.md` | v2 shrank to a bare pointer after extracting a dedicated doc, the case rule 5 forbids. v3: keep, add, link |
| Book chapter "The Main Component" | `` `main` is the dirtiest, lowest-level module: it creates everything and hands control to the policy. Treat it as a plugin `` (marked ⚠️ unverified) | `26 The Main Component · The Ultimate Detail` | `26 The Main Component · The Ultimate Detail · main as the configurator: "Main acts as both the configurator and…the driving actor" ✅ · src/main.ts + src/CompositionRoot.ts` | The unverifiable sentence was removed correctly (rule 2). v2 also lost the row's purpose; v3 keeps the row and adds a *verified* idea in its place |
| Analogies | `greatest-hits album` and `CEO … posts a job description` | 10 analogies (A1–A10). The greatest-hits one is gone; the CEO one survives as `A10 Job posting` | 11 analogies (A1–A11), including `A8 greatest-hits album` and `A9 CEO and job description` | **Greed** satisfied: all old ones plus all new ones |
| Edge cases | E1–E10, incl. `E5 Two adapters in the same ring call each other` and `E8 An alias import (@/infrastructure/x) inside domain` | E1–E8; both of those are gone | E1–E11: all ten from v1, plus `E11 Every type is exported / public` | The union |
| "What *detail* does not mean" paragraph | `It does not mean unimportant. It means replaceable without touching policy.` | absent | present, labelled `(analysis, ours)` | Restored |
| Size | 332 lines | **426 lines** | 512 lines | v2 was *longer* than v1 and still lost content (rule 7). Diagrams and new sections hid the loss |

**What v3 removed from v1, with reasons** (the rule 6 list):
- `2009 (approx.) … date ⚠️ unverified` → replaced by the verified date, 20 March 2009.
- The four unverifiable book-chapter summaries → rows kept with verified section titles and verified related ideas.
- `Many small types … ⚠️ general critique` → replaced by AWS's verified "maintenance overhead" critique.
- "ring" → "circle", which is Martin's own word.

## Checklist

- [ ] Did I edit the existing text, not rewrite from blank?
- [ ] Is every removal on the list, with wrong / unverifiable / duplicate as its reason?
- [ ] Does each extracted section still carry its key content plus a "Full treatment:" link?
- [ ] Would a reader of the old version feel regret anywhere? Would they still want to combine the two versions?
- [ ] Did I compare unit by unit (`compare-every-version.pattern.md`), not by length?

## References

**Local artifacts:**
- `copilot/knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` — v3, the merged result.
- `copilot/frameworks/agent-foundry/trees/knowledge-research.tree.md` — KRS-Q1 and KRS-Q7 apply this pattern.
- `pattern.schema.md` — the shape of this file.

**External authoritative sources:**
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: explanation material serves study and needs its context, so a parent doc keeps enough to stand on its own.

## Related

- `compare-every-version.pattern.md` — how to show the before/after above.
- `backup-before-overwrite.pattern.md` — the file-level twin: never lose real content when replacing it.
