---
schema: knowledge-doc/v1
type: reference
topic: kubernetes
status: verified
applies-to: ["Kubernetes ≥ 1.29", "the docs under knowledge/kubernetes/ as of 2026-11-04"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, learning-path, curriculum, roadmap, study-plan]
---

# Kubernetes learning path: from containers to operating a cluster

## Summary
**TL;DR:** Start from Linux containers (namespaces, cgroups), then learn Kubernetes as a set of control loops over a shared API: architecture → workloads and scheduling → networking → storage and configuration → security → operations. Each stage lists the docs to read, a lab exercise in the k3s lab, and a self-check.
**Use this when:** you start learning Kubernetes internals, plan study time, or want the next doc to read.
**Not this doc:** the lab itself → `kubernetes/lab-setup.md`.

## Scope
Every v1 doc under `knowledge/kubernetes/` plus the Linux container docs it builds on. Stages only depend on earlier ones. Topics not covered yet are listed at the end.

## Catalog

### Stages

| # | Stage | Read (in order) | Lab exercise (`kubernetes/lab-setup.md`) | Self-check: you can explain … |
|---|---|---|---|---|
| 0 | Prerequisite: containers | `linux/containers/container-from-primitives-deep-dive.md` → `linux/containers/cgroups-v2.md` | Build a container by hand (Linux lab) | … what a container is, in kernel terms |
| 1 | Architecture | `architecture/life-of-a-pod-deep-dive.md` → `architecture/control-plane-and-reconciliation.md` | `kubectl create deployment`, then read events and owner references | … which component acts at each step from `kubectl apply` to a running container |
| 2 | Workloads & scheduling | `workloads/pod-lifecycle-and-probes.md` → `workloads/deployments-and-rollouts.md` → `workloads/workload-controllers.md` → `workloads/scheduling-and-placement.md` | Roll out a new image and undo it; create a crash, a liveness failure, a `Pending` pod; taint the node | … why a 3-replica rollout updates one pod at a time, and every reason a pod can be `Pending` |
| 3 | Resources | `cpu-limits-and-throttling.md` → `memory-limits-and-oom-kill.md` → `container-cpu-memory-limits-deep-dive.md` | Guaranteed pod: read `cpu.max`/`memory.max` inside it; OOM-kill a pod | … what `limits.cpu: 250m` becomes in the kernel |
| 4 | Networking | `networking/pod-networking-and-dns.md` → `networking/services-and-kube-proxy.md` → `networking/ingress-gateway-and-network-policy.md` | Expose a Deployment; read its iptables chain; `nslookup` from a pod; apply a NetworkPolicy | … how a packet to a ClusterIP reaches a pod, and why `ndots:5` slows external lookups |
| 5 | Storage & configuration | `storage/persistent-volumes-and-csi.md` → `volumes-secrets-and-projected.md` | PVC with `WaitForFirstConsumer`: watch `Pending` → `Bound` | … what happens to the data when the claim is deleted |
| 6 | Security | `security/rbac-and-service-accounts.md` → `security/pod-security.md` → `linux/containers/container-isolation.md` | `kubectl auth can-i --as=…`; read a pod's token; label a namespace `restricted` and deploy a privileged pod | … the difference between API permissions (RBAC) and node permissions (securityContext) |
| 7 | Operations | `operations/troubleshooting-pods.md` → `operations/autoscaling.md` → `linux/system-management/performance-triage.md` | Diagnose each failure from stage 2 using only `kubectl` | … the one command that explains each pod status |

### Free, authoritative resources

| Resource | Why |
|---|---|
| [Kubernetes documentation](https://kubernetes.io/docs/home/) | Concepts, tasks and reference for every object in these docs |
| [Kubernetes API reference](https://kubernetes.io/docs/reference/kubernetes-api/) | Exact fields and defaults |
| [Gateway API](https://gateway-api.sigs.k8s.io/) | The successor of Ingress |
| [K3s documentation](https://docs.k3s.io/) | The lab distribution |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| ConfigMaps, resource quotas and LimitRanges | `workloads/` or a new `configuration/` | kubernetes.io "Configuration" and "Policies" concepts |
| Custom resources, operators, admission webhooks | `architecture/` | "Extending Kubernetes" concepts |
| etcd operations, backup and upgrades | `operations/` | kubernetes.io "Operating etcd clusters" |
| Observability (metrics pipeline, logging, events) | `operations/` | kubernetes.io "Logging Architecture" |
| Multi-tenancy and cluster federation | new subtopic | kubernetes.io "Multi-tenancy" |
| Windows nodes | `windows/` + `kubernetes/` | kubernetes.io "Windows containers in Kubernetes" |

## Lookup notes
- Lab outputs come from k3s v1.33.5 on one node; managed clusters differ in CNI, storage classes and kube-proxy mode.
- The kubernetes.io pages are "living" and describe the newest release; check the version selector when a default matters.

## Takeaways
- Learn the Linux container layer first; Kubernetes adds control loops on top of it, not new isolation.
- After each stage, reproduce at least one failure in the lab and explain it from events alone.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: the resources table.
- [Gateway API](https://gateway-api.sigs.k8s.io/) — Kubernetes SIG Network, living. Backs: the resources table.
- `kubernetes/lab-setup.md` — the lab every exercise runs in.

## Related
- `linux/learning-path.md` — the Linux path that stage 0 comes from.
- `kubernetes/lab-setup.md` — set up the lab before stage 1.
