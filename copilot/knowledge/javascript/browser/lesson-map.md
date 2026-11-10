---
schema: knowledge-doc/v1
type: reference
topic: javascript/browser
status: verified
applies-to: ["javascript.info Parts 2–8 at repository commit 20208769e5 (2026-07-25)", "the docs under knowledge/javascript/ as of 2026-11-10"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, javascript-info, curriculum, lesson-map, learning-path]
---

# javascript.info Parts 2–8 lesson-to-doc map

## Summary
**TL;DR:** All 64 lessons of javascript.info Parts 2–8 (Browser: Document, Events, Interfaces; Frames and windows; Binary data, files; Network requests; Storing data in the browser; Animation; Web components) mapped to the knowledge doc that covers each, in the tutorial's order, with a suggested reading order for the browser docs.
**Use this when:** you follow javascript.info and want the matching verified doc, or need to know whether a browser topic is already covered here.
**Not this doc:** Part 1 (the language) → `javascript/learning-path.md`; Part 9 (regular expressions) → `javascript/regular-expressions/`.

## Scope
The 64 `article.md` lessons under `2-ui` … `8-web-components` of the tutorial's source repository at commit `20208769e5` ✅[^1], each linked at its public URL `https://javascript.info/<slug>`. Docs are in `javascript/browser/` unless a path says otherwise.

## Catalog

### Reading order
| # | Doc | Covers |
|---|---|---|
| 1 | `browser-platform-deep-dive.md` | DOM tree navigation, attributes, event path, loading order, `fetch`, CORS, storage |
| 2 | `dom-node-classes-and-content.md` | Node types and classes, content properties |
| 3 | `element-geometry-and-scrolling.md` | Sizes, scrolling, coordinates |
| 4 | `ui-events-mouse-pointer-keyboard.md` | Handlers, mouse, pointer, keyboard, scroll |
| 5 | `forms-focus-and-selection.md` | Forms, focus, input events, submit, Range/Selection |
| 6 | `resource-loading-windows-and-frames.md` | `onload`/`onerror`, popups, frames, clickjacking |
| 7 | `binary-data-blobs-and-files.md` | Buffers, encodings, Blob, File |
| 8 | `network-requests-in-depth.md` | FormData, progress, abort, options, XHR, resume, WebSocket, SSE |
| 9 | `indexeddb.md` | IndexedDB |
| 10 | `css-and-javascript-animation.md` | Bezier curves, CSS and JS animation |
| 11 | `web-components.md` | Custom elements, shadow DOM, templates, slots |
| — | `browser-lab-setup.md` | How every lab result was produced |

### Part 2 — Browser: Document, Events, Interfaces (32 lessons)
| Chapter | Lesson | Doc |
|---|---|---|
| Document | [browser-environment](https://javascript.info/browser-environment), [dom-navigation](https://javascript.info/dom-navigation), [searching-elements-dom](https://javascript.info/searching-elements-dom), [dom-attributes-and-properties](https://javascript.info/dom-attributes-and-properties), [modifying-document](https://javascript.info/modifying-document), [styles-and-classes](https://javascript.info/styles-and-classes) | `browser-platform-deep-dive.md` |
| Document | [dom-nodes](https://javascript.info/dom-nodes), [basic-dom-node-properties](https://javascript.info/basic-dom-node-properties) | `dom-node-classes-and-content.md` |
| Document | [size-and-scroll](https://javascript.info/size-and-scroll), [size-and-scroll-window](https://javascript.info/size-and-scroll-window), [coordinates](https://javascript.info/coordinates) | `element-geometry-and-scrolling.md` |
| Introduction to Events | [introduction-browser-events](https://javascript.info/introduction-browser-events) | `ui-events-mouse-pointer-keyboard.md` |
| Introduction to Events | [bubbling-and-capturing](https://javascript.info/bubbling-and-capturing), [event-delegation](https://javascript.info/event-delegation), [default-browser-action](https://javascript.info/default-browser-action), [dispatch-events](https://javascript.info/dispatch-events) | `browser-platform-deep-dive.md` |
| UI Events | [mouse-events-basics](https://javascript.info/mouse-events-basics), [mousemove-mouseover-mouseout-mouseenter-mouseleave](https://javascript.info/mousemove-mouseover-mouseout-mouseenter-mouseleave), [mouse-drag-and-drop](https://javascript.info/mouse-drag-and-drop), [pointer-events](https://javascript.info/pointer-events), [keyboard-events](https://javascript.info/keyboard-events), [onscroll](https://javascript.info/onscroll) | `ui-events-mouse-pointer-keyboard.md` |
| Forms, controls | [form-elements](https://javascript.info/form-elements), [focus-blur](https://javascript.info/focus-blur), [events-change-input](https://javascript.info/events-change-input), [forms-submit](https://javascript.info/forms-submit) | `forms-focus-and-selection.md` |
| Document and resource loading | [onload-ondomcontentloaded](https://javascript.info/onload-ondomcontentloaded), [script-async-defer](https://javascript.info/script-async-defer) | `browser-platform-deep-dive.md` |
| Document and resource loading | [onload-onerror](https://javascript.info/onload-onerror) | `resource-loading-windows-and-frames.md` |
| Miscellaneous | [mutation-observer](https://javascript.info/mutation-observer) | `browser-platform-deep-dive.md` |
| Miscellaneous | [selection-range](https://javascript.info/selection-range) | `forms-focus-and-selection.md` |
| Miscellaneous | [event-loop](https://javascript.info/event-loop) | `javascript/async/event-loop-and-async-await.md` |

### Parts 3–8 (32 lessons)
| Part | Lesson | Doc |
|---|---|---|
| 3 Frames and windows | [popup-windows](https://javascript.info/popup-windows), [cross-window-communication](https://javascript.info/cross-window-communication), [clickjacking](https://javascript.info/clickjacking) | `resource-loading-windows-and-frames.md` |
| 4 Binary data, files | [arraybuffer-binary-arrays](https://javascript.info/arraybuffer-binary-arrays), [text-decoder](https://javascript.info/text-decoder), [blob](https://javascript.info/blob), [file](https://javascript.info/file) | `binary-data-blobs-and-files.md` |
| 5 Network requests | [fetch](https://javascript.info/fetch), [fetch-crossorigin](https://javascript.info/fetch-crossorigin), [url](https://javascript.info/url), [long-polling](https://javascript.info/long-polling) | `browser-platform-deep-dive.md` |
| 5 Network requests | [formdata](https://javascript.info/formdata), [fetch-progress](https://javascript.info/fetch-progress), [fetch-abort](https://javascript.info/fetch-abort), [fetch-api](https://javascript.info/fetch-api), [xmlhttprequest](https://javascript.info/xmlhttprequest), [resume-upload](https://javascript.info/resume-upload), [websocket](https://javascript.info/websocket), [server-sent-events](https://javascript.info/server-sent-events) | `network-requests-in-depth.md` |
| 6 Storing data | [cookie](https://javascript.info/cookie), [localstorage](https://javascript.info/localstorage) | `browser-platform-deep-dive.md` |
| 6 Storing data | [indexeddb](https://javascript.info/indexeddb) | `indexeddb.md` |
| 7 Animation | [bezier-curve](https://javascript.info/bezier-curve), [css-animations](https://javascript.info/css-animations), [js-animation](https://javascript.info/js-animation) | `css-and-javascript-animation.md` |
| 8 Web components | [webcomponents-intro](https://javascript.info/webcomponents-intro), [custom-elements](https://javascript.info/custom-elements), [shadow-dom](https://javascript.info/shadow-dom), [template-element](https://javascript.info/template-element), [slots-composition](https://javascript.info/slots-composition), [shadow-dom-style](https://javascript.info/shadow-dom-style), [shadow-dom-events](https://javascript.info/shadow-dom-events) | `web-components.md` |

## Lookup notes
- Lesson slugs are the source folder names without their number prefix (`2-ui/1-document/09-size-and-scroll` → `size-and-scroll`) ✅[^1].
- Lessons the tutorial numbers but omits (for example Part 3's 02, 04, 05) do not exist at this commit; the count of 64 is of `article.md` files ✅[^1].
- `browser-platform-deep-dive.md` is a `deep-dive/v1` doc; its topics are not yet synthesized into typed docs (tracker item T-30).

## Takeaways
- Look up a javascript.info browser lesson here first; every lesson in Parts 2–8 has a doc.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- [javascript-tutorial/en.javascript.info](https://github.com/javascript-tutorial/en.javascript.info) — Ilya Kantor and contributors, commit `20208769e5` (2026-07-25). Backs: the list of 64 lessons and their slugs, counted from the `article.md` files on 2026-11-10. [^1]
- [The Modern JavaScript Tutorial](https://javascript.info/) — javascript.info, living. Background: part and chapter names.

## Related
- `javascript/learning-path.md` — the same map for Part 1.
- `javascript/browser/index.md`
