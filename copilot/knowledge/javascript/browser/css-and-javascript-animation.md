---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["CSS Transitions, CSS Animations, CSS Easing Functions", "Web Animations API", "HTML living standard (requestAnimationFrame)", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, animation, bezier-curve, de-casteljau, cubic-bezier, steps, css-transition, transitionend, keyframes, requestanimationframe, timing-function, easing, web-animations-api]
---

# Animation: Bezier curves, CSS transitions and keyframes, JavaScript animation

## Summary
**TL;DR:** An animation is a value changing over time through a **timing function** that maps elapsed time (0→1) to progress (0→1). CSS describes that curve as `cubic-bezier(x1, y1, x2, y2)` — a Bezier curve from (0,0) to (1,1) with two control points — or as `steps(n)`. **CSS transitions** animate a property from its old to its new value when it changes; **`@keyframes`** animations run a named sequence; both report progress with events (`transitionend`, `animationiteration`, …) and stay smooth when they change only `transform` and `opacity`. When CSS cannot express it (bounce, physics, canvas), **JavaScript animation** draws each frame in `requestAnimationFrame`, computing progress from the frame's timestamp and passing it through any timing function — including the "easeOut" and "easeInOut" transforms of an ease-in curve.
**Use this when:** choosing between CSS and JavaScript animation, writing or reading a `cubic-bezier`, reacting to an animation's end, or building a custom easing.
**Not this doc:** the event loop that schedules frames → `javascript/async/event-loop-and-async-await.md`.

## Problem
An animation driven by `setInterval(…, 20)` stutters and keeps running in background tabs; code waits for `transitionend` that never comes because the value did not change; an animation of `left`/`width` janks on phones; and a designer's "overshoot" curve looks wrong because nobody knew a Bezier y value may leave 0–1.

## Mental model
**Analogy:** a timing function is the speed profile of a lift between two floors: the floors are fixed (start and end value), the curve decides whether it starts gently, rushes, overshoots and settles. A Bezier curve is a rubber band pinned at the two floors and pulled toward two control points.

**Artifact — de Casteljau construction for 3 points at t = 0.25 (javascript.info's method ✅[^2]):**
```
P1 ──── P2 ──── P3        1. take the point 25 % along P1→P2 and 25 % along P2→P3
   \   /                  2. take the point 25 % along the segment joining them
    • curve point         3. repeat for t from 0 to 1: the points trace the curve
Formula (4 points): P = (1−t)³P1 + 3(1−t)²t P2 + 3(1−t)t² P3 + t³P4
```

## How it works
1. **Bezier curves.** Defined by control points; the curve starts at the first and ends at the last point, passes near (not through) the middle ones, and stays inside their convex hull ✅[^2]. Degree = points − 1 (3 points: quadratic, 4: cubic) ✅[^2]. De Casteljau's algorithm builds a point for a given `t` by repeated linear interpolation; the formula above gives the same point ✅[^2].
2. **CSS timing functions.** `cubic-bezier(x1, y1, x2, y2)` fixes P1 = (0,0) and P4 = (1,1); x is time and must stay in [0, 1] (`cubic-bezier(1.5, …)` threw `TypeError` in `element.animate`), y is progress and may leave [0, 1] to overshoot (`cubic-bezier(.3, 1.8, .6, 1)` reached 217.7 px on the way from 100 px to 200 px) ✅[^1] ✅[^3] ✅[^4]. Keywords are shortcuts: `ease-in` = `cubic-bezier(0.42, 0, 1, 1)`, `linear` = `cubic-bezier(0, 0, 1, 1)` ✅[^4]. `steps(n, start|end)` jumps in n equal steps ✅[^3] ✅[^4].
3. **CSS transitions.** `transition: property duration timing-function delay` (or the four `transition-*` properties) animates the property when its value changes; not every property is animatable ✅[^3]. Events: `transitionrun`, `transitionstart`, `transitionend` (with `propertyName` and `elapsedTime` 0.2 for 200 ms), and `transitioncancel` when the value changes mid-way, after which a new run starts from the current value (190 px, 30 % into a 250 → 50 px move) ✅[^1] ✅[^3].
4. **Keyframes.** `@keyframes name { from {…} 50% {…} to {…} }` plus `animation: name duration timing iteration-count direction`; events `animationstart`, `animationiteration` (each repeat), `animationend` — the lab saw elapsed times 0, 0.1, 0.2 for 2 × 100 ms ✅[^1] ✅[^3].
5. **Performance.** A change to geometry (`width`, `left`) triggers layout and paint; `transform` and `opacity` can be handled by the compositor, usually on the GPU, so animate those ✅[^3].
6. **JavaScript animation with `requestAnimationFrame`.** `requestAnimationFrame(cb)` runs `cb(timestamp)` before the next repaint, normally at the display's refresh rate; all callbacks of one frame get the same timestamp (two in the lab did) ✅[^1] ✅[^5] ✅[^6]. Browsers pause or throttle it in background tabs and hidden iframes (in the lab, an off-screen page ran it about once per second), and it is aligned with painting, unlike `setInterval`, whose independent timers do not batch with repaints ✅[^1] ✅[^5] ✅[^6]. Compute progress from the timestamp, not by counting frames, or the animation runs faster on high-refresh screens ✅[^6].
7. **A reusable `animate({timing, draw, duration})`.** Each frame: `timeFraction = min((time − start) / duration, 1)`, `progress = timing(timeFraction)`, `draw(progress)`, request another frame while `timeFraction < 1` ✅[^5].
8. **Timing functions in JavaScript.** Power `t => t ** n`, `arc` `1 − sin(acos(t))`, `back` (pull back, then shoot), `bounce`, `elastic` ✅[^5]. Any ease-in function becomes **easeOut** with `t => 1 − timing(1 − t)` and **easeInOut** by applying ease-in for the first half and easeOut for the second ✅[^5]. `draw` can do anything — move an element, type text, paint a canvas ✅[^5].
9. **Web Animations API.** `element.animate(keyframes, options)` runs the same engine as CSS from JavaScript and returns an `Animation` with `play`, `pause`, `currentTime`, and a `finished` promise (`playState` `finished`) ✅[^1] ✅[^7].

## Worked example
A 200 ms width transition, interrupted and observed:

| Step | Code | Result (lab ✅[^1]) |
|---|---|---|
| 1 | CSS `#anim { transition: width 200ms linear }`; JS `anim.style.width = '250px'` | `transitionrun`, `transitionstart` |
| 2 | wait for `transitionend` | after ≈209 ms, `propertyName` `width`, `elapsedTime` 0.2 |
| 3 | `transition: width 1000ms linear`; set `width = '50px'`; after 300 ms read `getComputedStyle(anim).width` | `190.016px` (30 % of the way) |
| 4 | set `width = '400px'` now | `transitioncancel` (elapsed 0.315), then a new `transitionrun`/`transitionstart` from 190 px |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Setting a property to its current value | No transition, no `transitionend` | Nothing changed ✅[^3] |
| `cubic-bezier` x outside [0, 1] | Invalid (`TypeError` in `animate`) | Time cannot run backwards ✅[^1] ✅[^4] |
| rAF animation in a background tab | Paused or throttled | Saves power; time-based progress jumps to the right state on return ✅[^1] ✅[^6] |
| Hover transition that reverts | `transitionend` fires again at the end of the way back | It fires in both directions ✅[^8] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| CSS transitions | Declarative, compositor-friendly, cheap | Only start → end, only CSS properties |
| `@keyframes` | Multi-step, looping, no JS | Static; changing it at runtime is awkward |
| Web Animations API | CSS engine with JS control (pause, seek, promises) | Same property limits as CSS |
| `requestAnimationFrame` | Any curve, physics, canvas, text | You write the loop; main-thread cost |

## Takeaways
- Animate `transform` and `opacity`; avoid layout properties in animations. [rule-candidate]
- Drive JavaScript animation by elapsed time from the rAF timestamp, never by frame counts or `setInterval`. [rule-candidate]
- Build easeOut and easeInOut from one ease-in function instead of writing three.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 36 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, 2026-11-10. [^1]
- [Bezier curve](https://javascript.info/bezier-curve) — javascript.info, living. Backs: control points, de Casteljau's algorithm, the formula. [^2]
- [CSS-animations](https://javascript.info/css-animations) — javascript.info, living. Backs: transitions, timing functions, `steps`, `transitionend`, keyframes, performance. [^3]
- [`<easing-function>`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function) — MDN, living. Backs: `cubic-bezier` ranges, keyword equivalents, `steps`. [^4]
- [JavaScript animations](https://javascript.info/js-animation) — javascript.info, living. Backs: `setInterval` vs rAF, `animate` helper, timing functions, easeOut/easeInOut, `draw`. [^5]
- [Window: requestAnimationFrame() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — MDN, living. Backs: refresh-rate timing, pausing in background, time-based progress. [^6]
- [Element: animate() method](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) — MDN, living. Backs: Web Animations API, `Animation` object. [^7]
- [Element: transitionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event) — MDN, living. Backs: fires in both directions. [^8]

## Related
- `javascript/async/event-loop-and-async-await.md` — where rendering and rAF sit in the event loop.
- `javascript/browser/element-geometry-and-scrolling.md` — values commonly animated.
