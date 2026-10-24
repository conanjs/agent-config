---
schema: knowledge-doc/v1
type: concept
topic: kubernetes
status: verified
applies-to: ["Linux cgroup v2", "Kubernetes ≥ 1.25 on Linux nodes", "Docker --memory"]
derived-from: [kubernetes/container-cpu-memory-limits-deep-dive.md]
last-verified: 2026-10-20
last-updated: 2026-10-20
tags: [kubernetes, cgroups, memory, oom, eviction, exit-137]
---

# Memory limits and OOM kills in containers

## Summary
**TL;DR:** A memory limit is a hard ceiling on the pages a container's processes use. Memory cannot be paused like CPU time, so when the container is at its limit and the kernel cannot reclaim enough, the kernel's **OOM killer** kills processes in that container (exit code `137`, status `OOMKilled`) and the kubelet restarts it. A separate mechanism, **node-pressure eviction**, removes whole pods when the node itself runs low.
**Use this when:** a pod shows `OOMKilled`, exit code `137` or a growing `RESTARTS` count; you are choosing `requests.memory` / `limits.memory`; or you need to know which memory number to watch.
**Not this doc:** CPU limits and throttling → `cpu-limits-and-throttling.md`; full end-to-end story → `container-cpu-memory-limits-deep-dive.md`.

## Problem
CPU over the limit only makes a container slower, so it is tempting to expect the same from memory. Instead the container disappears and restarts, often with no error in the application's own logs, and summing per-process memory gives numbers far above what the limit actually measures.

## Mental model
**Analogy:** CPU is a queue at a counter: if you are over your share you just wait your turn. Memory is seats in a room: a seated person cannot be "paused out" of their seat. When the room (limit) is full and nobody can be asked to stand up (reclaim), someone is removed.

**Artifact** — the files and the status you will see ✅ [CG2] [K8S-MEM] [BASH]:
```console
$ cat /sys/fs/cgroup/memory.max
2147483648                       # 2 GiB = limits.memory: 2Gi
$ cat /sys/fs/cgroup/memory.current
1426063360                       # everything charged: processes + file cache
$ grep inactive_file /sys/fs/cgroup/memory.stat
inactive_file 129314816          # droppable cache → working set = current − this

$ kubectl describe pod <pod>
    Last State:  Terminated
      Reason:    OOMKilled
      Exit Code: 137             # 128 + 9 (SIGKILL)
```

## How it works
**5 actors:**
- **Application** — its job: allocate memory, via normal allocations (heap, buffers, new Chromium pages).
- **Kernel memory cgroup** — its job: charge every page to the container and enforce the ceiling, via `memory.max`. ✅ [CG2]
- **Kernel OOM killer** — its job: free memory by killing processes in the cgroup, via `SIGKILL`. ✅ [CG2] [BASH]
- **kubelet** — its job: restart the killed container, and evict pods when the node is low, via the container runtime and node stats. ✅ [K8S-MEM] [EVICT]
- **kube-scheduler** — its job: place pods so that memory **requests** fit on the node, via the API server. ✅ [K8S-RES]

```
app allocates ─► cgroup charges pages ─► memory.current reaches memory.max?
                                            │ no → continue
                                            ▼ yes
                                     kernel reclaims (drop file cache, swap if any)
                                            │ enough → continue
                                            ▼ cannot reduce
                                     OOM killer in THIS cgroup
                                     (whole container if memory.oom.group = 1)
                                            ▼
                                     SIGKILL → exit 137 → status OOMKilled
                                            ▼
                                     kubelet restarts the container (RESTARTS +1)
```

1. **Application (local):** allocates memory.
2. **Kernel memory cgroup (local):** charges the pages; `memory.current` includes process memory and file cache. ✅ [CG2]
3. **Kernel (local):** at the limit, it first tries to reclaim. ✅ [CG2]
4. **Kernel OOM killer (local):** if usage "can't be reduced", the OOM killer is invoked **in that cgroup only**. ✅ [CG2]
   - It picks the victim by each process's `oom_score`: based on the memory the process uses, adjusted by `oom_score_adj`; a higher score is more likely to be selected. ✅ [PROC-OOM]
   - On cgroup v2, Kubernetes sets `memory.oom.group` unless the kubelet option `singleProcessOOMKill` is true, so **all processes in the container are killed together**. ✅ [KUBELET-CFG] (A Node.js app that spawned Chromium dies with it.)
5. **Runtime → kubelet (local):** the container exits with `137` (fatal signal 9 → 128 + 9). ✅ [BASH] Its status is `OOMKilled`. ✅ [K8S-MEM]
6. **kubelet (local) → API server (network):** restarts the container per its restart policy and reports the new status. ✅ [K8S-MEM]

**Why kill instead of throttle:** memory is **incompressible**. CPU time can be given later, but a page holding data cannot be taken back without losing the data. ✅ [QOS-DESIGN] The soft brake `memory.high` exists: it throttles allocation and forces heavy reclaim, but never kills. ✅ [CG2] Kubernetes sets it only when the kubelet field `memoryThrottlingFactor` is set; the default is `nil`. ✅ [QOS]

**Timing:** the kernel only kills when it detects memory pressure, so a container can be over its limit briefly before it is killed. ✅ [K8S-RES]

**Two different kills:**

| | Container OOM kill | Node-pressure eviction |
|---|---|---|
| Who | Kernel ✅ [CG2] | kubelet ✅ [EVICT] |
| Trigger | One container over **its own** limit | The **node** low on memory: `memory.available` = capacity − node working set ✅ [EVICT] |
| Victim | Processes in that container | Whole pods: BestEffort first, then Burstable, Guaranteed last ✅ [QOS] |
| Result | Container restarts in place | Pod terminated; its controller creates a new one |

**Which number to watch:** working set = `memory.current − inactive_file`. The kubelet uses it because inactive file cache can always be dropped. ✅ [EVICT]

## Worked example
A Node.js service renders PDFs with headless Chromium in a container with `--cpus=1 --memory=2g` (measured, cgroup v2):

| Run | Peak working set | Result |
|---|---|---|
| 50 PDFs with at most 3 Chromium pages at once | ~680 MB | 50/50 done |
| 50 PDFs, all 50 pages at once (no cap) | **2,048 MB = the limit** | Every page hit the 30 s render timeout; none finished |

The same service with 3 pages open, three ways of adding memory:

| Measure | Value | Meaning |
|---|---|---|
| Sum of each process's RSS | 1,496 MB | Shared pages counted once per process: too high |
| Sum of each process's PSS | 482 MB | Shared pages split fairly between processes |
| cgroup `memory.current` | 361 MB | What the limit is compared with |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Over the request, under the limit, node fine | Nothing | The request is for placement only ✅ [K8S-RES] |
| Over the request, node under memory pressure | Pod may be **evicted** by kubelet | Eviction ranks pods by usage above request ✅ [EVICT] [QOS] |
| Briefly over the limit | Can survive until the kernel sees pressure | Kills only happen under pressure ✅ [K8S-RES] |
| Usage is mostly file cache | Reclaimed first; usually no kill | File pages can be dropped ✅ [CG2] |
| No memory limit at all | Bounded only by the node; a host-level OOM can kill any process | ✅ [DOCKER] |
| Container runs several processes (e.g. Chromium) | The whole container is killed on cgroup v2 | `memory.oom.group` ✅ [KUBELET-CFG] |
| Requests equal limits for CPU and memory | Pod is **Guaranteed**: evicted last under node pressure | QoS criteria ✅ [QOS] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Limit close to normal usage | Packs more pods per node | OOM kills on bursts (e.g. many PDFs at once) |
| Limit well above normal usage, request at normal usage | Room for bursts | Burstable QoS; eviction candidate under node pressure |
| Request = limit (Guaranteed) | Evicted last; predictable | Reserves the peak amount permanently |
| Cap in-app concurrency (pages, workers) | Keeps peak memory bounded | Bursts queue instead of running at once |

## Takeaways
- Size `limits.memory` from the **peak working set under the largest expected burst**, and cap in-app concurrency so a burst cannot exceed it. [rule-candidate]
- Watch working set (`memory.current − inactive_file`), not summed process RSS.
- `OOMKilled` / exit `137` means the kernel killed the container at its limit; the application usually cannot log it, so check `kubectl describe pod`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 29 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-20

## References
- [CG2] [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `memory.max` (OOM killer when usage can't be reduced), `memory.high`, `memory.current`, `memory.stat`, memory ownership.
- [K8S-RES] [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: requests for placement, memory limits enforced by OOM kills only under pressure.
- [K8S-MEM] [Assign Memory Resources to Containers and Pods](https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/) — Kubernetes project, living. Backs: `OOMKilled`, termination past the limit, kubelet restart.
- [KUBELET-CFG] [Kubelet Configuration (v1beta1): singleProcessOOMKill](https://kubernetes.io/docs/reference/config-api/kubelet-config.v1beta1/) — Kubernetes project, living. Backs: `memory.oom.group` → processes killed as a group on cgroup v2.
- [EVICT] [Node-pressure Eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/) — Kubernetes project, living. Backs: kubelet eviction, `memory.available`, working set excludes `inactive_file`.
- [QOS] [Pod Quality of Service Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) — Kubernetes project, living. Backs: QoS criteria and eviction order; `memoryThrottlingFactor` default `nil`.
- [QOS-DESIGN] [Resource QoS design proposal](https://github.com/kubernetes/design-proposals-archive/blob/main/node/resource-qos.md) — Kubernetes project (archived), 2016. Backs: memory is incompressible.
- [PROC-OOM] [proc_pid_oom_score(5)](https://man7.org/linux/man-pages/man5/proc_pid_oom_score.5.html) — Linux man-pages, living. Backs: `oom_score` is based on memory used, reflects `oom_score_adj`; higher = more likely to be selected.
- [BASH] [Bash Reference Manual: Exit Status](https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html) — GNU, living. Backs: exit status 128 + signal number.
- [DOCKER] [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) — Docker, living. Backs: host-level OOME can kill any process.
- `kubernetes/container-cpu-memory-limits-deep-dive.md` — the deep dive this doc was distilled from (measurements and full walk-through).

## Related
- `kubernetes/cpu-limits-and-throttling.md` — the CPU side: throttling instead of killing.
- `kubernetes/container-cpu-memory-limits-deep-dive.md` — full end-to-end version with both resources.
- [proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) — RSS vs PSS per process.
