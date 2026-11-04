---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/networking
status: verified
applies-to: ["Kubernetes ≥ 1.29, kube-proxy iptables mode (lab: v1.33.5+k3s1)"]
derived-from: [kubernetes/architecture/life-of-a-pod-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, service, clusterip, nodeport, loadbalancer, headless, endpointslice, kube-proxy, iptables, dnat]
---

# Services, EndpointSlices and kube-proxy

## Summary
**TL;DR:** Pods come and go with new IPs; a **Service** gives a set of pods (chosen by a label selector) one stable virtual IP and DNS name. A controller keeps **EndpointSlices** listing the IPs of the *ready* pods behind it. On every node, **kube-proxy** watches Services and EndpointSlices and writes kernel rules: in iptables mode, a chain per Service that **DNATs** each new connection to a randomly chosen endpoint. The ClusterIP is not on any interface — it exists only as those rules. Types: `ClusterIP` (default, in-cluster), `NodePort` (plus a port on every node), `LoadBalancer` (plus an external load balancer), `ExternalName` (a DNS alias), headless (`clusterIP: None`, DNS returns pod IPs).
**Use this when:** a Service does not route, traffic is uneven, you read `iptables-save` on a node, choose a Service type, or need to know why `ping <ClusterIP>` fails.
**Not this doc:** pod IPs and DNS → `networking/pod-networking-and-dns.md`; external HTTP routing and policies → `networking/ingress-gateway-and-network-policy.md`; netfilter basics → `linux/networking/netfilter-and-nat.md`.

## Problem
"The Service has no endpoints", "traffic only goes to one pod", "I can't ping the ClusterIP" and "connections fail for a few seconds during deploys" are all explained by how EndpointSlices follow readiness and how kube-proxy turns them into per-connection NAT rules.

## Mental model
**Analogy:** a company switchboard number. Callers dial one published number (ClusterIP). The receptionist's list (EndpointSlice) holds the extensions of staff currently at their desks (ready pods). For each new call, the switchboard (kube-proxy's rules on every node) picks an extension at random and connects the call; once connected, the call stays on that extension.

**Artifact:** one Service and its slice (lab, k3s v1.33.5, 2026-11-04) ✅[^4]:
```console
$ kubectl get svc web -o wide
NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE   SELECTOR
web    ClusterIP   10.43.208.65   <none>        80/TCP    0s    app=web
$ kubectl get endpointslices -l kubernetes.io/service-name=web -o wide
NAME        ADDRESSTYPE   PORTS   ENDPOINTS                          AGE
web-jxjbr   IPv4          80      10.42.0.10,10.42.0.11,10.42.0.12   0s
```

## How it works
**4 actors:**
- **Service object** — its job: declare the selector, ports and type; gets a cluster IP from the Service range ✅[^1].
- **EndpointSlice controller** — its job: keep slices of matching, ready pod IPs, via continuously scanning pods that match the selector ✅[^1] ✅[^3].
- **kube-proxy (every node)** — its job: watch Services and EndpointSlices and program the node's packet rules, via iptables, IPVS or nftables (Linux) or kernelspace (Windows) ✅[^2].
- **Linux netfilter + conntrack** — its job: apply the DNAT on each new connection and remember it for the rest of the flow (see `linux/networking/netfilter-and-nat.md`).

```
client pod 10.42.0.20 ── connect 10.43.208.65:80
   │ (OUTPUT / PREROUTING on the client's node)
   ▼
KUBE-SERVICES: dst 10.43.208.65:80 ─► KUBE-SVC-LOLE4ISW44XBNF3G
   ├─ p=1/3 ─► KUBE-SEP-…  DNAT → 10.42.0.10:80
   ├─ p=1/2 of rest ─► KUBE-SEP-…  DNAT → 10.42.0.11:80
   └─ rest ─► KUBE-SEP-…  DNAT → 10.42.0.12:80
conntrack remembers the choice; replies are un-NAT'd back to 10.43.208.65:80
```

1. **Selector → slices:** pods matching `app=web` and passing readiness appear in the Service's EndpointSlices; a failing readiness probe removes them ✅[^1] ✅[^3].
2. **Watch → rules:** each kube-proxy watches Services and EndpointSlices and keeps node rules in sync with a control loop ✅[^2].
3. **iptables mode:** for each endpoint it installs rules that "by default, select a backend Pod at random" ✅[^2]. The lab's chain uses `--probability 0.33333333349`, then `0.5`, then an unconditional jump — an equal 1/3 share each ✅[^4].
4. **Masquerade mark:** traffic from outside the pod CIDR (`! -s 10.42.0.0/16`) and hairpin traffic (a pod reaching itself via the Service) is marked for SNAT ✅[^4] (the `KUBE-SEP` rule matches `-s <endpoint IP>`, i.e. the pod reaching itself).
5. **Modes:** iptables is the default on Linux in the current docs, which announce a future switch of the default to nftables; IPVS is also available ✅[^2].

**Service types:**

| Type | Reachable from | How |
|---|---|---|
| `ClusterIP` (default) | Inside the cluster | Virtual IP rules on every node ✅[^1] |
| `NodePort` | `<any-node-IP>:<port>` | Adds a port (default range 30000–32767) on every node ✅[^6] |
| `LoadBalancer` | External IP | Asks a cloud/LB controller for a load balancer that targets the nodes ✅[^6] |
| `ExternalName` | — | DNS CNAME to an outside name, no proxying ✅[^6] |
| Headless (`clusterIP: None`) | — | No virtual IP; DNS returns the pod IPs directly ✅[^5] |

## Worked example
The real chain for `web` (3 endpoints), as it sits in the node's `nat` table (lab, 2026-11-04) ✅[^4]:
```text
-A KUBE-SVC-LOLE4ISW44XBNF3G ! -s 10.42.0.0/16 -d 10.43.208.65/32 -p tcp --dport 80 -j KUBE-MARK-MASQ
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.0.10:80" -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-KKJTHWGQ5EHIOKS2
-A KUBE-SEP-KKJTHWGQ5EHIOKS2 -s 10.42.0.10/32 -j KUBE-MARK-MASQ
-A KUBE-SEP-UJOO5W55X2FBY24Q -p tcp -m tcp -j DNAT --to-destination 10.42.0.11:80
```

Why connections can fail for a moment during a rollout:

| t | Event |
|---|---|
| 0 | Pod `…10` gets `SIGTERM`; its endpoint is marked not ready/terminating in parallel ✅[^3] |
| shortly after | Each node's kube-proxy rewrites its rules when it sees the slice change ✅[^2] |
| meanwhile | A node with stale rules may still DNAT a new connection to `…10`, which is shutting down |
| fix | `preStop` sleep of a few seconds + `SIGTERM` handling (see `workloads/pod-lifecycle-and-probes.md`) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Service selector typo | Service exists, EndpointSlice empty, connections refused/time out | No matching pods ✅[^1] |
| Pods not ready | Removed from endpoints | Readiness ✅[^3] |
| `ping <ClusterIP>` | Fails, while TCP to the port works | Rules match only the Service's protocol/port; no interface owns the IP ✅[^4] (lab: `ping` 100% loss while `nc -z <ClusterIP> 80` reported open) |
| Long-lived connections (gRPC, HTTP/2) | Stick to one pod; uneven load after scaling | DNAT is chosen per connection ✅[^4] (lab: 20 requests on one keep-alive connection hit 1 pod; 20 new connections hit all 3) |
| A chosen endpoint fails mid-connect | Client sees the error on that connection | Random selection per connection ✅[^2]; retry in the client |
| Very many Services in iptables mode | One chain per Service and endpoint ✅[^4] | The docs offer other modes for better performance and scalability than iptables ✅[^2] |

## Takeaways
- When a Service misbehaves, check in order: selector ↔ pod labels, EndpointSlice contents, readiness, then node rules.
- Use client-side balancing or a mesh for long-lived multiplexed connections; Services balance connections, not requests.
- Pair readiness probes with a short `preStop` delay so endpoint removal propagates before shutdown.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 27 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/) — Kubernetes project, living. Backs: ClusterIP default, cluster IP for virtual IP mechanism, selector-driven EndpointSlices. [^1]
- [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/) — Kubernetes project, living. Backs: kube-proxy watches and sync loop, modes, iptables random selection, nftables as future default. [^2]
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: readiness removes pods from EndpointSlices; terminating endpoints. [^3]
- `kubernetes/lab-setup.md` — the k3s lab where the Service, EndpointSlice and iptables chains were captured on 2026-11-04. [^4]
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) — Kubernetes project, living. Backs: headless Services resolve to pod IPs. [^5]
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the deep dive this doc was distilled from.
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/) — Kubernetes project, living. Backs: NodePort range default 30000–32767, LoadBalancer via an external load balancer, ExternalName returns a CNAME. [^6]

## Related
- `linux/networking/netfilter-and-nat.md` — DNAT and conntrack.
- `kubernetes/networking/pod-networking-and-dns.md` — the pod IPs being targeted.
