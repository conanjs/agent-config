---
schema: stack-paradigm/v1
last-updated: 2026-10-04
stack: typescript-node
paradigm: class-modeled@1
---

# class-modeled on typescript-node

## Shape mapping

| Paradigm section | TypeScript form |
|---|---|
| Modeling | Classes for entities, aggregates, value objects, and use cases; interfaces for ports consumed by application services |
| State | `#private` fields or `private` fields; `readonly` value objects; public methods expose behavior instead of writable data |
| Composition | Constructor injection for ports; composition root wires concrete adapters; polymorphism through interfaces where behavior varies |
| Effects | Domain imports no adapters; application classes orchestrate ports; infrastructure implements ports |
| Errors shape | `Result<T, E>` discriminated union for expected domain failures; typed `Error` subclasses with `cause` for unexpected failures, matching `idiom.errors` |
| Testing shape | Unit tests construct models and use cases with in-memory fakes; assertions observe public results and state snapshots |

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
| PDM-class-modeled-R1 | ESLint `no-restricted-syntax` selectors for public mutable `PropertyDefinition`; `@typescript-eslint/explicit-member-accessibility`; `@typescript-eslint/prefer-readonly` | `src/domain/**` |
| PDM-class-modeled-R3 | ESLint `no-restricted-syntax` selector for exported function declarations in application use-case modules; require exported classes for use cases | `src/application/**` |
| PDM-class-modeled-R4 | ESLint `no-restricted-imports` or boundary rules blocking domain imports from infrastructure, interface, runtime I/O modules, and adapter packages | `src/domain/**` |

## References

**Local artifacts:**
- `../../idioms.md` — `idiom.errors` and `idiom.di` forms used here.
- `../../../paradigms/class-modeled.md` — stack-agnostic paradigm rules.
- `../../../schemas/stack-paradigm.schema.md` — overlay schema and enforcement-table requirements.

**External authoritative sources:**
- [typescript-eslint `explicit-member-accessibility`](https://typescript-eslint.io/rules/explicit-member-accessibility/) — rule named in enforcement.
- [typescript-eslint `prefer-readonly`](https://typescript-eslint.io/rules/prefer-readonly/) — rule named in enforcement.
- [ESLint `no-restricted-syntax`](https://eslint.org/docs/latest/rules/no-restricted-syntax) — selector-based syntax restriction.
- [ESLint `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) — import-boundary restriction.

## Related

- `functional-pipeline.md` — TypeScript overlay for the other initial paradigm.
- `../../index.md` — TypeScript stack command slots.
