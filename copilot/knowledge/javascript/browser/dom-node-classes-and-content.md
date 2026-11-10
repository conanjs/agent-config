---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["WHATWG DOM and HTML living standards", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, dom, node-types, nodetype, tagname, innerhtml, outerhtml, textcontent, hidden, class-hierarchy]
---

# DOM node classes, types and content properties

## Summary
**TL;DR:** Every piece of an HTML page becomes a **node**: elements, text (including the whitespace between tags), comments, the doctype and the document itself. Each node is an object of a class in one inheritance chain (`HTMLInputElement → HTMLElement → Element → Node → EventTarget`), and the class decides which properties exist. Read content with `textContent` (plain text, safe) or `innerHTML`/`outerHTML` (markup, parsed on write); `innerHTML +=` rebuilds the whole element and loses state, and assigning `outerHTML` replaces the element in the document but not in your variable.
**Use this when:** a node is not the element you expected, you choose between `innerHTML`, `outerHTML`, `textContent` and `data`, or you need the class of a node.
**Not this doc:** walking and searching the tree, live collections, attributes versus properties → `browser-platform-deep-dive.md` §1–3.

## Problem
Code that assumes "the page is a tree of tags" breaks on text and comment nodes, reads `tagName` from a text node (it is `undefined`), appends with `innerHTML +=` and silently wipes what the user typed, or keeps using a variable after `outerHTML` replaced its element.

## Mental model
**Analogy:** the DOM is a family tree where every member has a job title inherited down a chain: "input" is a kind of "HTML element", which is a kind of "element", which is a kind of "node", which can "receive events". The title decides what a member can do; text nodes are relatives with no tag at all.

**Artifact (lab ✅[^1]):**
```js
let p = Object.getPrototypeOf(document.querySelector('input')), chain = [];
while (p) { chain.push(p.constructor.name); p = Object.getPrototypeOf(p); }
chain // ['HTMLInputElement', 'HTMLElement', 'Element', 'Node', 'EventTarget', 'Object']
```

## How it works
1. **The browser parses HTML into nodes** and repairs bad markup on the way: a `<table>` written without `<tbody>` gets one (`<table><tr>` parsed to `<table><tbody><tr>`) ✅[^1] ✅[^2], and `document.head`/`document.body` always exist ✅[^1].
2. **Node types.** `nodeType` is 1 for elements, 3 for text, 8 for comments, 9 for the document and 10 for the doctype ✅[^1] ✅[^4]. Whitespace between tags is a text node, so `document.body.childNodes` starts with `3:#text` before the first `DIV` ✅[^1].
3. **Names.** `tagName` exists only on elements; `nodeName` exists on every node: `BODY` for an element, `#text`, `#comment`, `#document` ✅[^1] ✅[^3]. HTML tag names are upper-case in HTML documents ✅[^3].
4. **Content properties.**
   - `innerHTML` reads and writes the markup *inside* an element; writing parses HTML ✅[^1] ✅[^3].
   - `outerHTML` includes the element itself. Assigning it **replaces** the element in the document with new nodes; the old variable still points to the detached original (`isConnected` false) ✅[^1] ✅[^3].
   - `textContent` returns all text without tags (`"Hello bold world"`) and writes text literally, so it is the safe way to insert user input ✅[^1] ✅[^3].
   - `data` / `nodeValue` hold the text of text and comment nodes; an element's `nodeValue` is `null` ✅[^1] ✅[^3].
5. **`hidden`.** Setting `el.hidden = true` adds the `hidden` attribute and the element computes to `display: none` ✅[^1] ✅[^3].

## Worked example
Appending a bold word to a container that holds an input the user typed into:

| Step | Code | Result (Chrome 152 lab ✅[^1]) |
|---|---|---|
| 1 | `inp.value = 'typed'` (an `<input>` inside `tmp`) | — |
| 2 | `tmp.innerHTML += '<b>x</b>'` | The string is read, concatenated and re-parsed |
| 3 | `inp.isConnected` | `false` — the old input was removed |
| 4 | `tmp.querySelector('input').value` | `""` — a new input, the typed text is gone |
| 5 | Fix: `tmp.insertAdjacentHTML('beforeend', '<b>x</b>')` or `tmp.append(b)` | Existing nodes keep their state ✅[^3] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `textNode.tagName` | `undefined` | Only `Element` has `tagName` ✅[^1] |
| `<script>` inserted with `innerHTML` | Does not run | Scripts inserted through `innerHTML` are not executed ✅[^5] |
| `outerHTML` on an element without a parent | Nothing changes | With no parent there is nowhere to put the replacement ✅[^6] |
| Comment nodes | Present in `childNodes`, `nodeType` 8 | Comments are part of the tree ✅[^1] ✅[^2] |
| `document.documentElement` vs `document.body` | `<html>` vs `<body>`; `body` can be `null` in a script in `<head>` | The parser has not reached `<body>` yet ✅[^7] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `textContent` | Safe for untrusted text, fast | No markup |
| `innerHTML` | Builds many nodes from one string | Re-parses, drops listeners and state, unsafe with untrusted input |
| `createElement` + `append` | Keeps existing nodes and their listeners | More code |

## Takeaways
- Use `children` and `nodeType === 1` checks when only elements matter; text and comment nodes are real nodes.
- Never append with `innerHTML +=`; use `append` or `insertAdjacentHTML`. [rule-candidate]
- Put untrusted text in `textContent`, never `innerHTML`. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 28 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab where every result marked with this note ran on 2026-11-10. [^1]
- [DOM tree](https://javascript.info/dom-nodes) — javascript.info, living. Backs: node kinds, whitespace text nodes, autocorrection, `documentElement`/`body`. [^2]
- [Node properties: type, tag and contents](https://javascript.info/basic-dom-node-properties) — javascript.info, living. Backs: class hierarchy, `nodeName`/`tagName`, `innerHTML`, `outerHTML`, `textContent`, `data`, `hidden`. [^3]
- [Node: nodeType property](https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType) — MDN, living. Backs: node type constants. [^4]
- [Element: innerHTML property](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML) — MDN, living. Backs: inserted scripts do not run. [^5]
- [Element: outerHTML property](https://developer.mozilla.org/en-US/docs/Web/API/Element/outerHTML) — MDN, living. Backs: no change when the element has no parent. [^6]
- [Walking the DOM](https://javascript.info/dom-navigation) — javascript.info, living. Backs: `document.body` is `null` in a head script. [^7]
- [DOM Standard](https://dom.spec.whatwg.org/) — WHATWG, living. Background: the node tree and interfaces.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — navigation, searching, attributes, safe insertion.
- `javascript/browser/element-geometry-and-scrolling.md` — sizes and coordinates of elements.
