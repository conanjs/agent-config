---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["UI Events and Pointer Events (W3C)", "HTML living standard", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, events, event-handlers, handleevent, mouse-events, mouseover, mouseenter, relatedtarget, drag-and-drop, pointer-events, pointer-capture, touch-action, keyboard, event-code, event-key, scroll]
---

# UI events: handlers, mouse, pointer, keyboard and scroll

## Summary
**TL;DR:** Attach handlers with `addEventListener` (several per event, options, `handleEvent` objects); the `on<event>` property holds only one. One physical click produces a fixed chain: `pointerdown → mousedown → pointerup → mouseup → click`, with `pointerover/enter` and `mouseover/enter` first. `mouseover/out` bubble and fire again when the pointer moves onto a **child**; `mouseenter/leave` do not bubble and ignore children. **Pointer events** unify mouse, pen and touch, and `setPointerCapture` keeps a drag's events on one element even outside it. On the keyboard, `event.code` is the physical key and `event.key` the character it produced. `scroll` fires after scrolling, asynchronously, and cannot be cancelled.
**Use this when:** writing drag-and-drop, hover menus, keyboard shortcuts, touch-friendly controls, or infinite scroll, or debugging a handler that fires too often or never.
**Not this doc:** event phases, delegation, default actions and synthetic events → `browser-platform-deep-dive.md` §4; form and focus events → `forms-focus-and-selection.md`.

## Problem
Hover menus flicker because `mouseout` fires when the pointer enters a child, drag code loses the element when the mouse moves fast, touch scrolling cancels a drag, a shortcut on `Z` breaks on a German keyboard, and a scroll handler tries to `preventDefault()` scrolling that has already happened.

## Mental model
**Analogy:** each physical action is a short play with a fixed script. A click is: the pointer walks on stage (`over`, `enter`), presses (`down`), releases (`up`), and the narrator announces "click". Pointer capture is a spotlight operator who keeps the light on the actor even after they walk off the stage.

**Artifact (one real left click on `#outer`, lab ✅[^1]):**
```
pointerover  pointerenter  mouseover  mouseenter
pointerdown (buttons=1)  mousedown (detail=1)
pointerup   mouseup   click (detail=1, pointerType "mouse")
```

## How it works
1. **Three ways to attach.**
   - HTML attribute `onclick="..."`: the browser wraps the text in `function onclick(event) {...}`, so `this` is the element and `event` is available ✅[^1] ✅[^2].
   - DOM property `el.onclick = fn`: one handler only (a second assignment replaced the first); assigning a string is ignored (reads `null`); the property does not change the attribute ✅[^1] ✅[^2].
   - `addEventListener(type, fn, options)`: many handlers; the same function added twice runs once; removing needs the **same** function reference; an object with `handleEvent(e)` works as a handler; inside a regular function `this` is `currentTarget`, inside an arrow function it is the outer `this` ✅[^1] ✅[^2]. Some events, like `DOMContentLoaded`, have no `on…` property and need `addEventListener` ✅[^1] ✅[^2].
2. **Mouse events.** `button` says which button changed (0 left, 1 middle, 2 right) and `buttons` is a bit mask of buttons held (1 left, 2 right) ✅[^1] ✅[^3]. A right press runs `mousedown → contextmenu → mouseup → auxclick`, with no `click` ✅[^1]. A double click repeats down/up/click with `detail` 2 and then fires `dblclick` ✅[^1] ✅[^3]. Modifier flags are `shiftKey`, `altKey`, `ctrlKey`, `metaKey` (Cmd on Mac) ✅[^3]. `clientX/Y` are window-relative, `pageX/Y` document-relative ✅[^3]. Calling `preventDefault()` on `mousedown` stops text selection from starting ✅[^3].
3. **Over/out versus enter/leave.** Moving from `#outer` onto its child `#inner` fired `mouseout` on outer (`relatedTarget` inner), then `mouseover` on inner, which **bubbled** back to outer; outer got no `mouseleave` ✅[^1] ✅[^4]. `mouseenter/leave` do not bubble and are not sent when moving between an element and its descendants ✅[^1] ✅[^5]. Fast moves may skip elements entirely, but a `mouseover` is always paired with a `mouseout` ✅[^4]. `relatedTarget` is the element the pointer came from or goes to, and is `null` (or `html`) at the window edge ✅[^1] ✅[^4].
4. **Drag-and-drop with mouse events.** On `mousedown` record the pointer's offset inside the element, move it on `mousemove` of `document` (not the element, which the pointer can outrun), drop on `mouseup`; disable the browser's built-in image/link drag with `ondragstart = () => false`; find the drop target with `elementFromPoint` after briefly hiding the dragged element ✅[^6]. The HTML Drag and Drop API (`draggable`, `dataTransfer`) is the separate, built-in alternative, needed for dragging files in from the OS ✅[^6] ✅[^7].
5. **Pointer events.** Every pointer event fired before its mouse counterpart; properties add `pointerId`, `pointerType` (`mouse`, `pen`, `touch`), `isPrimary`, `width/height` (1×1 for a mouse) and `pressure` (0.5 for a pressed mouse button by spec) ✅[^1] ✅[^8] ✅[^9]. Multi-touch gives each finger its own `pointerId`; only the first is `isPrimary` ✅[^8]. The browser fires `pointercancel` when it takes over a gesture (for example to pan); CSS `touch-action: none` stops that for a drag area ✅[^8] ✅[^9].
6. **Pointer capture.** `el.setPointerCapture(pointerId)` in `pointerdown` retargets all later events of that pointer to `el`: in the lab, `pointermove` events outside the element still arrived at it (and so did the compatibility `mousemove`), `gotpointercapture` fired first, and `lostpointercapture` fired automatically after `pointerup` ✅[^1] ✅[^8] ✅[^10].
7. **Keyboard.** `keydown` repeats while held (`event.repeat` true) and `keyup` fires once ✅[^11] ✅[^12]. `event.code` names the physical key (`KeyZ`, `Digit1`, `ShiftLeft`) regardless of layout; `event.key` is the character (`z`, `Z`, `y` on a German layout) ✅[^11] ✅[^12]. Use `code` for position-based shortcuts, `key` for typed meaning ✅[^11]. A Backspace ran `keydown → beforeinput → input → keyup`; on Tab, `keyup` reached the newly focused field ✅[^1]. `keypress`, `keyCode` and `charCode` are deprecated; `preventDefault()` on `keydown` blocks the character, but not text pasted or dictated, so validate on `input` ✅[^11] ✅[^13]. Mobile virtual keyboards often report `key` "Unidentified" during composition ✅[^11].
8. **Scroll.** `scroll` fires on the scrolled element or on `document` (bubbling to `window`), after the scroll, asynchronously; it is not cancelable and an element's `scroll` does not bubble ✅[^1] ✅[^14]. To prevent scrolling, cancel the cause (`wheel`, or keys like PageDown in `keydown`) or use `overflow: hidden` ✅[^14]. `scrollend` reports the end of a scroll ✅[^15].

## Worked example
A draggable card that cannot lose the pointer:

| Step | Code | Observed (lab ✅[^1]) |
|---|---|---|
| 1 | `card.style.touchAction = 'none'` | Touch drags are not taken over as panning |
| 2 | `card.onpointerdown = e => { card.setPointerCapture(e.pointerId); start = e.clientX }` | `pointerdown` pointerId 1, then `gotpointercapture` |
| 3 | `card.onpointermove = e => card.style.transform = \`translateX(${e.clientX - start}px)\`` | Moves kept arriving with the pointer far outside the card |
| 4 | `card.onpointerup = e => save()` | `hasPointerCapture` true inside `pointerup`; `lostpointercapture` right after |
| 5 | `click` after the drag | Targeted the card, because events were captured |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `mouseout` fires when entering a child | Hover menu closes | Over/out consider only the deepest element ✅[^1] ✅[^4] |
| Mouse leaves the element during a drag | `mousemove` on the element stops | Listen on `document`, or use pointer capture ✅[^6] ✅[^10] |
| Dragging an `<img>` with mouse events | Browser starts its own drag, `mouseup` lost | Native drag-and-drop; cancel `dragstart` ✅[^6] |
| `ctrlKey` shortcut on Mac | Users expect Cmd | Check `metaKey` too ✅[^3] |
| Shortcut by `event.key === 'z'` | Fails with Shift or other layouts | `key` follows layout and modifiers; use `code` for position ✅[^11] |
| `preventDefault()` in `scroll` | No effect | Scroll is not cancelable ✅[^1] ✅[^14] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Mouse events | Simple, universal | No touch or pen; extra work for drags |
| Pointer events + capture | One code path for mouse, pen, touch; robust drags | Need `touch-action` and `pointercancel` handling |
| HTML Drag and Drop API | Drag between windows and files from the OS | Awkward API, limited styling, weak on touch |

## Takeaways
- Use `mouseenter/leave` (or pointer equivalents) for hover UI; use `mouseover/out` only with delegation and `relatedTarget` checks.
- Build drags on pointer events with `setPointerCapture` and `touch-action: none`. [rule-candidate]
- Match shortcuts on `event.code` for position, `event.key` for meaning; never on `keyCode`. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 59 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, real clicks, hovers, drags and key presses through the browser pane's automation, 2026-11-10 (typed text and Shift chords from the automation were not realistic and were not used). [^1]
- [Introduction to browser events](https://javascript.info/introduction-browser-events) — javascript.info, living. Backs: attribute, property and `addEventListener` handlers, `this`, `handleEvent`, events without `on` properties. [^2]
- [Mouse events](https://javascript.info/mouse-events-basics) — javascript.info, living. Backs: event order, `button`, modifiers, coordinates, preventing selection. [^3]
- [Moving the mouse: mouseover/out, mouseenter/leave](https://javascript.info/mousemove-mouseover-mouseout-mouseenter-mouseleave) — javascript.info, living. Backs: `relatedTarget`, skipped elements, child transitions. [^4]
- [Element: mouseenter event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event) — MDN, living. Backs: no bubbling, not sent for descendant moves. [^5]
- [Drag'n'Drop with mouse events](https://javascript.info/mouse-drag-and-drop) — javascript.info, living. Backs: the drag algorithm, `ondragstart`, `elementFromPoint` drop targets. [^6]
- [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — MDN, living. Backs: draggable items, `dataTransfer`. [^7]
- [Pointer events](https://javascript.info/pointer-events) — javascript.info, living. Backs: event types, properties, multi-touch, `pointercancel`, capture. [^8]
- [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — MDN, living. Backs: `pressure` range (0.5 for a pressed mouse per `PointerEvent.pressure`), `pointercancel`, `touch-action`. [^9]
- [Element: setPointerCapture() method](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) — MDN, living. Backs: retargeting and automatic release. [^10]
- [Keyboard: keydown and keyup](https://javascript.info/keyboard-events) — javascript.info, living. Backs: `code` vs `key`, auto-repeat, default actions, legacy properties, mobile keyboards. [^11]
- [KeyboardEvent: code property](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) — MDN, living. Backs: physical key independent of layout and modifiers. [^12]
- [Element: keypress event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event) — MDN, living. Backs: `keypress` deprecated; use `beforeinput` or `keydown`. [^13]
- [Scrolling](https://javascript.info/onscroll) — javascript.info, living. Backs: `scroll` event, preventing scroll via its causes. [^14]
- [Element: scroll event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event) — MDN, living. Backs: `scrollend` for the end of scrolling. [^15]

## Related
- `javascript/browser/browser-platform-deep-dive.md` — bubbling, delegation, default actions, `isTrusted`.
- `javascript/browser/forms-focus-and-selection.md` — focus, input and submit events.
- `javascript/browser/element-geometry-and-scrolling.md` — coordinates used by drags.
