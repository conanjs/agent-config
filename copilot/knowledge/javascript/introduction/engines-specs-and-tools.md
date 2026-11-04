---
schema: knowledge-doc/v1
type: concept
topic: javascript/introduction
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24", "current Chrome, Firefox, Safari, Edge"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, ecmascript, v8, spidermonkey, engine, specification, mdn, devtools, node]
---

# JavaScript engines, the specification and the everyday tools

## Summary
**TL;DR:** JavaScript is one language defined by one specification (**ECMA-262**, a new edition every year) and run by many **engines** (V8, SpiderMonkey, JavaScriptCore). The engine parses the script, compiles it to machine code and keeps optimizing it while it runs; the **host** (a browser or Node.js) adds everything outside the language — the DOM, timers, files, network. To learn and debug you need four things: the spec for exact rules, MDN as the manual, compatibility tables, and DevTools or the Node REPL to try code.
**Use this when:** starting JavaScript, deciding whether a behaviour belongs to the language or to the host, or looking for the authoritative answer to "what does this code do?".
**Not this doc:** engine internals such as hidden classes → `js-runtime/v8-hidden-classes.md`; the learning order → `javascript/learning-path.md`.

## Problem
Beginners mix up the language with its hosts. `setTimeout`, `alert` and `document` are not JavaScript language features but host APIs; a feature that "works in Chrome" may not exist in another engine; answers on forums contradict each other. Without knowing who defines what, it is hard to tell a bug from a rule.

## Mental model
**Analogy:** the specification is the rulebook of a board game, engines are different factories that build the board and pieces, and hosts are the rooms where you play — one room has a TV (the browser's DOM), another has a filing cabinet (Node's file system). The rules of the game itself are the same in every room.

**Artifact:** the same language run by a non-browser host in the lab ✅[^1]:
```console
$ docker run --rm node:24.22.1-alpine node -e 'console.log(process.version, typeof document, typeof setTimeout)'
v24.22.1 undefined function
```
`document` is missing because it belongs to browsers; `setTimeout` exists because Node provides its own timers.

## How it works
1. **Engines.** Each browser embeds an engine with a codename: V8 in Chrome, Opera and Edge; SpiderMonkey in Firefox; JavaScriptCore in Safari ✅[^2]. Node.js also uses V8 ✅[^7].
2. **Run pipeline.** The engine reads (parses) the script, converts it to machine code, runs it, and optimizes hot code further using data it collects while running ✅[^2].
3. **Host limits in the browser.** Page scripts cannot read arbitrary files or launch programs, and a page from one origin (domain, protocol, port) cannot freely read another's data — the Same Origin Policy ✅[^2].
4. **The specification.** ECMA-262 defines the language in a formal way; a new edition comes out every year and proposals move through TC39 stages before inclusion ✅[^3] ✅[^4].
5. **Manuals and support tables.** MDN is the practical reference with examples ✅[^5]; per-feature support tables (caniuse.com, the compat table) show which engines implement a feature ✅[^4].
6. **Languages that compile to JavaScript.** TypeScript adds static types, CoffeeScript adds shorter syntax, Dart and Kotlin can compile to JavaScript; the engine only ever runs the JavaScript output ✅[^2].
7. **Trying code.** In browsers, DevTools open with F12 (on macOS Chrome, Cmd+Opt+J) on the Console tab; Shift+Enter inserts a new line instead of running ✅[^6]. Outside a browser, `node` gives a REPL and runs files ✅[^1].
8. **Editors.** Full IDEs index a whole project and integrate version control and debugging; lightweight editors open fast and add features through plugins ✅[^8].

## Worked example
Question: "Does `structuredClone` exist in my runtime and who defines it?"

| Step | Action | Result |
|---|---|---|
| 1 | Search the spec index for `structuredClone` | Not in ECMA-262 → it is a host API ✅[^3] |
| 2 | Look it up on MDN | Documented under Web APIs (`Window.structuredClone`) ✅[^9] |
| 3 | Try it in Node 24 | `structuredClone({a:1})` works; cloning a function throws `DOMException` ✅[^1] |
| 4 | Conclusion | Safe in modern browsers and Node, but it is a host feature, not a language guarantee |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Code uses `alert` in Node | `ReferenceError` | `alert` is a browser host API |
| Feature works in Chrome, fails in an older Safari | Missing in that engine | Engines ship features at different times; check support tables ✅[^4] |
| Forum answer contradicts MDN | Trust the spec, then MDN | The spec is normative ✅[^3] |
| Same code, different timer behaviour in browser and Node | Hosts implement timers differently | Timers are host APIs (see `javascript/advanced-functions/function-objects-and-calls.md`) |

## Takeaways
- When behaviour is surprising, first ask whether the language (spec) or the host (browser, Node) defines it.
- Check MDN and a support table before using a new feature in code that must run in several engines.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab (`node:24.22.1-alpine`) where every behaviour marked with this note ran on 2026-11-04. [^1]
- [An Introduction to JavaScript](https://javascript.info/intro) — javascript.info, living. Backs: engine codenames, run pipeline, browser limits, compile-to-JS languages. [^2]
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: ECMA-262 defines the language; host APIs are outside it. [^3]
- [Manuals and specifications](https://javascript.info/manuals-specifications) — javascript.info, living. Backs: yearly editions, MDN, caniuse and compat tables. [^4]
- [JavaScript reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) — MDN, living. Backs: MDN as the practical manual. [^5]
- [Developer console](https://javascript.info/devtools) — javascript.info, living. Backs: DevTools shortcuts and multi-line input. [^6]
- [Introduction to Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) — Node.js project, living. Backs: Node.js runs the V8 engine outside the browser. [^7]
- [Code editors](https://javascript.info/code-editors) — javascript.info, living. Backs: IDE versus lightweight editor. [^8]
- [structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) — MDN, living. Backs: `structuredClone` is a Web API. [^9]

## Related
- `javascript/learning-path.md`
- `js-runtime/v8-hidden-classes.md` — how V8 optimizes objects.
