---
schema: knowledge-doc/v1
type: concept
topic: testing
status: verified
applies-to: ["any language", "Node.js 24 (examples)", "Spec Kit 1.2.3"]
last-verified: 2026-10-29
last-updated: 2026-10-29
tags: [characterization-test, legacy-code, bdd, gherkin, brownfield, spec-kit, mutation, node-test]
---

# Characterization tests for code that has none

## Summary
**TL;DR:** When code or a tool already works but has no tests, don't rewrite its spec from scratch. First pin what it does today with characterization tests, list anything that looks wrong for a decision, prove the tests catch breakage by switching off each check in turn, and only then change behavior under a new spec.
**Use this when:** adding tests to an existing validator, script, installer or module before changing it, or adopting spec-driven development in a repo that already has code.
**Not this doc:** writing a new feature's acceptance scenarios → the agentic-sdlc framework's `foundations/delivery/spec-writing.md`.

## Problem
A tool that has been changed many times without tests has no record of what it promises. Rebuilding its requirements as prose costs a lot and can still miss what the code really does. Changing it with no tests means a broken check passes CI silently. In agent-config, about 1,800 lines of validators had no tests on 2026-10-29.

## Mental model
**Analogy:** before renovating an old house, you photograph every room as it is. You don't redraw the original blueprints. The photos don't say the house is right; they say what was there, so you notice anything you change by accident.

**Artifact:** one scenario from `tests/validate-knowledge/validate-knowledge.feature` in agent-config:

```gherkin
Scenario: DD-4 a deep dive updated after its synthesis warns
  Given in "knowledge/demo/deep-dive.md", `last-updated: 2026-10-01` becomes `last-updated: 2026-10-05`
  When the validator runs
  Then it exits with 0 and prints:
    """
      warn  DD-4  demo/deep-dive.md: updated 2026-10-05 after synthesis into demo/concept.md (2026-10-01); re-synthesize
    PASS (1 warning(s))
    """
```

## How it works
1. **What it is.** A characterization test is written after the fact against existing code and records what the code does at that time, which is not necessarily correct or desirable. ✅ [^1]
2. **Feathers' recipe.** Put the code under a test harness, write an assertion you expect to fail, let the failure show the actual behavior, then make the test expect that behavior. ✅ [^1] The risk is a test that only repeats whatever the code does; Seemann's check is to sabotage the code and confirm the test fails. ✅ [^1]
3. **No retroactive spec.** Spec Kit's guide for existing projects says you do not need to recreate an existing system from specifications: the new `spec.md` defines the change you intend to make, not every existing behavior. ✅ [^2] The characterization tests cover the rest.
4. **Readable requirements.** Writing the tests as Gherkin keeps them readable without code: `Background` steps run before each scenario, and text between `"""` lines is a doc string passed to the step. ✅ [^3] A small runner on `node:test` can read that subset, so a repo with no `package.json` needs nothing installed.
5. **Proving the tests guard every check.** Switch off one check at a time (here: replace one `fail(`/`warn(` call with a no-op), run the scenarios, and confirm at least one fails. Tested on 2026-10-29 against `validate-knowledge.mjs` on Node 24.22.1: 61 call sites, 61 caught. ✅
6. **Running `node:test`.** `node --test` takes glob patterns as arguments, and with none it runs files such as `**/*.test.mjs`. ✅ [^4] Passing a folder does not search it: `node --test tests/` failed with `Cannot find module '…/tests'` on Node 24.22.1 (tested 2026-10-29). ✅ Listing the files (`find tests -name '*.test.mjs'`) works whatever the glob support.

## Worked example
The knowledge validator in agent-config, migrated on 2026-10-29 (`specs/001-knowledge-validator-tests/`):

1. Base fixture: the smallest tree that passes with `PASS (0 warning(s))`, with one root index, one topic index, one concept doc, one deep dive, one framework rule citing the concept, and one Company KB entry.
2. One scenario per check: 68 scenarios, each changing one line of the base tree. The expected output was read from the validator and reviewed line by line.
3. Three first-run mismatches. Two were mistakes in the scenarios (a line count of 451 instead of 450, and a paragraph too short to trigger the check). The third showed real behavior: a subtopic with a subfolder gets both "subfolders nest at most one level deep" and "subfolder "deeper" not listed in Subtopics". That went into `research.md` as finding F-1 rather than being "fixed" in the test. Writing this doc found a fourth (F-4): check marks inside code blocks are counted as claims.
4. Sabotage check: 61 of 61 checks caught. The whole run takes about 2.6 s.
5. A coverage test fails when the validator gains a rule code that no scenario title names.
6. The findings were then fixed under their own spec (`specs/002-knowledge-validator-findings/`): the scenarios for the changed behavior were edited first and failed (44 of 71 red), the validator was changed until all 71 passed, and the sabotage check still caught 61 of 61.

## Edge cases
| Case | What to do |
|---|---|
| Output contains today's date or a temp path | Compare only the stable part (here: every line after the dated header), and replace the temp folder with `{root}` |
| A check needs the network | Point it at a local HTTP server that answers with the status code in the path |
| Two results finish in a nondeterministic order | Give each its own scenario rather than sorting the output |
| The code does something that looks wrong | Pin it as it is, and list it as a finding with options; change it later under its own spec |
| A gap the check misses (a repeated paragraph right under its heading) | Pin the gap too, as a scenario that passes, so a later fix shows up as a deliberate scenario change |
| A Gherkin feature the runner does not support (`Scenario Outline`, tables, tags) | Fail the run loudly instead of skipping the scenario |

## Trade-offs
| Choice | Pros | Cons |
|---|---|---|
| Own Gherkin runner on `node:test` | Nothing to install; scenarios stay standard Gherkin | Only a subset of Gherkin; the runner is code to maintain |
| Cucumber.js | Full Gherkin, reports, wide adoption | Needs `npm install` and a `package.json` |
| Exact output comparison | Catches any change to a message, which is part of what the tool promises | Every wording change edits scenarios |
| Snapshot files | Quick to regenerate | The expected value lives away from its scenario, and regenerating invites blind updates |

## Takeaways
- Pin before you change: characterization tests first, the behavior change under its own spec after.
- A pinned behavior that looks wrong is a finding to decide, never a test to "correct".
- Prove coverage by sabotage: every check switched off must make a test fail.

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | TST-13 | Source: |
| foundation rule | TST-14 | Source: |

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-29

## References
- [Empirical Characterization Testing](https://blog.ploeh.dk/2025/11/03/empirical-characterization-testing/) — Mark Seemann, 2025-11-03; cites Michael Feathers, *Working Effectively with Legacy Code* (2004), ch. 13. Backs: How it works 1–2. [^1]
- [Adopting Spec Kit in an Existing Project](https://github.github.io/spec-kit/guides/existing-projects.html) — GitHub, living. Backs: How it works 3. [^2]
- [Gherkin: Reference](https://cucumber.io/docs/gherkin/reference/) — Cucumber, living. Backs: How it works 4. [^3]
- [Test runner — Running tests from the command line](https://nodejs.org/api/test.html#running-tests-from-the-command-line) — Node.js, living. Backs: How it works 6. [^4]
- `specs/001-knowledge-validator-tests/` and `tests/validate-knowledge/` in agent-config — the worked example, its findings and the sabotage results.

## Related
- `software-design/`
