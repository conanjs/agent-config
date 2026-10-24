---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node.js >= 15", "TypeScript on Node.js"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [promises, nodejs, linting, errors]
---

# Promise rejections and floating promises

## Summary
**TL;DR:** A floating promise is async work whose result and rejection path are not handled, and Node.js can turn an unhandled rejection into an uncaught exception in the default `throw` mode ✅[^1]
**Use this when:** Use this when enforcing `@typescript-eslint/no-floating-promises`, reviewing fire-and-forget work, or explaining why every promise must be awaited, returned, caught, or supervised ✅[^4]
**Not this doc:** Use `js-runtime/abort-signal.md` for cancellation and deadlines.

## Problem
A promise starts work immediately, but a caller that does not await, return, catch, or deliberately supervise it has no local place to observe failure ✅[^4]
Node.js emits `'unhandledRejection'` when a promise is rejected and no error handler is attached within one turn of the event loop ✅[^1]
Node.js also emits `'rejectionHandled'` when a handler is attached later to a promise that was already reported as unhandled ✅[^1]
Since Node.js 15, the default unhandled-rejection mode changed from `warn` to `throw` ✅[^3]

## Mental model
**Analogy:** A floating promise is a courier sent without a return address: the job may finish, but if it fails, the original caller has no envelope where the failure belongs ✅[^4]
**Artifact:**
```ts
async function handler(): Promise<void> {
  sendEmail(); // floating: rejection is not awaited, returned, or caught
  await saveAuditEvent();
}
```
The lint-safe version makes the ownership explicit by awaiting, returning, catching, or marking supervised work with `void` plus a real rejection handler ✅[^4]

## How it works
1. Promise rejection handling is asynchronous, so Node.js tracks a growing and shrinking set of rejected promises that currently lack handlers ✅[^1]
2. The `'unhandledRejection'` event receives the rejection reason and the promise that was rejected ✅[^1]
3. With `--unhandled-rejections=throw`, Node.js emits `'unhandledRejection'` and raises the rejection as an uncaught exception if no hook is set ✅[^2]
4. The current Node.js process docs describe `throw` or `strict` as the default path that can surface an unhandled rejection as an uncaught exception ✅[^1]
5. `@typescript-eslint/no-floating-promises` reports promise-valued statements that are not awaited, returned, caught with `.catch`, handled with two-argument `.then`, or intentionally voided under its option model ✅[^4]
6. The same rule also reports arrays of promises that are created and not combined through a promise concurrency method such as `Promise.all` or `Promise.allSettled` ✅[^4]
7. `void promise` tells the linter the promise was intentionally not awaited, but the rule documentation warns that `void` does not handle the promise or change runtime behavior ✅[^4]

## Worked example
A request handler starts a write and returns success before the write is known to have completed ✅[^4]
```ts
app.post("/users", async (req, res) => {
  createUser(req.body); // bad: unhandled rejection may crash or be reported globally
  res.status(202).end();
});
```
A safer version either awaits the work or passes it to a supervisor that catches and logs failures ✅[^4]
```ts
app.post("/users", async (req, res) => {
  await createUser(req.body);
  res.status(201).end();
});
```
For true background work, a named supervisor should own the promise and attach a rejection handler before the request returns ✅[^4]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Handler attached one tick late | Node.js can emit `'unhandledRejection'` first and `'rejectionHandled'` later ✅[^1] | Rejection tracking is based on event-loop turns ✅[^1] |
| `void doWork()` | The lint rule can allow the expression when configured that way ✅[^4] | `void` is only an intent marker and does not catch the rejection ✅[^4] |
| `Promise.all(items.map(async ...))` | One combined promise can be awaited or returned ✅[^4] | The array of promises is handled through a concurrency method ✅[^4] |
| Global `'unhandledRejection'` hook | The process can observe otherwise unhandled rejections ✅[^1] | Node.js emits the event with the reason and promise ✅[^1] |
| Default Node.js 15+ behavior | Unhandled rejection default mode is `throw` ✅[^3] | The Node.js 15 release changed the default from `warn` to `throw` ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Await or return every promise | Local sequencing and local error path ✅[^4] | Can serialize work unless combined deliberately |
| `Promise.all` fan-out | Preserves parallelism while keeping one owner ✅[^4] | Fail-fast behavior may need `allSettled` instead |
| Supervised background task | Keeps request latency low | Requires explicit catch, logging, and shutdown policy ✅[^4] |
| Global rejection hook only | Central visibility ✅[^1] | Too late to restore the local operation's intended control flow ✅[^1] |

## Takeaways
- Every promise needs an owner: await it, return it, catch it, or hand it to a supervisor. [rule-candidate]
- Treat `void promise` as a documented exception, not as error handling. [rule-candidate]
- Enable `@typescript-eslint/no-floating-promises` for TypeScript services. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-7 | Source: |

## Verification status
- Verified: 33 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Node.js Process: event 'unhandledRejection'](https://nodejs.org/api/process.html#event-unhandledrejection) — Node.js project, living. Backs: Problem, How it works, Edge cases. [^1]
- [Node.js CLI: --unhandled-rejections=mode](https://nodejs.org/api/cli.html#--unhandled-rejectionsmode) — Node.js project, living. Backs: How it works. [^2]
- [Node.js 15.0.0 release notes](https://nodejs.org/en/blog/release/v15.0.0) — Node.js project, 2020. Backs: Problem, Edge cases. [^3]
- [@typescript-eslint/no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/) — typescript-eslint project, living. Backs: Summary, Mental model, How it works, Worked example, Edge cases, Trade-offs. [^4]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-7.

## Related
- `js-runtime/abort-signal.md` — cancellation ownership for async work.
- `operations/structured-logging.md` — logging rejected background tasks safely.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — legacy Node.js runtime/toolchain context.
