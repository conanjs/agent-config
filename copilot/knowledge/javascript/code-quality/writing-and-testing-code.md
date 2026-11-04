---
schema: knowledge-doc/v1
type: how-to
topic: javascript/code-quality
status: verified
applies-to: ["Chrome DevTools", "Node.js 24", "Mocha + Chai", "Babel"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, debugging, devtools, breakpoints, coding-style, comments, testing, mocha, bdd, polyfills, transpilers]
---

# Debug, style, test and ship JavaScript to older engines

## Summary
**TL;DR:** Debug with breakpoints and the `debugger` statement instead of scattered logs; agree on a style and enforce it with a linter; comment *why*, not *what*; write behaviour specs first and run them with a test framework such as Mocha (or Node's built-in runner); and when code must run in old engines, use a **transpiler** for new syntax and **polyfills** for missing built-ins.
**Use this when:** setting up a new JavaScript project's quality basics, debugging a bug you cannot see from logs, or targeting engines that lack recent features.
**Not this doc:** engine and spec background → `javascript/introduction/engines-specs-and-tools.md`.

## Goal & prerequisites
**End state:** you can pause code at a chosen line and inspect it; the project has a lint/format config; behaviour is pinned by tests that run with one command; build output runs on the oldest engine you support.

**Needs:** Chrome (or another browser with DevTools) or Node.js 24; npm for Mocha/Chai or Babel if used.

## Steps
1. **Pause at the problem.** In DevTools → Sources, click a line number to set a breakpoint, or put `debugger;` in the code; execution stops there while DevTools is open ✅[^2]. Use *Watch* for expressions, *Call Stack* for how you got here, and step over / into / out to move ✅[^2]. In Node, run `node --inspect-brk app.js` and attach a debugger ✅[^8].
2. **Log only what helps.** `console.log` output is visible in the Console; remove noise after the fix ✅[^2].
3. **Agree on a style and automate it.** Typical rules: indent with 2 or 4 spaces, write semicolons, keep lines short, separate logical blocks with a blank line, avoid deep nesting with early `return`/`continue`, and put the code that uses helper functions first with the helpers below it ✅[^3]. Enforce with a linter (ESLint) so reviews discuss logic, not spacing ✅[^3].
4. **Comment the non-obvious.** Explain decisions, constraints and the "why"; prefer extracting a well-named function over a comment that narrates what the code does; document function contracts with JSDoc ✅[^4].
5. **Avoid "clever" code.** Single-letter names, abbreviations, reused variables, names that lie and hidden side effects make code hard to maintain — the "ninja code" lesson is a list of exactly these anti-patterns ✅[^5].
6. **Write the spec, then the code.** Behaviour-driven development (BDD): `describe` what is tested, `it` states one behaviour, an assertion such as `assert.equal(pow(2, 3), 8)` checks it; write failing specs first, make them pass, then refactor ✅[^6]. Node 24 also has a built-in runner: `node --test` with no arguments finds files such as `pow.test.js` that use `node:test` and `node:assert`, and reports `pass 1 / fail 0` ✅[^1]. Keep one behaviour per `it` so a failure points at one thing ✅[^6].
7. **Support old engines.** A transpiler (Babel) rewrites new syntax (e.g. `??`) into older syntax at build time; a polyfill adds a missing built-in function at run time, guarded by a feature check such as `if (!Math.trunc) { … }` ✅[^7].

## Verify
| Check | Expected result |
|---|---|
| Reload with `debugger;` in a handler and DevTools open | Execution pauses on that line ✅[^2] |
| Run the tests (Mocha in the browser or `node --test`) after breaking `pow` | The spec for that behaviour fails with expected vs actual values ✅[^6] |
| Run the linter on a file with a style violation | The rule and line are reported |
| Run transpiled code in the oldest target engine | No `SyntaxError` for new syntax ✅[^7] |

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `debugger;` is ignored | DevTools closed | Open DevTools first ✅[^2] |
| Tests pass but the bug remains | The spec does not describe that behaviour | Add an `it` that reproduces the bug, see it fail, then fix ✅[^6] |
| Transpiled code still fails with `X is not a function` | Transpilers change syntax, not missing built-ins | Add a polyfill ✅[^7] |
| A comment and the code disagree | The comment narrated *what* and went stale | Rewrite to explain *why*, or delete ✅[^4] |

## Takeaways
- Reproduce a bug as a failing test before fixing it. [rule-candidate]
- Transpilers fix syntax; polyfills fix missing built-ins — targeting old engines usually needs both.
- Comment intent and constraints, not mechanics.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab used across the `javascript/` docs. [^1]
- [Debugging in the browser](https://javascript.info/debugging-chrome) — javascript.info, living. Backs: breakpoints, `debugger`, watch, call stack, stepping. [^2]
- [Coding Style](https://javascript.info/coding-style) — javascript.info, living. Backs: typical style rules and linters. [^3]
- [Comments](https://javascript.info/comments) — javascript.info, living. Backs: explain why, JSDoc, avoid narrating comments. [^4]
- [Ninja code](https://javascript.info/ninja-code) — javascript.info, living. Backs: anti-patterns that hurt maintainability. [^5]
- [Automated testing with Mocha](https://javascript.info/testing-mocha) — javascript.info, living. Backs: BDD, `describe`/`it`, assertions, spec-first flow. [^6]
- [Polyfills and transpilers](https://javascript.info/polyfills) — javascript.info, living. Backs: transpiler versus polyfill. [^7]
- [Debugging Node.js](https://nodejs.org/en/learn/getting-started/debugging) — Node.js project, living. Backs: `--inspect` and `--inspect-brk`. [^8]

## Related
- `testing/characterization-tests.md` — pinning behaviour before changing untested code.
- `javascript/learning-path.md`
