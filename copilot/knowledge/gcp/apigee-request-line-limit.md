---
schema: knowledge-doc/v1
type: concept
topic: gcp
status: verified
applies-to: ["Apigee Edge (apigee.net runtime)", "clients sending lists in GET query strings"]
last-verified: 2026-11-09
last-updated: 2026-11-09
tags: [apigee, http-414, url-length, query-string, request-line, bullmq-retries]
---

# Apigee Edge request-line limit for long query strings

## Summary
**TL;DR:** Apigee Edge rejects a request whose request line (method, path and query string) is longer than 7,168 bytes with HTTP 414 and the fault code `protocol.http.TooBigLine` ✅[^1][^2] A list sent as a `|`-separated query parameter costs every item its length plus 3 bytes, because the separator is percent-encoded as `%7C` ✅[^2] Compute the cut-over from the encoded length, not from an item count.
**Use this when:** a service sends many IDs to an Apigee proxy in a GET query string; a call fails with 414 or `TooBigLine`; someone picks a fixed "max items" threshold for a GET request.

## Problem
A client chooses between two ways of fetching data: send the selected IDs as a query parameter, or, above some item count, fetch everything that matches the filter and narrow the result in memory. If the threshold is an item count chosen without measuring the encoded URL, selections just under the threshold fail with 414 every time. Selections above it trigger the far heavier "fetch everything" call, which can time out upstream. Neither failure is visible in the client's code, which only sees a generic HTTP error.

## Mental model
A paper form with a fixed-width address box: the box holds 7,168 characters no matter how many names you write in it, and every `|` takes three boxes instead of one once it is written as `%7C`.

Concrete artifact, the Apigee fault body returned for a 7,676-byte request line ✅[^2]:

```json
{"fault":{"faultstring":"request line size exceeding 7,168","detail":{"errorcode":"protocol.http.TooBigLine"}}}
```

## How it works
1. The client serializes the query with `URLSearchParams` (or axios `params`), which percent-encodes `|` as `%7C` ✅[^2]
2. The request line is `GET <path>?<encoded query> HTTP/1.1`. Apigee Edge documents "API proxy request URL size" as 7 KB and enforces it ✅[^1]
3. Over the limit, the Apigee router answers 414 before any proxy policy runs, with the fault body above ✅[^2]
4. A job queue that retries every failed job (for example BullMQ `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30000 } }`) repeats the doomed request: 3 immediate 414s plus 30 s + 60 s of backoff, about 90 s before the caller sees the error ✅[^2]

## Worked example
12-character IDs, separator `|`, plus 179 bytes for the method, path, other filter parameters and `HTTP/1.1` (measured 2026-11-06 ✅[^2]):

| Items | Encoded request line | Result |
|---|---|---|
| 250 | 3,926 bytes | OK |
| 400 | 6,176 bytes | OK |
| 466 | 7,166 bytes | OK, the largest that fits |
| 500 | 7,676 bytes | 414 `TooBigLine` |

`n` items take 12 bytes each plus 3 bytes for each of the `n − 1` separators (`%7C`), so the line is `15n − 3 + 179` bytes; every row of the table fits this, and `15n + 176 ≤ 7,168` gives at most 466 items. Longer filter values lower that number.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Threshold set as "more than 500 items → fetch all" | 467–500 items always fail with 414; 501+ switch to the heavy call | The threshold ignores encoding and the other parameters ✅[^2] |
| Longer filter values (user IDs, dates, extra filters) | The safe item count drops | They share the same 7,168-byte request line ✅[^1] |
| A second service with more filter parameters in the same request (measured 2026-11-09) | 446 IDs fitted and 454 failed with 414, against 466 / 467 in the first service; fetching everything for a filter of 1,495 records succeeded, while 3,059 records ended in a 502 from the CDN on all 3 attempts (about 85–115 s each, HTTP 500 to the caller after 250–262 s) ✅[^2] | More parameters leave fewer bytes for the list; the "fetch everything" path fails on the filter size, whatever the number selected |
| Failing call inside a retried queue job | The error appears only after all attempts and backoffs | Each attempt fails the same way; retries add delay, not success ✅[^2] |
| "Fetch everything, filter in memory" for large filters | Can exceed the upstream's response time: 3 attempts each ended in a 502 from the CDN in front of the gateway after 46–65 s with about 9,600 matching records ✅[^2] | The response size follows the filter, not the selection |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Threshold from the encoded length | Uses the list path as long as it fits | Must be recomputed if parameters change |
| POST the list in a body | No URL limit | Needs a backend endpoint that accepts a body |
| Split the list into several GETs under the limit | Works with the existing endpoint | More calls; results must be merged |
| Fetch everything and filter | One call | Cost follows the filter size; can time out |

## Takeaways
- Derive "how many items fit in a GET" from the encoded request-line length (7,168 bytes on Apigee Edge), not from a round item count. [rule-candidate]
- Do not retry 4xx responses such as 414 in job queues; they fail identically on every attempt. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-09

## References
- [Apigee Edge product limits](https://docs.apigee.com/api-platform/reference/limits) — Google, living. Backs: Summary, How it works §2, Edge cases ("API proxy request URL size: 7 KB", enforced; "Request Line Limit 7K"). [^1]
- Local measurements, 2026-11-06 and 2026-11-09 — two NestJS services calling an Apigee Edge proxy through a CDN, axios with `params`, BullMQ 5.80.9 with `attempts: 3` / exponential backoff 30 s; request-line lengths computed with `URLSearchParams` on real 12-character IDs; fault body and timings read from the service's logs. Backs: Summary, Mental model, How it works §1, §3–4, Worked example, Edge cases. [^2]
- [Apigee: Limits (Apigee X and hybrid)](https://cloud.google.com/apigee/docs/api-platform/reference/limits) — Google, living. Lists "API proxy request URL size" for the newer Apigee products; check it when not on Edge.

## Related
- `js-runtime/worker-thread-pools.md` — the same service's PDF rendering and BullMQ retry behaviour.
- `error-handling/` — which errors are worth retrying.
