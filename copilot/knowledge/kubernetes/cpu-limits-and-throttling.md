---
schema: knowledge-doc/v1
type: concept
topic: kubernetes
status: verified
applies-to: ["Linux cgroup v2", "Kubernetes ≥ 1.25 on Linux nodes", "Docker --cpus"]
derived-from: [kubernetes/container-cpu-memory-limits-deep-dive.md]
last-verified: 2026-10-20
last-updated: 2026-10-20
tags: [kubernetes, cgroups, cpu, throttling, cfs, vcpu, cpu-units]
---

# CPU limits and throttling in containers

## Summary
**TL;DR:** A CPU limit is a **time budget per 100 ms window**, not a reserved core. By default the container's threads can run on every CPU of the node at once, but once the group has used its budget the kernel stops scheduling its threads until the next window ("throttled"). The work is never killed; it only gets slower.
**Use this when:** a service is slower in a pod than on a laptop, `cpu.stat` shows throttling, you are reading `500m` / `1` / `1000m` / `2` / "no limit" in a deployment spec or `--cpus=1` in `docker run`, or you are choosing `requests.cpu` / `limits.cpu` / thread or page counts.
**Not this doc:** memory limits and OOM kills → `memory-limits-and-oom-kill.md`; the full story with every actor → `container-cpu-memory-limits-deep-dive.md`.

## Problem
"1 vCPU" sounds like "one core reserved for me". It is not. Code that is fast on an 8-core laptop can be several times slower in a pod with `limits.cpu: 1`, and adding more parallel work there often makes it **slower**, because the extra threads all spend the same budget.

## Mental model
**Analogy:** the container has a shared card with **100 ms of CPU credit, refilled every 100 ms**. Eight employees (threads) can use it at eight desks (cores) at the same time; they just empty it eight times faster, then everyone waits for the refill.

### What "CPU worth" means (two clocks)
There are two clocks. **Wall time** is the clock on the wall. **CPU time** is the time a thread actually spends running on a core; a thread that waits (for the network, or because it is throttled) uses none.

- One thread running flat out for 10 ms of wall time uses **10 ms of CPU time**.
- Four threads running flat out on four cores for 10 ms of wall time use **40 ms of CPU time**.

A limit is a budget of **CPU time per 100 ms of wall time**. So "1 CPU worth per 100 ms" means: *100 ms of CPU time for every 100 ms of wall time*, which is the same as keeping **one core busy on average**. It does not say which core, or how many threads; those can change every millisecond. "2 CPUs worth" means 200 ms of CPU time per 100 ms of wall time, on average two cores busy.

### What the node, the pods and the limits look like
A node has a fixed number of CPUs. Each container gets its **own budget**; the budgets do not cut the node's CPUs into private pieces.

```
Node with 8 CPUs (shared by all pods)
 ├─ Pod A  limit 1   → may spend 100 ms of CPU time per 100 ms; threads may land on any CPU
 ├─ Pod B  limit 2   → may spend 200 ms of CPU time per 100 ms; threads may land on any CPU
 └─ Pod C  no limit  → may use any idle CPU time; never throttled
```

The scheduler only looks at **requests** when it places a pod ✅ [K8S-RES]. The **limit** is only applied afterwards, on the node, by the kernel ✅ [K8S-RES]. A CPU limit does not reserve CPUs; on a busy node, how much CPU a container gets beyond its request depends on the request weights (see "Requests vs limits").

### The same limit written in different places
Kubernetes accepts `0.5` or `500m` ("m" = one thousandth of a CPU, "millicpu"), so `0.1` is the same as `100m` ✅ [K8S-RES]. The amounts are absolute: `500m` is the same amount of computing power on a 1-core, 2-core or 48-core machine ✅ [K8S-RES]. Docker's `--cpus=1.5` is the same as `--cpu-period=100000 --cpu-quota=150000` ✅ [DOCKER]. In Kubernetes the kubelet enforces limits with CFS quota by default ✅ [CPUMGR].

| You write (Kubernetes `limits.cpu`) | Same thing | Docker | Kernel `cpu.max` (µs per 100 000 µs) | Meaning |
|---|---|---|---|---|
| _(not set)_ | no limit | _(no `--cpus`)_ | `max 100000` ✅ [CG2] | Any idle CPU, never throttled |
| `500m` | `0.5` | `--cpus=0.5` | `50000 100000` | 50 ms of CPU time per 100 ms (half a core, on average) |
| `1` | `1.0`, `1000m` | `--cpus=1` | `100000 100000` | 100 ms per 100 ms (one core, on average) |
| `1500m` | `1.5` | `--cpus=1.5` | `150000 100000` ✅ [DOCKER] | 150 ms per 100 ms |
| `2` | `2000m` | `--cpus=2` | `200000 100000` | 200 ms per 100 ms (two cores, on average) |

Note that `1` and `1000m` are two spellings of the same value, not two different settings. The first number in `cpu.max` is `limit × 100 000` µs; the second is the period. The `500m` / `1500m` / `2` rows follow the same multiplication that the sourced Docker example uses.

**Artifact** — what `limits.cpu: 1000m` becomes inside the container (cgroup v2) ✅ [CG2] [K8S-RES]:
```console
$ cat /sys/fs/cgroup/cpu.max
100000 100000          # quota µs  period µs  → 100 ms of CPU time per 100 ms of wall time
$ cat /sys/fs/cgroup/cpu.stat
usage_usec 19266000    # CPU time used by every process in the container
nr_periods 192         # 100 ms windows elapsed
nr_throttled 192       # windows in which the group ran out of budget (counted once per window)
throttled_usec 95816000  # time spent throttled, added up over all CPUs: can exceed wall time
```

1 Kubernetes CPU = 1 physical core or 1 vCPU, depending on whether the node is bare metal or a VM ✅ [K8S-RES]. On most x86 cloud VMs, 1 vCPU = 1 hardware thread (half of a hyper-threaded core) ✅ [GCP].

## How it works
**5 actors:**
- **kube-scheduler** — its job: place the pod on a node where the sum of CPU **requests** fits, via the API server. ✅ [K8S-RES]
- **kubelet** — its job: pass requests and limits to the runtime, via the container runtime API. ✅ [K8S-RES]
- **Container runtime** — its job: write the limit into the container's cgroup, via `cpu.max`. ✅ [K8S-RES] [DOCKER]
- **Kernel scheduler** — its job: run threads and enforce the quota, via per-CPU run queues. ✅ [BWC] (Called CFS in the docs cited here; Linux 6.6 began a transition to a newer scheduler, EEVDF ✅ [EEVDF]. The cgroup v2 `cpu.max` interface is still the one documented ✅ [CG2].)
- **Application** — its job: run its threads, via normal code; it is never told it was throttled.

```
period start (refill pool to quota)                         next period
│                                                            │
├─ CPU0 run queue takes a 5 ms slice from the pool ─ thread runs
├─ CPU1 run queue takes a 5 ms slice ─────────────── thread runs
├─ … slices keep being taken while threads run …
├─ pool empty + a run queue needs more ─► group's threads THROTTLED
│     (removed from the run queue; not signalled; state kept)
└────────────────────────────────────────────────────────────► refill → runnable again
```

1. **kube-scheduler → kubelet (network, via the API server):** the pod lands on a node based on **requests**. ✅ [K8S-RES]
2. **kubelet → runtime → cgroup (local on the node):** the limit is written to `cpu.max`. ✅ [K8S-RES] [CPUMGR]
3. **Kernel (local, every period, 100 ms by default):** refills the group's global pool to the quota. ✅ [BWC]
4. **Kernel (local, while threads run):** each CPU's run queue takes runtime from the pool in **slices of 5 ms** (`sched_cfs_bandwidth_slice_us`). ✅ [BWC]
5. **Kernel (local, pool empty):** the group's threads are **throttled**: they "will not be able to run again until the next period". ✅ [BWC] Unused slice time left on a CPU lets a highly threaded group briefly overshoot, by roughly 1 ms per CPU; over a longer time the average stays near the quota. ✅ [BWC]
6. **Kernel (local):** counts `nr_periods`, `nr_throttled`, `throttled_usec` in `cpu.stat` ✅ [BWC] [CG2]. `nr_periods` and `nr_throttled` are counted per group, once per elapsed period, so `nr_throttled / nr_periods` cannot exceed 100% ✅ [FAIR]. `throttled_usec` adds up, for every CPU's run queue, the time it spent throttled, so it can exceed wall time ✅ [FAIR].

**Requests vs limits:**
- The **request** is used for placement. When the node is busy, spare CPU is shared between containers in proportion to their requests ("the CPU request typically defines a weighting") ✅ [K8S-RES] [QOS-DESIGN]. On cgroup v2 the request reaches the kernel as `cpu.weight`, converted from the OCI shares value with `weight = 1 + ((shares − 2) × 9999) / 262142` ✅ [KEP2254].
- The **limit** is a hard ceiling enforced by throttling. ✅ [K8S-RES]

**Why limit at all:** many pods share a node. A hard ceiling keeps one busy pod from taking CPU time from the others, and keeps real use near what the scheduler packed by requests. ✅ [K8S-RES]

**Laptop vs container:**
- A native process on a laptop has no budget: it can use every core (`sysctl -n hw.ncpu`, e.g. 8).
- Docker or OrbStack on macOS runs containers in a Linux VM. ✅ [ORB] `--cpus=1` sets the same kind of quota there. ✅ [DOCKER]
- Node's `os.availableParallelism()` is a wrapper around libuv's `uv_available_parallelism()` ✅ [NODE-OS]. On Linux libuv reads `cpu.max` (cgroup v2) or `cpu.cfs_quota_us` (v1) ✅ [LIBUV]. Version matters: the ChangeLog lists a cgroup fix for `uv_available_parallelism` in libuv 1.49.0 and a fix for `cpu.max` quotas below one period (e.g. `500m`) in 1.52.0 ✅ [LIBUV-CL]. Check `process.versions.uv` in your runtime.

## Worked example
4 busy threads on a 4-core node, `limits.cpu: 1` (`cpu.max = 100000 100000`). Arithmetic from the mechanism above ✅ [BWC]:

| Wall time | What happens |
|---|---|
| 0 ms | Pool refilled to 100 ms of CPU time |
| 0–25 ms | 4 threads run in parallel: 4 × 25 ms = 100 ms of CPU time used |
| 25–100 ms | Pool empty → all 4 threads throttled for **75 ms** although CPUs are idle |
| 100 ms | Refill → threads run again |

Measured on a Node.js service rendering PDFs with headless Chromium (50 files, 2 GiB memory limit; own benchmark, see References):

| `--cpus` | Pages at once | Wall time | CPU per file | Throttled periods |
|---|---|---|---|---|
| 1 | 10 | 142 s | 2.84 s | 100% |
| 1 | 3 | 92 s | 1.82 s | 99% |
| 1 | 1 | 73 s | 1.14 s | 74% |
| 2 | 3 | 21 s | 0.72 s | 78% |
| 4 | 4 | 13 s | 0.69 s | 27% |

At 1 CPU the work needs ≈ 50 × 1.1 s ≈ 55 s of CPU time, so nothing can finish much faster than a minute; more parallel pages only made each file cost more CPU. Giving the container 2 CPUs did more than any concurrency setting. These are measurements; this doc does not claim a cause for the growth in CPU per file.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| No CPU limit | Can use any idle CPU; never throttled | `cpu.max` = `max` ✅ [CG2] |
| Low average CPU, spiky and multi-threaded | Still throttled; requests stall until the next 100 ms window | The budget is per window and is burned in parallel ✅ [BWC] |
| Request < limit, node idle | Gets up to the limit | Requests matter only under contention ✅ [K8S-RES] |
| Request < limit, node busy | Gets about its request share of spare CPU | Shared by request weight ✅ [K8S-RES] [QOS-DESIGN] |
| Guaranteed pod, integer CPU request, kubelet `static` CPU manager policy | Runs on exclusive CPUs, not on every CPU of the node | "Only containers that are both part of a Guaranteed pod and have integer CPU requests are assigned exclusive CPUs" ✅ [CPUMGR] |
| Pools sized from total cores | More threads than budget → more throttling | Size from `os.availableParallelism()`, which reads the cgroup quota (version-dependent, see above) ✅ [LIBUV] [LIBUV-CL] |
| Throttled process | Not killed; only slower | Throttling only skips scheduling ✅ [BWC] |
| Saving up unused quota | Possible up to `cpu.max.burst` (default `0`) | ✅ [CG2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Set `limits.cpu` | Protects neighbours; predictable | Throttling and latency spikes for spiky or multi-threaded work |
| No CPU limit, only `requests.cpu` | Uses idle node CPU; fewer stalls | Usage can exceed what was planned; less predictable |
| Raise the limit (e.g. 1 → 2) | Real speed-up for CPU-bound work | More node capacity per pod |
| Lower in-app parallelism to ≈ the CPU budget | Less waste from contention | Lower peak throughput when CPU is free |

## Takeaways
- Treat `limits.cpu` as a time budget per 100 ms; size thread pools and concurrent work from `os.availableParallelism()`, not from the host's core count. [rule-candidate]
- When `nr_throttled / nr_periods` is near 100% and cores used ≈ limit, the work is CPU-bound: raise the CPU limit or reduce work per item; more parallelism will not help.
- Compare performance only between runs with the same CPU limit; a laptop without a quota is not a valid baseline.
- Do not judge throttling from `throttled_usec` alone; it can exceed wall time. Use `nr_throttled / nr_periods`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 44 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-20

## References
- [K8S-RES] [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: CPU units and `m` notation, absolute amounts, requests for scheduling, request as weighting, limits enforced by throttling, kubelet → runtime → cgroups.
- [BWC] [CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html) — Linux kernel documentation, living. Backs: quota/period, 100 ms default period, 5 ms slices, throttling until the next period, brief overshoot by unused slice, `cpu.stat`.
- [CG2] [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `cpu.max` (default `max 100000`), `cpu.max.burst` (default 0), `cpu.stat` fields.
- [FAIR] [`kernel/sched/fair.c`](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c) — Linux kernel source, master branch, read 2026-10-20. Backs: `nr_periods` and `nr_throttled` advance by the number of elapsed periods (`cfs_b->nr_periods += overrun`, `cfs_b->nr_throttled += overrun`); `throttled_time` is added per CPU run queue on unthrottle (`cfs_b->throttled_time += rq_clock(rq) - cfs_rq->throttled_clock`).
- [EEVDF] [EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html) — Linux kernel documentation, living. Backs: the kernel began transitioning from CFS to EEVDF in 6.6.
- [KEP2254] [KEP-2254: cgroup v2](https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/2254-cgroup-v2/README.md) — Kubernetes project, living. Backs: shares → `cpu.weight` formula; quota and period → `cpu.max`.
- [CPUMGR] [Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/) — Kubernetes project, living. Backs: kubelet uses CFS quota to enforce CPU limits by default; static policy gives exclusive CPUs to Guaranteed pods with integer CPU requests.
- [QOS-DESIGN] [Resource QoS design proposal](https://github.com/kubernetes/design-proposals-archive/blob/main/node/resource-qos.md) — Kubernetes project (archived), 2016. Backs: CPU is compressible; spare CPU shared by request ratio.
- [GCP] [CPU platforms](https://cloud.google.com/compute/docs/cpu-platforms) — Google Cloud, living. Backs: 1 vCPU = 1 hardware thread on most x86 machines.
- [DOCKER] [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) — Docker, living. Backs: `--cpus` sets the cgroup CPU quota; `--cpus="1.5"` equals `--cpu-period="100000" --cpu-quota="150000"`.
- [LIBUV] [libuv `src/unix/linux.c`](https://github.com/libuv/libuv/blob/v1.x/src/unix/linux.c) — libuv project, living. Backs: `uv__get_constrained_cpu` reads cgroup v2 `cpu.max` and cgroup v1 `cpu.cfs_quota_us`.
- [LIBUV-CL] [libuv ChangeLog](https://github.com/libuv/libuv/blob/v1.x/ChangeLog) — libuv project, living. Backs: "fix uv_available_parallelism using cgroup" in 1.49.0 (2024-09-25); "handle cgroups cpu.max with limit < period" in 1.52.0 (2026-02-11).
- [NODE-OS] [Node.js `os.availableParallelism()`](https://nodejs.org/api/os.html) — Node.js project, living. Backs: added in v19.4.0 / v18.14.0; "a small wrapper about libuv's `uv_available_parallelism()`".
- [ORB] [OrbStack architecture](https://docs.orbstack.dev/architecture) — OrbStack, living. Backs: containers on macOS run in a Linux VM.
- `kubernetes/container-cpu-memory-limits-deep-dive.md` — the deep dive this doc was distilled from (measurements and full actor walk-through).

## Related
- `kubernetes/memory-limits-and-oom-kill.md` — the memory side: why it kills instead of throttling.
- `kubernetes/container-cpu-memory-limits-deep-dive.md` — full end-to-end version with both resources.
- `js-runtime/` — Node.js/V8 runtime behaviour.
