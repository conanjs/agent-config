---
schema: topic-index/v1
kind: topic
topic: kubernetes
last-updated: 2026-11-04
---

# Kubernetes

Kubernetes covers how the cluster works and how workloads run on it: the control plane and reconciliation loops (traced end to end for one Deployment), pods, probes, rollouts, workload controllers and scheduling, pod networking, DNS, Services and kube-proxy, Ingress, Gateway API and NetworkPolicy, persistent storage, RBAC and Pod Security, troubleshooting and autoscaling — plus, at this level, how workloads get configuration and credentials from the cluster (volumes, Secret volumes, projected volumes and external secret stores) and how container CPU and memory limits work at runtime (cgroups, CPU throttling, OOM kills, eviction). Start with `learning-path.md`. It does not cover cluster operations such as upgrades and etcd backup, or GKE tooling; see the legacy GCP notes below.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Seven stages from Linux containers to operating a cluster, with docs, a lab exercise and a self-check per stage | verified |
| [lab-setup.md](lab-setup.md) | how-to | A disposable k3s cluster in a privileged Docker container; the source of the captured outputs | verified |
| [volumes-secrets-and-projected.md](volumes-secrets-and-projected.md) | concept | Secret vs volume vs mounted folder, `secret:` vs `projected:`, the `..data` symlink scheme, and the path from an external secret store to a file the app reads | verified |
| [cpu-limits-and-throttling.md](cpu-limits-and-throttling.md) | concept | What `limits.cpu` / "1 vCPU" really is (a time budget per 100 ms), how `500m` / `1` / `2` / no limit / `--cpus` map to the kernel, how the kernel throttles a group's threads, requests vs limits, laptop vs pod | verified |
| [memory-limits-and-oom-kill.md](memory-limits-and-oom-kill.md) | concept | Why memory over the limit is killed (exit 137, `OOMKilled`) instead of throttled, the OOM path, working set, and node-pressure eviction | verified |
| [container-cpu-memory-limits-deep-dive.md](container-cpu-memory-limits-deep-dive.md) | deep-dive | Every actor from scheduler to kernel, CFS bandwidth slices, OOM path, laptop vs container vs pod, measured examples and edge-case matrices; synthesized into the two concept docs above | verified |
| [GKE and Lens setup](../gcp/gke-lens-setup.md) | legacy | Inspecting a GKE cluster with Lens | — |

## Subtopics
| Subtopic | Summary |
|---|---|
| [architecture/](architecture/index.md) | Life of a pod from `kubectl` to iptables (deep dive); control plane components, the API request path and reconciliation loops |
| [workloads/](workloads/index.md) | Pod phases, probes, back-off and graceful termination; Deployments and rolling updates; StatefulSet/DaemonSet/Job/CronJob; scheduling with requests, affinity, taints |
| [networking/](networking/index.md) | CNI pod network and CoreDNS; Services, EndpointSlices and kube-proxy rules; Ingress, Gateway API and NetworkPolicy |
| [storage/](storage/index.md) | PVCs, PVs, StorageClasses, binding modes, access modes, reclaim policies, CSI |
| [security/](security/index.md) | RBAC roles and bindings, service account tokens, Pod Security Standards and admission |
| [operations/](operations/index.md) | Troubleshooting pods step by step; HPA, VPA and node autoscaling |

## References
- [Kubernetes documentation: Volumes](https://kubernetes.io/docs/concepts/storage/volumes/) — Kubernetes project, living. Backs: topic scope.
- [External Secrets Operator](https://external-secrets.io/latest/introduction/overview/) — External Secrets project, living. Backs: topic scope.
- [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) — Kubernetes project, living. Backs: topic scope (architecture).
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: topic scope (resource limits).

## Related
- `gcp/` — legacy GKE and GCP notes.
- `operations/` — configuration and secrets handling in application code.
- `linux/containers/` — the kernel mechanisms underneath (namespaces, cgroups v2, overlayfs, container networking and isolation).
