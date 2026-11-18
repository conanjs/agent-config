---
schema: infra
last-updated: 2026-11-06
---

# ne-import-shipment-api: pod CPU and memory limits and what Node.js sees

_Last verified on 2026-11-06 against `ne-ecom-gitops` commit `2b144f4463` (overlays) and the live `internal-test-env` pod on cluster `sea1-dev-ecom-gke03` (Node.js 24.22.1, libuv 1.52.1). Contains no secrets._

## Purpose
Show, for every overlay of `ne-import-shipment-api`, what CPU and memory limit the container gets, what `os.availableParallelism()` and `os.cpus().length` return inside it, and how many pdfmake worker threads the service therefore starts by default. The generic mechanism (how libuv computes the number) lives in `{{AGENT_HOME}}/knowledge/js-runtime/worker-thread-pools.md`; this doc applies it to the real manifests.

## The manifests (sampled from `applications/ne-import-shipment-api/overlays/<env>/deployment.yaml`)

`internal-test` (lines 40-46):
```yaml
          resources:
            limits:
              memory: 512Mi
              cpu: 500m
            requests:
              memory: 256Mi
              cpu: 100m
```

`production` (lines 42-48) and `loadtest` (lines 46-52) are identical:
```yaml
          resources:
            limits:
              memory: 2048Mi
              cpu: 1000m
            requests:
              memory: 1024Mi
              cpu: 500m
```

`stage` (lines 35-39); `test` (lines 40-44) is the same:
```yaml
          resources:
            limits:
              memory: 1024Mi
            requests:
              memory: 768Mi
```

`education` (lines 34-38) and `stage-dr` (lines 35-39) have the same shape with `requests.memory: 512Mi`. `development` has no `resources:` block at all. No overlay sets a `PDFMAKE_*` environment variable (`grep -rn PDFMAKE applications/ne-import-shipment-api` returns nothing), so the code defaults apply.

## How the limit reaches Node.js

| Manifest field | What the kubelet gives the container | Where Node.js reads it |
|---|---|---|
| `limits.memory: 512Mi` | cgroup file `/sys/fs/cgroup/memory.max` = `536870912` | `process.constrainedMemory()` (512 MiB). `os.totalmem()` still returns the whole node (about 14,988 MiB on the 4-vCPU node) |
| `limits.cpu: 500m` | cgroup file `/sys/fs/cgroup/cpu.max` = `50000 100000` (quota `milliCPU × 100`, period 100,000 µs) | `os.availableParallelism()` only. `os.cpus().length` ignores it |
| no `limits.cpu` | `cpu.max` = `max 100000` ("max" means no quota) | `os.availableParallelism()` = the number of CPUs the process may run on |
| `requests.*` | Scheduling and priority under node pressure; no limit file | Not visible to Node.js |

`cpu.max` holds `<quota> <period>`, both in microseconds: in every `period` window the whole container (all threads together) may use `quota` microseconds of CPU time. `50000 100000` means 50 ms of CPU in each 100 ms, which is half of one CPU.

## How `availableParallelism()` is calculated (libuv 1.52.1)
1. `N` = the number of CPUs in the process's affinity mask (the `Cpus_allowed_list` line of `/proc/self/status`: the CPU numbers the threads are allowed to run on). Without CPU pinning this is every CPU of the node, the same number as `os.cpus().length`. It is **not** always equal to it: pinning shrinks `N` while `os.cpus().length` stays at the node's total. Example: `docker run --cpuset-cpus=0,1` restricts a container to CPUs 0 and 1, so `Cpus_allowed_list` is `0-1`, `N` is 2 and `availableParallelism()` is 2 even with no quota, while `os.cpus().length` still shows all CPUs. In Kubernetes, pinning happens only with the kubelet's `static` CPU manager policy and only for Guaranteed pods with whole-number CPU requests; this service's pods set `requests` below `limits` (Burstable) or no CPU at all, so `N` is the node's CPU count (confirmed in the `internal-test` pod: `Cpus_allowed_list` `0-3`).
2. If there is no CPU limit, `cpu.max` reads `max 100000` (`max` is the quota, `100000` only the period), libuv skips the quota step, and the result is `N`. This is the case of the five overlays without `limits.cpu`.
3. If `cpu.max` has a quota: `cpus = quota ÷ period` with **integer division** (the fraction is dropped), and `0` becomes `1`.
4. The result is `min(N, cpus)`.

Worked with this service's numbers: `internal-test` has `50000 ÷ 100000 = 0` → raised to 1 → `min(4, 1)` = **1**. `production` has `100000 ÷ 100000 = 1` → `min(4, 1)` = **1**. `stage` has no quota → **4** (`N`).

## Result per overlay
`N` = 4 is the CPU count of the nodes of cluster `sea1-dev-ecom-gke03` (`kubectl get nodes`: machine type `c4-standard-4`, 4 CPUs, 3920m allocatable). The clusters of the other environments were not checked, so the `N` column holds for `internal-test` and is an assumption elsewhere; the formula is the same whatever `N` is.

Default worker threads in `PdfmakeService` = `max(1, min(PDFMAKE_DEFAULT_WORKER_THREADS (2), availableParallelism() − 1))`.

| Overlay | `limits.cpu` | `cpu.max` | `os.cpus().length` | `availableParallelism()` | Default workers | `limits.memory` / `memory.max` |
|---|---|---|---|---|---|---|
| development | none (no block) | `max 100000` | 4 | 4 | 2 | none |
| education | none | `max 100000` | 4 | 4 | 2 | 1024Mi / 1073741824 |
| stage | none | `max 100000` | 4 | 4 | 2 | 1024Mi / 1073741824 |
| stage-dr | none | `max 100000` | 4 | 4 | 2 | 1024Mi / 1073741824 |
| test | none | `max 100000` | 4 | 4 | 2 | 1024Mi / 1073741824 |
| internal-test | 500m | `50000 100000` | 4 | **1** | **1** | 512Mi / 536870912 |
| production | 1000m | `100000 100000` | 4 | **1** | **1** | 2048Mi / 2147483648 |
| loadtest | 1000m | `100000 100000` | 4 | **1** | **1** | 2048Mi / 2147483648 |

On a node with `M` CPUs the five rows without a CPU limit give `min(2, M − 1)` workers (1 worker when `M` ≤ 2, otherwise 2). In those five overlays (development, education, stage, stage-dr, test) `cpu.max` is `max 100000`, libuv skips the quota step, and `availableParallelism()` equals `N`, the node's CPU count (4 on cluster `sea1-dev-ecom-gke03`).

## Evidence from the live pod (`internal-test-env`, 2026-11-06)
Command (read-only):
```sh
kubectl exec -n internal-test-env <ne-import-shipment-api pod> -- sh -c '
echo "cpu.max     : $(cat /sys/fs/cgroup/cpu.max)"
echo "memory.max  : $(cat /sys/fs/cgroup/memory.max)"
grep Cpus_allowed_list /proc/self/status
node -e "const os=require(\"os\"); console.log(\"os.cpus().length =\", os.cpus().length); console.log(\"availableParallelism() =\", os.availableParallelism()); console.log(\"totalmem MB =\", Math.round(os.totalmem()/1048576)); console.log(\"constrainedMemory MB =\", Math.round(process.constrainedMemory()/1048576))"'
```
Output:
```text
cpu.max        : 50000 100000
memory.max     : 536870912
Cpus_allowed_list: 0-3
os.cpus().length            = 4
os.availableParallelism()   = 1
os.totalmem() (MB)          = 14988
constrainedMemory() (MB)    = 512
```
This matches the `--cpus=0.5` row of the table in the generic doc's Worked example, and confirms `limits.cpu: 500m` and `limits.memory: 512Mi` arrive as `cpu.max` `50000 100000` and `memory.max` `536870912`.

## Reproduce without a cluster
```sh
docker run --rm --cpus=0.5 --memory=512m node:24.22.1-alpine \
  node -e 'const os=require("os"); console.log(os.cpus().length, os.availableParallelism(), process.constrainedMemory()/1048576)'
```
Expected on an 8-CPU machine: `8 1 512`. Replace `--cpus` with `1`, `2` or remove it to reproduce the other rows (the full matrix, including `--cpuset-cpus`, is in the generic doc).

## What it means for the pdfmake workers
- `internal-test` and `production` start **1** worker and `stage` (4-CPU nodes) starts **2**, unless `PDFMAKE_WORKER_THREADS` is set.
- Without `resourceLimits` (now the case) each worker, and the main thread, gets a default heap limit of `clamp(limit ÷ 2, 256 MiB, 2 GiB)`; the rule, source and measurements are in `{{AGENT_HOME}}/knowledge/js-runtime/node-worker-default-heap-limit.md`. Applied to the overlays (workers from the table above; the sum is the most JavaScript heap the main thread plus workers may reach before any V8 limit stops them, not what they use):

| Overlay | `limits.memory` | Default `maxOldGenerationSizeMb` per thread (MiB) | Default `maxYoungGenerationSizeMb` (MiB) | `heap_size_limit` inside a worker (MB) | Workers | Main thread + workers (old-generation limits summed) | Reading |
|---|---|---|---|---|---|---|---|
| internal-test | 512Mi | 256 | 3 | 259 | 1 | 512 MiB | Equal to the container limit: no margin for Buffers, native memory and stacks |
| production, loadtest | 2048Mi | 1024 | 96 | 1120 | 1 | 2048 MiB | Equal to the container limit |
| stage, test, education, stage-dr | 1024Mi | 512 | 48 | 560 | 2 (4-CPU nodes) | 1536 MiB | Above the container limit: a kernel kill (exit 137) can come before any worker error |
| development | none | 2048 (node RAM 14,988 MiB is below 15 GiB) | 192 | 2240 | 2 | 6144 MiB | No container limit to protect |

  The default is not always half of `limits.memory`: it is half only between 512 MiB and 4 GiB; see `{{AGENT_HOME}}/knowledge/js-runtime/node-worker-default-heap-limit.md`. The three container values (512, 1024, 2048) were measured in a Docker container of the same size; the development row is computed from the rule. Measured in a 512 MiB container: one worker over its limit fails cleanly with `ERR_WORKER_OUT_OF_MEMORY`; two workers each allocating 250 MB (below the 256 MiB limit each) got the container killed (exit 137). The sums above are from the rule, not measured per overlay.
- `PdfmakeService` logs the inputs of its worker count in the `workerThreads` getter, so the real values show in the pod log: `PDFMAKE_WORKER_THREADS=<value>, availableParallelism()=<n>, PDFMAKE_DEFAULT_WORKER_THREADS=2` (`src/modules/file/services/pdfmake.service.ts`). The getter runs on every access, so the line repeats (several times when the pool starts, once per render). Each render log line also carries `threads`, `queue` and `completed` from the pool: `PDF rendered in <ms>ms (<KB> KB) [<builder>, threads <n>, queue <n>, completed <n>]`.

## Open items
- Check `N` on the cluster behind `stage`, `education`, `test` and `production` (`kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu`), and confirm with the startup log line after deploy.
- Check whether the `development` namespace has a `LimitRange` that adds default limits (this doc assumes none).

## Related
- `{{AGENT_HOME}}/knowledge/js-runtime/worker-thread-pools.md` — the generic mechanism, the full `docker run` matrix and the measured worker sizing.
- `{{AGENT_HOME}}/knowledge/kubernetes/cpu-limits-and-throttling.md` — how `limits.cpu` becomes `cpu.max` and how the kernel throttles.
- `{{AGENT_HOME}}/knowledge/kubernetes/memory-limits-and-oom-kill.md` — why memory over the limit is killed (exit 137).
- [GKE Clusters]({{AGENT_HOME}}/companies/ots/infra/gke-clusters.md)
- [ne-import-shipment-api overview]({{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/overview.md)

## References
- `{{OTS_REPOS_ROOT}}/ne-ecom-gitops/applications/ne-import-shipment-api/overlays/<env>/deployment.yaml` — the sampled `resources:` blocks (commit `2b144f4463`).
- `{{OTS_REPOS_ROOT}}/ne-import-shipment-api/src/modules/file/services/pdfmake.service.ts` — the worker-count getter and its startup log line.
- [libuv v1.52.1 `src/unix/core.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/core.c) and [`src/unix/linux.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/linux.c) — `uv_available_parallelism`, `uv__get_cgroupv2_constrained_cpu`.
- [Kubernetes `helpers_linux.go`](https://github.com/kubernetes/kubernetes/blob/master/pkg/kubelet/cm/helpers_linux.go) — `MilliCPUToQuota` (`quota = milliCPU × period ÷ 1000`, period 100000).
- [Kubernetes: Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — limits are enforced by the kernel with cgroups.
- [GKE: Customizing node system configuration](https://cloud.google.com/kubernetes-engine/docs/how-to/node-system-config) — `cpuCFSQuota` default `true`, period 100 ms.
- [Docker: Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) — `--cpuset-cpus` (which CPUs a container may use) vs `--cpus` (how much CPU time).
- [Kubernetes: Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/) — only Guaranteed pods with integer CPU requests get exclusive CPUs under the `static` policy.
