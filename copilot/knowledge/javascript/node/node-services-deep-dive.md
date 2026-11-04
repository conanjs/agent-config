---
schema: deep-dive/v1
topic: javascript/node
status: verified
applies-to: ["Node.js 24 (node:http, fetch, libuv thread pool)", "services deployed in containers or Kubernetes"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, nodejs, http-server, microservices, timeouts, graceful-shutdown, health-checks, long-polling, libuv, thread-pool, event-loop, configuration, fetch, abort-signal]
---

# Building services with Node.js, end to end

## Summary
**TL;DR:** A Node.js service is one JavaScript thread running an event loop, plus a small **libuv thread pool** (4 threads by default) for file system, DNS, crypto and compression work. That shape decides almost everything: I/O-bound HTTP services scale well; any CPU work on the main thread delays *every* request (a 200 ms loop delayed a health check by exactly 200 ms); and more than four concurrent pool jobs queue up. A production-ready service adds the same handful of mechanisms whatever the framework: routing, bounded and validated request bodies, explicit client and server **timeouts**, health endpoints, configuration from the environment, structured errors, and **graceful shutdown** that finishes in-flight requests and refuses new ones.
**Use this when:** you build or review an HTTP service or microservice in Node, tune timeouts or the thread pool, implement shutdown for containers, or choose between polling, long polling and push; or read full-stack/microservices-with-JavaScript books and want a verified companion built on open sources.
**Depth:** the runtime model (event loop, thread pool) measured; a framework-free JSON service — routing, body limits, invalid JSON, 404s; server timeout defaults; client timeouts with `AbortSignal`; long polling (Eloquent JavaScript's skill-sharing design); configuration with `--env-file`; graceful shutdown measured; CPU work and the event loop; microservice concerns (boundaries, sync versus async calls, idempotency, retries); a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1 in a container limited to 8 CPUs on an Apple M2 host.

## 1. The runtime model

| Part | Runs | Examples |
|---|---|---|
| Main thread + event loop | Your JavaScript, one callback at a time | Request handlers, JSON parsing, business logic |
| OS async I/O (epoll/kqueue) | In the kernel | Network sockets |
| libuv thread pool (default **4** threads, `UV_THREADPOOL_SIZE`) | Background threads | `fs`, `dns.lookup`, `crypto.pbkdf2`/`scrypt`, `zlib` |
| Worker threads | Separate JS threads you create | CPU-heavy work (`js-runtime/worker-thread-pools.md`) |

✅[^1] ✅[^3]

**Thread pool, measured** (CPU-heavy `pbkdf2` jobs after warm-up) ✅[^2]:

| Concurrent jobs | Default pool (ms) | Pool 8 (ms) | Pool 16 (ms) |
|---|---|---|---|
| 1 | 18 | 18 | 18 |
| 4 | 21 | 19 | 19 |
| 8 | 38 | 36 | 46 |
| 16 | 78 | 71 | 67 |

With the default pool, 4 jobs take as long as 1 and 8 take twice as long — four at a time, as documented ✅[^3]. Raising the pool to 8 or 16 barely helped on this host (its fast cores were already busy), so size the pool to measured CPU capacity, not to load.

**Blocking the loop:** while the main thread spun for 200 ms, a `/healthz` request issued just before took 200 ms ✅[^2]. Long synchronous work — big `JSON.parse`, regexes with catastrophic backtracking, sorting large arrays — stalls everything ✅[^1].

## 2. A minimal JSON service, verified

Built on `node:http` only, so every mechanism is visible ✅[^2]:

| Concern | Implementation | Lab |
|---|---|---|
| Routing | `new URL(req.url, base).pathname` + method checks | `/healthz` → 200 `{ok:true}`; unknown → 404 |
| Body size limit | Count bytes while iterating `for await (const chunk of req)`; over 1 KiB → 413 and destroy the request | 5000-byte body → 413 |
| Body validation | `JSON.parse` in `try`; failure → 400 | `'{'` → 400 `invalid JSON` |
| Happy path | Echo parsed JSON | `{"a":1}` → 200 |

Frameworks (Express, Fastify) package the same steps as middleware (`javascript/misc/design-patterns-deep-dive.md`) ✅[^4].

## 3. Timeouts

**Server-side defaults** on a fresh `http.Server` ✅[^2] ✅[^5]:

| Setting | Default | Meaning |
|---|---|---|
| `requestTimeout` | 300 000 ms | Time to receive the whole request |
| `headersTimeout` | 60 000 ms | Time to receive the headers |
| `keepAliveTimeout` | 5 000 ms | Idle time before closing a kept-alive socket |
| `timeout` | 0 (none) | Socket inactivity timeout |

Behind a load balancer, keep `keepAliveTimeout` **longer** than the balancer's idle timeout, or the balancer may reuse a socket Node is closing (intermittent 502s) ✅[^12].

**Client-side:** every outgoing call needs a deadline. `fetch(url, { signal: AbortSignal.timeout(100) })` against a 300 ms endpoint rejected with `TimeoutError` ✅[^2] ✅[^6]. Cancellation design: `js-runtime/abort-signal.md`.

## 4. Real-time updates: polling, long polling, push

Eloquent JavaScript's skill-sharing project uses **long polling**: the client asks "anything newer than version *v*?"; the server answers at once if so, otherwise holds the request until data changes or a timeout, then answers 304 ✅[^7]. Lab: a poll for `since=0` was answered with `{version: 1}` as soon as `/bump` changed the data; a poll with no change ended with 304 after the 1 s hold ✅[^2].

| Approach | Latency | Cost |
|---|---|---|
| Short polling | Up to the poll interval | Many empty requests |
| Long polling | Near-immediate | One open request per client; works over plain HTTP |
| Server-Sent Events / WebSockets | Immediate | Persistent connection; extra infrastructure |

## 5. Configuration

The twelve-factor rule: keep configuration in environment variables, not in code ✅[^8]. Node 24 loads a dotenv-style file natively: `node --env-file=.env app.mjs` exposed `APP_PORT=8080` and `GREETING="hello env"` as `process.env` values ✅[^2]. Validate configuration at startup and fail fast.

## 6. Graceful shutdown

Orchestrators send `SIGTERM`, wait a grace period (Kubernetes: 30 s by default), then kill ✅[^9] ✅[^10]. The service should stop accepting work, finish what is in flight, then exit ✅[^8].

Lab sequence ✅[^2]:

| Step | Action | Result |
|---|---|---|
| 1 | Start a 300 ms request | In flight |
| 2 | `server.close()` + `server.closeIdleConnections()` | Listening socket closed; idle keep-alive sockets dropped |
| 3 | New request | `ECONNREFUSED` |
| 4 | Wait for step 1 | Completed with 200 `{done:'slow'}` |
| 5 | `close` callback fires | Safe to close databases and exit |

In production, wire this to `process.on('SIGTERM', …)`, fail the readiness probe first so traffic drains, and add a hard timeout below the grace period ✅[^10].

## 7. Microservice concerns

| Concern | Guidance | Source |
|---|---|---|
| Boundaries | Split by business capability or bounded context, each service owning its data | ✅[^11] (`software-design/ddd/`) |
| Synchronous calls | Timeouts on every call, limited retries with backoff and jitter, circuit breakers | ✅[^11] |
| Asynchronous messaging | Queues/events decouple availability; consumers must be idempotent | ✅[^11] |
| Idempotency | Retries can repeat a request: use idempotency keys for writes | ✅[^11] |
| Observability | Structured logs, metrics, traces with correlation IDs | `operations/structured-logging.md` |
| Health | Separate liveness (process alive) from readiness (can serve) | ✅[^10] |
| Unhandled rejections | Crash the process by default in Node 24 — handle every promise | `js-runtime/promise-rejections.md` |

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| All requests slow while one endpoint computes | CPU work on the main thread | Worker threads, chunking, or another service |
| Crypto/zlib/fs calls queue up under load | Thread pool of 4 | Measure; raise `UV_THREADPOOL_SIZE` within CPU capacity |
| Intermittent 502s behind a load balancer | `keepAliveTimeout` shorter than the balancer's idle timeout | Raise it above the balancer's value |
| Requests hang forever on a slow dependency | No client timeout | `AbortSignal.timeout` on every call |
| Memory spikes on large uploads | Unbounded body buffering | Byte limit (413) and streaming |
| Deploys drop requests | No graceful shutdown | `SIGTERM` handler: close server, drain, then exit |
| Duplicate orders after retries | Non-idempotent writes | Idempotency keys |

## 9. How this deep dive was built
- **Sources:** Node.js documentation and guides (event loop, thread pool, `http`, `--env-file`), MDN (`AbortSignal`), Eloquent JavaScript ch. 20–21 (Node.js, the skill-sharing long-polling project), The Twelve-Factor App, Kubernetes documentation, microservices.io. It covers the subjects of full-stack and microservices-with-JavaScript books from these open sources only.
- **Verified:** `node:24.22.1-alpine` with `--cpus=8` on 2026-11-04 (lab files `svc/svc.mjs`, `svc/tp2.mjs`).

## References
- [Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) — Node.js project, living. Backs: event loop vs worker pool, which APIs use the pool, blocking risks. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] result was produced on 2026-11-04. [^2]
- [Command-line API: UV_THREADPOOL_SIZE](https://nodejs.org/api/cli.html#uv_threadpool_sizesize) — Node.js documentation, v24. Backs: thread-pool size variable, default 4. [^3]
- [Eloquent JavaScript, ch. 20 "Node.js"](https://eloquentjavascript.net/20_node.html) — Marijn Haverbeke, 4th ed. Backs: HTTP servers and request streams in Node. [^4]
- [HTTP](https://nodejs.org/api/http.html) — Node.js documentation, v24. Backs: `requestTimeout`, `headersTimeout`, `keepAliveTimeout` defaults, `closeIdleConnections`. [^5]
- [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — MDN, living. Backs: deadline signals and `TimeoutError`. [^6]
- [Eloquent JavaScript, ch. 21 "Project: Skill-Sharing Website"](https://eloquentjavascript.net/21_skillsharing.html) — Marijn Haverbeke, 4th ed. Backs: long polling with versions and 304 timeouts. [^7]
- [The Twelve-Factor App](https://12factor.net/) — Adam Wiggins, living. Backs: config in environment variables; disposability and graceful `SIGTERM` shutdown. [^8]
- [Pod lifecycle: termination of Pods](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) — Kubernetes documentation, living. Backs: `SIGTERM`, grace period (default 30 s). [^9]
- [Container lifecycle hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/) — Kubernetes documentation, living. Backs: grace period countdown, preStop; drain before exit. [^10]
- [Microservice architecture patterns](https://microservices.io/patterns/) — Chris Richardson, microservices.io, living. Backs: decomposition, sync/async communication, circuit breaker, idempotent consumers. [^11]
- [Application Load Balancer attributes: connection idle timeout](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html) — AWS documentation, living. Backs: set the application's idle (keep-alive) timeout larger than the load balancer's. [^12]

## Related
- `javascript/node/data-wrangling-deep-dive.md`
- `js-runtime/worker-thread-pools.md`
- `kubernetes/` — probes, rollouts, termination.
- `operations/structured-logging.md`
