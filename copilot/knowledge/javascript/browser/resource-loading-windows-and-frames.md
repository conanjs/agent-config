---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["HTML living standard", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, onload, onerror, crossorigin, script-error, window-open, popup, iframe, same-origin, postmessage, sandbox, clickjacking, x-frame-options, frame-ancestors]
---

# Resource loading, popups, frames and clickjacking

## Summary
**TL;DR:** Scripts, images and stylesheets report loading with `load` and `error` events; `error` means "could not fetch", not "code threw" (a script that throws still fires `load`), and an `<iframe>` fires `load` even for a 404 page. Errors in **cross-origin** scripts reach `window.onerror` only as `"Script error."` unless the tag has `crossorigin` and the server sends CORS headers. Windows and frames of the **same origin** can reach into each other; different origins see only a few properties (`location` for writing, `postMessage`, `closed`, `length`), so `postMessage` with an explicit target origin is the safe channel. `window.open` works reliably only from a user action. A hostile page can frame yours invisibly (**clickjacking**); stop it on the server with `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`.
**Use this when:** loading scripts dynamically, reporting front-end errors, opening popups (OAuth, payment, help windows), talking to an iframe or embedding widgets, or defending a page against being framed.
**Not this doc:** `DOMContentLoaded`, `load`, `async`/`defer` order → `browser-platform-deep-dive.md` §5; CORS for `fetch` → same deep dive §6.

## Problem
An error tracker shows only "Script error." with no file or line; a dynamically added script is assumed to have failed because its code threw; a popup opened after an `await` is blocked; a page reads `iframe.contentDocument` too early and gets the placeholder document; and a site's "Delete account" button can be clicked through an invisible frame on another site.

## Mental model
**Analogy:** each origin is a house. Windows of the same house share all rooms. Between houses you may only push a letter through the mailbox (`postMessage`) or point someone to a new address (`location =`); you cannot look inside. Clickjacking is a burglar holding your house's front door behind a cardboard cutout of a game, so your visitors press your doorbell thinking they play.

**Artifact (one throwing script loaded three ways from the other origin, lab ✅[^1]):**
```
<script src=http://127.0.0.1:8765/throw.js>                         → onerror: "Script error.", url "", line 0
<script crossorigin=anonymous src=…/throw.js>  (no CORS header)     → the script does not run; its error event fires
<script crossorigin=anonymous src=…/throw.js?cors> (ACAO: *)        → "ReferenceError: noSuchFunction is not defined", url, line 1
```

## How it works
1. **`load`/`error` on resources.** A script added with `document.head.append(script)` starts loading; `script.onload` fires after it **ran**, `onerror` only for network or HTTP failures (404 → `error`) ✅[^1] ✅[^2]. Runtime errors go to `window.onerror` ✅[^1] ✅[^2]. Images start loading as soon as `src` is set, even when not in the document ✅[^1] ✅[^2]. A failed stylesheet fires `error` ✅[^1]. An `<iframe>` fires only `load`, also for an error page ✅[^1] ✅[^2].
2. **Cross-origin details.** Full error details for a script from another origin need both `crossorigin` (`anonymous` = no cookies, `use-credentials` = cookies) and an `Access-Control-Allow-Origin` response; with the attribute but without the header the script is not executed at all ✅[^1] ✅[^2].
3. **Popups.** `window.open(url, name, features)` returns the new `Window`, or `null` if a popup blocker refused it; browsers allow it only in direct response to a user action, one window per action ✅[^3] ✅[^4]. Features like `width`, `height`, `left`, `top` request a minimal popup instead of a tab; `noopener` makes `open` return `null` and removes `window.opener` ✅[^4]. A same-origin popup can be read and changed by its opener and reach back through `window.opener`; `close()` and `closed`, `moveTo`/`resizeTo` (popups only), and `focus()`/`blur()` exist but browsers limit them ✅[^3] ✅[^4].
4. **Same origin.** An origin is protocol + host + port ✅[^5]. Same-origin frames give full access: `iframe.contentWindow.childValue` (42), `contentDocument`, `window.frames.name`, `window.frames[0]`, `parent`, `top` ✅[^1] ✅[^5].
5. **Different origin.** Reading a property threw `SecurityError`, `contentDocument` was `null`, reading `location.href` threw, writing `location` worked, `length` and `postMessage` were available ✅[^1] ✅[^5]. `document.domain` relaxation between subdomains is deprecated; use messaging ✅[^5].
6. **Wrong-document pitfall.** `iframe.contentDocument` read right after setting `src` is the initial `about:blank` document, which is replaced when the page loads; wait for `load` (or poll for a new document) before using it ✅[^1] ✅[^5].
7. **`postMessage`.** `win.postMessage(data, targetOrigin)` sends structured-cloneable data; the message is dropped silently if the window's origin differs from `targetOrigin` (sending to `http://example.com` delivered nothing) ✅[^1] ✅[^6]. The receiver's `message` event has `data`, `origin` (`http://127.0.0.1:8765` in the lab) and `source` (the sender window) — always check `origin` before trusting `data` ✅[^1] ✅[^6].
8. **`sandbox`.** An `<iframe sandbox>` with no values gets every restriction; values such as `allow-scripts`, `allow-forms`, `allow-same-origin`, `allow-top-navigation`, `allow-popups` lift one each. Without `allow-same-origin` even a same-origin page becomes a unique origin (access threw `SecurityError`) ✅[^1] ✅[^5].
9. **Clickjacking defences.** Framebusting scripts (`if (top != window) top.location = location`) are weak: the attacker can block navigation with `beforeunload` or a `sandbox` without `allow-top-navigation` ✅[^7]. Server headers work: `X-Frame-Options: DENY` or `SAMEORIGIN`, and the more flexible `Content-Security-Policy: frame-ancestors 'none' | 'self' | <origins>`; both left the framing page with an empty, unreadable frame ✅[^1] ✅[^7] ✅[^8]. `X-Frame-Options` is ignored in a `<meta>` tag ✅[^7]. `SameSite` cookies also blunt the attack, because the framed page is loaded without the user's session ✅[^7].

## Worked example
A parent page and a widget on another origin exchange messages safely:

| Step | Code | Result (lab ✅[^1]) |
|---|---|---|
| 1 | `f = document.createElement('iframe'); f.src = 'http://127.0.0.1:8765/child.html'; document.body.append(f)` | Frame on a second origin |
| 2 | `await new Promise(r => f.onload = r)` | Wait; do not touch `contentDocument` (it is `null`) |
| 3 | `f.contentWindow.postMessage({hi: 1}, 'http://127.0.0.1:8765')` | Delivered only to that origin |
| 4 | Widget: `e.source.postMessage({echo: e.data}, e.origin)` | Replies to the exact sender |
| 5 | Parent: `addEventListener('message', e => { if (e.origin !== 'http://127.0.0.1:8765') return; … })` | Got `{echo: {hi: 1}}`, `e.source === f.contentWindow` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Script throws after loading | `load` fires, not `error` | `error` is about fetching ✅[^1] ✅[^2] |
| `window.open` after `await fetch(...)` | Usually blocked | The user activation has expired ✅[^4] |
| `postMessage(data, '*')` | Any origin now in that window receives it | No origin check on send; use an exact origin ✅[^6] |
| Message handler without an `origin` check | Any page that holds a reference can send commands | `message` comes from any origin ✅[^6] |
| `sandbox="allow-scripts allow-same-origin"` on same-origin content | The frame can remove its own sandbox | Script with same-origin access can edit the iframe element ✅[^9] |

## Takeaways
- Report errors only from scripts served with `crossorigin` and CORS headers, or every cross-origin failure is "Script error.".
- Open popups synchronously inside the click handler; pass `noopener` for untrusted targets.
- Always pass an exact `targetOrigin` and check `event.origin`. [rule-candidate]
- Send `Content-Security-Policy: frame-ancestors 'self'` (or `X-Frame-Options: SAMEORIGIN`) on every page that has actions. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 44 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab with `localhost` and `127.0.0.1` as two origins, 2026-11-10 (popup behaviour in the embedded browser was not used). [^1]
- [Resource loading: onload and onerror](https://javascript.info/onload-onerror) — javascript.info, living. Backs: script/image events, iframes, `crossorigin` and "Script error.". [^2]
- [Popups and window methods](https://javascript.info/popup-windows) — javascript.info, living. Backs: popup blocking, `window.open`, `opener`, closing, moving, focus. [^3]
- [Window: open() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) — MDN, living. Backs: `null` when blocked, user-gesture rule, `popup` and `noopener` features. [^4]
- [Cross-window communication](https://javascript.info/cross-window-communication) — javascript.info, living. Backs: same origin, iframe access, `document.domain`, wrong-document pitfall, `frames`, `sandbox`, `postMessage`. [^5]
- [Window: postMessage() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) — MDN, living. Backs: `targetOrigin`, `origin`/`source`, security advice. [^6]
- [The clickjacking attack](https://javascript.info/clickjacking) — javascript.info, living. Backs: the attack, weak defences, `X-Frame-Options`, `SameSite`. [^7]
- [CSP: frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) — MDN, living. Backs: `frame-ancestors` values. [^8]
- [`<iframe>`: The Inline Frame element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) — MDN, living. Backs: `sandbox` values and the `allow-scripts allow-same-origin` warning. [^9]
- [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) — MDN, living. Background: `DENY`, `SAMEORIGIN`, CSP as the fuller option.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — page loading order, CORS for `fetch`.
- `javascript/browser/network-requests-in-depth.md` — `fetch` modes and credentials.
