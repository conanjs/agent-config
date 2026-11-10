---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["WHATWG Fetch, XMLHttpRequest, WebSockets and HTML (Server-sent events) standards", "RFC 6455", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, network, formdata, fetch, download-progress, abortcontroller, abortsignal, referrer, fetch-mode, credentials, cache, redirect, integrity, keepalive, xmlhttprequest, upload-progress, resumable-upload, websocket, server-sent-events, eventsource]
---

# Network requests in depth: FormData, fetch options, progress, abort, XHR, WebSocket and SSE

## Summary
**TL;DR:** `FormData` turns a form (or hand-added fields and files) into a `multipart/form-data` body that `fetch` sends with the right boundary. `fetch` shows **download** progress by reading `response.body` chunk by chunk against `Content-Length`, but has no **upload** progress event — `XMLHttpRequest`'s `upload.onprogress` does. Any request can be cancelled with an `AbortController` (or `AbortSignal.timeout`). Options control what leaves the browser: `referrer`/`referrerPolicy`, `mode`, `credentials`, `cache`, `redirect`, `integrity`, `keepalive`. A **resumable upload** asks the server how many bytes it has and sends `file.slice(from)`. For server push, **WebSocket** is a two-way message channel and **Server-Sent Events** (`EventSource`) a one-way text stream with automatic reconnection and `Last-Event-ID`.
**Use this when:** uploading files, showing progress, cancelling or timing out requests, controlling cookies and referrers, sending analytics on page exit, or choosing between polling, SSE and WebSocket.
**Not this doc:** `fetch` basics, `response.ok`, CORS, `URL` → `browser-platform-deep-dive.md` §6; long polling and the server side → `javascript/node/node-services-deep-dive.md`.

## Problem
A progress bar for uploads never moves with `fetch`; a request keeps running after the user left the screen; a cross-origin call leaks the full page URL in `Referer`; an analytics `fetch` on page exit is cancelled; a 200 MB upload restarts from zero after a network drop; and a chat built on polling is slow while one built on SSE cannot send.

## Mental model
**Analogy:** `fetch` is posting a parcel and receiving a reply parcel that arrives in pieces you can count; the options are the forms you fill at the counter (who sent it, may it carry your ID card, may it be redirected, must the seal match). `AbortController` is a recall button. A resumable upload is a removal van that, after a breakdown, phones the new house to ask which boxes arrived. WebSocket is a phone call (both talk any time); SSE is a radio station (it talks, you listen, and your radio re-tunes by itself).

**Artifact (download progress, lab ✅[^1]):**
```js
const res = await fetch('/big');
const total = +res.headers.get('Content-Length');           // 1048576
const reader = res.body.getReader(); let got = 0;
for (;;) { const { done, value } = await reader.read(); if (done) break; got += value.length; /* show got / total */ }
// got === total after several chunks
```

## How it works
1. **`FormData`.** `new FormData(form)` collects named, successful controls (unchecked radios and buttons are left out); `append` adds a value (repeat names allowed, `getAll` returns all), `set` replaces, `delete`, `has`, `get`, iteration ✅[^1] ✅[^2]. `append(name, blob, filename)` adds a file part (a Blob becomes a `File` named `x.txt`) ✅[^1] ✅[^2]. Passing it as `body` sets `Content-Type: multipart/form-data; boundary=…` automatically — do not set that header yourself ✅[^1] ✅[^2].
2. **Download progress.** `response.body` is a `ReadableStream`; read it with `getReader()` and count bytes; `Content-Length` may be missing (chunked or compressed responses), then show bytes only ✅[^1] ✅[^3]. Reading the stream consumes the body, so assemble the chunks yourself (`new Blob(chunks)` or concatenate into a `Uint8Array`) ✅[^3].
3. **Abort.** `const c = new AbortController(); fetch(url, {signal: c.signal}); c.abort()` rejects the fetch with `AbortError` and sets `signal.aborted` ✅[^1] ✅[^4]. One signal can cancel many requests; `abort(reason)` rejects with that reason ✅[^1] ✅[^4]. `AbortSignal.timeout(ms)` rejects with `TimeoutError`; `AbortSignal.any([...])` combines signals ✅[^1].
4. **`referrer` and `referrerPolicy`.** Default same-origin requests send the full page URL; cross-origin ones send only the origin (`strict-origin-when-cross-origin`) ✅[^1] ✅[^5]. `referrer: ''` sends none, `referrerPolicy: 'origin'` sends only the origin even same-origin ✅[^1] ✅[^5].
5. **`mode`.** `cors` (default) allows cross-origin reads under CORS; `same-origin` rejects any cross-origin request (`TypeError`); `no-cors` sends a simple request and returns an **opaque** response (`type` `opaque`, `status` 0, unreadable) ✅[^1] ✅[^5] ✅[^6].
6. **`credentials`.** `same-origin` (default) sends cookies only to the same origin, `include` also cross-origin (the server must answer with its exact origin and `Access-Control-Allow-Credentials: true`), `omit` never ✅[^1] ✅[^5].
7. **`cache`.** `default` uses the HTTP cache normally, `no-store` bypasses it and does not store, `reload` refetches and stores, `no-cache` revalidates, `force-cache` and `only-if-cached` prefer the cache; in the lab `no-store` and `reload` added `Cache-Control: no-cache` to the request ✅[^1] ✅[^5] ✅[^6].
8. **`redirect`.** `follow` (default; `response.redirected` true, `response.url` the final URL), `error` (rejects with `TypeError`), `manual` (an `opaqueredirect` response with status 0, used to detect a redirect) ✅[^1] ✅[^5].
9. **`integrity`.** A Subresource Integrity hash (`sha256-…`); a mismatch rejects with `TypeError` ✅[^1] ✅[^5].
10. **`keepalive`.** Lets a request outlive the page (for analytics on `visibilitychange` or `pagehide`); the body is limited to 64 KiB (a 70 KiB body rejected with `TypeError`) ✅[^1] ✅[^5] ✅[^6].
11. **`XMLHttpRequest`.** `open(method, url, async)` → optional `setRequestHeader`, `responseType` (`''`, `text`, `json`, `arraybuffer`, `blob`, `document`), `timeout` → `send(body)` ✅[^1] ✅[^7]. `readyState` goes 0 → 1 (opened) → 2 (headers) → 3 (loading) → 4 (done) ✅[^1] ✅[^7]. Events: `loadstart`, `progress`, `load` (also for 404: check `status`), `error` (network failure, `status` 0), `timeout`, `abort`, `loadend` ✅[^1] ✅[^7]. With `responseType = 'json'`, reading `responseText` throws `InvalidStateError` ✅[^1]. Forbidden headers such as `Referer` are ignored silently, and repeated `setRequestHeader` values are joined (`"1, 2"`) ✅[^1] ✅[^7]. Synchronous requests (`async` false) block the page and cannot set `responseType` (`InvalidAccessError`) ✅[^1] ✅[^7].
12. **Upload progress.** `xhr.upload` fires `loadstart`, `progress` (with `loaded`, `total`), `load`, `loadend` while the body is sent (512 KiB body: `total` 524288) ✅[^1] ✅[^7]. These count bytes handed to the network, not bytes the server stored ✅[^8].
13. **Resumable upload.** Give the file a stable id (name + size + `lastModified`), ask the server `GET /status` with header `X-File-Id` how many bytes it has, then send `file.slice(start)` with `X-Start-Byte: start`; the server appends only if `start` equals its stored length ✅[^1] ✅[^8]. In the lab a cut connection left the server with 261 471 bytes, more than the client could know from progress events, and the resumed request completed the 614 400-byte file ✅[^1].
14. **WebSocket.** `new WebSocket('wss://…', ['protocols'])` performs an HTTP upgrade; `readyState` 0 connecting → 1 open → 2 closing → 3 closed ✅[^1] ✅[^9]. `protocol` is the subprotocol the server picked, `extensions` the negotiated extensions ✅[^1] ✅[^9]. `send` accepts strings, `Blob`, `ArrayBuffer`; incoming binary arrives as a `Blob` unless `binaryType = 'arraybuffer'` ✅[^1] ✅[^9]. `bufferedAmount` shows queued, unsent bytes for rate limiting; the API has no backpressure ✅[^9] ✅[^10]. `close(code, reason)` accepts 1000 or 3000–4999 from script (`close(1001)` threw `InvalidAccessError`); the `close` event reported `1000`, `"bye"`, `wasClean` true ✅[^1] ✅[^9].
15. **Server-Sent Events.** `new EventSource(url)` keeps one HTTP response open (`Content-Type: text/event-stream`); messages are `data:` lines ending with a blank line (several `data:` lines join with `\n`), `event:` names a type that only `addEventListener(type)` receives, `id:` sets `lastEventId`, `retry:` sets the reconnect delay, lines starting with `:` are comments ✅[^1] ✅[^11]. When the server closes the stream the browser fires `error` with `readyState` 0 and reconnects, sending `Last-Event-ID` (ids continued 4, 5, 6) ✅[^1] ✅[^11]. `close()` sets `readyState` 2 and stops reconnecting; `withCredentials` enables cookies cross-origin ✅[^1] ✅[^11]. Over HTTP/1.1 browsers allow about 6 connections per origin across tabs, which limits SSE ✅[^12].

## Worked example
Upload a file with a progress bar, a cancel button, and resume after failure:

| Step | Action | Lab result ✅[^1] |
|---|---|---|
| 1 | `id = file.name + '-' + file.size + '-' + file.lastModified` | Stable across retries |
| 2 | `start = +(await (await fetch('/upload-status', {headers: {'X-File-Id': id}})).text())` | 0 |
| 3 | XHR `POST /upload` with `X-File-Id`, `X-Start-Byte: 0`, body `file.slice(0)`; `xhr.upload.onprogress` drives the bar | Connection cut: `error` |
| 4 | Ask status again | 261471 |
| 5 | Resend `file.slice(261471)` with `X-Start-Byte: 261471` | `load 200 stored 614400` = `file.size` |
| 6 | Cancel button calls `xhr.abort()` | `abort`, `loadend`, `readyState` 0 |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Setting `Content-Type` for a `FormData` body by hand | Server cannot parse parts | The boundary is missing ✅[^2] |
| Need upload progress with `fetch` | No event exists | Use XHR's `upload.onprogress` ✅[^3] ✅[^7] |
| Large `keepalive` body | `TypeError` | 64 KiB limit ✅[^1] ✅[^6] |
| `no-cors` response | Body unreadable, status 0 | Opaque by design ✅[^1] ✅[^6] |
| SSE message without the trailing blank line | Not dispatched yet | A blank line ends each event ✅[^11] |
| Many SSE tabs over HTTP/1.1 | New connections stall | Per-browser connection limit; use HTTP/2 ✅[^12] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `fetch` | Promises, streams, abort, rich options | No upload progress |
| `XMLHttpRequest` | Upload progress, `timeout`, wide support | Callback API, no streaming body |
| Long polling | Works everywhere | One request per message, latency |
| Server-Sent Events | Simple, auto-reconnect with `Last-Event-ID`, plain HTTP | One-way, text only |
| WebSocket | Two-way, binary, low overhead | Own protocol, manual reconnect, no backpressure |

## Takeaways
- Give every request that can outlive its screen an `AbortSignal` (often `AbortSignal.timeout`). [rule-candidate]
- Use `XMLHttpRequest` (or chunked uploads) when users need upload progress; resume large uploads from the server's count, not the client's.
- Prefer SSE for server-to-client updates and WebSocket only when the client must also stream messages.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 78 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab and its `/big`, `/slow`, `/echo`, `/redirect`, `/upload`, `/sse` and WebSocket endpoints, 2026-11-10. [^1]
- [FormData](https://javascript.info/formdata) — javascript.info, living. Backs: constructing, methods, files and blobs, automatic content type. [^2]
- [Fetch: Download progress](https://javascript.info/fetch-progress) — javascript.info, living. Backs: reading `response.body`, `Content-Length`, no upload progress in `fetch`. [^3]
- [Fetch: Abort](https://javascript.info/fetch-abort) — javascript.info, living. Backs: `AbortController`, one signal for many requests. [^4]
- [Fetch API](https://javascript.info/fetch-api) — javascript.info, living. Backs: `referrer`, `referrerPolicy`, `mode`, `credentials`, `cache`, `redirect`, `integrity`, `keepalive`. [^5]
- [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) — MDN, living. Backs: option values, `no-cors` safelisted headers, 64 KiB `keepalive` limit. [^6]
- [XMLHttpRequest](https://javascript.info/xmlhttprequest) — javascript.info, living. Backs: `open`/`send`, `responseType`, ready states, events, sync requests, headers, upload progress. [^7]
- [Resumable file upload](https://javascript.info/resume-upload) — javascript.info, living. Backs: why upload progress is not enough, `X-File-Id`, `X-Start-Byte`, the algorithm. [^8]
- [WebSocket](https://javascript.info/websocket) — javascript.info, living. Backs: opening, subprotocols, extensions, data types, `bufferedAmount`, close codes, states. [^9]
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) — MDN, living. Backs: no backpressure in the `WebSocket` API. [^10]
- [Server Sent Events](https://javascript.info/server-sent-events) — javascript.info, living. Backs: message format, reconnection, `retry`, `id`, `Last-Event-ID`, event types, `readyState`. [^11]
- [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) — MDN, living. Backs: one-way stream, about 6 connections per browser without HTTP/2. [^12]
- [Fetch Standard](https://fetch.spec.whatwg.org/) — WHATWG, living. Background: request modes, credentials, redirects.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — fetch basics, CORS, `URL`.
- `javascript/browser/binary-data-blobs-and-files.md` — Blob, File and `slice`.
- `javascript/node/node-services-deep-dive.md` — long polling, SSE and WebSocket from the server side.
