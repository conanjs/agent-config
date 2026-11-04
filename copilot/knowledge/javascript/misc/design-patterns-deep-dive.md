---
schema: deep-dive/v1
topic: javascript/misc
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (EventEmitter, EventTarget)", "browsers for EventTarget"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, design-patterns, singleton, factory, prototype, observer, pub-sub, decorator, proxy, strategy, command, iterator, middleware, dependency-injection, mixin, module-pattern]
---

# Design patterns in JavaScript, end to end

## Summary
**TL;DR:** The classic object-oriented design patterns exist to work around missing language features; JavaScript has many of those features built in, so most patterns shrink to a few lines or disappear. A **module** is already a singleton; a **function** is already a strategy or command; **closures** give private state; `Proxy`, iterators and `EventTarget` are language-level proxy, iterator and observer patterns. What remains worth naming is mostly about **decoupling**: observer and pub/sub, middleware chains, dependency injection, mixins. Language decorators (`@dec`) are still a TC39 proposal (listed at stage 2.7) and are a `SyntaxError` in Node 24; decorating means wrapping functions.
**Use this when:** you recognize a pattern name in a codebase or interview and want its idiomatic JavaScript form, are choosing between class-based and function-based designs, or are reading JavaScript design-pattern books and want a verified companion built on open sources.
**Depth:** for each pattern — intent, idiomatic JavaScript form, lab-verified behaviour, and when it is an anti-pattern: module and singleton, factory, prototype, observer (`EventTarget`, `EventEmitter`), pub/sub, decorator (wrappers and the proposal's status), proxy, strategy, command with undo, iterator, middleware/chain of responsibility, dependency injection, mixins; a pattern-to-feature map and a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1.

## 1. Patterns versus language features

| Pattern (Gang of Four era) | What JavaScript already gives you |
|---|---|
| Singleton | An ES module: evaluated once, shared by every importer |
| Strategy, Command | First-class functions |
| Iterator | The iteration protocol and generators |
| Proxy | The `Proxy` object |
| Observer | `EventTarget` (web and Node), `EventEmitter` (Node) |
| Prototype | `Object.create`, the prototype chain |
| Private state / module pattern | Closures, `#private` fields, module scope |

✅[^1] ✅[^3]

**Analogy:** patterns are recipes written for a kitchen without certain appliances; in a better-equipped kitchen several recipes become "press the button".

## 2. Creational patterns

| Pattern | Idiomatic form | Lab |
|---|---|---|
| **Module / singleton** | `export default Object.freeze(config)`: two dynamic imports returned the same frozen object and the module body ran once | ✅[^2] |
| Class singleton | `static get() { return Db.#i ??= new Db() }` returns the same instance | ✅[^2] |
| **Factory** | A function choosing an implementation from a lookup table, throwing on unknown types (`json` → `{"a":1,"b":2}`, `csv` → `1,2`) | ✅[^2] |
| **Prototype** | `Object.create(proto, descriptors)` — the new object delegates to `proto` | ✅[^2] |

Singletons become an **anti-pattern** when they are a global mutable "kitchen sink" of app state: hidden coupling and hard tests. Prefer passing dependencies in (§5) or a dedicated state container ✅[^3].

## 3. Behavioural patterns

### 3.1 Observer

| Implementation | Lab behaviour |
|---|---|
| `EventTarget` + `CustomEvent` | A listener received `10`; after `removeEventListener` it did not receive `20` ✅[^2] ✅[^4] |
| Node `EventEmitter` | Listeners run synchronously in registration order (`a1, once1, b1`); `once` ran only once; emitting `'error'` with no listener **throws** the error ✅[^2] ✅[^5] |

Always remove listeners you no longer need — a forgotten listener keeps its closure alive (`javascript/advanced-functions/scope-and-closures-deep-dive.md`).

### 3.2 Publish/subscribe

A broker owns topics, so publishers and subscribers never reference each other. Lab: two subscribers received order 7; after one unsubscribed, only `stock 8` remained ✅[^2] ✅[^1].

### 3.3 Strategy and command

- **Strategy** = a map of functions with a default: shipping `standard` 7, `express` 19, unknown → standard 7 ✅[^2].
- **Command** = an object with `do` and `undo` kept on a history stack: two commands (+5, +3) then one undo left 5 ✅[^2] ✅[^1].

### 3.4 Iterator

Give a composite structure `*[Symbol.iterator]()` and delegate to children with `yield*`: a tree `1 → (2 → 3), 4` spread to `[1, 2, 3, 4]` ✅[^2] (`javascript/generators-iterators/generators-and-async-iteration.md`).

### 3.5 Middleware / chain of responsibility

Each handler gets `(ctx, next)` and decides whether and when to call `next`. Code after `next()` runs on the way back out, giving "onion" layering: `auth, log, handler, log-after` ✅[^2]. This is the model of web frameworks such as Express and Koa ✅[^6].

## 4. Structural patterns

| Pattern | Idiomatic form | Lab |
|---|---|---|
| **Decorator** | A higher-order function that wraps another and forwards `this` and arguments: a logging wrapper recorded `add(2,3)=5` | ✅[^2] |
| Language decorators (`@dec class C {}`) | Not available: `SyntaxError` in Node 24; the TC39 proposal is listed at stage 2.7. TypeScript's `experimentalDecorators` and the TC39 design differ | ✅[^2] ✅[^7] |
| **Proxy** | `new Proxy(target, handler)`: a lazy-loading proxy created the heavy object only on first property read (0 loads before, 1 after two reads) and logged both reads | ✅[^2] ✅[^8] |
| **Mixin** | Class-factory mixins `const Eq = B => class extends B { … }`, composed `Eq(Serializable(P))` | ✅[^2] |

Mixin and composition trade-offs: `javascript/classes/class-features-and-type-checks.md` and `software-design/oop/composition-over-inheritance.md`.

## 5. Dependency injection

Pass collaborators in instead of importing them inside the class: `new Service({ clock: { now: () => 'T0' } }).stamp()` → `'at T0'`, so tests can use fakes without module mocking ✅[^2]. Design guidance: `software-design/oop/dependency-injection.md`.

## 6. Choosing

| Problem | Pattern |
|---|---|
| One shared configuration or client | Module export (frozen if constant) |
| Choose an implementation at run time | Factory or strategy map |
| React to changes without coupling | Observer / `EventTarget`, or pub/sub for many-to-many |
| Cross-cutting behaviour (logging, caching, auth) | Function decorator or middleware |
| Undo/redo, queued operations | Command |
| Lazy loading, access control, validation | `Proxy` (mind its limits with private fields and built-ins) |
| Shared behaviour across unrelated classes | Mixin or composition |
| Testable code with external effects | Dependency injection |

## 7. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| Tests interfere with each other | Mutable singleton state | Inject dependencies; reset or avoid global state |
| Memory grows with each page or request | Listeners never removed | `removeEventListener` / `off`, or `AbortSignal` with `addEventListener` |
| Node process crashes on `emit('error')` | No `'error'` listener | Always listen for `'error'` |
| `@decorator` breaks the build | Proposal syntax not supported | Wrapper functions, or a compiler configured for one decorator dialect |
| Proxied object's methods throw | Private fields/internal slots bypass the proxy | Bind methods to the target |
| Middleware response sent twice | `next()` called after responding | Return after responding |

## 8. How this deep dive was built
- **Sources:** patterns.dev (Lydia Hallie and Addy Osmani), MDN (`EventTarget`, `Proxy`), Node.js `events` docs, the TC39 proposals list, the Express guide; and the knowledge base's own `software-design/` docs. It covers the subjects of JavaScript design-pattern books from these open sources only.
- **Verified:** `node:24.22.1-alpine` on 2026-11-04 (lab files `pat/patterns.mjs`, `pat/config.mjs`).

## References
- [Design patterns](https://www.patterns.dev/vanilla/) — Lydia Hallie and Addy Osmani, patterns.dev, living. Backs: JavaScript forms of singleton, factory, observer, proxy, mixin and others. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] result was produced on 2026-11-04. [^2]
- [Singleton pattern](https://www.patterns.dev/vanilla/singleton-pattern/) — patterns.dev, living. Backs: modules as singletons; the global-mutable-state anti-pattern. [^3]
- [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) — MDN, living. Backs: add/remove/dispatch semantics. [^4]
- [Events](https://nodejs.org/api/events.html) — Node.js documentation, v24. Backs: synchronous listener order, `once`, the special `'error'` event. [^5]
- [Using middleware](https://expressjs.com/en/guide/using-middleware.html) — Express, living. Backs: `(req, res, next)` chains. [^6]
- [TC39 proposals](https://github.com/tc39/proposals) — Ecma TC39, living. Backs: decorators listed at stage 2.7. [^7]
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) — MDN, living. Backs: traps for interception. [^8]

## Related
- `software-design/oop/` — dependency injection, composition over inheritance, polymorphism.
- `javascript/misc/proxy-eval-currying-and-reference-type.md`
- `javascript/prototypes/objects-this-and-delegation-deep-dive.md`
