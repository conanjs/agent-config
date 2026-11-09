---
schema: knowledge-doc/v1
type: how-to
topic: performance
status: draft
applies-to: ["Grafana k6; service load experiments"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Load measurement and performance regression control

## Summary
**TL;DR:** A measurement is meaningful only when the system receives the intended load, returns correct results and meets resource budgets. Track intended, started, completed, failed and rejected work.
**Use this when:** establishing a baseline, comparing a change or creating a performance regression gate.

## Goal & prerequisites
Goal: a reproducible result recording workload shape, environment, correctness and response-time distribution. You need an authorized test environment, a read endpoint, an installed k6 and a recorded version. Values below form an illustrative, unexecuted contract; replace them with the application's targets.

The 99th percentile (p99) is the boundary that 99% of samples do not exceed, like the service time in position 99 of 100 sorted customer times; it is not the maximum. ✅ [k6](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) distinguishes an open model, whose arrivals are independent of completion time, from a closed model, whose users wait for the previous iteration. A closed model can automatically reduce load when the server slows and conceal coordinated omission; it remains appropriate when real behavior includes waiting.

## Steps
1. Define correct output, dataset/seed, endpoint mix, key skew, cache state and budgets. Example: 200 iterations/second for 15 minutes, HTTP request p99 below 250 ms, errors below 0.1%, no dropped iterations; these are not universal standards.
2. Record versions and configuration: `k6 version`, application commit, runtime, kernel, hardware, CPU/memory limits, pools, database and data. CPU expands to Central Processing Unit; record the load generator too, to identify generator-side limits.
3. ✅ [Executor configuration](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) defines rate, timeUnit and virtual-user limits. Save the following as `load.js`. `TARGET_URL` is the test endpoint supplied by the operator; replace the example body contract containing `"ok":true` with an actual business check.

```javascript
import http from 'k6/http';
import { check } from 'k6';
export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate', rate: 200, timeUnit: '1s',
      duration: '15m', preAllocatedVUs: 100, maxVUs: 500,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<250'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
  },
};
export default function () {
  const response = http.get(__ENV.TARGET_URL, { timeout: '2s' });
  check(response, {
    'status and business contract': r => r.status === 200 && r.body.includes('"ok":true'),
  });
}
```

4. ✅ [JSON output](https://grafana.com/docs/k6/latest/results-output/real-time/json/) saves individual data points; [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) define pass/fail. Run `k6 run --out json=run.json load.js` after setting `TARGET_URL` in the environment. Do not add sleep to an arrival-rate model to control the rate. Collect resource metrics and profiles alongside the test; keep raw files with metadata. This is a synthetic single-endpoint test, not a replacement for the production traffic mix.
5. Run cold-start, warm steady-state, burst and recovery phases separately; compare baseline/candidate with the same data. Vary run order to reduce bias and repeat independent sessions; do not treat every request in one burst as an independent sample.
6. Compare the load curve with useful throughput, errors, queue age, peak memory, cost and correctness. Change one main hypothesis per cycle so that causes remain explainable.

✅ [Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/) are iterations that never start; too few virtual users or a slow server keeping them busy can cause them. A virtual user is a simulated user, like an available request-sending staff member; increasing this count does not fix server capacity.

## Verify
Run `k6 run --out json=run.json load.js`; expect successful exit only when thresholds pass. Beyond the exit code, inspect the summary and counts: 200×900 = 180,000 intended iterations; reconcile started/completed iterations and the graceful-completion interval. `dropped_iterations=0`, `checks=100%` and `http_req_failed<0.1%` validate the script's checks, not full business correctness if the body oracle is too weak.

| Check | Qualifying result | Inconclusive sign |
|---|---|---|
| Delivered load | No lost iterations; generator has headroom | Only 150,000/180,000 iterations delivered despite attractive latency |
| Correctness | Same ids, ranking and totals as the oracle | HTTP 200 with missing data |
| Distribution | Histogram, sample count, p50/p95/p99, separate error latency | Only an average, or timeouts omitted |
| Comparison | Multiple sessions, spread and a practically meaningful effect | One lucky run or results close to the threshold |
| Resources | Memory, queue age and cost within budget | Faster by using twice the memory, beyond the limit |
| Recovery | Backlog falls and the service stabilizes | The burst ends but expired work remains queued |

✅ [Prometheus histograms](https://prometheus.io/docs/practices/histograms/) allow bucket/count aggregation followed by percentile calculation; do not average per-machine p99 values or summary quantiles to obtain system p99. Error depends on histogram representation. For success-only p99, retain a success-filtered histogram alongside errors/timeouts; the example's default `http_req_duration` threshold covers all measured HTTP requests.

⚠️ unverified: this script and command were not executed during the research session. Before using them as a gate, test that changing the contract or deliberately slowing the endpoint actually fails the gate. Mark near-boundary results inconclusive and investigate noise rather than automatically passing them.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Good p99, increasing dropped_iterations | Insufficient delivered load | Check generator, virtual users and server latency; do not claim capacity |
| Low CPU but slow responses | Input/output, pool, lock or throttling waits | Use off-CPU and waiting metrics |
| Faster candidate with more errors | Work is dropped rather than completed faster | Compare useful successes and correctness |
| Lower average, users still wait | Tails or fast failures hide the issue | Separate successes/errors and inspect the histogram |
| Different measurements each run | Noise, cache state, changed data or autoscaling | Control conditions, record metadata, repeat deliberately |

## Rollback
Keep the baseline and old configuration with the artifacts. If rollout exceeds the budget, restore the known version/configuration and compare traffic mixes before assigning a cause. Schema/data changes need a system-specific rollback plan; the measurement script does not provide database rollback.

## Takeaways
- Do not claim a load target was met if the generator did not deliver it.
- A gate must check correctness, load, latency, errors and resources together.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 5 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [Constant arrival rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) — Grafana k6, living. Backs: script configuration.
- [JSON output](https://grafana.com/docs/k6/latest/results-output/real-time/json/) — Grafana k6, living. Backs: command.
- [Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) — Grafana k6, living. Backs: pass/fail behavior.
- [Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) — Grafana k6, living. Backs: arrival models.
- [Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/) — Grafana k6, living. Backs: incomplete load.
- [Histograms and summaries](https://prometheus.io/docs/practices/histograms/) — Prometheus, living. Backs: aggregation.
- [Benchmark methodology](measurement/benchmarking-methodology.md) — local microbenchmark foundation.

## Related
- [Profiling](measurement/profiling-and-flame-graphs.md)
- [Runtime/client measurements](runtime-and-client-performance.md)
