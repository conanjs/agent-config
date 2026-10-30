---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, design-by-contract, invariants, errors]
---

# Design by contract in domain objects

## Summary
**TL;DR:** Design by contract states what a caller must provide, what a routine promises after it runs, and what a class must keep true between public calls. Expected business denials are normal results; contract violations are bugs in caller or supplier code.
**Use this when:** deciding whether a failed rule should be returned as a typed result, asserted as a precondition, or treated as a programming error.
**Not this doc:** aggregate testing and root-only mutation → `software-design/ddd/aggregates.md`.

## Problem
Without explicit contracts, code mixes invalid programmer calls, expected domain rejections, and unexpected defects into one vague error path. Design by Contract puts executable specifications into software and makes preconditions, postconditions, and invariants explicit. ✅[^1]

## Mental model
**Analogy:** a delivery contract says the sender must provide a valid address, the courier must deliver to that address, and the truck must remain roadworthy after every delivery.
**Artifact:**
```ts
class Role {
  #permissions = new Set<string>();

  grant(permission: Permission): Result<void, "already_granted"> {
    if (this.#permissions.has(permission.key)) return { ok: false, error: "already_granted" };
    this.#permissions.add(permission.key);
    return { ok: true, value: undefined };
  }
}
```
`permission` being a valid `Permission` object is a precondition; no duplicate permission after a successful grant is a postcondition and invariant.

## How it works
A precondition states what must be true before a routine can run correctly. ✅[^1]

A postcondition states what the routine guarantees after it runs when the precondition was satisfied. ✅[^1]

A class invariant applies to the class as a whole and must be established by creation and maintained by exported routines. ✅[^2]

In Eiffel's contract model, a routine body should not test its own precondition because satisfying the precondition is the client's responsibility. ✅[^2]

A precondition violation signals a bug in the client that made the call. ✅[^2]

A postcondition or invariant violation signals a bug in the supplier routine that failed to do its job. ✅[^2]

Contracts are not a mechanism for routine user-input validation or other expected special conditions. ✅[^2]

In a class-modeled domain, expected business-rule failures such as `already_granted` should be explicit return values because the caller is allowed to ask and must handle the denial. ✅[^2]

## Worked example
`Role.create("admin", [read])` establishes the invariant that a role has no duplicate permissions. A caller passes a syntactically valid `Permission("read")` to `grant`; the role returns `already_granted`, and this is an expected business outcome. A caller passing `undefined` instead of a `Permission` violates the precondition and indicates a programming bug, not a domain denial.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Invalid API payload | Validate at the boundary and return an input error | Human or remote input is not a trusted software collaborator. ✅[^2] |
| Duplicate grant | Return an explicit domain failure | The request is meaningful, expected, and recoverable by the caller. ✅[^2] |
| Private field corrupted by a bug | Fail fast or throw | The class invariant was broken, so the supplier implementation is wrong. ✅[^2] |
| Expensive invariant | Check where practical and test thoroughly | Runtime contract monitoring can be controlled by build or compiler options. ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Explicit results for business denials | Forces caller handling | More result plumbing |
| Assertions for contracts | Finds programming bugs close to the fault | Should not be used for normal user mistakes |
| Exceptions for all failures | Simple signature | Blurs expected denials with defects |

## Takeaways
- Treat precondition, postcondition, and invariant failures as bugs, not ordinary business outcomes. [rule-candidate]
- Return expected domain denials explicitly when the caller may legitimately make the request. [rule-candidate]
- Write tests that prove public operations preserve invariants across valid and invalid sequences. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R5 | Source: |

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Design by Contract and Assertions](https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions) — Eiffel Software, living. Backs: Problem, How it works. [^1]
- [ET: Design by Contract (tm), Assertions and Exceptions](https://www.eiffel.org/doc/eiffel/ET-_Design_by_Contract_%28tm%29%2C_Assertions_and_Exceptions) — Eiffel Software, living. Backs: How it works, Edge cases. [^2]
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R5.
- Bertrand Meyer, *Object-Oriented Software Construction*, 2nd ed. (1997) — further reading; Eiffel's public DbC documentation is used above for verified claims.

## Related
- `software-design/oop/core-concepts.md`
- `software-design/oop/polymorphism.md`
- `software-design/oop/encapsulation.md`
- `software-design/ddd/aggregates.md`
- `software-design/ddd/layering.md`