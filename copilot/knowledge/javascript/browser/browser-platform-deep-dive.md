---
schema: deep-dive/v1
topic: javascript/browser
status: verified
applies-to: ["WHATWG DOM and HTML living standards", "Fetch standard", "Chrome 152 for every lab result"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, browser, dom, events, bubbling, capturing, event-delegation, attributes-properties, script-loading, mutation-observer, fetch, cors, url, localstorage, cookies, microtasks]
---

# The browser platform for JavaScript: DOM, events, loading, network and storage

## Summary
**TL;DR:** In a browser, JavaScript drives a **document tree (DOM)** through host APIs defined by the WHATWG DOM and HTML standards, not by ECMAScript. Five mental models carry most of the work: the DOM is a tree of *nodes*, including whitespace text, and some collections are live; HTML **attributes** are the initial markup while DOM **properties** are the current state; events travel **capture → target → bubble**, which makes delegation possible; scripts and page events load in a defined order (`defer` scripts run before `DOMContentLoaded`); and `fetch` resolves on any HTTP response — a 404 is not an error until you check `response.ok`. Storage APIs store strings only, and cookies are a single string.
**Use this when:** writing or debugging front-end JavaScript without a framework, or understanding what a framework does underneath; or reading DOM-scripting, jQuery-era or "rich internet application" books and wanting a verified, current companion.
**Depth:** nodes and navigation; searching and live versus static collections; attributes versus properties (`value`, `checked`, `data-*`); safe content insertion; classes and styles; the event path, `stopPropagation`, delegation, default actions, synthetic events (`bubbles`, `cancelable`, `isTrusted`), listener options (`once`, `signal`); microtask timing for real versus programmatic clicks; script loading order; `MutationObserver` batching; `fetch` semantics, body reuse, abort, network errors, CORS; `URL`/`URLSearchParams`; `FormData`; `localStorage`, `sessionStorage`, cookies; text encoding; a failure matrix. Every ✅[^2] row was run in Chrome 152 on a local page.

## 1. The DOM tree

| Fact | Lab |
|---|---|
| Whitespace between tags is a **text node**: a `div` with `<p>` and `<ul>` on separate lines has 3 `childNodes` (`P`, `#text`, `UL`) but 2 `children` | ✅[^2] ✅[^3] |
| `getElementsByTagName` returns a **live** collection (3 after appending an `li`); `querySelectorAll` returns a **static** snapshot (still 2) | ✅[^2] ✅[^4] |
| `el.closest(selector)` walks up to the nearest matching ancestor; `el.matches(selector)` tests one element | ✅[^4] |

Navigation pairs: `parentNode`/`parentElement`, `childNodes`/`children`, `firstChild`/`firstElementChild`, `nextSibling`/`nextElementSibling` — the `Element` versions skip text and comment nodes ✅[^3].

## 2. Attributes versus properties

| Element | Attribute (markup) | Property (live state) | Lab |
|---|---|---|---|
| `<input value="initial">` after typing | `getAttribute('value')` → `"initial"` | `.value` → `"typed"`; `.defaultValue` → `"initial"` | ✅[^2] |
| `<input type=checkbox checked>` after unchecking | `hasAttribute('checked')` → `true` | `.checked` → `false` | ✅[^2] |
| `data-user-id="7"` | — | `.dataset.userId` → `"7"` (camelCase) | ✅[^2] |
| Non-standard `foo="bar"` | `getAttribute('foo')` → `"bar"` | `.foo` → `undefined` (no property is created) | ✅[^2] |

✅[^5]. Rule: read and write **properties** for current state, **attributes** for markup; use `data-*` for custom data.

## 3. Changing the document safely

- `textContent = '<b>x</b>'` inserts text: `innerHTML` then reads `&lt;b&gt;x&lt;/b&gt;` and no element is created ✅[^2].
- `innerHTML` parses HTML. A `<script>` inserted that way does not run (lab: the global stayed unset), but event-handler attributes in inserted HTML do, so **never** put untrusted text into `innerHTML` ✅[^2] ✅[^6].
- Prefer `createElement` + `textContent` + `append`/`prepend`/`before`/`after`/`replaceWith` ✅[^6].
- `classList.add/remove/toggle` manage classes (`add('a','b')` then `toggle('a')` → `"b"`); `el.style` reflects only **inline** styles (`style.display` is `""`) while `getComputedStyle(el).display` gives the applied value (`"block"`) ✅[^2] ✅[^7].

## 4. Events

### 4.1 The path: capture, target, bubble

A click on `<b>` inside `<p>` inside `div#outer` ran listeners in this order: `outer-capture`, `para-capture`, `target`, `para-bubble`, `outer-bubble`, `body-bubble` ✅[^2] ✅[^8]. `stopPropagation()` in the `<p>` bubble listener stopped `outer-bubble` and `body-bubble` but not the other listeners already on `<p>` (`stopImmediatePropagation` would) ✅[^2] ✅[^8].

### 4.2 Delegation

One listener on a container handles events from all current and future children: `list` used `e.target.closest('.item')` and handled a click on an item added *after* the listener was attached (`"c"`) ✅[^2] ✅[^9]. Check `container.contains(item)` so nested lists do not leak matches.

### 4.3 Default actions and synthetic events

| Fact | Lab |
|---|---|
| `preventDefault()` in a `submit` listener stops navigation (`defaultPrevented` true; still on `/lab.html`) | ✅[^2] ✅[^10] |
| `new Event('x')` is **not cancelable** by default: `preventDefault()` leaves `defaultPrevented` false | ✅[^2] |
| `new Event('ping')` does **not bubble** unless `{bubbles: true}`: only the bubbling one reached `#outer` | ✅[^2] ✅[^11] |
| `dispatchEvent` is **synchronous** (`before, handler, after`), and script-created events have `isTrusted === false` | ✅[^2] ✅[^11] |
| Listener options: `{once: true}` runs once; `{signal}` removes the listener when the `AbortController` aborts (each ran exactly once) | ✅[^2] ✅[^12] |

### 4.4 Microtasks and clicks — a subtle difference

| Click source | Order with listener 1 queuing a promise reaction | Lab |
|---|---|---|
| Real user click (browser automation clicking the element) | `h1, micro1, h2` — microtasks run **between** listeners | ✅[^2] |
| `element.click()` from script | `h1, h2, after click()` — the microtask waits until the calling script finishes | ✅[^2] |

Reason: the HTML standard runs a microtask checkpoint after each callback only when the JavaScript stack is empty; `.click()` keeps the calling script on the stack ✅[^13]. Tests that use `.click()` can therefore pass where real clicks behave differently.

## 5. Page and script loading

Observed order for a head inline script, a body inline script and a `defer` script ✅[^2]:

| # | Event |
|---|---|
| 1 | head inline script |
| 2 | body inline script |
| 3 | `defer` script (runs after parsing, in document order) |
| 4 | `DOMContentLoaded` |
| 5 | `load` (after images, styles and other resources) |

`async` scripts run as soon as they download, in any order, independent of `DOMContentLoaded`; module scripts are deferred by default ✅[^14] ✅[^15].

**`MutationObserver`** callbacks are batched as a microtask: after one attribute change and two appends, the callback had not run synchronously (0 calls) and then ran once with 3 records ✅[^2] ✅[^16].

## 6. Network: `fetch`

| Fact | Lab |
|---|---|
| A **404 resolves**: `ok` false, `status` 404 — `fetch` rejects only on network failure | ✅[^2] ✅[^17] |
| `response.json()` parses the body; `content-type` was `application/json` | ✅[^2] |
| A body can be read **once**: a second `json()` threw `TypeError` (use `response.clone()` to read twice) | ✅[^2] ✅[^18] |
| Abort via `AbortController` rejects with `AbortError` | ✅[^2] |
| Connection refused and DNS failure both reject with `TypeError` (`Failed to fetch`) | ✅[^2] |
| `FormData(form)` collects named controls (`name` → `"typed"`) | ✅[^2] |

**CORS:** a page may read a cross-origin response only if the server allows it with `Access-Control-Allow-Origin`; "non-simple" requests (custom headers, methods other than GET/POST/HEAD, JSON content type) first send a preflight `OPTIONS` request; cookies cross origins only with `credentials: 'include'` plus `Access-Control-Allow-Credentials` ✅[^19] ✅[^20]. CORS is enforced by the browser, not the server; server-to-server calls are unaffected.

**`URL` / `URLSearchParams`** encode for you: a space in the path becomes `%20`, repeated keys are kept (`getAll('q')` → `["1","2"]`), and `append('name','Ann & Bob')` produced `name=Ann+%26+Bob` ✅[^2] ✅[^21].

Long polling, Server-Sent Events and WebSockets are compared in `javascript/node/node-services-deep-dive.md` ✅[^22].

## 7. Storage and encoding

| API | Fact | Lab |
|---|---|---|
| `localStorage` | Stores **strings only**: an object became `"[object Object]"`, a number came back as a string; a missing key returns `null`; property assignment also stores | ✅[^2] ✅[^23] |
| `sessionStorage` | Same API, per tab and origin: a value set there was not in `localStorage` | ✅[^2] ✅[^23] |
| `storage` event | Fires in **other** documents of the same origin, not in the one that changed the value | ✅[^24] |
| Cookies | `document.cookie = 'k=v; path=/; max-age=3600'` sets one cookie; reading returns only `name=value` pairs joined by `; ` (attributes like `max-age` are not returned) | ✅[^2] ✅[^25] |
| `TextEncoder` / `Blob` | `"é"` is 2 UTF-8 bytes; `new Blob(['héllo']).size` is 6 | ✅[^2] |

Store JSON with `JSON.stringify`/`JSON.parse`; keep secrets out of web storage (any script on the page can read it) and use `HttpOnly`, `Secure`, `SameSite` cookies for sessions ✅[^25].

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `childNodes[0]` is not the first element | Whitespace text node | `children` / `firstElementChild` |
| Loop over a collection never ends or skips items | Live `HTMLCollection` changing while you modify the DOM | `querySelectorAll` snapshot or `Array.from` |
| Reading `getAttribute('value')` gives stale input | Attribute is the initial value | Read `.value` |
| Injected markup runs attacker code | Untrusted text in `innerHTML` | `textContent`, or sanitize |
| Listener on a parent never fires for a custom event | `new Event` does not bubble by default | `{bubbles: true}` |
| `preventDefault()` has no effect on a custom event | Not cancelable by default | `{cancelable: true}` |
| Handlers for new list items do not work | Listeners bound to old elements | Event delegation |
| Tests pass with `.click()` but real clicks differ | Microtask timing (§4.4) | Test with real input simulation |
| 404 treated as success | `fetch` resolves on HTTP errors | Check `response.ok` |
| "body stream already read" | Body consumed twice | `response.clone()` |
| Cross-origin request blocked | Missing CORS headers on the server | Configure `Access-Control-Allow-*`, or proxy through your server |
| Stored object comes back as `"[object Object]"` | Web storage holds strings | `JSON.stringify`/`parse` |

## 9. How this deep dive was built
- **Sources:** javascript.info Part 2 (Document, Events, UI events, Forms, Document and resource loading, Mutation observer) and Part 3 (Network requests, Storing data, Binary data), read from the private mirror and cited at their public URLs; the WHATWG DOM, HTML and Fetch standards; MDN; Jake Archibald's article on tasks and microtasks. It covers the subjects of the DOM-scripting, Ajax, jQuery-era and RIA books from these open sources only.
- **Verified:** Chrome 152 (the desktop app's built-in browser) on a page served from `localhost`, 2026-11-04 (lab files `browser/lab.html`, `browser/deferred.js`, `browser/data.json`, checks run with the page's JavaScript console and one real click).

## References
- [Browser environment, specs](https://javascript.info/browser-environment) — javascript.info, living. Background: DOM, BOM and the specifications behind them. [^1]
- `linux/lab-setup.md` — the lab used across the knowledge base; this dive's browser results came from Chrome 152 on a local page, 2026-11-04 (see §9). [^2]
- [Walking the DOM](https://javascript.info/dom-navigation) — javascript.info, living. Backs: text nodes, `childNodes` vs `children`, navigation pairs. [^3]
- [Searching: getElement*, querySelector*](https://javascript.info/searching-elements-dom) — javascript.info, living. Backs: live vs static collections, `closest`, `matches`. [^4]
- [Attributes and properties](https://javascript.info/dom-attributes-and-properties) — javascript.info, living. Backs: attribute/property sync, `value`, `checked`, `dataset`, non-standard attributes. [^5]
- [Modifying the document](https://javascript.info/modifying-document) — javascript.info, living. Backs: insertion methods, `innerHTML` vs `textContent`. [^6]
- [Styles and classes](https://javascript.info/styles-and-classes) — javascript.info, living. Backs: `classList`, inline `style`, `getComputedStyle`. [^7]
- [Bubbling and capturing](https://javascript.info/bubbling-and-capturing) — javascript.info, living. Backs: event phases, `stopPropagation`. [^8]
- [Event delegation](https://javascript.info/event-delegation) — javascript.info, living. Backs: delegation with `closest` and `contains`. [^9]
- [Browser default actions](https://javascript.info/default-browser-action) — javascript.info, living. Backs: `preventDefault`, `defaultPrevented`. [^10]
- [Dispatching custom events](https://javascript.info/dispatch-events) — javascript.info, living. Backs: `bubbles`, `cancelable`, synchronous dispatch, `isTrusted`. [^11]
- [EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) — MDN, living. Backs: `once`, `signal`, `passive` options. [^12]
- [Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) — Jake Archibald, 2015. Backs: microtask checkpoint after callbacks only with an empty stack; `.click()` keeps the caller on the stack. [^13]
- [Page: DOMContentLoaded, load, beforeunload, unload](https://javascript.info/onload-ondomcontentloaded) — javascript.info, living. Backs: loading events and their order. [^14]
- [Scripts: async, defer](https://javascript.info/script-async-defer) — javascript.info, living. Backs: `defer` order before `DOMContentLoaded`, `async` independence, modules deferred. [^15]
- [Mutation observer](https://javascript.info/mutation-observer) — javascript.info, living. Backs: batched, asynchronous mutation records. [^16]
- [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — MDN, living. Backs: fetch does not reject on 404; check status. [^17]
- [Fetch](https://javascript.info/fetch) — javascript.info, living. Backs: response methods; a body can be read only once. [^18]
- [Fetch: Cross-Origin Requests](https://javascript.info/fetch-crossorigin) — javascript.info, living. Backs: CORS, safe vs unsafe requests, preflight, credentials. [^19]
- [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) — MDN, living. Backs: CORS headers and preflight. [^20]
- [URL objects](https://javascript.info/url) — javascript.info, living. Backs: `URL`, `searchParams`, automatic encoding. [^21]
- [Long polling](https://javascript.info/long-polling) — javascript.info, living. Backs: long polling in the browser. [^22]
- [LocalStorage, sessionStorage](https://javascript.info/localstorage) — javascript.info, living. Backs: string-only storage, per-tab session storage. [^23]
- [HTML Standard: Web storage](https://html.spec.whatwg.org/multipage/webstorage.html) — WHATWG, living. Backs: `storage` event dispatched to other documents. [^24]
- [Cookies, document.cookie](https://javascript.info/cookie) — javascript.info, living. Backs: cookie string format, attributes, `HttpOnly`, `SameSite`. [^25]
- [DOM Standard](https://dom.spec.whatwg.org/) — WHATWG, living. Background: nodes, events and dispatch.

## Related
- `javascript/async/event-loop-and-async-await.md` — tasks and microtasks.
- `javascript/node/node-services-deep-dive.md` — the server side of long polling and timeouts.
- `javascript/misc/design-patterns-deep-dive.md` — observer and delegation patterns.
