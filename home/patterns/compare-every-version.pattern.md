---
schema: pattern/v1
last-updated: 2026-10-26
origin: 2026-10-26 — the user noted that the first worked example of revise-without-erasing described the change ("Short names, one check column") instead of showing it, and asked for every version to be compared side by side
related-patterns: [revise-without-erasing]
---

# Pattern: Compare Every Version

**Use when:** you show how something changed across two or more versions. Examples: reporting your own revision of a doc, reviewing a rewrite, writing an incident or "lessons learned" note, choosing between drafts, merging versions, or explaining why a config or API moved from A to B.
**Not for:** a plain code diff that a tool already shows well (`git diff`), unless you need to explain *why* each hunk changed.

## The pattern

1. **One column per version, in time order, then a verdict column.** For example `v1 · v2 · … · final · Verdict`. Never only "before / after" when more versions exist: the middle version is often where the damage happened.
2. **Name each version precisely** in a legend above the table: a commit hash, a file name, a date, or "draft by X". If it was never committed, say so.
3. **Every cell quotes the real thing.** Use an exact excerpt of the text, code, header or command, in code format; never a description of it.
   - ✗ `Short names, one "check" column`
   - ✓ `Frameworks · No express import under src/domain or src/application`

   Shorten only with `…`, and keep the part that shows the difference.
4. **Rows are the units that changed:**
   - a section, a table header, a single row, a function, a config key;
   - then **aggregate rows** (counts of sections, rows, examples; line counts).
   Unchanged units are left out, or summarised in one "unchanged" row.
5. **The verdict says what happened and why.** Use kept / changed / dropped / added / restored, with the reason: wrong, unverifiable, duplicate, by accident.
6. **Many versions:**
   - show the first, the final, and every version in which *this unit* changed;
   - write `= v2` for a cell that did not change since v2;
   - past about five versions, keep the full table in an appendix and put a two-row summary (first vs. final) at the top.
7. **Name the feeling the change caused, if any:** regret (something good was lost), greed (both versions have something good), relief (a real error fixed). It tells the reader which rows matter.
8. **Don't use size as the verdict.** Show line counts as an aggregate row, but judge unit by unit. A longer version can still have lost content.

### Cell format cheat-sheet

| Kind of unit | How to quote it in a cell |
|---|---|
| Table row | The cells joined by ` · ` |
| Table header | The column names joined by ` · ` |
| Paragraph | The first sentence, or the sentence that changed, in quotes |
| Code | One line in backticks; or a `diff` block under the table, keyed by row number |
| Absent | `absent`, plus *where* it went if it moved (`moved to X.md §5`) |

## Why this exists

The user reviewed the first worked example of `revise-without-erasing.pattern.md`. Its cells said things like `Short names, one "check" column`, a description that does not let anyone *see* the loss. Their words (2026-10-26):

> "The work example in this repo doesn't specify the before, after in a comparison … if in case there're many versions, then in a comparison, should list all those versions."

> "You will make the cell description concise like `Short names, one "check" column` without examples of the real incident ones, so it's like talking about the concept/incident but doesn't mention the concrete examples so people/AI can feel, understand and imagine."

## Worked example

`revise-without-erasing.pattern.md` §Worked example is the full application: three versions (v1 first deep dive, v2 rewrite, v3 merge), eight units, exact excerpts, a verdict per row, and a size row showing v2 was longer yet lost content. One row from it, before and after this pattern:

| | Cell for "Independence table, first row" |
|---|---|
| Before this pattern (description) | `Short names, one "check" column` |
| After this pattern (quote) | `Frameworks · No express import under src/domain or src/application` next to v1's `Independent of frameworks · The framework is a library you call, not a cage you live in · …` |

The reader of the second row can see the loss without being told.

## Checklist

- [ ] Every version listed, named and in order?
- [ ] Every cell an exact excerpt, not a description?
- [ ] A verdict with a reason in every row?
- [ ] Aggregate rows present, but not used as the verdict?
- [ ] More than five versions → summary on top, full table in an appendix?

## References

**Local artifacts:**
- `revise-without-erasing.pattern.md` — the first full application.
- `pattern.schema.md` — PAT-3 (concrete examples) and PAT-4 (comparisons for patterns about change).

**External authoritative sources:**
- [git-diff documentation](https://git-scm.com/docs/git-diff) — Git project, living. Backs: the "Not for" line; tools already show line-level diffs, and this pattern adds the per-unit *why*.

## Related

- `explaining-mechanisms.pattern.md` — the same "show the concrete artifact" habit, applied to flows.
