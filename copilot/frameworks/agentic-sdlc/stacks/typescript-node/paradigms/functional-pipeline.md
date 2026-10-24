---
schema: stack-paradigm/v1
last-updated: 2026-10-04
stack: typescript-node
paradigm: functional-pipeline@1
---

# functional-pipeline on typescript-node

## Shape mapping

| Paradigm section | TypeScript form |
|---|---|
| Modeling | Plain `type` aliases and `interface` records for data; discriminated unions for alternatives; no domain service classes in the core pipeline |
| State | `readonly` properties, `ReadonlyArray`, and new values returned from each step; no shared mutable accumulators in core code |
| Composition | Small pure functions composed in named order; pipelines pass `Result<T, E>` between parse, validate, decide, and map steps |
| Effects | Adapters and handlers load inputs and persist outputs; core functions receive plain values and return decisions |
| Errors shape | `Result<T, E>` discriminated union for expected failures; exhaustive handling on `error.kind` or equivalent tags |
| Testing shape | Table-driven unit tests for core functions; adapter tests only at the shell |

## Example

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type RawUser = Readonly<{ id: string; email: string }>;
type ValidUser = Readonly<{ id: string; email: string }>;
type SyncDecision = Readonly<{ kind: "upsert"; user: ValidUser } | { kind: "skip"; id: string }>;

type ValidationError = Readonly<{ kind: "invalid_email"; id: string }>;

const validateUser = (raw: RawUser): Result<ValidUser, ValidationError> =>
  raw.email.includes("@") ? { ok: true, value: raw } : { ok: false, error: { kind: "invalid_email", id: raw.id } };

const decideSync = (user: ValidUser): SyncDecision => ({ kind: "upsert", user });

const syncCore = (raw: RawUser): Result<SyncDecision, ValidationError> => {
  const validated = validateUser(raw);
  return validated.ok ? { ok: true, value: decideSync(validated.value) } : validated;
};

async function syncShell(rawUsers: RawUser[], repo: { upsert(user: ValidUser): Promise<void> }) {
  for (const raw of rawUsers) {
    const decision = syncCore(raw);
    if (decision.ok && decision.value.kind === "upsert") await repo.upsert(decision.value.user);
  }
}
```

## Counter-example

```ts
let skipped = 0; // PDM-functional-pipeline-R1: shared mutable state in the core

async function syncUser(raw: { id: string; email: string }, repo: { exists(id: string): Promise<boolean> }) { // PDM-functional-pipeline-R2/R5: core step performs I/O
  if (!raw.email.includes("@")) { // PDM-functional-pipeline-R3: failure is not an explicit modeled alternative
    skipped += 1;
    return null;
  }

  if (await repo.exists(raw.id)) { // PDM-functional-pipeline-R4: validation, decision, and effect are tangled
    return { action: "skip" };
  }

  return { action: "upsert", user: raw };
}
```

## Enforcement

| Rule | Tool config | Scope (paths) |
|---|---|---|
| PDM-functional-pipeline-R1 | TypeScript `readonly` types plus `tsconfig` `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`; `llm (fallback): full immutability needs review when no readonly lint plugin is configured` | `src/domain/**`, `src/application/**` |
| PDM-functional-pipeline-R2 | ESLint `no-restricted-imports` or boundary rules blocking core imports from infrastructure, interface, runtime I/O modules, and adapter packages | `src/domain/**`, `src/application/**` |
| PDM-functional-pipeline-R5 | ESLint `no-restricted-imports` or boundary rules requiring adapters and handlers to stay outside the core paths | `src/domain/**`, `src/application/**` |

## References

**Local artifacts:**
- `../../idioms.md` — `idiom.errors` Result shape used here.
- `../../../paradigms/functional-pipeline.md` — stack-agnostic paradigm rules.
- `../../../schemas/stack-paradigm.schema.md` — overlay schema and enforcement-table requirements.

**External authoritative sources:**
- [TypeScript `strict` compiler option](https://www.typescriptlang.org/tsconfig/#strict) — typechecking baseline used in enforcement.
- [TypeScript `noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess) — safer indexed access for immutable records and arrays.
- [TypeScript `exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes) — exact optional property semantics.
- [ESLint `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) — import-boundary restriction.

## Related

- `class-modeled.md` — TypeScript overlay for invariant-owning domain code.
- `../../index.md` — TypeScript stack command slots.
