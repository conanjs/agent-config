---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/workloads
last-updated: 2026-11-04
---

# Workloads and scheduling

Pods and the controllers that manage them: pod phases, probes, restart back-off and graceful termination; Deployments and rolling updates; StatefulSets, DaemonSets, Jobs and CronJobs; and how the scheduler places pods with requests, affinity, taints and tolerations. Not covered: ConfigMaps, quotas and LimitRanges.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [pod-lifecycle-and-probes.md](pod-lifecycle-and-probes.md) | concept | A pod moves through phases (`Pending` → `Running` → `Succeeded`/`Failed`, or `Unknown`), while each container is `Waiting`, `Running` or `Terminated` | verified |
| [deployments-and-rollouts.md](deployments-and-rollouts.md) | concept | A Deployment does not manage pods directly: it owns one **ReplicaSet** per pod-template version (named by `pod-template-hash`), and each ReplicaSet keeps N pods alive | verified |
| [workload-controllers.md](workload-controllers.md) | reference | Pick the controller by what the pods need: interchangeable replicas → **Deployment**; stable names, per-pod storage and ordered start/stop → **StatefulSet**; one pod per node → **DaemonSet**; run to completion → **Job**; run to completion on a schedule → **CronJob** | verified |
| [scheduling-and-placement.md](scheduling-and-placement.md) | concept | The scheduler places each unbound pod in two steps: **filter** out nodes that cannot run it (not enough *requested* CPU/memory, a taint it does not tolerate, a required affinity it does not meet…), then **score** the remaining feasible nodes and bind to the best (random among ties) | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
