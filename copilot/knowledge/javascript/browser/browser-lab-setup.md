---
schema: knowledge-doc/v1
type: how-to
topic: javascript/browser
status: verified
applies-to: ["Node.js 24", "Chrome 152 (the Claude desktop app's built-in browser)", "any Chromium-based browser"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, lab, chrome, localhost, cross-origin, websocket, server-sent-events, testing]
---

# Run a two-origin browser lab on localhost

## Summary
**TL;DR:** One dependency-free Node 24 file serves a test page plus the endpoints that browser APIs need to be observed honestly: a slow response (abort), a large response with `Content-Length` (download progress), an echo of request headers (fetch options, cookies, referrer), a redirect, framing-blocked pages (clickjacking defences), a resumable-upload pair, a Server-Sent Events stream and a minimal WebSocket echo. Because `localhost:8765` and `127.0.0.1:8765` are **different origins** for the browser, the same server also acts as a cross-origin site. Every lab result in the `javascript/browser/` docs dated 2026-11-10 came from this setup.
**Use this when:** you want to reproduce a browser behaviour claimed in these docs, or check one in a newer browser version.
**Not this doc:** the Linux and Node lab used for language behaviour → `linux/lab-setup.md`.

## Goal & prerequisites
**End state:** a page at `http://localhost:8765/lab.html` whose JavaScript console can reach every endpoint below, and a second origin at `http://127.0.0.1:8765`.

**Needs:** Node.js 24 (`node -v` prints `v24.x`), a Chromium-based browser, and a free TCP port 8765. No packages are installed.

**Why two host names make two origins:** an origin is the triple scheme + host + port, compared as strings, so `localhost` and `127.0.0.1` differ even though they reach the same server ✅[^2]. Analogy: two doors with different house numbers that open into the same room; the browser's guard checks the number on the door, not the room.

## Steps
1. **Create a folder** `lab/` and save this as `lab/server.mjs`:
   ```js
   import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
   const dir = path.dirname(new URL(import.meta.url).pathname), uploads = new Map();
   const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
   const sleep = ms => new Promise(r => setTimeout(r, ms));
   const server = http.createServer(async (req, res) => {
     const url = new URL(req.url, `http://${req.headers.host}`), p = url.pathname;
     if (p === '/big') { res.writeHead(200, { 'Content-Length': 1 << 20 });            // 1 MiB in 16 chunks
       for (let i = 0; i < 16; i++) { res.write(Buffer.alloc(65536, 97)); await sleep(30); } return res.end(); }
     if (p === '/slow') { await sleep(3000); return res.end('slow'); }
     if (p === '/echo') { const c = []; for await (const x of req) c.push(x); const body = Buffer.concat(c);
       res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true' });
       return res.end(JSON.stringify({ method: req.method, headers: req.headers, bodyLength: body.length, body: body.toString('latin1').slice(0, 2000) })); }
     if (p === '/redirect') { res.writeHead(302, { Location: '/echo' }); return res.end(); }
     if (p === '/xfo-deny') { res.writeHead(200, { 'Content-Type': 'text/html', 'X-Frame-Options': 'DENY' }); return res.end('<p id=x>framed?</p>'); }
     if (p === '/csp-none') { res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "frame-ancestors 'none'" }); return res.end('<p id=x>framed?</p>'); }
     if (p === '/upload-status') return res.end(String(uploads.get(req.headers['x-file-id'])?.length || 0));
     if (p === '/upload') { const id = req.headers['x-file-id'], start = +req.headers['x-start-byte'], cut = +(url.searchParams.get('cutAfter') || Infinity);
       let got = uploads.get(id) || Buffer.alloc(0);
       if (start !== got.length) { res.writeHead(400); return res.end(`bad start ${start}, have ${got.length}`); }
       for await (const c of req) { got = Buffer.concat([got, c]); uploads.set(id, got); if (got.length - start >= cut) return req.destroy(); }
       return res.end(`stored ${got.length}`); }
     if (p === '/sse') { const last = +(req.headers['last-event-id'] || 0);                // 3 events, then the server hangs up
       res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
       res.write(`retry: 500\n\nid: ${last + 1}\ndata: line one\ndata: line two\n\n`);
       res.write(`event: tick\nid: ${last + 2}\ndata: {"n":${last + 2}}\n\n: a comment\nid: ${last + 3}\ndata: third\n\n`);
       return setTimeout(() => res.end(), 100); }
     const file = path.join(dir, p === '/' ? 'lab.html' : p);
     if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
     res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store',
       ...(url.searchParams.has('cors') ? { 'Access-Control-Allow-Origin': '*' } : {}) });
     fs.createReadStream(file).pipe(res);
   });
   server.on('upgrade', (req, socket) => {                                                  // WebSocket echo, frames ≤ 125 bytes
     const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
     const proto = req.headers['sec-websocket-protocol']?.split(',')[0].trim();
     socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, ...(proto ? [`Sec-WebSocket-Protocol: ${proto}`] : []), '', ''].join('\r\n'));
     socket.on('data', b => { const op = b[0] & 15, len = b[1] & 127, mask = b.subarray(2, 6);
       const data = Buffer.from(b.subarray(6, 6 + len)).map((x, i) => x ^ mask[i % 4]);
       if (op === 8) return socket.end(Buffer.concat([Buffer.from([0x88, data.length]), data]));
       const reply = Buffer.from('echo:' + data); socket.write(Buffer.concat([Buffer.from([0x80 | op, reply.length]), reply])); });
     socket.on('error', () => {});
   });
   server.listen(8765, () => console.log('lab listening on port 8765'));
   ```
2. **Save a test page** as `lab/lab.html`. The docs used one `<div id="box">` styled `width: 300px; height: 200px; border: 25px solid; padding: 20px; overflow: auto` with a 600 px tall child, a `div#outer` containing `div#inner` containing `b#deep`, a form `name="f"` (text input `login`, a `textarea`, a `select` with options `a`/`b`, two radios, a submit button `#go`), a paragraph `<p id="para">Hello <b>bold</b> world</p>`, a `div#anim` with `transition: width 200ms linear`, a comment node and a `<template>` holding a `<script>`.
3. **Add helper files:** `lab/child.html` (sets `window.childValue = 42` and answers every `message` event by posting `{echo, origin, from}` back to `e.source`) and `lab/throw.js` containing `noSuchFunction();`.
4. **Start the server:** `node lab/server.mjs`.
5. **Open** `http://localhost:8765/lab.html` and run checks in the DevTools console (or through the automation of the desktop app's browser pane). Use `http://127.0.0.1:8765/...` URLs whenever a check needs a second origin.
6. **For real input** (mouse order, focus, pointer capture), use real clicks, key presses and drags, not `element.click()` or `dispatchEvent`, because script-made events differ (`isTrusted` false, microtask timing; see `browser-platform-deep-dive.md` §4.4).

## Verify
| Check (console on `localhost:8765`) | Expected |
|---|---|
| `(await fetch('/echo')).status` | `200` ✅[^1] |
| `(await fetch('http://127.0.0.1:8765/echo')).json().then(j => j.headers.origin)` | `"http://localhost:8765"` (a cross-origin request carries `Origin`) ✅[^1] |
| `new WebSocket('ws://localhost:8765/ws').onopen = () => console.log('open')` | logs `open` ✅[^1] |
| `navigator.userAgent.match(/Chrome\/[\d.]+/)[0]` | the version to record, e.g. `Chrome/152.0.7977.167` ✅[^1] |

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `innerWidth` is `0` and geometry reads `0` | The browser pane or window is hidden, so the viewport has no size | Show the window, or emulate a viewport size before measuring ✅[^1] |
| `requestAnimationFrame` fires about once per second | The page is not on screen; browsers pause or throttle rAF in background tabs ✅[^3] | Keep the page visible for timing checks |
| Typed text produces `input` but no `keydown` | The automation inserts text directly instead of pressing keys | Press individual keys for keyboard-event checks ✅[^1] |
| `window.open` results differ from a normal browser | Embedded browsers may handle new windows their own way | Check popup behaviour in a stand-alone browser |
| `EADDRINUSE` on start | Port 8765 is taken | Change the port in `server.listen` and in the URLs |

## Rollback
Stop the server with Ctrl+C and delete the `lab/` folder; nothing is installed or cached outside it (responses use `Cache-Control: no-store`).

## Takeaways
- Use `localhost` and `127.0.0.1` on one port as two origins; no second server or DNS change is needed.
- Measure input-driven behaviour with real input; record the browser version with every result.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- This lab, run 2026-11-10: Chrome 152.0.7977.167 in the Claude desktop app's built-in browser, Node.js 24.22.1, a longer version of the server above with the same endpoints and responses. [^1]
- [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) — MDN, living. Backs: origin = scheme, host and port. [^2]
- [Window: requestAnimationFrame() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — MDN, living. Backs: rAF paused in background tabs. [^3]
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455) — IETF, 2011. Background: the `Sec-WebSocket-Accept` GUID and frame layout used by the echo server.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — the earlier Chrome lab (DOM, events, fetch, storage).
- `linux/lab-setup.md` — the Node and Linux lab for language behaviour.
