---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [least-astonishment, naming, command-query-separation, api-design]
---

# Least astonishment in APIs

## Summary
**TL;DR:** A reader should be able to predict what code does from names, signatures, defaults, and documented contracts. Hidden writes, misleading getters, boolean flags, and invisible failure modes violate least astonishment because callers must know private surprises.
**Use this when:** reviewing public APIs, domain methods, flags, function names, errors, and side effects.
**Not this doc:** formal preconditions and invariants -> `software-design/oop/design-by-contract.md`.

## Problem
An API surprises callers when a name suggests a query but performs a write, when `false` means premium behavior, or when failure appears only as a thrown runtime exception.

GNU interface guidance warns against behavior that changes based on invocation name or output device unless users already expect that convention. ✅[^1]

## Mental model
**Analogy:** a door labeled "Pull" should not require pushing, and an emergency exit should say when an alarm will sound.
**Artifact:**
```ts
type FindUserResult = Readonly<{ kind: "found"; user: User } | { kind: "missing" }>;

const findUser = async (id: string): Promise<FindUserResult> => ({ kind: "missing" });
```
The name says query, and the return type makes the missing case visible.

## How it works
Command-query separation divides methods into queries that return a result without changing observable state and commands that change state without returning a result. ✅[^2]

Fowler treats command-query separation as a useful convention that may have practical exceptions, such as a stack `pop`. ✅[^2]

A flag argument tells a function to perform different operations depending on a boolean or enum value. ✅[^3]

Fowler generally prefers separate intention-revealing methods over public flag arguments, because `regularBook(customer)` is clearer than `book(customer, false)`. ✅[^3]

TypeScript function annotations can expose parameter and return types, and TypeScript checks calls against those annotations. ✅[^4]

Discriminated unions let TypeScript narrow behavior based on a tag field, which makes success and failure variants explicit to callers. ✅[^5]

Class-modeled code expresses least astonishment with verbs that reveal side effects:
```ts
class Users {
  async find(id: string): Promise<FindUserResult> { return { kind: "missing" }; }
  async create(input: NewUser): Promise<User> { return { id: "u1", ...input }; }
}
```

Functional-pipeline code expresses it with pure query functions and effectful shell names:
```ts
const selectActiveUsers = (users: ReadonlyArray<User>): ReadonlyArray<User> =>
  users.filter(user => user.active);

const saveUsers = async (users: ReadonlyArray<User>): Promise<void> => { /* shell */ };
```

Failure is least surprising when it is visible in the signature or contract, for example `Result`, `Promise<Result>`, documented thrown exceptions, or stack-specific error idioms.

## Worked example
A method named `getOrCreateUser(id)` may create a row, so `getUser(id)` would be astonishing. Better names are `findUser(id): Promise<Found | Missing>` for the query and `ensureUser(id): Promise<User>` for the command-like operation. If callers must choose strict or lenient behavior, prefer `parseStrict(input)` and `parseLenient(input)` over `parse(input, true)`.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Private flag helper | Acceptable behind intention-revealing public methods | Fowler allows hidden flag implementations when public calls stay clear. ✅[^3] |
| Familiar language idiom | May break pure CQS | Fowler cites `pop` as a useful exception. ✅[^2] |
| Device-sensitive CLI output | Use only where convention is expected or offer an explicit option | GNU guidance warns that hidden device dependence can surprise scripts. ✅[^1] |
| Exceptions | Document or type them using the stack idiom | Invisible failure modes surprise callers. |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Separate command/query methods | Predictable calls and easier reasoning | More method names |
| Boolean public flag | Fewer methods | Call sites hide intent |
| Result type for expected failure | Failure visible to caller | More branching at call sites |

## Takeaways
- Name commands as commands and queries as queries; do not hide writes behind `get` or `find`. [rule-candidate]
- Replace public boolean behavior flags with intention-revealing methods when callers choose behavior. [rule-candidate]
- Make expected failure visible in the signature or documented contract. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-11 | Source: |

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Standards for Interfaces Generally](https://www.gnu.org/prep/standards/html_node/User-Interfaces.html) — GNU Project, living. Backs: Problem, Edge cases. [^1]
- [CommandQuerySeparation](https://martinfowler.com/bliki/CommandQuerySeparation.html) — Martin Fowler, 2005. Backs: How it works, Edge cases. [^2]
- [FlagArgument](https://martinfowler.com/bliki/FlagArgument.html) — Martin Fowler, 2011. Backs: How it works, Edge cases. [^3]
- [Everyday Types: Functions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#functions) — TypeScript Handbook, living. Backs: How it works. [^4]
- [Narrowing: Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — TypeScript Handbook, living. Backs: How it works. [^5]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-11.

## Related
- `software-design/oop/design-by-contract.md`
- `software-design/oop/encapsulation.md`
- `software-design/design-principles/kiss-and-yagni.md`
- `software-design/functional-modeling/types-as-rules.md`
