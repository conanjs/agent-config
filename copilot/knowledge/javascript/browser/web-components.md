---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["HTML and DOM living standards (custom elements, shadow DOM, template, slots)", "CSS Scoping", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, web-components, custom-elements, lifecycle-callbacks, observedattributes, customized-built-in, shadow-dom, template, slots, slotted, host, css-custom-properties, composed, composedpath, retargeting]
---

# Web components: custom elements, shadow DOM, templates, slots, styling and events

## Summary
**TL;DR:** Web components are four browser features used together. **Custom elements** register a class for a tag with a dash in its name (`customElements.define('time-fmt', TimeFmt)`) and get lifecycle callbacks: `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback` (only for `observedAttributes`), `adoptedCallback`. **Shadow DOM** gives an element a private tree whose markup is hidden from `document.querySelector` and whose styles neither leak out nor get page styles in (except inherited properties and custom properties). **`<template>`** holds inert markup to clone. **Slots** project the host's own children ("light DOM") into places in the shadow tree without moving them. Events from inside are **retargeted** to the host, and only `composed` events cross the shadow boundary.
**Use this when:** building reusable widgets without a framework, reading a design system built on web components, or debugging why a style, a selector or an event does not reach inside or outside a component.
**Not this doc:** event bubbling and delegation in general → `browser-platform-deep-dive.md` §4.

## Problem
A component renders nothing because it reads its children in the constructor, attribute changes are ignored because they are not observed, page CSS mysteriously fails to style a widget (or a widget's CSS fails to style the content passed in), and a click handler on `document` sees the component instead of the button that was clicked inside it.

## Mental model
**Analogy:** a custom element is a new appliance model registered with the city; the shadow DOM is the appliance's sealed casing (you see the front panel, not the wiring); slots are labelled sockets on the front where you plug in your own parts, which stay yours; styling is the paint: the factory paints the inside, the owner paints the outside and wins on what they own; events leaving the casing are signed with the appliance's name, not the internal part's.

**Artifact (lab ✅[^1]):**
```js
class TimeFmt extends HTMLElement {
  static observedAttributes = ['datetime'];
  connectedCallback() { this.render(); }
  attributeChangedCallback(name, oldV, newV) { this.render(); }
  render() { this.textContent = new Date(this.getAttribute('datetime')).toISOString().slice(0, 10); }
}
customElements.define('time-fmt', TimeFmt);   // <time-fmt datetime="2020-01-02"> now shows 2020-01-02
```

## How it works
1. **The idea.** A component has its own markup, styles and behaviour behind a clear interface, like a self-contained part of a larger machine ✅[^2].
2. **Defining custom elements.** Names need a dash (`customElements.define('nodash', …)` threw `SyntaxError`); a name can be defined once (`NotSupportedError` the second time) ✅[^1] ✅[^3]. Before `define`, `<time-fmt>` is a plain `HTMLElement` that matches `:not(:defined)`; `define` **upgrades** existing elements, `customElements.whenDefined(name)` resolves, and `customElements.get(name)` returns the class ✅[^1] ✅[^3].
3. **Lifecycle.** For an element already in the page the constructor ran with attributes and children present (it was upgraded after parsing), then `attributeChangedCallback` for each observed attribute (`null → 2020-01-02`), then `connectedCallback`; changing a non-observed attribute called nothing; removal called `disconnectedCallback`; `document.createElement('time-fmt')` ran the constructor with 0 attributes ✅[^1] ✅[^3]. Do rendering work in `connectedCallback`, not the constructor, because a parser-created element may not have its children yet and may be connected and disconnected several times ✅[^3]. When children must be complete, the lesson suggests deferring with a zero-delay `setTimeout` ✅[^3].
4. **Customized built-ins.** `class extends HTMLButtonElement` with `define(name, cls, {extends: 'button'})` and `<button is="hello-btn">` keep the built-in's behaviour and accessibility; Chrome supports them (lab), Safari does not plan to ✅[^1] ✅[^3] ✅[^4].
5. **Shadow DOM.** `el.attachShadow({mode: 'open'})` returns a shadow root; `el.shadowRoot` is that root for `open` and `null` for `closed`; `shadowRoot.host` points back ✅[^1] ✅[^5]. An element can have one shadow root, and only some elements (custom elements and a list of built-ins like `div`, `span`) can host one; `img` threw `NotSupportedError` ✅[^1] ✅[^5]. Built-in controls like `<input type=range>` use a browser-internal shadow tree ✅[^5]. `document.querySelector('#in')` did not find an element inside; `shadowRoot.querySelector` did ✅[^1] ✅[^5].
6. **Templates.** `<template>` content is parsed into `template.content` (a `DocumentFragment`), not rendered and not found by document queries; its scripts do not run until a clone is inserted — a template from the page's markup ran its script once per inserted clone (1, then 2) ✅[^1] ✅[^6]. Scripts in a template built with `innerHTML` never run, because fragment parsing marks them as already started ✅[^1] ✅[^7]. Insert with `el.append(tpl.content.cloneNode(true))` so the template stays reusable ✅[^1] ✅[^6].
7. **Slots.** In the shadow tree, `<slot name="title">` receives the light-DOM child with `slot="title"`; an unnamed `<slot>` receives every other top-level child, including text; the content between `<slot>` tags is fallback shown when nothing is assigned ✅[^1] ✅[^8]. Slotted nodes stay in the light DOM (still `host.children`), they are only rendered elsewhere — the "flattened" tree ✅[^1] ✅[^8]. API: `slot.assignedNodes()`/`assignedElements()` (`{flatten: true}` includes fallback), `node.assignedSlot`, and `slotchange` when assignment changes (fired after appending a child) ✅[^1] ✅[^8].
8. **Styling.** Styles inside the shadow tree apply only there (a red `p` inside did not color a `p` outside) ✅[^1] ✅[^9]. `:host` and `:host(selector)` style the host from inside, but page rules on the host win over `:host` (a page `border-width` beat it) ✅[^1] ✅[^9] ✅[^10]. `::slotted(selector)` styles top-level slotted elements, but those belong to the page, so page rules win (`div > b` beat `::slotted(b)`) ✅[^1] ✅[^9]. Inherited properties (color, font) and **CSS custom properties** pass into the shadow tree, so components expose theming hooks like `var(--title-color, default)`; setting `--title-color` on the host colored the slotted title ✅[^1] ✅[^9].
9. **Events.** Events from inside a shadow tree are **retargeted**: a click on `#in` showed `target` `#in` inside and `target` = the host `DIV` to a `document` listener, while `composedPath()[0]` still named `#in` (for open roots) ✅[^1] ✅[^11]. Most built-in UI events are `composed: true` and cross the boundary; a `CustomEvent` with `bubbles: true` but without `composed: true` stopped at the shadow root ✅[^1] ✅[^11] ✅[^12]. For a closed root, `composedPath()` seen from outside starts at the host ✅[^1] ✅[^11].

## Worked example
A card component with a named title slot, a theming hook and an event for the page:

| Step | Code | Result (lab ✅[^1]) |
|---|---|---|
| 1 | `sr = host.attachShadow({mode: 'open'}); sr.innerHTML = '<style>::slotted(span){color: var(--title-color, rgb(1,1,1))}</style><slot name=title></slot><slot>fallback</slot>'` | Shadow tree with two slots |
| 2 | `host.innerHTML = '<span slot=title>Title</span><b>light 1</b>text'` | `title` slot gets the span; default slot gets `B` and the text |
| 3 | `host.style.setProperty('--title-color', 'rgb(0, 128, 0)')` | Slotted title computes to `rgb(0, 128, 0)` |
| 4 | Inside: `el.dispatchEvent(new CustomEvent('y', {bubbles: true, composed: true}))` | Reaches `document`; the same event without `composed` does not |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Reading children in the constructor | Empty when created by `createElement` or the parser mid-way | Children are added later ✅[^1] ✅[^3] |
| Attribute not in `observedAttributes` | No callback | Only listed attributes are observed ✅[^1] ✅[^3] |
| `attachShadow` twice | `NotSupportedError` | One shadow root per element ✅[^1] ✅[^5] |
| Page CSS for an element inside a shadow tree | No effect | Selectors do not cross the boundary ✅[^1] ✅[^9] |
| `::slotted(b span)` | Does not match | Only top-level slotted elements can be selected ✅[^9] |
| Customized built-in in Safari | Not upgraded | Safari does not implement `is=` ✅[^4] |

## Takeaways
- Render in `connectedCallback`, list every reactive attribute in `observedAttributes`, and clean up in `disconnectedCallback`. [rule-candidate]
- Expose styling through CSS custom properties (and `::part`), not by expecting page selectors to reach inside.
- Dispatch component events as `new CustomEvent(name, {bubbles: true, composed: true, detail})`. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 59 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, 2026-11-10. [^1]
- [From the orbital height](https://javascript.info/webcomponents-intro) — javascript.info, living. Backs: the component idea and the four technologies. [^2]
- [Custom elements](https://javascript.info/custom-elements) — javascript.info, living. Backs: `define`, naming, lifecycle callbacks, `observedAttributes`, rendering order, customized built-ins, `:defined`, `whenDefined`. [^3]
- [Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) — MDN, living. Backs: Safari does not plan to support customized built-ins. [^4]
- [Shadow DOM](https://javascript.info/shadow-dom) — javascript.info, living. Backs: built-in shadow DOM, `attachShadow`, open/closed, allowed hosts, encapsulation. [^5]
- [Template element](https://javascript.info/template-element) — javascript.info, living. Backs: inert content, scripts running on insertion, cloning. [^6]
- [Element: innerHTML property](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML) — MDN, living. Backs: scripts inserted through `innerHTML` do not execute. [^7]
- [Shadow DOM slots, composition](https://javascript.info/slots-composition) — javascript.info, living. Backs: named and default slots, fallback, flattened tree, slot API, `slotchange`. [^8]
- [Shadow DOM styling](https://javascript.info/shadow-dom-style) — javascript.info, living. Backs: local styles, `:host`, cascading priority, `::slotted`, custom properties. [^9]
- [:host](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:host) — MDN, living. Backs: `:host` selects the shadow host from inside. [^10]
- [Shadow DOM and events](https://javascript.info/shadow-dom-events) — javascript.info, living. Backs: retargeting, `composedPath`, `composed`, custom events. [^11]
- [Event: composed property](https://developer.mozilla.org/en-US/docs/Web/API/Event/composed) — MDN, living. Backs: which events cross the shadow boundary. [^12]
- [HTML Standard: Custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html) — WHATWG, living. Background: upgrades and reactions.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — the event path that retargeting changes.
- `javascript/browser/dom-node-classes-and-content.md` — the `HTMLElement` class custom elements extend.
