---
schema: pattern/v1
last-updated: 2026-10-29
origin: 2026-10-29 — V noticed that the agent-config validators had no written requirements or tests, and asked to migrate them to a standard instead of rebuilding them
related-patterns: [layered-guards, revise-without-erasing, compare-every-version]
---

# Pattern: Pin Before You Change

**Use when:** something already works but has no tests or written requirements (a validator, script, installer, lint config, or a module in an existing repo) and you are about to change it or bring it under a standard such as Spec Kit.
**Not for:** new code (write its scenarios first, per the framework's `spec-writing.md`), or a throwaway script nobody will change again.

## The pattern

1. **Don't rebuild the spec.** Leave what exists as the context. A new spec covers only the change you are about to make; Spec Kit's guide for existing projects says the same.
2. **Pin today's behavior.** Write characterization tests: one scenario per check or branch, with the expected result read from what the code actually does. The test says "this is what it does", not "this is right".
3. **Write them as scenarios.** Use Given/When/Then (Gherkin) so the requirement reads without the code, and compare the output text exactly, because the message is part of what the tool promises.
4. **Never correct a pinned value.** If the code does something that looks wrong, keep the scenario as it is and list the behavior as a finding with options. It changes later under its own spec, which edits that scenario on purpose.
5. **Prove the pins hold.** Switch off each check one at a time and confirm a scenario fails. A check nothing catches is a missing scenario.
6. **Lock the door behind you.** Add a coverage check that fails when a new rule id has no scenario, and run the tests in the same command as the hook, the commit check and CI (`layered-guards.pattern.md`).

## Why this exists

On 2026-10-29, after validators had been extended for weeks with checks that were only tried once in chat, V wrote:

> "Currently, as I understand, so far you're just writing validator tool, no explicit requirements to that, so can never track, as time goes, it changes and nothing records."

Asked where the requirements should live and whether to rebuild them, V wrote:

> "If removing and building everything from the start now, it'll cost and not efficient. This is a chance to perform migrate something exists that's not following standard to something standard."

The feeling behind it is distrust of invisible drift: a tool that guards every document, but that nobody can say is still doing what it did last month.

## Worked example

`validate-knowledge.mjs` in agent-config, before and after `specs/001-knowledge-validator-tests/`:

| | Before (2026-10-28) | After (2026-10-29) |
|---|---|---|
| Where the VS count rule was written | Only in the code: `if (+sm[1] !== nOk \|\| +sm[2] !== nNo) warn('VS', …)` | `tests/validate-knowledge/validate-knowledge.feature`: `Scenario: VS a count that differs from the ✅ marks in the body warns` |
| How it was checked | Once, by hand, in a chat session | On every commit, hook and CI run: `node --test` from `scripts/check-docs.sh` |
| What happens if the check is deleted | Nothing; CI stays green | `✖ VS a count that differs from the ✅ marks in the body warns`, with expected and actual output |
| A behavior that looked wrong | Unnoticed | Pinned as found, listed as finding F-1…F-4 in `research.md` with options, then fixed under its own spec (`specs/002-knowledge-validator-findings/`), which edited only the scenarios it changed |
| Coverage | Unknown | 61 of 61 `fail`/`warn` call sites caught when switched off one at a time |


The After column is the state at the end of spec 001. Spec 002 then renamed the printed codes to the schema rule ids, so that check now prints `KD-9` instead of `VS`, and the scenario's title starts with `KD-9`.

## Checklist
- [ ] No spec rewritten after the fact; the existing code is the context
- [ ] One scenario per check, expected output read from the real tool
- [ ] Questionable behavior listed as findings, not changed
- [ ] Each check switched off once; every one made a scenario fail
- [ ] Coverage check for rule ids; tests run in hook, commit check and CI

## References

**Local artifacts:**
- `specs/001-knowledge-validator-tests/` and `tests/validate-knowledge/` in agent-config — the first application.
- `copilot/frameworks/agentic-sdlc/foundations/delivery/testing-strategy.md` — TST-13 and TST-14, the rules this pattern applies.
- `copilot/knowledge/testing/characterization-tests.md` — how characterization tests work, with sources.

**External authoritative sources:**
- Michael Feathers, *Working Effectively with Legacy Code* (2004), ch. 13 — characterization tests and the recipe for writing them.
- [Empirical Characterization Testing](https://blog.ploeh.dk/2025/11/03/empirical-characterization-testing/) — Mark Seemann, 2025: sabotage the code to confirm the test can fail.
- [Adopting Spec Kit in an Existing Project](https://github.github.io/spec-kit/guides/existing-projects.html) — no retroactive specification of existing behavior.

## Related
- `layered-guards.pattern.md` — where the tests run once they exist.
- `revise-without-erasing.pattern.md` — the same instinct for prose: keep what is right while fixing what is wrong.
