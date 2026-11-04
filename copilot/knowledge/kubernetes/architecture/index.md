---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/architecture
last-updated: 2026-11-04
---

# Kubernetes architecture

How the control plane and nodes cooperate: the API server in front of etcd, controllers that reconcile desired and actual state, the scheduler, kubelets, container runtimes, CNI and kube-proxy, traced end to end for one Deployment. Not covered: extending the API (CRDs, operators, webhooks).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [life-of-a-pod-deep-dive.md](life-of-a-pod-deep-dive.md) | deep-dive | One Deployment from kubectl through API server, controllers, scheduler, kubelet, CRI, CNI, EndpointSlices and kube-proxy iptables rules, with live k3s output, a component-failure matrix and failure signatures | verified |
| [control-plane-and-reconciliation.md](control-plane-and-reconciliation.md) | concept | Kubernetes is a database of desired state (the API server in front of etcd) plus many small, independent **control loops** | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
