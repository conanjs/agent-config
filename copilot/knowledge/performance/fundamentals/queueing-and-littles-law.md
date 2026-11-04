---
schema: knowledge-doc/v1
type: concept
topic: performance/fundamentals
status: verified
applies-to: ["any system with queues: servers, thread pools, connection pools, message queues"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, queueing, littles-law, utilization, capacity-planning, latency, throughput]
---

# Queueing and Little's law: why latency explodes near full utilization

## Summary
**TL;DR:** **Little's law** says that, in a stable system, the average number of items inside (L) equals the arrival rate (λ) times the average time each spends inside (W): **L = λ·W**. It holds for almost any queueing system and turns throughput and latency into a concurrency number. Queueing theory adds the uncomfortable part: response time grows non-linearly with utilization. In a simulated single server with 10 ms service time, mean response was 20 ms at 50% busy, 50 ms at 80%, 100 ms at 90% and 209 ms at 95%.
**Use this when:** you size thread pools, connection pools or replicas, pick a target utilization, or explain why a server at 90% CPU is slow although it "has headroom".
**Not this doc:** how percentiles describe latency → `fundamentals/latency-percentiles-and-tail.md`.

## Problem
Capacity plans that run servers at 90–95% utilization "to save money" deliver terrible latency; pools sized by guesswork either starve or waste memory. Both are predictable with Little's law and basic queueing.

## Mental model
**Analogy:** a coffee shop. If 2 customers arrive per minute (λ) and each spends 5 minutes inside (W), there are on average 10 people in the shop (L). As the barista gets busier, customers do not just wait a bit longer — the queue grows sharply, because any short burst of arrivals has no idle time to absorb it.

**Artifact:** single-server queue simulation (Poisson arrivals, exponential 10 ms service, 200 000 requests; lab, Python 3.12.13, 2026-11-04) ✅[^2]:
```text
utilization  50%: mean response   20.2 ms (theory 1/(mu-lam) =   20.0)  p99   94.7 ms
utilization  70%: mean response   33.3 ms (theory 1/(mu-lam) =   33.3)  p99  152.6 ms
utilization  80%: mean response   49.9 ms (theory 1/(mu-lam) =   50.0)  p99  231.0 ms
utilization  90%: mean response  100.1 ms (theory 1/(mu-lam) =  100.0)  p99  463.5 ms
utilization  95%: mean response  208.7 ms (theory 1/(mu-lam) =  200.0)  p99  792.2 ms
```

## How it works
**Little's law** ✅[^1]:
1. L = λ·W, where L = average number in the system, λ = average arrival rate, W = average time in the system.
2. It needs only a system observed long enough; it holds independent of queue discipline (FIFO, LIFO, random, priority) and does not require a stationary arrival process.
3. Lab check with an independent time-weighted count of requests in the system ✅[^2]:

| Utilization | L from event sweep | λ × mean W |
|---|---|---|
| 50% | 1.00 | 1.00 |
| 80% | 3.91 | 3.91 |
| 90% | 9.70 | 9.70 |

**Utilization and response time:** for a single server with random (Poisson) arrivals and exponential service — the M/M/1 model — mean response time is 1/(μ − λ), where μ = service rate. As λ approaches μ, the denominator goes to zero and response time grows without bound. The simulation matched the formula within 1% up to 90% and 4% at 95% ✅[^2].

## Worked example
Sizing a database connection pool. Each request holds a connection for 40 ms (W), and peak traffic is 500 requests/s (λ):

| Step | Calculation | Result |
|---|---|---|
| Average connections in use | L = λ·W = 500 × 0.040 | 20 |
| Headroom for bursts | Target ≤ 70–80% busy | ≈ 25–30 connections |
| Check the database side | 30 connections × instances | Must fit the database's max connections |

If W rises to 200 ms because the database slows down, L becomes 100: the pool saturates, requests queue, and latency compounds — the queueing curve above.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Arrival rate > service rate | Queue grows forever | No steady state; Little's law needs stability ✅[^1] |
| Utilization 90% → 95% | Mean response doubles (100 → 209 ms) | 1/(μ − λ) ✅[^2] |
| p99 vs mean | p99 is ~4–5× the mean at every load here | Exponential tails ✅[^2] |
| Many servers sharing one queue | Better than one queue per server at the same total load | Lab: 2 servers at 85% load — random split: mean 69.9 ms, p99 332 ms; one shared queue: mean 35.7 ms, p99 159 ms ✅[^2] |

## Takeaways
- Use L = λ·W to size pools, concurrency limits and replica counts from measured rates and latencies. [rule-candidate]
- Keep sustained utilization of latency-sensitive resources well below 100% (often 60–80%); latency rises sharply above that.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Little's Law as Viewed on Its 50th Anniversary](https://people.cs.umass.edu/~emery/classes/cmpsci691st/readings/OS/Littles-Law-50-Years-Later.pdf) — John D. C. Little, Operations Research 59(3), 2011. Backs: L = λW, its generality and stability requirement. [^1]
- `linux/lab-setup.md` — the lab where the M/M/1 simulation and the independent Little's-law check ran on 2026-11-04 (Python 3.12.13). [^2]

## Related
- `performance/fundamentals/latency-percentiles-and-tail.md` — percentiles.
- `performance/fundamentals/amdahls-law-and-scalability.md` — limits of adding parallelism.
- `kubernetes/cpu-limits-and-throttling.md` — CPU quotas as another source of queueing.
