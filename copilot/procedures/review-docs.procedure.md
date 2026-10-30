---
schema: procedure/v1
last-updated: 2026-10-27
depends-on: []
---

# Procedure: Review Knowledge Docs and Procedures Before Commit

Tool-agnostic review for any change under `knowledge/` or `procedures/` (store B and the procedures home). It covers what the validators cannot judge: meaning, purpose and truth. Written once here; the `review-docs` skill only points here.

**Why it exists.** On 2026-10-27 a review of three docs drafted in another AI chat, plus one procedure, found nine defects the validators of the time missed: replies to questions the doc never asks, a copy-pasted paragraph under the wrong diagram, a takeaway on the wrong topic, a fill-in notes template inside "Verify", diagrams copied byte-for-byte between docs, a non-schema `revision:` key, a malformed Verification status line, and a procedure using a CLI flag removed three months before it was written. The validators now catch the mechanical half (`scripts/check-docs.sh`); this review catches the rest.

**Inputs needed:**
- **the change** — the staged diff, a commit, or a list of files.
- **origin** — written here, or drafted elsewhere (another AI chat, a paste, a human outside this repo). Drafted elsewhere means every step below is mandatory, for every file.

## Steps

1. **Run the validators.** `scripts/check-docs.sh` from the repo root (it finds Node ≥ 18 itself). Fix every FAIL. Treat every `KB-7`, `KB-8` and `PR-4` warning as a question to answer in step 3, not as noise. For knowledge docs that cite URLs, also run `node copilot/frameworks/knowledge/tools/validate-knowledge.mjs --urls`.

2. **Read every changed file in full**, not only the diff. A defect such as a duplicated paragraph is invisible in a diff that adds only one of the copies.

3. **Check each file against this list.** Record each finding as `file:line — problem — why it matters`.

   | # | Check | Rule | Typical defect |
   |---|---|---|---|
   | a | **Stands alone:** every sentence makes sense to a reader who never saw the conversation. No answer whose question is missing; no "as discussed", "your question", or argument with a person | KB-7 | "**No, not by definition.**" opening a section |
   | b | **Each section does its job**, not only carries its name (Problem states a problem; Worked example is one run with real values; Verify gives checks with expected results; Takeaways are about this doc's topic) | KD-8 | Notes template inside Verify; takeaway about a different subject |
   | c | **One canonical copy:** nothing copied from another doc, nothing repeated within the doc; summary + link instead | KB-8 | Same diagram in two docs |
   | d | **Copy-paste fit:** every paragraph matches the diagram, code or table it sits next to | KB-8, KD-8 | "assumes the contract and join" under a diagram with neither |
   | e | **Claims are sourced:** each factual claim about a tool, standard or author is ✅ with a source you opened, or marked ⚠️ unverified (a `verified` doc may not keep ⚠️, so verify or remove that claim only). A reference's title, author and year match the page | KB-1, KD-2, `_system.md` §3 | Reference title that is not the page's title |
   | f | **External tool behaviour is current:** for every flag, path, command or step of a third-party tool, open its current docs and changelog. For a procedure, its `depends-on` lists the tool with the version checked and `last-verified`; never bump either without doing the check | PR-6 | `--ai` flag removed upstream; moved file paths; missing workflow step |
   | g | **Revisions don't erase:** compare old and new version unit by unit; every removed block has a reason (wrong, unverifiable, true duplicate) | `patterns/revise-without-erasing.pattern.md` | Good table silently dropped in a rewrite |
   | h | **Front-matter is the schema's:** no invented keys; to track something new, change the schema first | FM-KEYS, PR-1 | `revision: 1` |

4. **Fix, or report.** Fix what you were asked to fix, following `patterns/revise-without-erasing.pattern.md`, then run step 1 again. Otherwise report the findings, most important first, and do not commit.

5. **State what was checked and what was not** in the commit message or the reply: for example "validators pass; sources for Spec Kit re-checked at v1.2.3; `--urls` not run".

## What this procedure does NOT do

- **Replace the validators.** Step 1 runs them; this procedure covers only what they cannot judge.
- **Approve on behalf of the owner.** It produces findings and fixes; the human decides to commit or merge.
- **Retrofit legacy docs.** Docs without `schema:` are skipped, as in `frameworks/knowledge/schemas/_system.md` §6, unless the change itself touches them.

## References

**Local artifacts:**
- `scripts/check-docs.sh` — runs both validators (step 1); also run by `.githooks/pre-commit`, `.claude/settings.json` and `.github/workflows/validate-docs.yml`.
- `copilot/frameworks/knowledge/tools/validate-knowledge.mjs`, `copilot/procedures/tools/validate-procedures.mjs` — the validators.
- `copilot/frameworks/knowledge/schemas/_system.md` (KB-1 … KB-8), `knowledge-doc.schema.md` (KD-1 … KD-9), `copilot/procedures/procedure.schema.md` (PR-1 … PR-6) — the rules cited in step 3.
- `copilot/patterns/revise-without-erasing.pattern.md`, `copilot/patterns/compare-every-version.pattern.md` — step 3g and step 4.
- `skills/review-docs/SKILL.md` — the thin wrapper for Claude Code, Copilot and Codex.

## Related

- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` — why this is one procedure plus one skill wrapper.
- `copilot/procedures/procedure.schema.md` — freshness rules for procedures (layer 4).
