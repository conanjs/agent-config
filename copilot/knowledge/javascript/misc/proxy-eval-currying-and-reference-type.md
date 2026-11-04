---
schema: knowledge-doc/v1
type: concept
topic: javascript/misc
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, proxy, reflect, traps, invariants, eval, currying, partial-application, reference-type, this]
---

# Proxy and Reflect, `eval`, currying and the Reference Type

## Summary
**TL;DR:** A **`Proxy`** wraps a target object and intercepts operations through **traps** (`get`, `set`, `has`, `deleteProperty`, `ownKeys`, `apply`, …); **`Reflect`** offers the default behaviour of each trap so a trap can add logic and then forward. Proxies cannot see built-in **internal slots** (`Map` data) or **private fields**, so wrapping such objects breaks their methods unless you bind them. `eval` runs a string as code in the current scope (indirect `eval` uses the global scope) — avoid it. **Currying** turns `f(a, b, c)` into `f(a)(b)(c)` for easy partial application. The **Reference Type** is the spec's internal value that carries the object before the dot to the call — it is why `obj.method()` has a `this` but `(cond ? obj.method : x)()` does not.
**Use this when:** building validation, defaults, logging or access control around objects; reading code that uses `eval`; writing curried helpers; or explaining a lost `this` in an unusual expression.
**Not this doc:** property descriptors → `javascript/object-properties/property-descriptors-and-accessors.md`; `bind` and decorators → `javascript/advanced-functions/function-objects-and-calls.md`.

## Problem
Validation spread across setters is hard to keep consistent; a proxied `Map` throws on `set`; `eval` makes code hard to optimize and audit; `this` disappears in an expression that only *looks* like a method call.

## Mental model
**Analogy:** a proxy is a receptionist in front of an office: every request (read, write, delete, list) passes the desk, where it can be answered, changed or refused; `Reflect` is the receptionist simply passing the request through. But staff-only doors (internal slots, private fields) do not go through the reception desk — so a stranger standing in for the office cannot open them.

**Artifact:** a proxy with five traps, in Node 24 ✅[^1]:
```js
const target = { a: 1 };
const p = new Proxy(target, {
  get: (t, k, r) => k in t ? Reflect.get(t, k, r) : 'default:' + String(k),
  set(t, k, v) { if (typeof v !== 'number') return false; t[k] = v; return true; },
  has: (t, k) => k === 'magic' || k in t,
  deleteProperty: (t, k) => String(k).startsWith('_') ? false : Reflect.deleteProperty(t, k),
  ownKeys: t => Reflect.ownKeys(t).filter(k => !String(k).startsWith('_')),
});
p.b = 2; target._hidden = 1;
[p.a, p.zzz, 'magic' in p, Object.keys(p), target.b]   // [1, 'default:zzz', true, ['a','b'], 2]
p.c = 'str'          // TypeError in strict mode — set trap returned false
delete p._hidden     // TypeError in strict mode — deleteProperty returned false
```

## How it works
1. **Traps.** Each internal operation has a trap; missing traps forward to the target ✅[^2]. `set` and `deleteProperty` must return `true` on success; `false` makes the operation throw `TypeError` in strict mode ✅[^1] ✅[^2].
2. **`apply` trap.** Proxying a function intercepts calls: the lab's `apply` trap returned `'logged:5'` for `sum(2, 3)` ✅[^1] ✅[^2].
3. **`Reflect`.** `Reflect.get/set/has/deleteProperty/ownKeys/apply` perform the default operation with the same arguments; passing the `receiver` keeps getters' `this` correct when objects inherit from a proxy ✅[^2].
4. **Invariants.** The language enforces consistency rules on traps — for example `get` cannot report a different value for a non-writable, non-configurable property ✅[^2] ✅[^6].
5. **Limits.** Built-ins such as `Map` store data in internal slots, so `proxy.set()` called with the proxy as `this` throws `TypeError`; the same happens for private class fields ✅[^1] ✅[^2]. A proxy is a different object, so `proxy !== target` ✅[^2].
6. **Revocable proxies.** `Proxy.revocable(target, handler)` returns `{proxy, revoke}`; after `revoke()` every operation throws `TypeError` ✅[^1] ✅[^2].
7. **`eval`.** Direct `eval(code)` runs in the caller's scope and can change local variables (the lab's local `a` became 2); indirect `(0, eval)(code)` runs globally (the local `b` stayed 1). In strict mode `eval` gets its own scope for new declarations ✅[^1] ✅[^3]. Use `new Function` or proper parsing instead ✅[^3].
8. **Currying.** A generic `curry(f)` returns a function that collects arguments until it has `f.length` of them: `sum3(1)(2)(3)`, `sum3(1, 2)(3)` and `sum3(1, 2, 3)` all gave 6 ✅[^1] ✅[^4]. It only works for functions with a fixed number of parameters ✅[^4].
9. **Reference Type.** Property access `obj.method` produces an internal reference `(obj, 'method', strict)`; a call `()` applied directly to it receives `obj` as `this`. Any other operation — assignment, `?:`, `||` — produces a plain function value and `this` is lost. Measured: `user.hi()` and `(user.hi)()` gave `'J'`; `(cond ? user.hi : user.hi)()` gave `undefined` ✅[^1] ✅[^5].

## Worked example
Validating writes to a settings object:

| Step | Code | Result |
|---|---|---|
| 1 | `const settings = new Proxy({}, { set(t, k, v) { if (typeof v !== 'number') return false; return Reflect.set(t, k, v); } })` | — |
| 2 | `settings.timeout = 30` | Stored ✅[^1] |
| 3 | `settings.timeout = '30'` (strict) | `TypeError` ✅[^1] |
| 4 | `Object.keys(settings)` | `['timeout']` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `new Proxy(new Map(), {}).set(1, 1)` | `TypeError` | Internal slot accessed with the proxy as `this` ✅[^1] |
| Proxy around a class instance with `#private` | Method using `#x` throws `TypeError` | Private fields are keyed by the real object ✅[^1] |
| `eval` with user input | Code injection | Executes arbitrary code ✅[^3] |
| `(obj.m)()` | Keeps `this` | Parentheses do not discard the reference ✅[^1] |
| Curried variadic function | Never completes | `f.length` ignores rest parameters ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Proxy | Intercepts every operation, even unknown keys | Overhead on every access; breaks internal slots and `#fields` |
| Accessor properties | Fast, explicit | Only for known property names |
| Currying | Easy partial application and composition | Less obvious call sites |

## Takeaways
- Forward from traps with `Reflect.*` and return `true` from `set`/`deleteProperty` on success.
- Do not proxy objects that rely on internal slots or private fields unless you bind their methods to the target.
- Never `eval` untrusted input. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 29 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Proxy and Reflect](https://javascript.info/proxy) — javascript.info, living. Backs: traps, return values, `Reflect`, receiver, invariants, internal-slot and private-field limits, revocable proxies. [^2]
- [Eval: run a code string](https://javascript.info/eval) — javascript.info, living. Backs: scope of `eval`, strict mode, alternatives. [^3]
- [Currying](https://javascript.info/currying-partials) — javascript.info, living. Backs: curry implementation and fixed-length limitation. [^4]
- [Reference Type](https://javascript.info/reference-type) — javascript.info, living. Backs: how `this` is carried by property references and lost by other operations. [^5]
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) — MDN, living. Backs: handler invariants. [^6]

## Related
- `javascript/misc/bigint-unicode-and-weakrefs.md`
- `javascript/advanced-functions/function-objects-and-calls.md`
