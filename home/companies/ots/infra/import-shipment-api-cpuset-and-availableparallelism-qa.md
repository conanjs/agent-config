---
schema: infra
last-updated: 2026-11-06
---

# ne-import-shipment-api: Q&A on `--cpuset-cpus`, `N` and `availableParallelism()`

_Q&A kept as it was given on 2026-11-06, word for word (sections 1 and 2); section 3 was added the same day after a live check of the `internal-test-env` pod. In sections 1 and 2, "I" is the assistant that ran the measurements and "your overlays" are the `ne-ecom-gitops` overlays of `ne-import-shipment-api`. The full tables and commands are in [import-shipment-api-cpu-memory-limits.md]({{AGENT_HOME}}/companies/ots/infra/import-shipment-api-cpu-memory-limits.md); the generic mechanism is in `{{AGENT_HOME}}/knowledge/js-runtime/worker-thread-pools.md`._

## 1. What `--cpuset-cpus=0,1` means

- It is a Docker option that pins a container to specific CPUs: a comma list or a hyphen range, with CPUs numbered from 0. [Docker docs](https://docs.docker.com/engine/containers/resource_constraints/): `0-3` is the first four CPUs and `1,3` is the second and fourth.
- `--cpuset-cpus=0,1` means the container's threads may only run on CPU 0 and CPU 1. Inside it, `Cpus_allowed_list` reads `0-1`, so `N` is 2. `os.cpus().length` still lists all 8 CPUs of the machine.
- It is a different limit from `--cpus`:
  - `--cpuset-cpus` limits *which* CPUs the threads can use.
  - `--cpus` limits *how much* CPU time they get, which is the `cpu.max` quota.
  - I measured this: `--cpuset-cpus=0,1` with no quota gave `availableParallelism()` = 2.
- Kubernetes does not pin your pods this way. Per the [Kubernetes CPU management docs](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/), only containers in a Guaranteed pod with whole-number CPU requests get exclusive CPUs, and only when the kubelet runs the `static` policy. Your overlays set `requests` below `limits`, or no CPU request at all, so they are not pinned. The internal-test pod confirms it: `Cpus_allowed_list` was `0-3`, so `N` = 4.

## 2. Your three questions

1. **Is `N` always `os.cpus().length`?** No. They are the same only when the process is not pinned to specific CPUs.
   - `os.cpus().length` is the machine's CPU count and ignores limits.
   - `N` is the number of CPUs in the process's affinity mask (the `Cpus_allowed_list` line of `/proc/self/status`).
   - Measured: with `docker run --cpuset-cpus=0,1`, `os.cpus().length` was 8, `Cpus_allowed_list` was `0-1`, and `availableParallelism()` was 2, with no quota at all.
2. **What happens without a quota?** `cpu.max` reads `max 100000`, libuv skips the quota step, and the result is `N`. In the five no-limit overlays, `availableParallelism()` is `N`.
3. **Is it `min(N, cpus)`, with `cpus` = `quota ÷ period` using integer division?** Yes, with one detail: the minimum of 1 applies to `cpus`.
   - The full rule is `min(N, max(1, floor(quota ÷ period)))`.
   - So 1.99 CPU gives 1, and 2.9 CPU gives 2.
   - In the five overlays without a CPU limit, `N` is the node's CPU count unless the pods are pinned. They should not be, since the CPU manager only pins pods that have whole-number CPU requests, but I did not check that on the cluster.

## 3. Follow-up: is `N` = 4 in the internal-test pod "set by Kubernetes"?

**Question:** `N` is the number of CPUs in the process's affinity mask, which is 4 in the internal-test container pod (set by Kubernetes)?

**Answer:** The number 4 is right; "set by Kubernetes" is not. Kubernetes did not choose 4: it applied no CPU pinning, so the container's processes may run on every CPU of the node, and the node has 4.

Checked read-only in pod `ne-import-shipment-api-7b759bd47d-md7g7` (namespace `internal-test-env`, cluster `sea1-dev-ecom-gke03`) on 2026-11-06:
```sh
kubectl exec -n internal-test-env <pod> -- sh -c '
for f in cpuset.cpus cpuset.cpus.effective cpu.max; do echo "$f: [$(cat /sys/fs/cgroup/$f)]"; done
grep -E "Cpus_allowed_list" /proc/self/status
grep -c ^processor /proc/cpuinfo'
kubectl get pod -n internal-test-env <pod> -o jsonpath='{.status.qosClass}'
```
```text
cpuset.cpus: []
cpuset.cpus.effective: [0-3]
cpu.max: [50000 100000]
Cpus_allowed_list:	0-3
4
Burstable
```

| Value | Meaning here |
|---|---|
| `cpuset.cpus: []` (empty) | Nobody restricted this container to specific CPUs, so it inherits its parent's CPUs |
| `cpuset.cpus.effective: [0-3]` | The CPUs it may really use: all four CPUs of the node (`c4-standard-4`) |
| `Cpus_allowed_list: 0-3` | The process's affinity mask, inherited from that cgroup, so `N` = 4 |
| `grep -c ^processor /proc/cpuinfo` = 4 | The machine's CPU count, which is why `os.cpus().length` is also 4 |
| `cpu.max: [50000 100000]` | The CPU time budget from `limits.cpu: 500m`: a separate limit that makes `availableParallelism()` 1 (`50000 ÷ 100000` = 0, raised to 1, `min(4, 1)`) |
| QoS class `Burstable` | `requests` are below `limits`, so the pod is not Guaranteed and cannot get exclusive CPUs even under the `static` CPU manager policy |

Not checked: the kubelet's CPU manager policy on the node (it was not readable with the access used). It does not change the result for this pod, because it is Burstable.

## Related
- [import-shipment-api-cpu-memory-limits.md]({{AGENT_HOME}}/companies/ots/infra/import-shipment-api-cpu-memory-limits.md) — per-overlay manifests, table of results, live-pod evidence.
- `{{AGENT_HOME}}/knowledge/js-runtime/worker-thread-pools.md` — the libuv algorithm and the full `docker run` matrix.
- `{{AGENT_HOME}}/knowledge/kubernetes/cpu-limits-and-throttling.md` — how `limits.cpu` becomes `cpu.max`.

## References
- [Docker: Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) — `--cpuset-cpus` and `--cpus`.
- [Kubernetes: Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/) — `static` policy and exclusive CPUs.
- [libuv v1.52.1 `src/unix/core.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/core.c) and [`src/unix/linux.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/linux.c) — `uv_available_parallelism`.
- `{{OTS_REPOS_ROOT}}/ne-ecom-gitops/applications/ne-import-shipment-api/overlays/<env>/deployment.yaml` — the `resources:` blocks the answers refer to.
