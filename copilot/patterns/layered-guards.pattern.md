---
schema: pattern/v1
last-updated: 2026-10-27
origin: 2026-10-27 — a review of three AI-drafted docs and one procedure found nine defects the existing validator never ran on; the user asked how to stop agents repeating them
related-patterns: [shared-procedure-thin-wrapper, revise-without-erasing]
---

# Pattern: Layered Guards

**Use when:** a kind of artifact (docs, procedures, configs, code) keeps getting the same classes of mistake, from agents or people, and you want them caught every time rather than when someone remembers to look.
**Not for:** a one-off fix. Fix it and move on; build guards only for mistakes that can recur.

## The pattern

1. **Sort each mistake by who can detect it.** A script can catch shape (an unknown key, a duplicated block, a wrong date format); only a reader can catch meaning (a takeaway on the wrong topic); only a fresh check of the source can catch staleness (a CLI flag removed upstream). One guard per kind, not one guard for everything.
2. **Make the checker run without anyone remembering.** Wire the same script into every place a change passes: the editor or agent (a post-edit hook), the commit (a pre-commit hook), and the merge (a required CI check). A validator nobody runs is documentation, not a guard.
3. **Fail on certainties, warn on heuristics.** A rule a script can decide exactly fails the build; a heuristic (a phrase that *looks like* chat residue) only warns, so false alarms never train people to bypass the guard.
4. **Put the judgment checks in one procedure, and point to it from wherever work starts.** The always-loaded instructions and a skill both say "before committing X, follow Y"; the procedure lists the checks with the rule each one enforces and a real example of the defect.
5. **Give time-sensitive facts a version and a date.** Anything that describes an outside tool records what it was checked against and when; a scheduled job compares that with upstream and warns on drift.
6. **Test each guard against the real failure.** Run the new checks on the commit that had the defects and show they fire, and on the current tree to show they stay quiet. A guard that has never caught anything is unproven.
7. **Write down where the guards are.** One overview (here, the README's "Doc guards" section) lists every layer, where it runs and how to enable it; otherwise the guards exist but nobody knows to rely on them or to extend them.

## Why this exists

On 2026-10-27 the user had committed three docs drafted with another AI after a quick review, and a later review found nine defects: an answer to a question the doc never asked, a paragraph copied under the wrong diagram, a takeaway on the wrong topic, a notes template inside "Verify", diagrams copied byte-for-byte between docs, an invented `revision:` front-matter key, a malformed Verification status line, and a Spec Kit procedure using a flag removed upstream three months before it was written. The repo already had a validator; nothing ran it.

The user's question:

> "I'm concerned and afraid that AI agents might incorrectly do something similar to all the issues just resolved above, what are the solutions to prevent and enforce them?"

And, once the guards existed, the follow-up that produced rule 7:

> "Why I don't see anywhere mentions these protection layers?"

## Worked example

The four layers as built in this repo:

| Layer | Kind of mistake | Where it runs | File |
|---|---|---|---|
| 1. Wiring | any validator failure | Claude Code post-edit hook, git pre-commit, required CI check `validate-docs` on `main` | `scripts/check-docs.sh`, `.githooks/pre-commit`, `.claude/settings.json`, `.github/workflows/validate-docs.yml` |
| 2. Mechanical checks | shape | inside the validators | `copilot/frameworks/knowledge/tools/validate-knowledge.mjs` (`FM-KEYS`, `VS`, `KB-7`, `KB-8`) |
| 3. Judgment review | meaning | before commit, by procedure | `copilot/procedures/review-docs.procedure.md`, `skills/review-docs/SKILL.md` |
| 4. Freshness | staleness | validator + weekly CI | `copilot/procedures/procedure.schema.md`, `copilot/procedures/tools/validate-procedures.mjs` |

Rule 6 in practice: layer 2 run against the unfixed commit `5c6ef76` printed, among others,

```text
  warn  KB-7  ai-agents/graph-engineering-vs-sdd-ai-dlc-spec-kit.md: "**No," — paragraph opens with a bare "Yes"/"No" answer; state the question it answers
  warn  KB-8  identical 14-line block in ai-agents/graph-engineering-study-guide.md, documentation/learning-explanation-framework.md; keep one copy and link to it
  FM-KEYS  ai-agents/graph-engineering-study-guide.md: front-matter key "revision" is not defined by knowledge-doc/v1 (…)
```

and on the fixed tree printed `PASS (0 warning(s))`. Layer 4 with a procedure set back to `verified-against: v1.2.0`:

```text
  warn  PR-5  spec-driven-development.procedure.md: GitHub Spec Kit (specify CLI) verified against v1.2.0, upstream latest is v1.2.3; re-verify the procedure
```

Rule 3 in practice: `KB-7` and `KB-8` only warn, because a line starting with "**No,**" can be legitimate; `FM-KEYS` fails, because an undefined key is never legitimate.

## Checklist

1. List the recurring mistakes and sort them: shape, meaning, staleness.
2. Shape → a validator check (fail if exact, warn if heuristic).
3. Meaning → a numbered check in one review procedure, cited by rule id.
4. Staleness → a version + date field, a freshness warning, a scheduled upstream check.
5. Wire the validator into hook, commit and required CI check; mind CI path filters on required checks (a filtered-out required check stays "Pending" and blocks merges).
6. Run the checks on the bad commit and the good tree; keep the output as evidence.
7. Add the layers to the overview doc.

## References

**Local artifacts:**
- `README.md` § "Doc guards" — the overview this pattern's rule 7 asks for.
- The files in the Worked example table.
- `copilot/procedures/review-docs.procedure.md` — the nine defects in detail.

**External authoritative sources:**
- [About protected branches: require status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging) — GitHub Docs, living. Backs: rule 2 (the merge gate).
- [Troubleshooting required status checks](https://docs.github.com/en/enterprise-server@3.16/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) — GitHub Docs. Backs: checklist 5 ("checks associated with that workflow will remain in a Pending state").
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) — Anthropic, living. Backs: rule 2 (the post-edit hook; exit code 2 returns the error to the agent).

## Related

- `shared-procedure-thin-wrapper.pattern.md` — how layer 3 reaches every agent tool with one procedure and one skill.
- `revise-without-erasing.pattern.md` — step g of the review procedure.
