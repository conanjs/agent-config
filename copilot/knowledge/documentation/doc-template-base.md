# Doc Template — Base (format-agnostic)

**Purpose:** Reusable spec for any document meant for the user's team. Loaded automatically via the global instruction chain (`~/.claude/CLAUDE.md` → `~/.copilot/instructions/personal-defaults.instructions.md`) whenever the user asks for a team-facing document, in any project. Only the *topic* and *length* need to be asked each time — audience, language, and level are fixed here.

**This process is itself a loop-engineering instance:** Action (draft the doc) → Check (Stop Condition, per format, below) → Decide (pass → ship; fail → fix using [[lessons-learned]], then re-draft). See [[loop-engineering]] for the underlying concept.

## Fixed parameters

| Parameter | Value |
|---|---|
| Target reader | The user's team — not deeply technical, not fluent in English |
| Language | Simple English only (no translation) |
| English level | **CEFR A1 — Beginner** (current default; table below covers other levels if a future doc needs one) |

## CEFR level table (verified — Council of Europe official can-do statements, Reading skill)

| Level | Name | Can do (reading) |
|---|---|---|
| **A1** | Beginner | Understands familiar names, words, and very simple sentences (notices, posters, catalogues). |
| **A2** | Elementary | Reads very short, simple texts; finds specific predictable info (ads, menus, timetables). |
| **B1** | Intermediate | Understands texts of mostly high-frequency everyday/job-related language; follows descriptions of events and feelings. |
| **B2** | Upper Intermediate | Reads articles/reports on contemporary issues with stated viewpoints; understands contemporary prose. |
| **C1** | Advanced | Understands long, complex factual/literary texts; reads specialised articles and technical instructions outside their field. |
| **C2** | Proficient | Reads virtually all forms of written language with ease, including abstract or structurally complex texts. |

## Writing rules for A1 level (checklist to self-verify a draft)

- Sentence length: aim for under ~12 words per sentence. Split anything longer.
- One idea per sentence. No "and this also means that, which leads to..." chains.
- No idioms, no phrasal jargon ("under the hood," "spin up," "boil the ocean").
- Active voice ("The AI checks the code," not "The code is checked by the AI").
- Every technical term gets a one-line definition the first time it appears, plus a real-world comparison (analogy) using something universally known (cooking, washing, a shop, a bus) — not a domain-specific analogy (e.g. avoid "thermostat" or "vending machine," these assume unfamiliar appliances — see [[lessons-learned]]).
- Prefer numbered steps / bullet lists over paragraphs wherever a sequence is being described.
- Spell out acronyms on first use.
- No negation stacking ("not uncommon," "isn't unclear").

## Standard document structure (format-agnostic)

1. **Title** — plain words, no jargon in the title itself.
2. **One-line summary** — "In simple words: ..." — the whole idea in one short sentence.
3. **Why this matters to you** — tie it to something the reader already does day-to-day.
4. **The idea, explained with an everyday comparison** — one concrete analogy for the *whole* idea, not an abstract one.
5. **Components — the concept broken into its working parts** — name each part (typically 2–4), one line defining what it is, plus one concrete real example artifact per part. This is not the same as section 4: section 4 gives one comparison for the whole idea; this section shows what actually gets *built*, part by part, so the reader can tell them apart when they see them for real. Precedent: the first doc built from this template (a plain-English Loop Engineering guide, removed 2026-10-30, in git history as `copilot/knowledge/ai-agents/loop-engineering-simple.md`) had a "Should you use a hook file?" section that named the mechanical-check component with a real `.claude/settings.json` example — a complete instance of this section would pair it with a second component (the policy/skill/instruction part) shown the same concrete way, not just described.
6. **A real example from work** — a full worked case that brings the components in section 5 together end-to-end, something the reader already uses or sees.
7. **Steps, as a numbered list** — if the concept is a process, show it as steps 1/2/3, not prose.
8. **Words to know** — a 3–6 line mini glossary, one short definition per line.
9. **Want to know more?** — a pointer to the full/technical version, for anyone who wants depth.
10. **References** / **Related** — kept per this environment's standard knowledge-doc convention; provenance/navigation, not required reading for the A1 audience.

## Choose your format

| Format | When to use | Rules file |
|---|---|---|
| Markdown (.md) | Default — knowledge base, Confluence paste, GitHub | [[formats/markdown]] |
| Word (.docx) | Formal doc someone will edit in Word, print, or route for sign-off | [[formats/word]] |
| Excel (.xlsx) | Structured content — checklists, comparison matrices, glossary-as-table | [[formats/excel]] |
| PDF | Final, non-editable, printable handout | [[formats/pdf]] |
| HTML | Shareable interactive page, possibly a live artifact | [[formats/html]] |

Each format file states: how the 10 sections above map onto that format's native structure, format-specific constraints, a minimal skeleton, and that format's **Stop Condition** — the checkable definition of "this doc passes" (the loop's verification step).

## Universal stop condition (content-level, applies before any format-specific check)

A draft passes the content check when, and only when:
- All 10 sections above are present and in order.
- Section 5 (Components) names each part separately with its own concrete example — not folded into the section 4 analogy or the section 6 worked example.
- Every sentence is under ~12 words (spot-check at minimum the analogy and summary sections).
- Every technical term used has a one-line definition + analogy at first use.
- The analogy used is universally concrete (see [[lessons-learned]] for a running list of analogies that failed this check before).
- References/Related sections are populated per the global rule in `personal-defaults.instructions.md`.

Format-specific checks in each `formats/*.md` file are *additional* to this, not a replacement for it.

## References

**Local artifacts:**
- `~/.claude/CLAUDE.md` → `~/.copilot/instructions/personal-defaults.instructions.md` — the global rule (added 2026-09-14) that auto-loads this template for team docs in every project, plus the rule requiring References/Related on every knowledge doc.
- [[lessons-learned]] — running log of past mistakes this template exists to prevent repeating.
- `copilot/knowledge/ai-agents/loop-engineering-simple.md` (removed 2026-10-30; `git log --all -- <that path>` finds it) — first document built from this template, written for one team.

**External authoritative sources:**
- [CEFR level descriptions — Council of Europe](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions) and [CAN-DO statements PDF (KCL, sourced from Council of Europe)](https://www.kcl.ac.uk/language-centre/assets/can-do-statements-cefr.pdf) — source of the level table above.

## Related

- [[loop-engineering]] — the concept this template's own draft→check→decide cycle is modeled on.
- [[lessons-learned]] — append a new entry here every time a draft fails the stop condition for a non-obvious reason.
- `formats/markdown.md`, `formats/word.md`, `formats/excel.md`, `formats/pdf.md`, `formats/html.md` — format-specific rules and stop conditions.
