---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node.js >= 18", "Web APIs", "TypeScript on Node.js"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [cancellation, abortsignal, fetch, timeouts]
---

# AbortSignal cancellation

## Summary
**TL;DR:** `AbortController` owns cancellation, and `AbortSignal` is the read-only signal passed to async APIs that should stop when the caller no longer wants the work ✅[^1]
**Use this when:** Use this when adding timeouts, request cancellation, fetch calls, or your own APIs that should stop downstream work ✅[^1]
**Not this doc:** Use `js-runtime/promise-rejections.md` for rejected promise ownership.

## Problem
Async code often outlives the request, CLI command, or parent operation that started it ✅[^1]
Without a propagated cancellation signal, outbound I/O and child operations can keep running after the caller has timed out or disconnected ✅[^1]
Cancellation only works across layers when every layer accepts the same kind of token and passes it onward ✅[^2]

## Mental model
**Analogy:** An `AbortSignal` is a red flag on a job site: the site manager owns the flag pole, and every worker watches the same flag so they can stop together ✅[^1]
**Artifact:**
```ts
async function loadUser(id: string, signal: AbortSignal): Promise<User> {
  signal.throwIfAborted();
  const res = await fetch(`https://api.example/users/${id}`, { signal });
  return res.json() as Promise<User>;
}
```
The API accepts a signal from its caller and passes that exact cancellation channel to `fetch` ✅[^1]

## How it works
1. `AbortController.abort(reason)` triggers its associated signal and causes the signal to emit one `'abort'` event ✅[^1]
2. `AbortSignal.aborted` becomes true after abort, and `AbortSignal.reason` exposes the reason supplied by the controller ✅[^1]
3. `AbortSignal.throwIfAborted()` throws the signal's reason when the signal is already aborted ✅[^1]
4. `AbortSignal.timeout(delay)` returns a signal that aborts after the given number of milliseconds ✅[^1]
5. `AbortSignal.any(signals)` returns a composed signal that aborts when any input signal aborts and keeps the triggering reason ✅[^1]
6. The DOM Standard defines `AbortSignal` as an `EventTarget` interface with `aborted`, `reason`, `throwIfAborted`, `abort`, `timeout`, and `any` members ✅[^2]
7. Node.js exposes `fetch` as a browser-compatible global and lists `AbortSignal` among global objects ✅[^1]
8. Node.js recommends `{ once: true }` for abort listeners so listeners are removed when the abort event is handled ✅[^1]

## Worked example
A request handler combines caller cancellation with a five-second deadline ✅[^1]
```ts
async function handler(req: Request): Promise<Response> {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]);
  const profile = await loadUser("u123", signal);
  return Response.json(profile);
}
```
If the client disconnects or the timeout fires, the composed signal aborts and downstream `fetch` receives the same cancellation signal ✅[^1]
If `loadUser` registers its own cleanup listener, it should use `{ once: true }` or remove the listener after cleanup ✅[^1]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Signal already aborted before work starts | `throwIfAborted()` throws immediately ✅[^1] | The signal carries an aborted state and reason ✅[^1] |
| Multiple cancellation sources | `AbortSignal.any` aborts when the first input signal aborts ✅[^1] | The composed signal uses the causing signal's reason ✅[^1] |
| Timer-only deadline | `AbortSignal.timeout(ms)` creates a self-aborting signal ✅[^1] | Node.js schedules abort after the delay ✅[^1] |
| Long-lived event listener | Listener can leak if it stays attached forever ✅[^1] | Node.js recommends `{ once: true }` for abort listeners ✅[^1] |
| API ignores the signal | Caller cancellation does not stop that layer | Cancellation requires observers to receive and honor the signal ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Require `signal` in infrastructure calls | Consistent cancellation propagation ✅[^1] | More parameters to pass through APIs |
| Optional `signal?: AbortSignal` in libraries | Easier adoption | Callers may forget to pass cancellation |
| `AbortSignal.timeout` | Simple deadline expression ✅[^1] | Deadline policy must still be chosen by the caller |
| `AbortSignal.any` | Combines user cancellation and timeout ✅[^1] | Requires preserving reason handling in tests |

## Takeaways
- Accept `AbortSignal` at async boundaries and pass it to outbound I/O. [rule-candidate]
- Compose timeouts with caller cancellation instead of replacing caller signals. [rule-candidate]
- Clean up abort listeners with `{ once: true }` or explicit removal. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-8 | Source: |

## Verification status
- Verified: 30 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Node.js Globals: AbortController and AbortSignal](https://nodejs.org/api/globals.html#class-abortsignal) — Node.js project, living. Backs: Summary, Problem, Mental model, How it works, Worked example, Edge cases, Trade-offs. [^1]
- [DOM Standard: AbortSignal](https://dom.spec.whatwg.org/#interface-abortsignal) — WHATWG, living. Backs: Problem, How it works, Edge cases. [^2]
- [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) — MDN Web Docs, living. Backs: broader API context. [^3]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-8.

## Related
- `js-runtime/promise-rejections.md` — promise ownership after cancellation rejects work.
- `operations/structured-logging.md` — logging cancellations with stable fields.
- `web-apis/http-error-mapping.md` — mapping timeout and cancellation errors at the interface layer.
