---
schema: knowledge-doc/v1
type: concept
topic: performance/fundamentals
status: verified
applies-to: ["any request/response system"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, latency, percentiles, p99, tail-latency, fan-out, slo, mean]
---

# Latency, percentiles and tail latency

## Summary
**TL;DR:** Latency is a distribution, not a number. The **mean** hides the slow requests users notice; **percentiles** (p50, p99, p99.9) describe them: p99 = 99% of requests were faster. Tails get worse with **fan-out**: when one user request waits for N backend calls, the chance it hits at least one backend's slow 1% is 1 − 0.99ᴺ — 10% for N = 10, 63% for N = 100. A simulated service with a 20 ms median had a 24 ms mean, an 81 ms p99 and a 257 ms max.
**Use this when:** you define SLOs, read dashboards, compare performance changes, or design systems that call many services per request.
**Not this doc:** why latency rises with load → `fundamentals/queueing-and-littles-law.md`.

## Problem
Dashboards that show only averages look healthy while a meaningful share of users waits seconds. Systems that fan out to many backends turn each backend's rare slow response into a common slow page. Teams then optimize the median, which users barely notice.

## Mental model
**Analogy:** a dinner party waiting for every guest before the meal starts. Each guest is almost always on time, but with 100 guests someone is almost certainly late, so dinner is almost always late. The meal's start time is set by the slowest guest — the tail.

**Artifact:** one simulated latency distribution (lognormal, 100 000 requests; lab, Python 3.12.13, 2026-11-04) ✅[^3]:
```text
mean 24.0 ms  p50 20.0  p90 43.2  p99 80.9  p99.9 128.6  max 257.4
```

## How it works
1. **Percentile:** sort all latencies; pXX is the value below which XX% of observations fall. Service level indicators are often expressed as percentiles over a measurement window ✅[^1].
2. **Why not the mean:** a long right tail pulls the mean above the median (24.0 vs 20.0 ms above) and the mean says nothing about how bad the worst 1% is ✅[^3].
3. **Fan-out amplification:** a user request that waits for all of N independent backends is slow if **any** backend is slow. With each backend slower than its own p99 1% of the time, P(user request slow) = 1 − 0.99ᴺ ✅[^3].
4. **At scale, tails dominate:** Dean and Barroso describe how temporary high-latency episodes that are rare per component come to dominate overall service performance in large fan-out systems ✅[^2].

## Worked example
Simulated fan-out: each user request waits for the slowest of N backends drawn from the distribution above (20 000 trials each) ✅[^3]:

| N backends | Share of user requests slower than one backend's p99 | Formula 1 − 0.99ᴺ |
|---|---|---|
| 1 | 1.1% | 1.0% |
| 10 | 10.0% | 9.6% |
| 100 | 63.7% | 63.4% |

At N = 100, the backend's p99 has become the user's median experience. Mitigations named in the tail-at-scale literature include sending a backup ("hedged") request after a delay and reducing per-component variability ✅[^2].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Averaging percentiles across servers | Wrong number | Percentiles do not average; merge the raw distributions or histograms |
| Few samples | p99.9 is noise | Needs ≥ 1 000 samples for one observation above it |
| Measuring only successful requests | Fast errors hide slow successes, or vice versa | Track error and success latency separately |
| Client vs server measurement | Client sees queueing and network the server never measures | SLIs measured at the client are often closer to user experience ✅[^1] |

## Takeaways
- Track p50, p99 and p99.9 (and max) instead of the mean, and set SLOs on percentiles. [rule-candidate]
- For fan-out designs, budget each backend's tail, not its median.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Service Level Objectives (Site Reliability Engineering book)](https://sre.google/sre-book/service-level-objectives/) — Google, 2016. Backs: SLIs aggregated as rates, averages or percentiles over a window; client-side latency as a closer measure. [^1]
- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) — Jeffrey Dean, Luiz André Barroso, Communications of the ACM 56 (2013). Backs: rare per-component latency episodes dominate at scale; tail-tolerant techniques. [^2]
- `linux/lab-setup.md` — the lab where the latency distribution and fan-out simulation ran on 2026-11-04 (Python 3.12.13). [^3]

## Related
- `performance/fundamentals/queueing-and-littles-law.md` — latency growth under load.
- `kubernetes/operations/autoscaling.md` — scaling on load.
