---
schema: stack-paradigm/v1
last-updated: 2026-10-25
stack: typescript-node
paradigm: class-modeled@1
---

# class-modeled on typescript-node

## Shape mapping

| Paradigm section | TypeScript form |
|---|---|
| Modeling | Classes for Tier A: entities, aggregates, value objects, use cases, adapters, middleware and guards, and every role-named unit (presenters, policies, factories, handlers); interfaces for ports consumed by application services. Tier B form: exported module-level functions in allow-listed files, each with a one-line why-comment, never a static-only class. In TypeScript the module is the namespace; C# needs `static class` only because methods must be declared inside a type. A class with instances plus static factories (`Role.create`, private constructor) is not static-only and is the normal value-object form. A project that wants C#-style static grouping records `allowStaticOnly: true` in its constitution, which outranks this overlay on form (`conventions.md` §3.4: State > Paradigm > Stack on form) |
| State | Which privacy goes where: (1) `readonly #field` for entity and value-object state, and for any field in any layer that holds a credential, key, hash or token. `#` stays private at runtime: `JSON.stringify`, `Object.keys`, spread and loggers cannot see it, `as any` cannot change it, and `#field in obj` can check that an object is a real instance. Alternative for a value object meant to be serialized as-is, and holding no secret: public `readonly` fields plus `Object.freeze(this)` in the constructor, which is also immutable at runtime but has no instance check. Neither protects a `private constructor` from being called at runtime. (2) `private readonly` constructor parameters for injected collaborators (ports, clock, logger); `#` cannot be a parameter. (3) Plain `readonly` public fields only for data shapes whose job is to be serialized (DTOs, response views, config records). Public methods expose behavior instead of writable data. Example: `User` keeps `readonly #passwordHash`; a token service keeps `readonly #signingKey`, not `private readonly signingKey` |
| Composition | Constructor injection for ports; composition root wires concrete adapters; polymorphism through interfaces where behavior varies |
| Effects | Domain imports no adapters; application classes orchestrate ports; infrastructure implements ports |
| Errors shape | `Result<T, E>` discriminated union for expected domain failures; typed `Error` subclasses with `cause` for unexpected failures, matching `idiom.errors` |
| Testing shape | Unit tests construct models and use cases with in-memory fakes passed through the port; assertions observe public results and state snapshots; tests never copy production logic |

## Example

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type PermissionKey = string;

class Role {
  #permissions: ReadonlySet<PermissionKey>;

  private constructor(
    public readonly id: string,
    private readonly name: string,
    permissions: Iterable<PermissionKey>,
  ) {
    this.#permissions = new Set(permissions);
  }

  static create(id: string, name: string, permissions: PermissionKey[]): Result<Role, "empty_permissions"> {
    if (permissions.length === 0) return { ok: false, error: "empty_permissions" };
    return { ok: true, value: new Role(id, name, permissions) };
  }

  grants(permission: PermissionKey): boolean {
    return this.#permissions.has(permission);
  }

  grant(permission: PermissionKey): Result<Role, "already_granted"> {
    if (this.#permissions.has(permission)) return { ok: false, error: "already_granted" };
    return { ok: true, value: new Role(this.id, this.name, [...this.#permissions, permission]) };
  }
}

interface RoleRepository {
  save(role: Role): Promise<void>;
}

class GrantPermissionToRole {
  constructor(private readonly roles: RoleRepository) {}

  async run(role: Role, permission: PermissionKey): Promise<Result<Role, "already_granted">> {
    const result = role.grant(permission);
    if (!result.ok) return result;
    await this.roles.save(result.value);
    return result;
  }
}
```

## Counter-example

```ts
export interface Role { // PDM-class-modeled-R1: data shape exposes state instead of behavior
  id: string;
  permissions: string[];
}

export async function grantPermission(role: Role, repo: { save(role: Role): Promise<void> }, permission: string) { // PDM-class-modeled-R3: free use-case function takes a port as a parameter
  if (role.permissions.includes(permission)) { // PDM-class-modeled-R2: invariant lives outside the owning model
    throw new Error("already granted"); // PDM-class-modeled-R5: expected business failure is not a Result
  }
  role.permissions.push(permission); // PDM-class-modeled-R1: caller mutates public state
  await repo.save(role); // PDM-class-modeled-R4: business operation mixes model change and I/O
}
```

## Enforcement

| Rule | Tool config | Scope (paths) |
|---|---|---|
| PDM-class-modeled-R1 | ESLint `no-restricted-syntax` selectors for public mutable `PropertyDefinition`, and `PropertyDefinition[accessibility='private']` plus `TSParameterProperty` so domain state uses `#` (the domain receives no injected collaborators, so every parameter property there is state); `@typescript-eslint/explicit-member-accessibility`; `@typescript-eslint/prefer-readonly`. Secret-holding fields outside the domain are an `llm` review check (State row) | `src/domain/**` |
| PDM-class-modeled-R3 | ESLint `no-restricted-syntax` selector for exported function declarations in application use-case modules; require exported classes for use cases | `src/application/**` |
| PDM-class-modeled-R4 | ESLint `no-restricted-imports` or boundary rules blocking domain imports from infrastructure, interface, runtime I/O modules, and adapter packages | `src/domain/**` |
| PDM-class-modeled-R7 | ESLint `no-restricted-syntax` with selectors `Program > FunctionDeclaration`, `Program > ExportNamedDeclaration > FunctionDeclaration`, `Program > ExportDefaultDeclaration > FunctionDeclaration` and `Program > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']`. The Tier B allow-list (entry point, route tables, config, framework factories) goes in the config block's `ignores`; it mirrors the `Tier B files:` list in `docs/architecture.md` §7, which owns it. Also uses R1, R3 and R4 above for Tier A shape. `@typescript-eslint/no-extraneous-class` with `allowWithDecorator: true` (framework modules) and `allowStaticOnly: false` rejects namespace-only classes | `src/**` minus the allow-list |
| PDM-class-modeled-R9 | ESLint `no-restricted-imports` blocking adapter and infrastructure modules (use the layer aliases, see TSN-17) everywhere except the composition root file and its tests | `src/**` minus the composition root |

## References

**Local artifacts:**
- `../../idioms.md` — `idiom.errors` and `idiom.di` forms used here.
- `../../../paradigms/class-modeled.md` — stack-agnostic paradigm rules.
- `../../../schemas/stack-paradigm.schema.md` — overlay schema and enforcement-table requirements.
- `knowledge/software-design/oop/modules-vs-static-classes.md` — why the module, not a static class, is the TypeScript grouping unit.
- `knowledge/js-runtime/private-fields.md` — `#` versus `private`: runtime behavior, serialization, performance.

**External authoritative sources:**
- [TypeScript Handbook, Classes: "Why No Static Classes?"](https://www.typescriptlang.org/docs/handbook/2/classes.html) — C# and Java need static classes because they force all functions into a class.
- [typescript-eslint `no-extraneous-class`](https://typescript-eslint.io/rules/no-extraneous-class/) — rule and options for static-only classes.
- [C# static classes (Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/static-classes-and-static-class-members) — a static class as a container for methods, e.g. `System.Math`.

**External authoritative sources:**
- [typescript-eslint `explicit-member-accessibility`](https://typescript-eslint.io/rules/explicit-member-accessibility/) — rule named in enforcement.
- [typescript-eslint `prefer-readonly`](https://typescript-eslint.io/rules/prefer-readonly/) — rule named in enforcement.
- [ESLint `no-restricted-syntax`](https://eslint.org/docs/latest/rules/no-restricted-syntax) — selector-based syntax restriction.
- [ESLint `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) — import-boundary restriction.

## Related

- `functional-pipeline.md` — TypeScript overlay for the other initial paradigm.
- `../../index.md` — TypeScript stack command slots.
