---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/networking
last-updated: 2026-11-04
---

# Kubernetes networking

The flat pod network provided by CNI plugins, cluster DNS with CoreDNS and `ndots:5`, Services with EndpointSlices and kube-proxy's iptables DNAT rules, and north-south (Ingress, Gateway API) and east-west (NetworkPolicy) traffic control. Not covered: service meshes, multi-cluster networking.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [pod-networking-and-dns.md](pod-networking-and-dns.md) | concept | Kubernetes requires a flat network: every pod gets its **own cluster-wide IP**, containers in one pod share it (and talk over `localhost`), and any pod can reach any other pod **without NAT** | verified |
| [services-and-kube-proxy.md](services-and-kube-proxy.md) | concept | Pods come and go with new IPs; a **Service** gives a set of pods (chosen by a label selector) one stable virtual IP and DNS name | verified |
| [ingress-gateway-and-network-policy.md](ingress-gateway-and-network-policy.md) | concept | Two different traffic controls | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
