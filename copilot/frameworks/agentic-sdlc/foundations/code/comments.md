---
schema: foundation/v2
last-updated: 2026-10-27
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
| CMT-6 | Doc comments add information. Every parameter and every non-void return is documented (C# parity: StyleCop SA1611, SA1615): as a tag where the stack's format has one (TSDoc `@param`/`@returns`, C# `<param>`/`<returns>`, Python `Args:`/`Returns:`), in the summary prose where it has none (Go, Rust). Each note says more than the name and type: range, unit, format, ownership, the empty or not-found case. A property or getter is described by its summary alone. An implementation that only inherits the contract (CMT-12) inherits its notes. Stacks enforce presence by lint where a rule exists (TypeScript: TSN-13) | Every parameter and non-void return is documented, and no note is a paraphrase of the symbol name | `/** @param roleId The role id. */`; a public method with no note for one of its parameters | llm (fallback) | — |
| CMT-7 | A file or class header exists only when the purpose is not obvious from its name; it links the decision record or owner where one exists. | Every header answers a question the file name does not | A header repeating `role-repository.ts` as "Role repository" | llm | — |
| CMT-8 | Deviations carry a reason and a record: paradigm escape hatches, lint or type suppressions, and workarounds name the rule or decision id (and an issue or task id for a workaround). | Each deviation comment names what is bypassed and why, with an id | A suppression with no reason, or a free function with no hatch note | llm | — |
| CMT-9 | No commented-out code. History lives in version control. | The repo contains no disabled code blocks inside comments | A 20-line block commented out "just in case" | llm | — |
| CMT-10 | TODO and FIXME carry an owner or task id: `TODO(<owner-or-task-id>): <what>`. | Every marker matches the format and its task is open | A bare `// TODO fix later` | script | — |
| CMT-11 | Comments are changed with the code they describe. A comment that contradicts the code is a defect. | Changed lines and their nearby comments agree after the change | A step comment says "validate" after the validation moved elsewhere | llm | — |
| CMT-12 | A contract is written once, on the declaration that owns it: the port, interface or base type. An implementation's doc comment has a summary of its own: it links the contract it fulfils and states only what this implementation adds that a caller or operator must know, such as where the data lives, durability, how far atomicity holds, cost, or extra failures. It never repeats the contract's summary, parameter or return notes. The stack names the form that keeps those notes visible in the editor (TS: TSN-13). How the implementation works stays in a body comment (CMT-1). | No implementation repeats a contract its port already states, every port member has one, and every implementation's summary links its contract and adds one fact the port does not | Two adapters each say "returns null when the document does not exist" while the port says nothing; an adapter documented only as `{@inheritDoc DocumentStore.find}`, which the editor shows as raw text, so the adapter has no visible summary | lint + llm | — |
| CMT-13 | A summary is specific: it states what the member does in terms the names around it do not already give. It answers the contract questions in `naming.md` ("The contract questions"): the effect, the condition it depends on, where the change lands, and what happens otherwise. Mechanism stays out (CMT-1, body comment). If no specific summary can be written, the unit's design is suspect, not the wording (NAM-13). | The summary passes the swap test: it would be false for a different member with the same name and signature, such as a last-write-wins `run()` | `/** Applies one revision. */` on `ReviseDocument.run`; `/** Handles the request. */`; `/** Processes the order. */` | llm (fallback); stacks add a lint floor where one exists (TypeScript: TSN-13) | — |

## Interpreting

**Which comment goes where (resolves CS-13 and CS-15)**

CS-13 asks for comments that explain why. CS-15 asks for documented public surfaces. Neither asks for a comment on every function. A blanket per-function "Intent:" line is a CMT-1 violation: the name (`../code/naming.md`, NAM-1) carries intent, and the comment would only restate it.

| Location | Comment | What it says |
|---|---|---|
| Exported type, function, method, accessor, interface member | Required (CMT-5) | Contract, errors, side effects, units |
| Port or interface member | Required (CMT-5, CMT-12) | The contract, once, for every implementation |
| Member implementing a port or interface | Own summary linking the contract (CMT-12) | What this implementation adds: where data lives, durability, scope of atomicity, cost, extra failures. Parameter and return notes are inherited, not repeated; how it works goes in the body |
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
| Parameter notes | Always, one per parameter, each adding meaning (CMT-6) | Range, unit, format, ownership |
| Return note | Always for a non-void function or method; not for properties and getters (CMT-6) | Empty, null or not-found cases |
| Errors | Always, for each expected failure | Which error, and when |
| Example | Optional | One call and its result |
| Contract link | On implementations (CMT-12) | A link to the port member that owns the contract, inside the implementation's own summary |

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
 * Grants a permission to a role and saves the role, unless the role already holds it.
 *
 * @returns `already_granted` when the role already holds it; nothing is saved then.
 * @throws RepositoryError when the role cannot be saved.
 */
```

**Specific summaries (CMT-13)**

`jsdoc/informative-docs` and its equivalents only compare a summary with its own symbol name. A method called `run` inside `ReviseDocument` therefore passes with `Applies one revision.`, because none of those words is `run`. Yet the summary says nothing the class and method names did not: "revise document" is "apply a revision". Worse, it is also true of an implementation that overwrites a newer change, so it hides the one promise the use case exists to keep.

| Version | Summary | Swap test |
|---|---|---|
| Before | `Applies one revision.` | Also true of a last-write-wins `run()`: fails |
| After | `Replaces the document's body in the store, but only if nobody revised it since the caller read expectedVersion; otherwise changes nothing and returns why.` | False for last-write-wins: passes |

The "after" answers four contract questions (`naming.md`): effect (replaces the body), destination (in the store), condition (only if nobody revised it since `expectedVersion`), otherwise (changes nothing, returns why). It names no mechanism: the version check inside `save` is a body comment.

Two checks, cheapest first:
1. **Lint floor (stacks that have it; TS: TSN-13).** Remove stop words and every word of the member, class and interface names from the summary. Fewer than three words left fails. This catches verb-plus-object summaries, nothing more.
2. **Review (RUB-10).** The swap test above, plus: does the summary answer the questions a caller must know before calling? A long summary can still be vague, so lint never replaces this.

**Implementation summaries (CMT-12)**

An adapter used to point at its port with the format's inherit-doc form and nothing else. Measured on 2026-10-27 in the stack reference, hovering `InMemoryDocumentStore.find` in the editor (TypeScript 6.0.3 language service):

| Adapter comment | Summary on hover | `@param` / `@returns` on hover |
|---|---|---|
| `/** {@inheritDoc DocumentStore.find} */` | `{@inheritDoc DocumentStore.find}` as raw text: no real summary | The port's, inherited |
| none | The port's summary | The port's, inherited |
| `/** {@link DocumentStore.find} against this process's memory: resolves at once and never rejects, so a caller here never sees a storage failure. */` | The adapter's own sentence, with a link to the contract | The port's, inherited |
| The same sentence plus `@throws RangeError …` | The adapter's own sentence | **None**: one block tag on the adapter stops the inheritance |

So the adapter keeps a summary of its own that a reader can act on, the contract's notes still appear once, and nothing is copied. An extra failure goes in the summary sentence ("…; rejects with `SqliteError` when the file stays locked past the busy timeout"), not in a block tag. A summary with nothing to add beyond the port ("Finds a document") fails CMT-13; say where it looks and what that means for the caller.

**TODO format.** `TODO(RBAC-142): remove after the v2 token migration`. A task id or an owner handle is enough. A marker whose task is closed is stale and counts as a CMT-11 finding.

**Generated and vendored code.** Rules do not apply to generated files; the generator's output is not reviewed for comments.

**Enforcement split**

| Part | Checked by | Where it is configured |
|---|---|---|
| Doc comment present on every public declaration (CMT-5), valid format, not a pure paraphrase (CMT-6), own summary linking the contract on implementations (CMT-12), summary longer than its surrounding names (CMT-13 floor) | Lint, required in every stack profile | Stack idioms (TS: TSN-13; Python, Go and Rust: their Enforcement tables) |
| TODO and FIXME format (CMT-10) | Script over source | Stack idioms (TS: TSN-14) |
| Why-not-what, step comments, headers, deviations, commented-out code, stale comments, specific summaries beyond the lint floor (CMT-1 to CMT-4, CMT-7 to CMT-9, CMT-11, CMT-13) | `llm` review | `../review/review-rubrics.md` RUB-10; the engineering role's ENG-R11 |

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
- [TSDoc, `{@inheritDoc}`](https://tsdoc.org/pages/tags/inheritdoc/) — copies summary, `@remarks`, `@param`, `@typeParam`, `@returns`, and forbids a summary beside it: why an implementation cannot have both (CMT-12).
- [Recommended XML documentation tags (C#)](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/recommended-tags) — "document all publicly visible types and their public members"; `<inheritdoc>` keeps implementations in sync with interfaces (CMT-5, CMT-12).
- [Compiler warning CS1591](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1591) — missing XML comment for a publicly visible type or member: the enforcement bar CMT-5 copies.
- [Go Doc Comments, "Funcs"](https://go.dev/doc/comment) — a function's doc comment "should explain what the function returns or, for functions called for side effects, what it does", and not the algorithm (CMT-13).
- [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/) — describe "what a function or method does and what it returns"; trouble describing an API simply suggests the wrong API (CMT-13).
- Knowledge: `knowledge/code-documentation/doc-comments.md` — C# XML tags, TSDoc, JSDoc and other stacks side by side.

## Related

- `coding-standards.md` — CS-13, CS-15 point here.
- `naming.md` — names carry intent so comments do not have to; "The contract questions" that CMT-13 summaries answer.
- `error-handling.md` — what a doc comment lists under errors.
- `../review/review-rubrics.md` — RUB-10, the shared review check.
- `../review/fitness-functions.md` — FF-12 counts suppressions that lack a reason comment (CMT-8).
- `../design/clean-architecture.md` — where the composition root sits.
