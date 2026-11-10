---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["HTML living standard", "DOM living standard (Range)", "Selection API (W3C)", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, forms, form-elements, select, option, focus, blur, focusin, tabindex, change, input, beforeinput, clipboard, submit, requestsubmit, range, selection, setselectionrange]
---

# Forms, focus, input events and text selection

## Summary
**TL;DR:** `document.forms` and `form.elements` give named access to forms and their controls (radio groups come back as a `RadioNodeList` whose `value` reads and sets the checked one). `input` fires on every change of a value by the user, `change` only when the user commits a new value (on blur for text fields), and **neither fires when script sets `.value`**. `focus`/`blur` do not bubble; `focusin`/`focusout` do. A form submits through `submit` (Enter in a field or a click on a submit button); `form.submit()` skips the event and validation while `form.requestSubmit()` keeps both. Text selection uses `Range` (a pair of boundary points) and `Selection` (the user's ranges) for page content, and `selectionStart/End`, `setSelectionRange`, `setRangeText` inside inputs and textareas.
**Use this when:** reading or validating forms, building custom inputs, managing focus for accessibility, or reading, changing or restoring what the user selected.
**Not this doc:** attributes vs properties (`value` vs `defaultValue`) and `FormData` collection → `browser-platform-deep-dive.md` §2 and `network-requests-in-depth.md`.

## Problem
Validation that listens to `change` misses keystrokes; code that sets `.value` and waits for `input` never hears it; a handler on `focus` attached to a form never runs; a "save" button calling `form.submit()` bypasses the submit handler and HTML validation; and selection code built for page text does nothing inside a `<textarea>`.

## Mental model
**Analogy:** a form is a paper form handed to a clerk. `input` is the clerk watching every pen stroke; `change` is the clerk reading the box after you move to the next box; `submit` is handing the form over the counter, which the clerk checks (validation) unless you post it through the back door (`form.submit()`). A `Range` is two bookmarks in a book; the `Selection` is the highlighter the reader is holding.

**Artifact (Enter pressed in a text field after deleting one character, lab ✅[^1]):**
```
beforeinput  input (value "initia")  beforeinput      ← Enter
change (value "initia")                               ← committed before submitting
click on <button id="go"> (isTrusted true, detail 0)  ← implicit submission clicks the default button
submit (event.submitter = #go)
```

## How it works
1. **Navigation.** `document.forms.f` and `document.forms[0]` are the same form; `form.elements.login` (or `form.login`) is the control named `login`; each control has `.form` back to its form ✅[^1] ✅[^2]. A name shared by radios returns a `RadioNodeList`: setting its `value` to `'2'` checked the second radio ✅[^1] ✅[^2].
2. **Values.** Inputs and textareas use `.value` (not `innerHTML`); checkboxes and radios use `.checked` ✅[^2]. A `<select>` has `value`, `selectedIndex` and `options`; setting `value = 'a'` moved `selectedIndex` to 0 ✅[^1] ✅[^2]. `new Option(text, value, defaultSelected, selected)` creates an option: appending `new Option('Cee', 'c', true, true)` made the select's value `c` ✅[^1] ✅[^2]. In a multi-select read every `option.selected` ✅[^2].
3. **Focus.** `focus` fires on the element receiving focus and `blur` on the one losing it; they **do not bubble**, so a form-level listener needs the capture phase or `focusin`/`focusout`, which bubble ✅[^1] ✅[^3] ✅[^4]. On Tab the lab order was `blur` (with `relatedTarget` = the next field) → `focusout` → `focus` → `focusin` ✅[^1]. `el.focus()` does nothing on an element that cannot take focus (a plain `div`) until it has `tabindex`; `tabindex="-1"` allows script focus but leaves it out of Tab order, `0` puts it in document order, positive numbers come first ✅[^1] ✅[^3]. `tabIndex` defaults: input 0, `a` with `href` 0, `div` −1 ✅[^1]. `blur()` moves focus to `body`; `document.activeElement` tells who has focus ✅[^1] ✅[^3].
4. **`change` and `input`.** `input` fires after every user modification, including paste and dictation, and cannot be cancelled; cancel the cheaper `beforeinput` instead ✅[^1] ✅[^5]. `change` fires on blur for text fields only if the value differs from when focus arrived (typing `a` and deleting it fired no `change`), and immediately for selects, checkboxes and radios ✅[^1] ✅[^5]. Assigning `.value` from script fires neither event ✅[^1].
5. **Clipboard.** `cut`, `copy`, `paste` fire before the action and can be cancelled; `event.clipboardData` reads or sets the data inside these handlers, while `navigator.clipboard` (async, permission-gated) works elsewhere ✅[^5].
6. **Submit.** Pressing Enter in a single-line field or clicking `<input type=submit>`/`<button>` fires `submit` on the form; Enter also fires a `click` on the first submit button ✅[^1] ✅[^6]. `event.submitter` names the button ✅[^1]. `form.submit()` sends without the `submit` event (0 events in the lab) and without constraint validation; `form.requestSubmit()` fires `submit` (1 event) and validates ✅[^1] ✅[^6] ✅[^7].
7. **`Range`.** A range is a start and an end, each a (node, offset) pair: offsets count characters in a text node and child nodes in an element ✅[^8]. `setStart(text, 2)` and `setEnd(b.firstChild, 3)` on `<p>Hello <b>bold</b> world</p>` gave `"llo bol"`; `setStart(p, 0)`, `setEnd(p, 2)` gave `"Hello bold"` ✅[^1] ✅[^8]. Methods: `cloneContents` (partial elements are cloned), `extractContents`, `deleteContents`, `insertNode`, `surroundContents` (wrapped `bold` in `<i>`), `selectNode`, `selectNodeContents`, `collapse` ✅[^1] ✅[^8].
8. **`Selection`.** `document.getSelection()` holds the user's ranges: `anchor` is where the selection started and `focus` where it ends, so a backwards selection has `anchorOffset` 3, `focusOffset` 2 while its range is still ordered (start 2) ✅[^1] ✅[^8] ✅[^9]. `isCollapsed` and `type` (`Caret`, `Range`) describe it; `addRange`, `removeAllRanges`, `setBaseAndExtent`, `collapse` change it; `selectionchange` fires on `document` ✅[^1] ✅[^8].
9. **Selection in form controls.** `input` and `textarea` have their own API: `selectionStart/End`, `setSelectionRange(0, 5)`, `select()`, the `select` event, and `setRangeText(text, start, end, mode)` (`'end'` placed the caret after inserted text) ✅[^1] ✅[^8]. Chrome also returned the textarea's selected text from `getSelection().toString()`; do not rely on that across browsers ✅[^1] ✅[^9].
10. **Making text unselectable:** CSS `user-select: none`, or cancel `selectstart`/`mousedown` ✅[^1] ✅[^8].

## Worked example
Insert a snippet at the caret of a textarea and keep the caret after it:

| Step | Code | Result (lab ✅[^1]) |
|---|---|---|
| 1 | `ta.value = 'hello world'; ta.focus(); ta.setSelectionRange(0, 5)` | `selectionStart` 0, `selectionEnd` 5 |
| 2 | `ta.setRangeText('HEY')` | `"HEY world"`, selection 0–3 (default `preserve` mode) |
| 3 | `ta.setRangeText('!!', 11, 11, 'end')` | `"HEY world!!"`, caret at 11 |
| 4 | No `input` event fired | Script edits are silent; dispatch one if a framework listens ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `onfocus` on a `<form>` | Never runs for its fields | `focus` does not bubble; use `focusin` or capture ✅[^1] ✅[^4] |
| Value changed and changed back | No `change` | Compared with the value at focus ✅[^1] |
| `form.submit()` | No `submit` event, no validation | Use `requestSubmit()` ✅[^1] ✅[^7] |
| Unchecked radios and checkboxes | Missing from `FormData` | Only successful controls are sent ✅[^1] ✅[^2] |
| `focus()` on a detached element | No effect | Only rendered, connected elements take focus ✅[^1] |
| `Range` offsets on an element | Count child nodes, not characters | Offset meaning depends on the node type ✅[^8] |

## Takeaways
- Validate on `input` (or `beforeinput` to block), save on `change`; dispatch `new Event('input', {bubbles: true})` after setting `.value` from script if listeners depend on it.
- Delegate focus handling with `focusin`/`focusout`. [rule-candidate]
- Use `form.requestSubmit()` instead of `form.submit()`. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 59 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, real clicks and key presses, 2026-11-10. [^1]
- [Form properties and methods](https://javascript.info/form-elements) — javascript.info, living. Backs: `document.forms`, `form.elements`, `element.form`, values, `select`/`option`, `new Option`. [^2]
- [Focusing: focus/blur](https://javascript.info/focus-blur) — javascript.info, living. Backs: focus/blur, `tabindex`, `activeElement`, `focusin`/`focusout`. [^3]
- [Element: focusin event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event) — MDN, living. Backs: `focusin` bubbles, `focus` does not. [^4]
- [Events: change, input, cut, copy, paste](https://javascript.info/events-change-input) — javascript.info, living. Backs: `change` vs `input`, clipboard events and restrictions. [^5]
- [Forms: event and method submit](https://javascript.info/forms-submit) — javascript.info, living. Backs: ways to submit, Enter clicks the submit button, `form.submit()` fires no event. [^6]
- [HTMLFormElement: requestSubmit() method](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit) — MDN, living. Backs: `requestSubmit` fires `submit` and validates. [^7]
- [Selection and Range](https://javascript.info/selection-range) — javascript.info, living. Backs: `Range` boundaries and methods, `Selection` properties and events, form-control selection, unselectable text. [^8]
- [Selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection) — MDN, living. Backs: anchor/focus, form controls use their own API. [^9]

## Related
- `javascript/browser/ui-events-mouse-pointer-keyboard.md` — keyboard events behind `input`.
- `javascript/browser/network-requests-in-depth.md` — sending forms with `FormData`.
- `javascript/browser/browser-platform-deep-dive.md` — `value` vs `defaultValue`, default actions.
