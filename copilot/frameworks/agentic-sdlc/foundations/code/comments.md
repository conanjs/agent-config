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
| CMT-5 | Public API (exported types, functions, methods) has a doc comment stating contract, errors and side effects, in the stack profile's doc-comment form. | Every exported symbol has one, and it names what is promised and what can fail | An exported use case with no note that it throws on a missing role | llm (fallback) | — |
| CMT-6 | Doc comments add information. Parameter and return notes appear only when they say more than the name and type. | No doc comment is a paraphrase of the symbol name | `/** @param roleId The role id. */` | llm (fallback) | — |
| CMT-7 | A file or class header exists only when the purpose is not obvious from its name; it links the decision record or owner where one exists. | Every header answers a question the file name does not | A header repeating `role-repository.ts` as "Role repository" | llm | — |
| CMT-8 | Deviations carry a reason and a record: paradigm escape hatches, lint or type suppressions, and workarounds name the rule or decision id (and an issue or task id for a workaround). | Each deviation comment names what is bypassed and why, with an id | A suppression with no reason, or a free function with no hatch note | llm | — |
| CMT-9 | No commented-out code. History lives in version control. | The repo contains no disabled code blocks inside comments | A 20-line block commented out "just in case" | llm | — |
| CMT-10 | TODO and FIXME carry an owner or task id: `TODO(<owner-or-task-id>): <what>`. | Every marker matches the format and its task is open | A bare `// TODO fix later` | script | — |
| CMT-11 | Comments are changed with the code they describe. A comment that contradicts the code is a defect. | Changed lines and their nearby comments agree after the change | A step comment says "validate" after the validation moved elsewhere | llm | — |

## Interpreting

**Which comment goes where (resolves CS-13 and CS-15)**

CS-13 asks for comments that explain why. CS-15 asks for documented public surfaces. Neither asks for a comment on every function. A blanket per-function "Intent:" line is a CMT-1 violation: the name (`../code/naming.md`, NAM-1) carries intent, and the comment would only restate it.

| Location | Comment | What it says |
|---|---|---|
| Exported type, function, method | Required (CMT-5) | Contract, errors, side effects |
| Orchestration body | Required (CMT-3) | One short line per step; why when order matters (CMT-4) |
| Small internal helper | None, unless a why exists | A constraint or trade-off the name cannot show |
| Every function, by default | Not required | — |
| Deviation from a rule or paradigm | Required (CMT-8) | The hatch or record id and the reason |

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
| Doc comment present on exported API (CMT-5) and not a paraphrase (CMT-6) | Lint where the stack has a doc-comment rule; otherwise `llm (fallback)` | Stack idioms (TS: TSN-13) |
| TODO and FIXME format (CMT-10) | Script over source | Stack idioms (TS: TSN-14) |
| Why-not-what, step comments, headers, deviations, commented-out code, stale comments (CMT-1 to CMT-4, CMT-7 to CMT-9, CMT-11) | `llm` review | `../review/review-rubrics.md` RUB-10; the engineering role's ENG-R11 |

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| CMT-3 step comments | CMT-2 no narration | One comment per step, never per line. A step is a unit of intent, such as "build the composition root". |
| CMT-3 step comments | `coding-standards.md` CS-2 small units | If many step comments are needed, extract steps into named functions and keep step comments only in the orchestrating one. |
| CMT-5 public docs | CMT-1 no restating | Document the contract (promises, errors, side effects), never the name. A trivially obvious accessor needs no body text. |

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

## Related

- `coding-standards.md` — CS-13, CS-15 point here.
- `naming.md` — names carry intent so comments do not have to.
- `error-handling.md` — what a doc comment lists under errors.
- `../review/review-rubrics.md` — RUB-10, the shared review check.
- `../review/fitness-functions.md` — FF-12 counts suppressions that lack a reason comment (CMT-8).
- `../design/clean-architecture.md` — where the composition root sits.
