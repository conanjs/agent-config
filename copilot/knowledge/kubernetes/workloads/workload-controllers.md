---
schema: knowledge-doc/v1
type: reference
topic: kubernetes/workloads
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, deployment, statefulset, daemonset, job, cronjob, replicaset, workloads]
---

# Workload controllers compared: Deployment, StatefulSet, DaemonSet, Job, CronJob

## Summary
**TL;DR:** Pick the controller by what the pods need: interchangeable replicas → **Deployment**; stable names, per-pod storage and ordered start/stop → **StatefulSet**; one pod per node → **DaemonSet**; run to completion → **Job**; run to completion on a schedule → **CronJob**. All of them create Pods through the API server and are reconciled by controllers in kube-controller-manager.
**Use this when:** you choose a workload type, or need the guarantees and defaults of one quickly.
**Not this doc:** rollout mechanics of Deployments → `workloads/deployments-and-rollouts.md`.

## Scope
Built-in workload controllers of Kubernetes ≥ 1.29, their guarantees and the defaults most often relied on. Claims come from the kubernetes.io concept pages.

## Catalog

### Which controller

| Controller | Pod identity | Storage | Scaling / ordering | Typical use |
|---|---|---|---|---|
| Deployment (→ ReplicaSet) | Random names (`web-7dd566fbcc-4rh2q`), interchangeable ✅[^5] | Shared or none; a `ReadWriteOnce` volume mounts read-write on one node only ✅[^6] | Any order; rolling update with surge/unavailable ✅[^1] | Stateless web/API services |
| StatefulSet | Stable names `web-0`, `web-1`, … and stable DNS via a required headless Service ✅[^2] | One PVC per pod from `volumeClaimTemplates`, **kept** on scale-down or deletion ✅[^2] | `OrderedReady` (default) or `Parallel`; rolling updates in **reverse** ordinal order; `partition` for staged updates ✅[^2] | Databases, brokers, quorum systems |
| DaemonSet | One pod per eligible node ✅[^3] | Any | Pods follow nodes: added as nodes join, garbage-collected as they leave ✅[^3] | Log shippers, node monitoring, storage and network agents ✅[^3] |
| Job | Pods run to completion | Any | `completions`, `parallelism` ✅[^7] (both default 1) | Batch tasks, migrations |
| CronJob | Creates Jobs on a repeating schedule ✅[^8] | Any | Cron schedule, `concurrencyPolicy` ✅[^8] | Periodic batch |

### Defaults worth knowing

| Field | Controller | Default | Source |
|---|---|---|---|
| `strategy.rollingUpdate.maxSurge` / `maxUnavailable` | Deployment | 25% / 25% (round up / down) | ✅[^1] |
| `revisionHistoryLimit` | Deployment | 10 | ✅[^1] |
| `progressDeadlineSeconds` | Deployment | 600 | ✅[^1] |
| `podManagementPolicy` | StatefulSet | `OrderedReady` | ✅[^2] |
| `backoffLimit` | Job | 6 | ✅[^7] |
| `restartPolicy` | Job pods | must be `OnFailure` or `Never` | ✅[^7] |
| Pod restart back-off | all | 10 s doubling, cap 300 s, reset after 10 min healthy | ✅[^4] |

### How each places pods

| Controller | Placement |
|---|---|
| Deployment / ReplicaSet / StatefulSet / Job | Pods go to the scheduler like any other ✅[^9] |
| DaemonSet | The controller creates one Pod per eligible node with a `nodeAffinity` matching that node's `metadata.name`; the default scheduler then binds it ✅[^3] |

## Lookup notes
- Deleting a StatefulSet does not guarantee ordered termination; scale it to 0 first ✅[^2].
- StatefulSet PVCs survive scale-down: delete them yourself when the data is no longer needed ✅[^2].
- The headless Service for a StatefulSet must exist; create it yourself ✅[^2].
- A DaemonSet with a `nodeSelector` or affinity runs only on matching nodes ✅[^3].

## Takeaways
- Default to a Deployment; move to a StatefulSet only for stable identity or per-pod storage.
- Use DaemonSets for node agents, and remember their pods must tolerate the taints on special nodes.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — Kubernetes project, living. Backs: Deployment defaults. [^1]
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) — Kubernetes project, living. Backs: stable identity, headless Service, PVC retention, ordering policies, reverse-order updates, partition, deletion caveat. [^2]
- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/) — Kubernetes project, living. Backs: one pod per node, node join/leave, uses, per-node affinity, selector behaviour. [^3]
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: restart back-off. [^4]
- `kubernetes/lab-setup.md` — the k3s lab where Deployment pod names were captured on 2026-11-04. [^5]
- [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) and [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) — Kubernetes project, living. Backs: further reading for the ⚠️ rows.
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) — Kubernetes project, living. Backs: `ReadWriteOnce` = read-write by a single node. [^6]
- [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) — Kubernetes project, living. Backs: `backoffLimit` default 6; `RestartPolicy` must be `OnFailure` or `Never`; `completions`/`parallelism` default 1. [^7]
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) — Kubernetes project, living. Backs: creates Jobs on a repeating schedule; `concurrencyPolicy`. [^8]
- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) — Kubernetes project, living. Backs: the scheduler places every unscheduled Pod. [^9]

## Related
- `kubernetes/workloads/deployments-and-rollouts.md` — the Deployment in depth.
- `kubernetes/storage/persistent-volumes-and-csi.md` — the PVCs StatefulSets create.
