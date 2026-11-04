---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/operations
status: verified
applies-to: ["Kubernetes ≥ 1.29", "autoscaling/v2", "metrics-server"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, autoscaling, hpa, vpa, cluster-autoscaler, metrics-server, stabilization, requests]
---

# Autoscaling: HPA, VPA and node autoscaling

## Summary
**TL;DR:** Three loops scale three things. The **HorizontalPodAutoscaler (HPA)** changes a workload's replica count every 15 s using `desired = ceil(current × currentMetric / targetMetric)`, ignores changes within a 10% tolerance, and for scale-down uses the highest recommendation of the last 5 minutes. CPU/memory **utilization is measured against requests**, so pods without requests cannot be scaled on them. The **VerticalPodAutoscaler (VPA)** adjusts requests instead. A **node autoscaler** (Cluster Autoscaler, Karpenter) adds nodes when pods are `Pending` for lack of room and removes underused nodes.
**Use this when:** you configure an HPA, scaling is too slow, too jumpy or does nothing, or you plan how pod and node autoscaling interact.
**Not this doc:** what requests and limits mean at runtime → `kubernetes/cpu-limits-and-throttling.md`; scheduling of the new pods → `workloads/scheduling-and-placement.md`.

## Problem
An HPA that never scales (no metrics-server, or no requests), one that flaps up and down, scale-up that stalls because new pods are `Pending` with no node autoscaler, and HPA plus VPA fighting over the same CPU signal are the common autoscaling failures.

## Mental model
**Analogy:** a call centre. The HPA is the shift supervisor who adds or sends home agents based on average calls per agent compared with a target, but waits five minutes of calm before sending anyone home. The VPA changes how big each agent's desk is. The node autoscaler rents another floor when there is no desk left for a new agent.

**Artifact:** an `autoscaling/v2` HPA (values are examples):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: {name: cpu, target: {type: Utilization, averageUtilization: 60}}   # 60% of the CPU *request*
```

## How it works
**4 actors:**
- **HPA controller** (in kube-controller-manager) — its job: compute desired replicas each sync period (default 15 s) and update the target's `scale` ✅[^1].
- **Metrics APIs** — its job: provide numbers: `metrics.k8s.io` (usually metrics-server, installed separately), `custom.metrics.k8s.io`, `external.metrics.k8s.io` ✅[^1].
- **Workload controller** — its job: create or delete pods to match the new `replicas`.
- **Node autoscaler** — its job: add nodes for unschedulable pods and remove empty or underused ones ✅[^3] ✅[^4].

**HPA algorithm** ✅[^1]:
1. Read the metric for each target pod; for utilization targets, utilization = usage ÷ the container's **request**.
2. `desiredReplicas = ceil[currentReplicas × (currentMetricValue / desiredMetricValue)]`.
3. Skip if the ratio is within the tolerance (default 0.1) of 1.0.
4. Pods with missing metrics are set aside, then assumed to use 100% of target on scale-down and 0% on scale-up; not-yet-ready pods are treated as 0% on scale-up.
5. Scale-down uses the highest recommendation within the stabilization window (default 300 s), which prevents flapping.
6. If any container lacks the relevant request, utilization for that metric is undefined and the HPA takes no action on it.

**The other two autoscalers** (outside core Kubernetes):

| Autoscaler | Changes | Signal | Caveat |
|---|---|---|---|
| VPA | Container CPU/memory resources (vertical scaling) ✅[^5] | Usage history | See the VPA project for update modes |
| Cluster Autoscaler / Karpenter | Node count | Pods that failed to schedule for lack of resources; nodes underutilized for an extended time ✅[^4] | Pods must declare requests for the scheduler to pack them ✅[^6] |

## Worked example
4 replicas, target 60% CPU utilization, each pod requests `500m`:

| Pod CPU usage | Utilization (usage ÷ 500m) |
|---|---|
| 450m, 400m, 500m, 450m | 90%, 80%, 100%, 90% → average 90% |

`desired = ceil(4 × 90 / 60) = ceil(6.0) = 6` → scale to 6 ✅[^1]. Ten minutes later the average falls to 40%: `ceil(6 × 40 / 60) = 4`. The HPA keeps the highest recommendation of the last 300 s, so it scales down only after the load has stayed low for 5 minutes ✅[^1]. If the 2 new pods cannot fit on any node, they stay `Pending` until a node autoscaler adds capacity — the HPA alone cannot fix that.

The lab cluster ran without metrics-server (disabled at start), which is exactly the case where an HPA reports no metrics and does nothing ✅[^2].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| No metrics-server | HPA shows unknown metrics; no scaling | `metrics.k8s.io` missing ✅[^1] |
| Containers without CPU requests | No action on CPU utilization | Utilization undefined ✅[^1] |
| Ratio 1.08 | No change | Within 10% tolerance ✅[^1] |
| Quick spike, then drop | Scales up fast, down only after 5 minutes | Stabilization window ✅[^1] |
| Sidecar with tiny request | Skews utilization | Utilization is per container request — pod-level utilization may not represent individual containers; use container resource metrics ✅[^7] |

## Takeaways
- Set CPU/memory requests on every container of a scaled workload; the HPA divides by them. [rule-candidate]
- Pair pod autoscaling with node autoscaling, or new replicas will sit `Pending`.
- Tune `behavior` (stabilization, policies) instead of fighting flapping with min/max replicas.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) — Kubernetes project, living. Backs: sync period 15 s, formula, tolerance 0.1, stabilization 300 s, utilization vs requests, missing requests, missing metrics and not-ready handling, metrics APIs. [^1]
- `kubernetes/lab-setup.md` — the k3s lab, started without metrics-server, on 2026-11-04. [^2]
- [Vertical Pod Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler) and [Cluster Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler) — Kubernetes autoscaler project, living. Backs: further reading for the unverified rows.
- [Node Autoscaling](https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/) — Kubernetes project, living. Backs: provisioning and consolidating nodes. [^3]
- [Cluster Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler) — Kubernetes autoscaler project, living. Backs: scales up for pods that failed to schedule for lack of resources; removes nodes underutilized for an extended time. [^4]
- [Autoscaling Workloads](https://kubernetes.io/docs/concepts/workloads/autoscaling/) — Kubernetes project, living. Backs: vertical scaling resizes container CPU and memory. [^5]
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: the scheduler keeps the sum of requests below node capacity. [^6]
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) — Kubernetes project, living. Backs: pod-level utilization may not represent individual containers; container resource metrics. [^7]

## Related
- `kubernetes/cpu-limits-and-throttling.md` — requests vs limits.
- `kubernetes/workloads/scheduling-and-placement.md` — why new pods may be `Pending`.
