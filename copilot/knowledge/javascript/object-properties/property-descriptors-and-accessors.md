---
schema: knowledge-doc/v1
type: concept
topic: javascript/object-properties
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, property-descriptor, writable, enumerable, configurable, defineproperty, freeze, seal, getter, setter, accessor]
---

# Property flags, descriptors, getters and setters

## Summary
**TL;DR:** Every property is either a **data property** (`value` plus the flags `writable`, `enumerable`, `configurable`) or an **accessor property** (`get`/`set` functions plus `enumerable`, `configurable`). Properties created normally have all flags `true`; properties made with `Object.defineProperty` default every omitted flag to `false`. `writable: false` blocks assignment, `enumerable: false` hides the property from `for…in`, `Object.keys` and JSON, and `configurable: false` is a one-way door that blocks deletion and most flag changes. `Object.freeze`/`seal`/`preventExtensions` apply flags to a whole object — shallowly.
**Use this when:** making constants or read-only APIs, hiding helper properties, computing a property from others, or validating on assignment.
**Not this doc:** private class fields as an alternative → `javascript/classes/class-features-and-type-checks.md`; proxies for full interception → `javascript/misc/proxy-eval-currying-and-reference-type.md`.

## Problem
A "constant" config object is changed by another module; a helper method shows up in `JSON.stringify` output; a property added with `defineProperty` cannot be deleted and nobody knows why; `Object.freeze` does not stop nested changes.

## Mental model
**Analogy:** each property is a drawer with three switches: *lock* (writable), *visible on the inventory list* (enumerable), and *can be rewired or removed* (configurable). Turning off the last switch welds the other switches in place. An accessor property is a drawer with a clerk inside who computes the answer each time you open it.

**Artifact:** descriptors in Node 24 ✅[^1]:
```js
Object.getOwnPropertyDescriptor({ a: 1 }, 'a')
// { value: 1, writable: true, enumerable: true, configurable: true }
const o = {}; Object.defineProperty(o, 'x', { value: 1 });
Object.getOwnPropertyDescriptor(o, 'x')
// { value: 1, writable: false, enumerable: false, configurable: false }
Object.getOwnPropertyDescriptor(Math, 'PI')
// { value: 3.141592653589793, writable: false, enumerable: false, configurable: false }
```

## How it works
1. **Reading and setting flags.** `Object.getOwnPropertyDescriptor(obj, key)` returns the descriptor; `Object.defineProperty(obj, key, descriptor)` creates or updates one, and omitted flags default to `false` when creating ✅[^1] ✅[^2]. `Object.getOwnPropertyDescriptors` plus `Object.defineProperties` clone an object with its flags and symbols ✅[^2].
2. **`writable: false`.** Assignment throws `TypeError` in strict mode and is silently ignored otherwise ✅[^1] ✅[^2].
3. **`enumerable: false`.** The property is skipped by `for…in`, `Object.keys` and `JSON.stringify`, but direct access still works ✅[^1] ✅[^2].
4. **`configurable: false`.** The property cannot be deleted, and its flags cannot be changed — except that `writable` can still go from `true` to `false` ✅[^2]. Both a redefinition and a `delete` threw `TypeError` in strict mode ✅[^1].
5. **Whole-object helpers.** `preventExtensions` forbids new properties; `seal` also makes all properties non-configurable; `freeze` also makes them non-writable ✅[^2] ✅[^4]. They are shallow: a frozen object's nested object stays mutable ✅[^1].
6. **Accessors.** `get full() {…}` runs on read, `set full(v) {…}` on assignment; the descriptor has `get`/`set` and no `value`/`writable` ✅[^1] ✅[^3]. A descriptor with both `get` and `value` is invalid (`TypeError`) ✅[^1] ✅[^3].
7. **Smart getters for compatibility.** An accessor can keep an old property name working while the data moves — e.g. derive `age` from a stored `birthday` ✅[^3].

## Worked example
A user object whose `fullName` is computed and validated:

| Step | Code | Result |
|---|---|---|
| 1 | `const u = { first: 'A', last: 'B', get full() { return this.first + ' ' + this.last }, set full(v) { [this.first, this.last] = v.split(' ') } }` | — |
| 2 | `u.full` | `'A B'` |
| 3 | `u.full = 'C D'` | `u.first` is `'C'` ✅[^1] |
| 4 | `Object.getOwnPropertyDescriptor(u, 'full')` | has `get`, no `value` ✅[^1] |
| 5 | `Object.freeze(u); u.first = 'X'` (strict) | `TypeError` ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `defineProperty` on an existing normal property, only `{enumerable: false}` | Other flags keep their values | Updating merges with the existing descriptor ✅[^2] |
| `Object.freeze({a: {b: 1}}).a.b = 2` | Works | Freeze is shallow ✅[^1] |
| Non-writable property, sloppy mode | Assignment silently ignored | Errors only in strict mode ✅[^2] |
| Getter without setter, then assignment (strict) | `TypeError` | No setter to call ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `defineProperty` flags | Fine-grained control per property | Verbose; easy to forget `false` defaults |
| `Object.freeze` | One call for immutability | Shallow; strict-mode-only errors |
| Getter/setter | Computed or validated access with property syntax | Hidden work on each access |
| Private fields (`#x`) | Real privacy | Class-only |

## Takeaways
- Freeze exported configuration objects (deep-freeze if nested) so other modules cannot mutate them. [rule-candidate]
- Remember `defineProperty` defaults flags to `false`; spell out every flag you need.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Property flags and descriptors](https://javascript.info/property-descriptors) — javascript.info, living. Backs: flags, defaults, non-configurable rules, cloning with descriptors, sealing and freezing. [^2]
- [Property getters and setters](https://javascript.info/property-accessors) — javascript.info, living. Backs: accessor descriptors, invalid mixed descriptors, smart getters. [^3]
- [Object.freeze()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze) — MDN, living. Backs: freeze semantics and shallowness. [^4]

## Related
- `javascript/object-basics/objects-references-and-this.md`
- `js-runtime/private-fields.md` — `#x` versus TypeScript `private`.
