---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/workloads
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, scheduler, requests, taints, tolerations, node-affinity, pod-anti-affinity, topology-spread, pending]
---

# Scheduling and placement: requests, affinity, taints

## Summary
**TL;DR:** The scheduler places each unbound pod in two steps: **filter** out nodes that cannot run it (not enough *requested* CPU/memory, a taint it does not tolerate, a required affinity it does not meet…), then **score** the remaining feasible nodes and bind to the best (random among ties). If no node passes, the pod stays `Pending` with a `FailedScheduling` event that names every reason. You steer placement with `nodeSelector`/node affinity (attract to nodes), taints and tolerations (repel from nodes), pod (anti-)affinity and topology spread (relative to other pods).
**Use this when:** a pod is `Pending`, you dedicate nodes to a workload, spread replicas across zones, or size requests.
**Not this doc:** what requests and limits do at runtime → `kubernetes/cpu-limits-and-throttling.md`, `kubernetes/memory-limits-and-oom-kill.md`.

## Problem
Pods stay `Pending` on a cluster with "free" CPU (because the scheduler counts requests, not usage); all replicas land on one node and die together; GPU nodes fill up with ordinary pods. Each is a filter or score the team did not set.

## Mental model
**Analogy:** seating guests at a wedding. Filtering removes tables that cannot take the guest (not enough seats reserved = requests; "family only" sign = taint without the matching invitation = toleration; "must sit by the window" = required affinity). Scoring picks the nicest remaining table (spread friends apart, prefer the garden). A guest with no possible table waits in the lobby (`Pending`).

**Artifact:** a pod spec that uses every lever (values are examples):
```yaml
spec:
  containers:
  - name: worker
    image: example/worker:2.1
    resources: {requests: {cpu: "500m", memory: 512Mi}}      # what filtering counts
  tolerations:
  - {key: dedicated, operator: Equal, value: batch, effect: NoSchedule}   # may use batch nodes
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions: [{key: node-pool, operator: In, values: [batch]}]   # must use batch nodes
  topologySpreadConstraints:
  - {maxSkew: 1, topologyKey: topology.kubernetes.io/zone, whenUnsatisfiable: ScheduleAnyway,
     labelSelector: {matchLabels: {app: worker}}}           # prefer an even spread over zones
```

## How it works
**3 actors:**
- **kube-scheduler** — its job: choose a node for each unbound pod, via filter and score plugins ✅[^1].
- **API server** — its job: store the decision as a binding (`spec.nodeName`) ✅[^1].
- **Node lifecycle / admins** — its job: label and taint nodes, via node objects.

1. **Queue:** pods without a node wait in the scheduling queue.
2. **Filter:** remove nodes that cannot run the pod; e.g. the resource filter checks that the node's allocatable minus already-**requested** resources fits the pod's requests ✅[^1]. Remaining nodes are *feasible*.
3. **Score:** rank feasible nodes with the active scoring rules; pick the highest; break ties at random ✅[^1].
4. **Bind:** tell the API server; the kubelet on that node takes over ✅[^1].
5. **No feasible node:** the pod stays unscheduled; preemption may evict lower-priority pods to make room ✅[^5].

**The levers:**

| Lever | Direction | Hard or soft | Notes |
|---|---|---|---|
| `resources.requests` | Fit | Hard (filter) | Usage is ignored; requests are reserved ✅[^1] |
| `nodeSelector` | Attract to labelled nodes | Hard | Node must have **all** labels ✅[^2] |
| Node affinity `required…` / `preferred…` | Attract | Hard / soft (weighted) | `IgnoredDuringExecution`: label changes later do not evict ✅[^2] |
| Taint `NoSchedule` | Repel new pods | Hard unless tolerated | Running pods stay ✅[^3] |
| Taint `PreferNoSchedule` | Repel | Soft | ✅[^3] |
| Taint `NoExecute` | Repel and **evict** running pods | Hard | `tolerationSeconds` delays eviction ✅[^3] |
| Toleration | Allows a tainted node | — | Allows, does not attract; combine with affinity to dedicate nodes ✅[^3] |
| Pod affinity / anti-affinity | Near / away from other pods in a `topologyKey` domain | Hard or soft | ✅[^6] |
| Topology spread constraints | Even spread over zones/nodes | Hard or soft | `maxSkew`, `whenUnsatisfiable` ✅[^7] |

## Worked example
Two real `Pending` pods from the lab (k3s v1.33.5, one node, 2026-11-04) ✅[^4]:

| Pod | Event message | Filter that failed | Fix |
|---|---|---|---|
| `toobig` (`requests.cpu: 64`) | `0/1 nodes are available: 1 Insufficient cpu. preemption: … No preemption victims found` | Resources | Lower the request or add a bigger node |
| `tainted` (no toleration) after `kubectl taint nodes <n> dedicated=batch:NoSchedule` | `0/1 nodes are available: 1 node(s) had untolerated taint {dedicated: batch}` | Taint | Add the toleration, or remove the taint — after `kubectl taint nodes <n> dedicated-` the pod was `Running` within 8 s |

Reading the message: `0/N nodes are available:` followed by one count per reason; the counts add up to N.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Node CPU 20% used but pods `Pending` for CPU | Requests, not usage, are counted | Resource filter ✅[^1] |
| Pod with no requests | Fits anywhere; can overload a node | The scheduler only sums requests ✅[^8] (lab: a pod without requests was `BestEffort` and scheduled) ✅[^4] |
| Toleration only, to "dedicate" nodes | Pod may still land elsewhere | Tolerations allow, they do not attract ✅[^3] |
| Node label removed after scheduling | Pod keeps running | `IgnoredDuringExecution` ✅[^2] |
| Node becomes unreachable | `NoExecute` taint; pods evicted after 300 s by default | Built-in taints and default toleration seconds ✅[^9] |
| `nodeName` set directly | Scheduler bypassed | "the scheduler ignores the Pod" ✅[^6] |

## Takeaways
- Set realistic requests on every container; the scheduler can only pack what is declared. [rule-candidate]
- Dedicate nodes with **both** a taint (keep others off) and node affinity (keep this workload on).
- Spread replicas across zones/nodes with topology spread constraints or anti-affinity.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 23 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) — Kubernetes project, living. Backs: filtering, resource fit, scoring, random tie-break, binding, unschedulable pods. [^1]
- [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/) — Kubernetes project, living. Backs: nodeSelector all-labels rule, node affinity hard/soft, operators, IgnoredDuringExecution. [^2]
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) — Kubernetes project, living. Backs: effects, eviction and `tolerationSeconds`, tolerations allow but do not guarantee. [^3]
- `kubernetes/lab-setup.md` — the k3s lab where both `FailedScheduling` messages were captured on 2026-11-04. [^4]
- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) — Kubernetes project, living. Backs: preemption exists (details unverified here). [^5]
- [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/) — Kubernetes project, living. Backs: `topologyKey` domains for (anti-)affinity; with `nodeName` set the scheduler ignores the Pod. [^6]
- [Pod Topology Spread Constraints](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/) — Kubernetes project, living. Backs: `maxSkew`, `whenUnsatisfiable`. [^7]
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) — Kubernetes project, living. Backs: the scheduler keeps the sum of requests below node capacity. [^8]
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) — Kubernetes project, living. Backs: automatic `not-ready`/`unreachable` tolerations with `tolerationSeconds=300`. [^9]

## Related
- `kubernetes/cpu-limits-and-throttling.md` — requests vs limits at runtime.
- `kubernetes/operations/autoscaling.md` — adding nodes when pods are `Pending`.
