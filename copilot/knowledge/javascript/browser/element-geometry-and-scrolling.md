---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["CSSOM View Module (W3C draft)", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, geometry, offsetwidth, clientwidth, scrollheight, scrolltop, getboundingclientrect, elementfrompoint, scrollintoview, coordinates, window-size]
---

# Element geometry, window size, scrolling and coordinates

## Summary
**TL;DR:** The browser exposes the box of an element as read-only numbers: `offset*` (outer box with borders), `client*` (inside the borders, padding included, scrollbar excluded) and `scroll*` (the full content, including the part scrolled away); only `scrollTop`/`scrollLeft` are writable. Coordinates come in two systems: **window-relative** (`clientX`, `getBoundingClientRect()`, like `position: fixed`) and **document-relative** (`pageX`, rect + `scrollY`, like `position: absolute`). Read sizes from these properties, not from CSS `width`, which ignores padding and borders and can be `auto`.
**Use this when:** positioning tooltips or dropdowns, measuring content, detecting the scroll end, scrolling to an element, or converting between mouse and document coordinates.
**Not this doc:** inline and computed styles, `classList` → `browser-platform-deep-dive.md` §3; scroll *events* → `ui-events-mouse-pointer-keyboard.md`.

## Problem
A dropdown placed with `getComputedStyle(el).width` lands in the wrong place (the value excludes padding and borders, or is `auto`), a tooltip drifts when the page scrolls (mixing window and document coordinates), and code that reads sizes of a `display: none` element gets zeros.

## Mental model
**Analogy:** a framed picture. `offsetWidth` is the frame's outer edge; `clientWidth` is the glass inside the frame; `scrollHeight` is the whole picture, most of it rolled up behind the frame; `scrollTop` is how far it is rolled. Window coordinates measure from the corner of your screen; document coordinates measure from the top of the whole rolled-out picture.

**Artifact (lab, a 300×200 box with 25 px border, 20 px padding, `overflow: auto`, 600 px content ✅[^1]):**
```
offsetWidth  390 = 300 + 2·20 + 2·25      clientTop/Left  25 (border)
offsetHeight 290 = 200 + 2·20 + 2·25      clientWidth   340 = 300 + 2·20 (scrollbar 0: overlay scrollbars)
scrollHeight 640 = 600 + 2·20             scrollTop max 400 = scrollHeight − clientHeight
```

## How it works
1. **`offsetParent`, `offsetLeft/Top`.** Position relative to the nearest positioned ancestor, table cell or `body` (`BODY`, 8, 8 in the lab) ✅[^1] ✅[^2].
2. **`offsetWidth/Height`** is the full outer size including borders ✅[^1] ✅[^2].
3. **`clientTop/Left`** is the border width (plus a left scrollbar in right-to-left layouts); **`clientWidth/Height`** is the content plus padding without the scrollbar ✅[^1] ✅[^2]. With classic scrollbars the scrollbar width is `offsetWidth − 2·clientLeft − clientWidth` (16 px in javascript.info's example); with macOS overlay scrollbars it was 0 ✅[^1] ✅[^2].
4. **`scrollWidth/Height`** includes content scrolled out of view; **`scrollTop/Left`** are writable and clamp to the maximum (`scrollTop = 1e9` gave 400) ✅[^1] ✅[^2].
5. **Window.** `innerWidth` includes the scrollbar; `document.documentElement.clientWidth` excludes it ✅[^3]. The full document height needs the maximum of six values (`scrollHeight`, `offsetHeight`, `clientHeight` of `body` and `documentElement`) ✅[^1] ✅[^3]. The current scroll is `scrollX/scrollY` (`pageXOffset` is an alias; both 500 after `scrollTo(0, 500)`) ✅[^1] ✅[^3].
6. **Scrolling.** `scrollTo(x, y)` scrolls to absolute coordinates, `scrollBy(dx, dy)` relative (500 → 510), `el.scrollIntoView()` aligns the element's top with the window top, and `scrollIntoView(false)` its bottom, clamped by the document's limits ✅[^1] ✅[^3]. `overflow: hidden` on `<html>` stops the user from scrolling but script can still call `scrollTo` (scrolled to 200) ✅[^1].
7. **Coordinates.** `getBoundingClientRect()` returns window-relative `x/y/top/left/right/bottom/width/height`, fractional and possibly negative; document coordinates are `rect.top + scrollY` (492.5 + 100 = 592.5) ✅[^1] ✅[^4]. `document.elementFromPoint(x, y)` returns the topmost element at window coordinates, or `null` outside the visible window ✅[^1] ✅[^4].

## Worked example
Placing a note 5 px under an element so that it stays put while the page scrolls:

| Step | Code | Value (lab ✅[^1]) |
|---|---|---|
| 1 | `scrollTo(0, 100)` | `scrollY` 100 |
| 2 | `r = para.getBoundingClientRect()` | `r.top` 492.5, `r.left` 8, `r.height` 16 |
| 3 | Document top: `r.bottom + scrollY + 5` | 508.5 + 100 + 5 = 613.5 |
| 4 | `note.style.position = 'absolute'; note.style.top = '613.5px'; note.style.left = r.left + scrollX + 'px'` | Note stays with the element on scroll (document coordinates) |
| 5 | With `position: fixed` you would use `r.bottom + 5` and must recompute on every scroll | Window coordinates move with the viewport ✅[^4] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Element or ancestor has `display: none` | `offsetWidth` 0, `offsetParent` `null`, rect width 0 | It has no box ✅[^1] ✅[^2] |
| `getComputedStyle(span).width` on an inline element | `"auto"` | Inline boxes have no CSS width; use `offsetWidth` ✅[^1] ✅[^2] |
| `transform: scale(2)` | `offsetWidth` stays 100, rect width 200 | `offset*` ignores transforms; the rect reflects them ✅[^1] |
| Element left of or above the viewport | Rect values negative (−50, −20) | Window coordinates can be negative ✅[^1] ✅[^4] |
| `elementFromPoint` below the visible area | `null` | Only window coordinates inside the viewport hit ✅[^1] ✅[^4] |
| Window not visible (hidden tab or pane) | `innerWidth` 0 in the lab | Measure only when rendered ✅[^1] |

## Takeaways
- Measure boxes with `offset*`, `client*`, `scroll*` or `getBoundingClientRect()`, never with CSS `width`. [rule-candidate]
- Convert explicitly: document = window + `scrollX/scrollY`; pick the system that matches the CSS `position` you set.
- "Scrolled to the bottom" is `scrollTop + clientHeight >= scrollHeight - 1` (fractional pixels).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 35 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab where every result marked with this note ran on 2026-11-10, viewport emulated at 1000×800. [^1]
- [Element size and scrolling](https://javascript.info/size-and-scroll) — javascript.info, living. Backs: `offset*`, `client*`, `scroll*`, CSS width pitfalls, hidden elements. [^2]
- [Window sizes and scrolling](https://javascript.info/size-and-scroll-window) — javascript.info, living. Backs: window and document size, `scrollX/Y`, `scrollTo`, `scrollBy`, `scrollIntoView`, forbidding scroll. [^3]
- [Coordinates](https://javascript.info/coordinates) — javascript.info, living. Backs: window vs document coordinates, `getBoundingClientRect`, `elementFromPoint`. [^4]
- [CSSOM View Module](https://drafts.csswg.org/cssom-view/) — W3C CSS Working Group, living draft. Background: definitions of every property above.
- [Element: getBoundingClientRect() method](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) — MDN, living. Background: rect fields and transforms.

## Related
- `javascript/browser/ui-events-mouse-pointer-keyboard.md` — `clientX/pageX` on mouse events, drag-and-drop positioning, scroll events.
- `javascript/browser/dom-node-classes-and-content.md`
