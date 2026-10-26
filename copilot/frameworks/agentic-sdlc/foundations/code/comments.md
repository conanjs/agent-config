---
schema: foundation/v2
last-updated: 2026-10-25
rule-prefix: CMT
subject: code
---

# Comments

When code gets a comment, what that comment says, and which comments are mandatory. Comments carry what the code cannot: why, constraints, contracts, and the flow of orchestration code. Analogy: route markers on a hiking trail, placed at forks and hazards, not a caption on every paving stone. The stack profile supplies the doc-comment syntax and the lint rules. Reviews cite `CMT-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| CMT-1 | Comments explain why: intent, constraint, invariant, trade-off, or a non-obvious decision. They never restate what the name or signature already says. | Deleting the comment would lose information a reader cannot get from the code | `// increment counter` above `count += 1`; `// handle shutdown` above `handleShutdown()` | llm | — |
| CMT-2 | No per-line narration. Comment a block only when its reason is not evident from names; never caption every statement. | No comment is paired 1:1 with a statement it paraphrases | A comment on each line of a 10-line function | llm | — |
| CMT-3 | Orchestration code carries step comments: one short comment per step, numbered when the order is fixed. Orchestration code is a process entry point, a composition root, a use-case or application-service method that sequences 3+ collaborator calls, a middleware chain, or a job body. | A reader sees the flow from the comments alone, without tracing every call | `main()` builds, wires, starts and listens with no marker of which step is which | llm | — |
| CMT-4 | A step whose order or placement is non-obvious states why. | The reason is written where a future edit would break it | Config load moved after logger creation with no note that the logger needs it | llm | — |
| CMT-5 | Every exported type and every public member (function, method, constructor, accessor, interface member, exported constant) has a doc comment in the stack's standard doc-comment format, checked by lint. Its summary states the contract: what is promised, what can fail, side effects, and units or ranges the type cannot express. This is the same bar as C#'s compiler warning for a missing XML comment on a publicly visible member. | Lint reports no undocumented public declaration, and each summary names at least one fact the signature does not | An exported use case with no note that it throws on a missing role; a port method with no contract | lint | — |
| CMT-6 | Doc comments add information. Parameter and return notes appear only when they say more than the name and type. | No doc comment is a paraphrase of the symbol name | `/** @param roleId The role id. */` | llm (fallback) | — |
| CMT-7 | A file or class header exists only when the purpose is not obvious from its name; it links the decision record or owner where one exists. | Every header answers a question the file name does not | A header repeating `role-repository.ts` as "Role repository" | llm | — |
| CMT-8 | Deviations carry a reason and a record: paradigm escape hatches, lint or type suppressions, and workarounds name the rule or decision id (and an issue or task id for a workaround). | Each deviation comment names what is bypassed and why, with an id | A suppression with no reason, or a free function with no hatch note | llm | — |
| CMT-9 | No commented-out code. History lives in version control. | The repo contains no disabled code blocks inside comments | A 20-line block commented out "just in case" | llm | — |
| CMT-10 | TODO and FIXME carry an owner or task id: `TODO(<owner-or-task-id>): <what>`. | Every marker matches the format and its task is open | A bare `// TODO fix later` | script | — |
| CMT-11 | Comments are changed with the code they describe. A comment that contradicts the code is a defect. | Changed lines and their nearby comments agree after the change | A step comment says "validate" after the validation moved elsewhere | llm | — |
| CMT-12 | A contract is written once, on the declaration that owns it: the port, interface or base type. An implementation references it with the format's inherit-doc form. It adds only parts the reference does not copy, such as extra errors or an example; implementation detail (storage, performance) goes in a why-comment in the body (CMT-1). Formats that copy the summary and remarks reject a second one next to the reference (TS: TSN-13). | No implementation repeats a contract its port already states, and every port member has one | Two adapters each say "returns null when the document does not exist" while the port says nothing | lint + llm | — |

## Interpreting

**Which comment goes where (resolves CS-13 and CS-15)**

CS-13 asks for comments that explain why. CS-15 asks for documented public surfaces. Neither asks for a comment on every function. A blanket per-function "Intent:" line is a CMT-1 violation: the name (`../code/naming.md`, NAM-1) carries intent, and the comment would only restate it.

| Location | Comment | What it says |
|---|---|---|
| Exported type, function, method, accessor, interface member | Required (CMT-5) | Contract, errors, side effects, units |
| Port or interface member | Required (CMT-5, CMT-12) | The contract, once, for every implementation |
| Member implementing a port or interface | Inherit-doc reference (CMT-12) | Only parts the reference does not copy, such as extra errors; implementation detail goes in the body |
| Orchestration body | Required (CMT-3) | One short line per step; why when order matters (CMT-4) |
| Small internal helper | None, unless a why exists | A constraint or trade-off the name cannot show |
| Every function, by default | Not required | — |
| Deviation from a rule or paradigm | Required (CMT-8) | The hatch or record id and the reason |

**Doc-comment structure (CMT-5)**

Every stack's format carries the same parts, in this order. The stack profile names the syntax. TypeScript uses TSDoc (TSN-13), the equivalent of C#'s XML documentation comments.

| Part | Required | Says |
|---|---|---|
| Summary sentence | Always | The contract in one sentence: what is promised, beyond the name |
| Remarks | When needed | Longer explanation, design reason, decision-record id |
| Parameter notes | Only when they add meaning (CMT-6) | Range, unit, format, ownership |
| Return note | Only when it adds meaning | Empty, null or not-found cases |
| Errors | Always, for each expected failure | Which error, and when |
| Example | Optional | One call and its result |
| Inherit-doc | On implementations (CMT-12) | A reference to the port member that owns the contract |

**Step comments**

- Use numbers when order is fixed and the steps run in a straight line. Use short unnumbered step comments when branches or loops break the line.
- A step comment names the step's intent in a few words. It is not a paraphrase of the call beneath it.
- If a function needs many step comments, it may be doing too much. Check CS-2 and extract steps with intention-revealing names.

**Good and bad examples (illustrative TypeScript)**

Bad: restates the name, and says nothing about why.

```ts
// Handles shutdown
async function handleShutdown(signal: string): Promise<void> { /* … */ }
```

Good: explains the constraint the name cannot show.

```ts
// Runs once: a second SIGTERM during drain must not restart the shutdown sequence.
async function handleShutdown(signal: string): Promise<void> { /* … */ }
```

Bad: per-line narration.

```ts
// create the logger
const logger = createLogger(config);
// create the server
const server = new HttpServer(logger);
```

Good: step comments in orchestration code (CMT-3, CMT-4).

```ts
async function main(): Promise<void> {
  // 1. Load and validate config. Everything below depends on it.
  const config = loadConfig();
  // 2. Build the composition root. This is the only place concrete adapters are created.
  const app = composeApp(config);
  // 3. Register signal handlers before listening so a startup-time SIGTERM still drains.
  app.onShutdown(handleShutdown);
  // 4. Start accepting traffic.
  await app.listen();
}
```

Good: doc comment on a public use case (CMT-5, CMT-6).

```ts
/**
 * Grants a permission to a role and persists the result.
 *
 * @returns `already_granted` when the role already holds it; nothing is saved then.
 * @throws RepositoryError when the role cannot be saved.
 */
```

**TODO format.** `TODO(RBAC-142): remove after the v2 token migration`. A task id or an owner handle is enough. A marker whose task is closed is stale and counts as a CMT-11 finding.

**Generated and vendored code.** Rules do not apply to generated files; the generator's output is not reviewed for comments.

**Enforcement split**

| Part | Checked by | Where it is configured |
|---|---|---|
| Doc comment present on every public declaration (CMT-5), valid format, not a pure paraphrase (CMT-6), inherit-doc on implementations (CMT-12) | Lint, required in every stack profile | Stack idioms (TS: TSN-13; Python, Go and Rust: their Enforcement tables) |
| TODO and FIXME format (CMT-10) | Script over source | Stack idioms (TS: TSN-14) |
| Why-not-what, step comments, headers, deviations, commented-out code, stale comments (CMT-1 to CMT-4, CMT-7 to CMT-9, CMT-11) | `llm` review | `../review/review-rubrics.md` RUB-10; the engineering role's ENG-R11 |

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| CMT-3 step comments | CMT-2 no narration | One comment per step, never per line. A step is a unit of intent, such as "build the composition root". |
| CMT-3 step comments | `coding-standards.md` CS-2 small units | If many step comments are needed, extract steps into named functions and keep step comments only in the orchestrating one. |
| CMT-5 public docs | CMT-1 no restating | Every public declaration is documented, so the summary must add one fact the name and type do not: unit, range, source, lifetime, or the null and empty case. `Gets the user id.` fails. `Positive integer assigned by the store; never changes.` passes. Lint catches pure restatement; review catches the rest. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/code/comments.md`: this foundation file.
- `stacks/typescript-node/idioms.md`: TSN-13 and TSN-14 map CMT-5, CMT-6 and CMT-10 to lint and script checks.

**External authoritative sources:**
- [John Ousterhout, *A Philosophy of Software Design*](https://web.stanford.edu/~ouster/cgi-bin/book.php) (2nd ed., 2021) — the chapters on comments: comments capture what the code cannot say.
- Robert C. Martin, *Clean Code* (2008), ch. 4 "Comments" — good comments versus noise and commented-out code.
- [Google TypeScript Style Guide, "Comments and documentation"](https://google.github.io/styleguide/tsguide.html) — documentation comments versus implementation comments; avoid comments that restate the parameter name and type.
- [TSDoc](https://tsdoc.org/) — the doc-comment standard for TypeScript.
- [Recommended XML documentation tags (C#)](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/recommended-tags) — "document all publicly visible types and their public members"; `<inheritdoc>` keeps implementations in sync with interfaces (CMT-5, CMT-12).
- [Compiler warning CS1591](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1591) — missing XML comment for a publicly visible type or member: the enforcement bar CMT-5 copies.
- Knowledge: `knowledge/code-documentation/doc-comments.md` — C# XML tags, TSDoc, JSDoc and other stacks side by side.

## Related

- `coding-standards.md` — CS-13, CS-15 point here.
- `naming.md` — names carry intent so comments do not have to.
- `error-handling.md` — what a doc comment lists under errors.
- `../review/review-rubrics.md` — RUB-10, the shared review check.
- `../review/fitness-functions.md` — FF-12 counts suppressions that lack a reason comment (CMT-8).
- `../design/clean-architecture.md` — where the composition root sits.
