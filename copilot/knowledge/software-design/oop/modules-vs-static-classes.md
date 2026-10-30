---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["C#", "Java", "TypeScript", "JavaScript (ES modules)"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [static-class, modules, namespaces, organization, typescript, csharp]
---

# Modules versus static classes as the grouping unit

## Summary
**TL;DR:** Every language needs a way to group related functions so readers know where to find them. C# and Java use a class, because there every method must live inside a type, and a static class is the container for functions that keep no instance state. TypeScript and JavaScript have a container already, the module (one file), so a class with only static members adds a second wrapper. The goal is the same in both. Only the grouping unit differs.
**Use this when:** deciding between `export function` and `static` methods, setting up a lint rule for static-only classes, or moving C# habits into TypeScript.
**Not this doc:** when a unit should be a behavior-owning object at all → `encapsulation.md`, `../ddd/building-blocks.md`.

## Problem
A team coming from C# writes `class PermissionRules { static canGrant() {} }` in TypeScript. Another team writes loose functions in `helpers.ts`. Both are trying to group things so they can be found. One adds an extra wrapper; the other loses the grouping entirely.

## Mental model
**Analogy:** a filing cabinet. In C#, every sheet must sit in a labelled folder (a type), and a static class is a folder for sheets that are not about any one customer. In TypeScript, each drawer (module file) already has a label, so putting a single folder inside the drawer adds nothing.

**Artifact:** the same grouping in both languages.
```csharp
// C#: methods must be declared in a type
public static class TemperatureConverter {
    public static double CelsiusToFahrenheit(double c) => c * 9 / 5 + 32;
}
// call site: TemperatureConverter.CelsiusToFahrenheit(20)
```
```ts
// TypeScript: the module is the container
// temperatureConverter.ts
export function celsiusToFahrenheit(c: number): number { return (c * 9) / 5 + 32; }

// call site keeps the grouped name:
import * as TemperatureConverter from "./temperatureConverter.js";
TemperatureConverter.celsiusToFahrenheit(20);
```

## How it works
1. **C#.** Methods are declared in a class, struct or interface. ✅[^1] A static class cannot be instantiated. It is a convenient container for methods that work only on their inputs and keep no instance fields, such as `System.Math`. ✅[^2]
2. **TypeScript.** It has no `static class` construct. Those constructs exist in other languages because the language forces all data and functions to be inside a class. TypeScript has no such restriction, so a top-level function or a plain object does the job. ✅[^3]
3. **Lint.** typescript-eslint's `no-extraneous-class` reports a class that has no non-static members, i.e. one used only as a namespace. Its rationale is that the wrapper adds complexity without adding structure. The `allowStaticOnly` option exists but defaults to `false`, and the docs strongly recommend against enabling it. ✅[^4]

**Where the boundary is**

| Shape | Static-only? | Normal in TS? |
|---|---|---|
| Class with only `static` members, never instantiated | Yes | No: use a module with named exports |
| Value object with a private constructor plus `static create()` and instance methods | No | Yes |
| Stateless class with instance methods, created by the composition root and injected | No | Yes: it can be swapped and faked |
| Framework class that needs a decorator (a DI module) | Exempt (`allowWithDecorator`) ✅[^4] | Yes |

## Worked example
A permission-key parser needed in three places.

| Option | Grouping | Swappable in tests | Lint (`no-extraneous-class` default) |
|---|---|---|---|
| `class PermissionKeys { static parse() }` | By class name | No: static calls are fixed | Reported |
| `permissionKeys.ts` exporting `parse()` | By module name (`import * as PermissionKeys`) | No: plain function | Clean |
| `class PermissionKeyParser { parse() }`, injected | By role name | Yes | Clean |

All three are found under one name. Pick the last one when the unit plays a named role or needs a fake. Pick the module when it is a small pure helper.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| A static class holds mutable static fields | It becomes hidden global state | Static members have one copy for the whole program ✅[^2] |
| A team wants the C# style in TS | Allowed with `allowStaticOnly: true` | A conscious, recorded trade-off the rule permits ✅[^4] |

## Takeaways
- In TypeScript, group stateless helpers by module, not by a static-only class. [rule-candidate]
- A stateless unit that plays a named role or needs a fake is an instance class, injected. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [Methods (C# programming guide)](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/methods) — Microsoft, living. Backs: How it works 1. [^1]
- [Static classes and static class members (C#)](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/static-classes-and-static-class-members) — Microsoft, living. Backs: How it works 1, Edge cases. [^2]
- [TypeScript Handbook: Classes, "Why No Static Classes?"](https://www.typescriptlang.org/docs/handbook/2/classes.html) — TypeScript team, living. Backs: How it works 2. [^3]
- [no-extraneous-class](https://typescript-eslint.io/rules/no-extraneous-class/) — typescript-eslint, living. Backs: How it works 3, boundary table, Edge cases. [^4]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — the Tier B form for TypeScript.

## Related
- `software-design/oop/encapsulation.md`
- `software-design/oop/dependency-injection.md`
- `software-design/ddd/building-blocks.md`
