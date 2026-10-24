---
schema: topic-index/v1
kind: topic
topic: kubernetes
last-updated: 2026-10-20
---

# Kubernetes

Kubernetes covers how workloads get configuration and credentials from the cluster (volumes, Secret volumes, projected volumes and how external secret stores feed them) and how container CPU and memory limits work at runtime (cgroups, CPU throttling, OOM kills, eviction). It does not cover cluster operations or GKE tooling; see the legacy GCP notes below.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [volumes-secrets-and-projected.md](volumes-secrets-and-projected.md) | concept | Secret vs volume vs mounted folder, `secret:` vs `projected:`, the `..data` symlink scheme, and the path from an external secret store to a file the app reads | verified |
| [cpu-limits-and-throttling.md](cpu-limits-and-throttling.md) | concept | What `limits.cpu` / "1 vCPU" really is (a time budget per 100 ms), how `500m` / `1` / `2` / no limit / `--cpus` map to the kernel, how the kernel throttles a group's threads, requests vs limits, laptop vs pod | verified |
| [memory-limits-and-oom-kill.md](memory-limits-and-oom-kill.md) | concept | Why memory over the limit is killed (exit 137, `OOMKilled`) instead of throttled, the OOM path, working set, and node-pressure eviction | verified |
| [container-cpu-memory-limits-deep-dive.md](container-cpu-memory-limits-deep-dive.md) | deep-dive | Every actor from scheduler to kernel, CFS bandwidth slices, OOM path, laptop vs container vs pod, measured examples and edge-case matrices; synthesized into the two concept docs above | verified |
| [GKE and Lens setup](../gcp/gke-lens-setup.md) | legacy | Inspecting a GKE cluster with Lens | — |

## References
- [Kubernetes documentation: Volumes](https://kubernetes.io/docs/concepts/storage/volumes/) — Kubernetes project, living. Backs: topic scope.
- [External Secrets Operator](https://external-secrets.io/latest/introduction/overview/) — External Secrets project, living. Backs: topic scope.
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: topic scope (resource limits).

## Related
- `gcp/` — legacy GKE and GCP notes.
- `operations/` — configuration and secrets handling in application code.
