---
schema: knowledge-doc/v1
type: concept
topic: software-design/functional-modeling
status: verified
applies-to: ["TypeScript functional-pipeline cores"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [testing, table-tests, property-based-testing, fast-check]
---

# Testing functional pipeline cores

## Summary
**TL;DR:** Test the pure core with table/example-driven cases and property-based checks because the same input should produce the same output without mocks. Test the shell with a few integration tests that prove adapter wiring and effect ordering. ✅[^1] ✅[^2] ✅[^3]
**Use this when:** backing `PDM-functional-pipeline-R6`, deciding test scope, or moving mock-heavy tests toward pure core examples.
**Not this doc:** defining pipeline steps → `pipelines.md`; separating shell and core → `functional-core.md`.

## Problem
If all business rules live behind HTTP handlers, repositories, or queues, tests need mocks to trigger simple domain cases. A pure core accepts values and returns values, so core tests can focus on examples and properties instead of faking infrastructure. ✅[^1]

## Mental model
**Analogy:** Test a calculator by giving it numbers and checking the answer, not by mocking the buttons, display, and power cord for every arithmetic rule.

**Artifact:**
```ts
type Case = Readonly<{
  name: string;
  input: ParsedGrantRequest;
  expected: GrantOutcome;
}>;

const cases: ReadonlyArray<Case> = [
  { name: "admin write", input: { role: "admin", permission: "shipment:write" }, expected: { kind: "granted", request: { role: "admin", permission: "shipment:write" } } },
  { name: "viewer write rejected", input: { role: "viewer", permission: "shipment:write" }, expected: { kind: "rejected", reason: "role_not_allowed" } },
];
```
Go's table-driven testing guide describes each table row as a complete test case with inputs and expected results. ✅[^4]

## How it works
1. **Core example tests:** Use table rows for representative success and failure cases. ✅[^4]
2. **Core property tests:** State invariants that should hold for many generated inputs, and let a property-based library generate cases. ✅[^2] ✅[^3]
3. **No core mocks:** Pure core functions need no database, network, clock, or logger double when those facts are passed as values. ✅[^1]
4. **Shell integration tests:** Cover a few paths proving adapters load facts, call the core, and apply returned decisions. ✅[^1]
5. **Failure diagnosis:** Property-based tools such as fast-check report counterexamples and shrink them toward smaller failing inputs. ✅[^3]

## Worked example
Example-driven test:
```ts
import { describe, expect, it } from "vitest";

describe("decideGrant", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(decideGrant(testCase.input)).toEqual(testCase.expected);
    });
  }
});
```

Property-based test:
```ts
import fc from "fast-check";

it("never grants viewer write", () => {
  fc.assert(fc.property(fc.constantFrom("shipment:read", "shipment:write"), permission => {
    const outcome = decideGrant({ role: "viewer", permission });
    expect(outcome.kind === "granted" && outcome.request.permission === "shipment:write").toBe(false);
  }));
});
```
fast-check generates inputs for the property, runs the assertion many times, and can shrink failing inputs to smaller counterexamples. ✅[^3]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Property repeats implementation | It can pass the same bug twice | Wlaschin recommends properties such as invariants, inverse operations, idempotence, and alternate oracles instead of duplicating the code under test. ✅[^2] |
| Random failures are hard to reproduce | Use the seed reported by the property-test tool | fast-check uses seeded generation and supports repeatable runs. ✅[^3] |
| Shell has many adapter combinations | Keep most rules in the core and test shell wiring with a small integration set | Bernhardt notes functional core pieces are easy to test and often need no test doubles. ✅[^1] |
| Pure core uses current time | Pass time as an input fact | That keeps the core deterministic for table and property tests. ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Table/example core tests | Clear business examples and regression coverage | Only covers named inputs. ✅[^4] |
| Property-based core tests | Searches many generated inputs and finds counterexamples | Requires thought to choose useful properties. ✅[^2] ✅[^3] |
| Shell integration tests | Proves real wiring | Slower and less precise for domain-rule failures. ✅[^1] |

## Takeaways
- Test pure core transformations with table examples for named business cases. [rule-candidate]
- Add property-based tests for invariants that should hold across many inputs. [rule-candidate]
- Use few shell integration tests for adapters; do not mock infrastructure for every core rule. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-functional-pipeline-R6 | Source: |

## Verification status
- Verified: 20 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — Gary Bernhardt / Destroy All Software, 2012. Backs: pure-core testing and no-test-double guidance. [^1]
- [Property-based testing](https://fsharpforfunandprofit.com/posts/property-based-testing/) and [Choosing properties](https://fsharpforfunandprofit.com/posts/property-based-testing-2/) — Scott Wlaschin / F# for Fun and Profit, 2014. Backs: property motivation and property patterns. [^2]
- [What is Property-Based Testing?](https://fast-check.dev/docs/introduction/what-is-property-based-testing/) — fast-check documentation, living. Backs: generated inputs, multiple runs, shrinking, seeded repeatability. [^3]
- [TableDrivenTests](https://go.dev/wiki/TableDrivenTests) — Go Wiki, living. Backs: table/example-driven tests. [^4]
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites this doc as PDM-functional-pipeline-R6.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/functional-pipeline.md` — TypeScript overlay for table-driven core tests and adapter tests.
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — further reading; consolidated here through Wlaschin's free F# for Fun and Profit materials.

## Related
- `software-design/functional-modeling/functional-core.md`
- `software-design/functional-modeling/pipelines.md`
- `software-design/functional-modeling/types-as-rules.md`
