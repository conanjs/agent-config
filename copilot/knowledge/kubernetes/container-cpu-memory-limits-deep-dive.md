---
schema: deep-dive/v1
topic: kubernetes
status: verified
applies-to: ["Linux cgroup v2", "Kubernetes ≥ 1.25 on Linux nodes", "Docker / OrbStack on macOS (Linux VM)"]
last-verified: 2026-10-20
last-updated: 2026-10-20
synthesized-into:
  - { path: kubernetes/cpu-limits-and-throttling.md, on: 2026-10-20 }
  - { path: kubernetes/memory-limits-and-oom-kill.md, on: 2026-10-20 }
tags: [kubernetes, containers, cgroups, cpu, memory, throttling, oom, cfs, vcpu]
---

# Container CPU and memory limits, end to end

## Summary
**TL;DR:** A container is just a group of normal Linux processes that the kernel accounts for together (a **cgroup**). A CPU limit gives that group a **time budget** per 100 ms window; when the budget is used up, the kernel's scheduler simply stops picking its threads until the next window ("throttling"). A memory limit is a **hard ceiling** on pages; memory cannot be "paused", so when the group cannot be squeezed below the ceiling, the kernel **kills** processes in it (OOM kill).
**Use this when:** a service is slower in a pod/container than on a laptop; you see `throttled` CPU, `OOMKilled`, exit code `137` or restarts; you are sizing `requests`/`limits`; or you need to explain what "1 vCPU" means.
**Depth:** every actor (app, kernel scheduler, cgroup, container runtime, kubelet, scheduler), what `requests` vs `limits` do for CPU and memory, the throttling mechanism down to the 5 ms slices, the OOM path to exit code 137, laptop vs pod comparison, worked examples with measured numbers, and edge-case matrices.

---

## 1. Words first (zero prior context)

| Term | Plain English | Analogy | Concrete artifact |
|---|---|---|---|
| Process / thread | A running program / one line of execution inside it. Only threads run on CPUs. | A worker | `node dist/main.js` is a process; its libuv pool and Chromium's renderers add more threads/processes |
| CPU core / hardware thread | The hardware that executes one thread at a time. With hyper-threading one physical core exposes 2 hardware threads. | A desk; hyper-threading = 2 chairs at one desk | macOS: `sysctl -n hw.ncpu` → `8` |
| vCPU | What a cloud VM sells as "1 CPU". On most x86 Compute Engine machines **1 vCPU = 1 hardware thread** (half a hyper-threaded core). ✅ [GCP] | One chair, not a whole desk | an `e2-standard-4` VM has 4 vCPUs |
| CPU unit (Kubernetes) | `1` = 1 physical core or 1 virtual core (vCPU), depending on whether the node is bare metal or a VM. `500m` = half of one. ✅ [K8S-RES] | — | `limits: { cpu: 1000m }` |
| cgroup | Kernel feature that groups processes and **accounts/limits** CPU, memory, I/O for the group. Each container is one cgroup. ✅ [K8S-RES] | A shared bank account with a spending cap | `/sys/fs/cgroup/cpu.max`, `/sys/fs/cgroup/memory.max` inside a container |
| CFS bandwidth control | The kernel scheduler feature that enforces a CPU **quota per period** for a cgroup. ✅ [BWC] | A monthly allowance, refilled every 100 ms | `cpu.max` = `100000 100000` (100 ms per 100 ms = 1 CPU) |
| Throttling | Threads of a cgroup that used up its quota are **not scheduled** until the next period. ✅ [BWC] | Card declined until the allowance refills | `cpu.stat`: `nr_throttled`, `throttled_usec` |
| OOM killer | Kernel code that frees memory by **killing** a process when memory cannot be reclaimed. ✅ [CG2] | Evicting a tenant because the building is full | container status `OOMKilled`, exit code `137` |
| Request (K8s) | What the scheduler **reserves** for the container on a node. ✅ [K8S-RES] | A table booking | `requests: { cpu: 500m, memory: 1Gi }` |
| Limit (K8s) | The **hard ceiling** the kernel enforces at runtime. ✅ [K8S-RES] | The fire-code maximum for the room | `limits: { cpu: 1000m, memory: 2Gi }` |

---

## 2. The actors

**6 actors:**
- **Application** — its job: do the work in threads/processes, via normal system calls (allocating memory, running code).
- **Kernel scheduler (CFS)** — its job: decide which runnable thread runs on which CPU next, via per-CPU run queues and a timer tick.
- **cgroup controllers (cpu, memory)** — their job: count the group's CPU time and memory pages and enforce `cpu.max` / `memory.max`, via files under `/sys/fs/cgroup/`.
- **Container runtime** (containerd, Docker) — its job: create the cgroup and write the limits into it, via the cgroup filesystem. ✅ [K8S-RES] [DOCKER]
- **kubelet** — its job: start containers with the pod spec's requests/limits, restart killed ones, and evict pods when the node runs low, via the container runtime and node stats. ✅ [K8S-RES] [EVICT]
- **kube-scheduler** — its job: place a pod on a node whose **unreserved requests** still fit, via the API server. ✅ [K8S-RES]

```
kube-scheduler ──(API server, network)──► kubelet on node X
                                              │ passes requests/limits
                                              ▼
                                       container runtime ──writes──► /sys/fs/cgroup/<pod>/<container>/
                                                                       cpu.max     = "100000 100000"
                                                                       cpu.weight  = (from requests)
                                                                       memory.max  = 2147483648
                                              ┌───────────────────────────────┘
                                              ▼   (all local, inside the node's kernel from here on)
     app threads ──run on──► CPUs ◄── CFS scheduler checks the cgroup's quota every slice
     app allocations ──charge──► memory cgroup ──over memory.max──► reclaim ──fails──► OOM kill
```

---

## 3. Requests vs limits, per resource

| | CPU | Memory |
|---|---|---|
| **Request** used by | kube-scheduler (placement). At runtime it becomes a relative **weight** for sharing spare CPU when the node is busy: excess CPU is shared in proportion to requests. ✅ [QOS-DESIGN] | kube-scheduler (placement); node-pressure eviction ranks pods by usage above request. ✅ [K8S-RES] [EVICT] |
| **Limit** enforced by | Kernel **throttling** (CFS bandwidth, `cpu.max`). Hard ceiling. ✅ [K8S-RES] | Kernel **OOM kill** (`memory.max`). Only when the kernel detects memory pressure, so a container can be briefly over before it is killed. ✅ [K8S-RES] |
| When exceeded | Slower, never killed. | Killed (exit `137`), then restarted by kubelet per the restart policy. ✅ [K8S-MEM] |
| Kind of resource | **Compressible**: time can be handed out later. ✅ [QOS-DESIGN] | **Incompressible**: a page holding data cannot be taken back without losing the data. ✅ [QOS-DESIGN] |

QoS class follows from these numbers ✅ [QOS]:
- **Guaranteed**: every container has CPU and memory requests **equal** to limits.
- **Burstable**: at least one request or limit set, not Guaranteed (e.g. request 500m / limit 1000m).
- **BestEffort**: nothing set.
When a node runs out of memory, kubelet evicts BestEffort first, then Burstable, then Guaranteed. ✅ [QOS]

---

## 4. CPU: how "1 vCPU" and throttling actually work

### 4.1 What the limit is (and is not)

`limits.cpu: 1000m` is written as `cpu.max = "100000 100000"`: **100 000 µs of CPU time per 100 000 µs period** (the default period is 100 ms). ✅ [BWC] [CG2] [DOCKER]

- It is **a time budget, not a core**. The container's threads can run on **all** of the node's CPUs at the same time; what is limited is the **total** CPU time of the group per period. ✅ [BWC] (quota is handed to *per-CPU* run queues)
- `500m` → `50000 100000`; `2` → `200000 100000`.
- No limit → `max 100000`: the group can use any idle CPU. ✅ [CG2]

Analogy: a shared company card with **100 ms of CPU credit every 100 ms**. Eight employees (threads) can swipe it at once on eight desks (cores); the credit just runs out eight times faster.

**"1 CPU worth per 100 ms" decoded.** *CPU time* is the time threads actually spend running on cores; *wall time* is the clock on the wall. Four threads running flat out for 10 ms of wall time use 40 ms of CPU time. The limit is a budget of CPU time per 100 ms of wall time: `1` = 100 ms of CPU time per 100 ms = one core busy on average (any core, any number of threads); `2` = 200 ms per 100 ms.

**Notation.** `1` and `1000m` are two spellings of the same value; `0.1` = `100m` ✅ [K8S-RES]; the amounts are absolute (`500m` is the same computing power on a 1-core or 48-core machine) ✅ [K8S-RES]. Docker `--cpus=1.5` = `--cpu-period=100000 --cpu-quota=150000` ✅ [DOCKER]. The kubelet enforces limits with CFS quota by default ✅ [CPUMGR].

**Exception: pinned CPUs.** With the kubelet `static` CPU manager policy, "only containers that are both part of a Guaranteed pod and have integer CPU requests are assigned exclusive CPUs" ✅ [CPUMGR]; those containers do not run on every CPU of the node.

### 4.2 The mechanism, step by step

All of this is **local, inside the node's kernel**; nothing crosses the network.

1. **Container runtime (once, at start):** writes the quota and period, via `cpu.max` in the container's cgroup directory. ✅ [K8S-RES]
2. **Kernel (every period boundary, 100 ms):** refills the group's **global pool** to the quota. ✅ [BWC]
3. **Kernel scheduler (whenever a thread of the group runs on CPU *n*):**
   - CPU *n*'s run queue takes a **slice** of runtime (default **5 ms**, `/proc/sys/kernel/sched_cfs_bandwidth_slice_us`) out of the global pool. ✅ [BWC]
   - The thread runs; its time is charged against that local slice.
   - Unused slice time left on a CPU lets a highly threaded group briefly overshoot its quota, by roughly 1 ms per CPU; the average stays near the quota over a longer window. ✅ [BWC]
4. **Kernel scheduler (when the pool is empty and CPU *n* needs more):** the group's threads on that run queue are **throttled**: removed from the run queue, so the scheduler simply never picks them. They are not signalled or stopped; their memory and state are untouched. ✅ [BWC] ("Throttled threads will not be able to run again until the next period")
5. **Kernel (next period boundary):** refills the pool; throttled threads become runnable again. ✅ [BWC]
6. **Kernel (statistics):** counts `nr_periods`, `nr_throttled`, `throttled_usec` in `cpu.stat`. ✅ [BWC] [CG2]

```
1 vCPU limit (cpu.max = 100000 100000), 4 threads busy on a 4-core node

time (ms) 0        25        50        75        100       125
          |--------|---------|---------|---------|---------|
CPU0  T1  ██████████████████                      ████ ...
CPU1  T2  ██████████████████   throttled          ████ ...
CPU2  T3  ██████████████████   (not scheduled)    ████ ...
CPU3  T4  ██████████████████                      ████ ...
          ^ 4 × 25 ms = 100 ms budget used        ^ refill at period boundary
          by t = 25 ms                             → runs again
```

With 4 busy threads, the 100 ms budget is gone after **25 ms of wall time**, and the group then sits **75 ms** doing nothing even though CPUs are idle. ✅ arithmetic from [BWC] semantics.

### 4.3 Why do it at all?

- **Many tenants per node.** A node runs many pods. Without a ceiling, one busy pod would take CPU time from all others ("noisy neighbour"). The limit is a **hard** ceiling the kernel enforces. ✅ [K8S-RES]
- **Packing and cost.** The scheduler packs pods by their requests; limits keep actual use near what was planned. ✅ [K8S-RES]

### 4.4 Laptop vs pod

| | macOS laptop (native) | Container on macOS (Docker / OrbStack) | Pod on a cloud VM node |
|---|---|---|---|
| Where Linux runs | — (macOS kernel, no cgroups) | A lightweight **Linux VM**; the container's cgroup is inside that VM. ✅ [ORB] | The node VM's kernel |
| CPUs a process can use | All cores (`hw.ncpu`, e.g. 8), shared with other apps by the OS scheduler | All cores the VM got, unless `--cpus` is set | All cores of the node |
| Time budget | None | `--cpus=1` → `cpu.max` quota of 1 CPU. ✅ [DOCKER] | `limits.cpu` → quota. ✅ [K8S-RES] |
| "1 CPU" means | — | 1 CPU of the VM | 1 vCPU = 1 hardware thread on most x86 VMs. ✅ [GCP] |
| What `os.availableParallelism()` reports (Node.js) | macOS logical CPUs | Lowered to the cgroup quota, e.g. `1` with `--cpus=1` (measured). Needs libuv ≥ 1.49.0 (≥ 1.52.0 for quotas below one period). ✅ [LIBUV] [LIBUV-CL] | Same, from the pod's `cpu.max`. ✅ [LIBUV] [LIBUV-CL] |

So the same code can be several times faster on a laptop: it has 8 hardware threads and no budget, while a pod with `limits.cpu: 1` has one CPU's worth of time per 100 ms.

### 4.5 Worked example: headless-Chromium PDF service (measured)

A Node.js API renders PDFs with headless Chromium (one browser, up to *N* pages at once). Same request, a fresh container per row, `--memory=2g`. "CPU per file" = container CPU time ÷ files.

| CPU limit | Pages at once | 50 files, wall time | CPU per file | Avg cores used | Throttled periods |
|---|---|---|---|---|---|
| 1 | 10 | 142 s | 2.84 s | 1.00 | 100% |
| 1 | 3 | 92 s | 1.82 s | 0.99 | 99% |
| 1 | 1 | 73 s | 1.14 s | 0.78 | 74% |
| **2** | 3 | **21 s** | 0.72 s | 1.73 | 78% |
| 4 | 4 | 13 s | 0.69 s | 2.73 | 27% |

How to read it:
- At 1 CPU the group used its whole budget (`avg cores ≈ limit`) and was throttled in almost every period: **CPU-bound**. 50 files × ~1.1 s = ~55 s of CPU is the floor; no setting at 1 CPU can beat ~1 minute.
- More pages at once on 1 CPU made it **slower**: CPU per file grew from 1.1 s to 2.8 s. Running more work in parallel does not create CPU time. The growth in CPU per file is a measurement; this dive does not claim a cause for it.
- 1 → 2 CPUs was **4.4× faster**, not 2×: CPU per file dropped from 1.8 s to 0.7 s (measured; again no cause claimed).
- `throttled_usec` was **larger than the wall time** (e.g. 96 s throttled in a 19 s run on an 8-core host). In the kernel source, the time is added once per CPU run queue when it is unthrottled (`cfs_b->throttled_time += rq_clock(rq) - cfs_rq->throttled_clock`), so it adds up across CPUs. ✅ [FAIR] `nr_periods` and `nr_throttled` advance by the number of elapsed periods, once per group, so `nr_throttled / nr_periods` stays ≤ 100%. ✅ [FAIR] Use that ratio to judge throttling.

### 4.6 CPU edge cases

| Case | What happens | Why |
|---|---|---|
| No CPU limit | Can use any idle CPU on the node; no throttling | `cpu.max = max`. ✅ [CG2] |
| Low **average** CPU but spiky, multi-threaded | Still throttled; latency spikes of up to (period − time to burn the quota) | Budget is per 100 ms window, burned in parallel by many threads. ✅ [BWC] |
| Request < limit, node idle | Gets up to the limit | Request only matters when CPU is contended. ✅ [QOS-DESIGN] |
| Request < limit, node busy | May get only about its request share | Spare CPU shared in proportion to requests. ✅ [QOS-DESIGN] |
| Thread pools sized from core count | Too many threads for the budget, more throttling | Use `os.availableParallelism()`, which reads cgroup `cpu.max` in libuv (version-dependent). ✅ [LIBUV] [LIBUV-CL] |
| Guaranteed pod, integer CPU request, `static` CPU manager | Runs on exclusive CPUs, not all CPUs of the node | ✅ [CPUMGR] |
| Throttled process | Not killed, not signalled; only slower | Throttling only skips scheduling. ✅ [BWC] |
| Burst allowance | Unused quota can be saved up to `cpu.max.burst` | ✅ [CG2] (`cpu.max.burst`); off by default |

---

## 5. Memory: limits, reclaim and the OOM kill

### 5.1 What is counted

The memory cgroup charges every page the group's processes use: process memory (heap, stacks) **and file cache** (files read from disk kept in RAM). `memory.current` is the total. ✅ [CG2]
- **Working set** = `memory.current − inactive_file`: what the kubelet and `kubectl top` use, because inactive file cache can be dropped at any time. ✅ [EVICT]
- With many processes (e.g. Chromium's renderers), summing per-process numbers can disagree with the cgroup. Rss is "the amount of the mapping that is currently resident in RAM" and Pss is "the process's proportional share of this mapping" ✅ [SMAPS]. In the §5.5 measurement the summed RSS (1,496 MB) was far above the summed PSS (482 MB) and the cgroup's `memory.current` (361 MB).

### 5.2 Why kill instead of throttle?

CPU time not given now can be given later (compressible). A memory page holds data: taking it away means losing the data, unless it can be written somewhere (file cache can be dropped and re-read; anonymous memory needs swap). So past the limit, the only safe way to get memory back is to end a process. ✅ [QOS-DESIGN] ("Memory is an incompressible resource")

There is a soft brake before the wall: `memory.high` throttles allocations and forces heavy reclaim, but it never kills. ✅ [CG2] Kubernetes sets it only when the kubelet field `memoryThrottlingFactor` is set; the default is `nil`, so the kubelet does not set `memory.high`. ✅ [QOS]

### 5.3 The OOM path, step by step

1. **Application (local):** allocates memory, e.g. a new Chromium page or a big `Buffer`.
2. **Kernel memory cgroup (local):** charges the new pages; `memory.current` approaches `memory.max`. ✅ [CG2]
3. **Kernel (local):** tries to **reclaim**: drops clean file cache, swaps if allowed. ✅ [CG2]
4. **Kernel OOM killer (local):** if usage "can't be reduced", the OOM killer runs **inside that cgroup only**. ✅ [CG2] It chooses the victim by each process's `oom_score`, which is based on the memory the process uses, adjusted by `oom_score_adj`; a higher score makes a process more likely to be selected. ✅ [PROC-OOM]
   - On cgroup v2, Kubernetes sets `memory.oom.group`, so **all processes of the container are killed together**, unless the kubelet option `singleProcessOOMKill` is true. ✅ [KUBELET-CFG] For a Node.js app that spawned Chromium, this means the Node process dies too.
5. **Kernel → process:** sends `SIGKILL` (signal 9). "The signals SIGKILL and SIGSTOP cannot be caught, blocked, or ignored", so the app gets no cleanup or log line. ✅ [SIGNAL]
6. **Container runtime → kubelet (local, on the node):** the container exited with code **137 = 128 + 9**. ✅ [BASH] Status `OOMKilled`. ✅ [K8S-MEM]
7. **kubelet:** restarts the container per the pod's restart policy (Deployments use `Always`), increasing `RESTARTS`. ✅ [K8S-MEM] The kubelet restarts with an exponential backoff (10 s, 20 s, 40 s, …) capped at 300 s, reset after 10 minutes without problems; `CrashLoopBackOff` is the state while that delay is in effect. ✅ [LIFECYCLE]
8. **kubelet → API server (network):** reports the new status; `kubectl describe pod` shows `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. ✅ [K8S-MEM]

```
app allocates ──► memory cgroup charges pages ──► memory.current ≥ memory.max ?
                                                     │ no → continue
                                                     ▼ yes
                                            kernel reclaims (file cache, swap)
                                                     │ enough → continue
                                                     ▼ not enough
                                            OOM killer in this cgroup
                                            (all procs if memory.oom.group=1)
                                                     ▼
                                            SIGKILL → exit 137 → "OOMKilled"
                                                     ▼
                                            kubelet restarts container (RESTARTS +1)
```

### 5.4 Two different "kills"

| | Container OOM kill | Node-pressure eviction |
|---|---|---|
| Who | **Kernel** | **kubelet** ✅ [EVICT] |
| Trigger | One container over **its own** `memory.max` | The **node** low on memory (`memory.available` = capacity − node working set) ✅ [EVICT] |
| Victim | Processes inside that container | Whole pods; BestEffort first, then Burstable using more than requested, Guaranteed last ✅ [QOS] |
| Result | Container restarts in place | Pod terminated and rescheduled (by its controller) |

### 5.5 Worked example: the same PDF service (measured)

- 1 CPU, 2 GiB limit, 50 pages rendered **at once** (no page cap): working set rose to **2,048 MB = the limit**, and every render hit Playwright's 30 s timeout instead of finishing. With a cap of 3 pages: ~680 MB, all 50 finished.
- With 3 pages open, the processes' **summed RSS was 1,496 MB, summed PSS 482 MB, cgroup `memory.current` 361 MB**: the cgroup number is what the limit is compared with.

### 5.6 Memory edge cases

| Case | What happens | Why |
|---|---|---|
| Over the **request**, under the **limit**, node fine | Nothing | Request is for placement and eviction ranking only. ✅ [K8S-RES] |
| Over the request, node under pressure | Pod may be **evicted** by kubelet | Ranked by usage above request. ✅ [EVICT] [QOS] |
| Briefly over the limit | May survive until the kernel sees pressure | Kills happen only under pressure. ✅ [K8S-RES] |
| Mostly file cache | Reclaimed first, usually no kill | File pages can be dropped. ✅ [CG2] |
| No memory limit | Bounded only by the node; a node-level OOM can kill any process | ✅ [DOCKER] ("any process is subject to killing") |
| Multi-process container (Chromium) | Whole container killed on cgroup v2 | `memory.oom.group`. ✅ [KUBELET-CFG] |

---

## 6. What to measure inside a container

| Question | File / tool | Read as |
|---|---|---|
| CPU limit | `/sys/fs/cgroup/cpu.max` | `quota period`; `max` = none ✅ [CG2] |
| Was it CPU-throttled? | `/sys/fs/cgroup/cpu.stat` | `nr_throttled / nr_periods`; `usage_usec` ÷ wall time = cores used ✅ [CG2] |
| Memory now / limit | `memory.current` / `memory.max` | Bytes ✅ [CG2] |
| What Kubernetes sees | `memory.current − inactive_file` (from `memory.stat`) | Working set ✅ [EVICT] |
| Killed by OOM? | `kubectl describe pod` | `Reason: OOMKilled`, `Exit Code: 137` ✅ [K8S-MEM] |

---

## References
- [K8S-RES] [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: CPU units, requests for scheduling, CPU limits enforced by throttling, memory limits enforced by OOM kills under pressure, kubelet → runtime → cgroups.
- [BWC] [CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html) — Linux kernel documentation, living. Backs: quota/period, default 100 ms period, 5 ms slices to per-CPU run queues, throttled threads wait for the next period, `cpu.stat` fields.
- [CG2] [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `cpu.max`, `cpu.max.burst`, `cpu.weight`, `cpu.stat`, `memory.max` (OOM killer when usage can't be reduced), `memory.high` (throttle, no kill), memory accounting.
- [QOS-DESIGN] [Resource QoS design proposal](https://github.com/kubernetes/design-proposals-archive/blob/main/node/resource-qos.md) — Kubernetes project (archived design), 2016. Backs: compressible vs incompressible, spare CPU shared by request ratio, the largest process is killed past the limit.
- [QOS] [Pod Quality of Service Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) — Kubernetes project, living. Backs: Guaranteed / Burstable / BestEffort criteria and eviction order; `memoryThrottlingFactor` default `nil` (kubelet does not set `memory.high`).
- [EVICT] [Node-pressure Eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/) — Kubernetes project, living. Backs: `memory.available`, working set excludes `inactive_file`, kubelet evicts.
- [K8S-MEM] [Assign Memory Resources to Containers and Pods](https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/) — Kubernetes project, living. Backs: `OOMKilled` status, termination past the limit, restart by kubelet.
- [KUBELET-CFG] [Kubelet Configuration (v1beta1): singleProcessOOMKill](https://kubernetes.io/docs/reference/config-api/kubelet-config.v1beta1/) — Kubernetes project, living. Backs: `memory.oom.group` on cgroup v2 → container processes killed as a group.
- [BASH] [Bash Reference Manual: Exit Status](https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html) — GNU, living. Backs: fatal signal N → exit status 128+N (137 = SIGKILL).
- [GCP] [CPU platforms](https://cloud.google.com/compute/docs/cpu-platforms) — Google Cloud, living. Backs: on most x86 processors each vCPU is one hardware thread.
- [DOCKER] [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) — Docker, living. Backs: `--cpus` sets the cgroup CPU quota; host-level OOME can kill any process.
- [LIBUV] [libuv `src/unix/linux.c`](https://github.com/libuv/libuv/blob/v1.x/src/unix/linux.c) — libuv project, living. Backs: `uv__get_constrained_cpu` reads cgroup v2 `cpu.max` and v1 `cpu.cfs_quota_us`; Node's `os.availableParallelism()` wraps `uv_available_parallelism()` ([Node.js os docs](https://nodejs.org/api/os.html)).
- [LIBUV-CL] [libuv ChangeLog](https://github.com/libuv/libuv/blob/v1.x/ChangeLog) — libuv project, living. Backs: cgroup fix for `uv_available_parallelism` in 1.49.0 (2024-09-25); `cpu.max` below one period handled in 1.52.0 (2026-02-11).
- [FAIR] [`kernel/sched/fair.c`](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c) — Linux kernel source, master branch, read 2026-10-20. Backs: `nr_periods` / `nr_throttled` advance by elapsed periods per group; `throttled_time` is added per CPU run queue.
- [CPUMGR] [Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/) — Kubernetes project, living. Backs: CFS quota enforces limits by default; static policy gives exclusive CPUs to Guaranteed pods with integer CPU requests.
- [PROC-OOM] [proc_pid_oom_score(5)](https://man7.org/linux/man-pages/man5/proc_pid_oom_score.5.html) — Linux man-pages, living. Backs: `oom_score` is based on memory used, reflects `oom_score_adj`, higher = more likely to be selected.
- [SIGNAL] [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages, living. Backs: SIGKILL cannot be caught, blocked, or ignored.
- [LIFECYCLE] [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: default `restartPolicy: Always`, exponential restart backoff (10 s … 300 s, reset after 10 min), `CrashLoopBackOff`.
- [SMAPS] [proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) — Linux man-pages, living. Backs: Rss and Pss definitions.
- [ORB] [OrbStack architecture](https://docs.orbstack.dev/architecture) — OrbStack, living. Backs: containers on macOS run in a lightweight Linux VM.
- Measurements in §4.5 and §5.5: own benchmark of a Node.js + Playwright Chromium PDF service in Docker with `--cpus` / `--memory`, cgroup v2 `cpu.stat`, `memory.current`, `memory.stat` and `/proc/<pid>/smaps_rollup`, 2026-10-19/20.

## Related
- `kubernetes/cpu-limits-and-throttling.md` — the CPU half as a short concept doc.
- `kubernetes/memory-limits-and-oom-kill.md` — the memory half as a short concept doc.
- `kubernetes/volumes-secrets-and-projected.md` — the other Kubernetes topic in this store.
- [proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) — RSS vs PSS per process.
