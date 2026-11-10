---
schema: topic-index/v1
kind: subtopic
topic: javascript/browser
last-updated: 2026-11-10
---

# The browser platform

JavaScript in the browser, covering all 64 lessons of javascript.info Parts 2–8: the DOM and node classes, element geometry and coordinates, events (handlers, mouse, pointer, keyboard, scroll), forms, focus and text selection, resource loading, popups, frames and clickjacking, binary data and files, network requests (`fetch` and its options, progress, abort, XMLHttpRequest, resumable upload, WebSocket, Server-Sent Events), storage (web storage, cookies, IndexedDB), animation and web components. Built from the tutorial (private mirror, cited at public URLs), the WHATWG and W3C standards and MDN, and verified in Chrome 152 (`browser-lab-setup.md`). Start with `lesson-map.md`. Not covered: frameworks, service workers and the Cache API, WebRTC, canvas and WebGL.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [lesson-map.md](lesson-map.md) | reference | All 64 javascript.info Parts 2–8 lessons mapped to their doc, with a reading order | verified |
| [browser-platform-deep-dive.md](browser-platform-deep-dive.md) | deep-dive | Nodes and live collections, attributes vs properties, event path and delegation, synthetic events, click microtask timing, loading order, MutationObserver, fetch/CORS, storage and cookies — verified in Chrome 152 | verified |
| [dom-node-classes-and-content.md](dom-node-classes-and-content.md) | concept | Node types and the class chain, `nodeName`/`tagName`, `innerHTML`, `outerHTML`, `textContent`, `data`, `hidden` | verified |
| [element-geometry-and-scrolling.md](element-geometry-and-scrolling.md) | concept | `offset*`, `client*`, `scroll*`, window and document size, `scrollTo`/`scrollIntoView`, window vs document coordinates, `elementFromPoint` | verified |
| [ui-events-mouse-pointer-keyboard.md](ui-events-mouse-pointer-keyboard.md) | concept | Handler forms, mouse event order, over/out vs enter/leave, drag-and-drop, pointer events and capture, `code` vs `key`, scroll | verified |
| [forms-focus-and-selection.md](forms-focus-and-selection.md) | concept | `form.elements`, select/option, focus and `focusin`, `input` vs `change`, clipboard, submit vs `requestSubmit`, Range and Selection | verified |
| [resource-loading-windows-and-frames.md](resource-loading-windows-and-frames.md) | concept | `load`/`error` on resources, "Script error.", popups, same-origin access, `postMessage`, `sandbox`, clickjacking defences | verified |
| [binary-data-blobs-and-files.md](binary-data-blobs-and-files.md) | concept | `ArrayBuffer`, typed arrays, `DataView` endianness, `TextEncoder`/`TextDecoder`, Blob and object URLs, File, FileReader | verified |
| [network-requests-in-depth.md](network-requests-in-depth.md) | concept | FormData, download progress, abort, fetch options, XMLHttpRequest, upload progress, resumable upload, WebSocket, Server-Sent Events | verified |
| [indexeddb.md](indexeddb.md) | concept | Versions and `upgradeneeded`, object stores, transactions and autocommit, errors, key ranges, indexes, cursors | verified |
| [css-and-javascript-animation.md](css-and-javascript-animation.md) | concept | Bezier curves, `cubic-bezier`/`steps`, transitions and keyframes with events, `requestAnimationFrame`, timing functions, Web Animations | verified |
| [web-components.md](web-components.md) | concept | Custom elements and lifecycle, shadow DOM, templates, slots, `:host`/`::slotted`/custom properties, event retargeting | verified |
| [browser-lab-setup.md](browser-lab-setup.md) | how-to | One Node 24 file that serves a test page, a second origin (127.0.0.1), slow, large, echo, redirect, framing-blocked, resumable-upload, SSE and WebSocket endpoints | verified |

## References
- [The Modern JavaScript Tutorial](https://javascript.info/) — javascript.info, living. Backs: subtopic scope (Parts 2–8).
- [HTML Standard](https://html.spec.whatwg.org/) — WHATWG, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
