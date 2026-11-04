---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/networking
status: verified
applies-to: ["Kubernetes ≥ 1.29 on Linux nodes", "CoreDNS"]
derived-from: [kubernetes/architecture/life-of-a-pod-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, pod-networking, cni, flannel, calico, cilium, coredns, dns, ndots, resolv-conf]
---

# Pod networking (CNI) and cluster DNS

## Summary
**TL;DR:** Kubernetes requires a flat network: every pod gets its **own cluster-wide IP**, containers in one pod share it (and talk over `localhost`), and any pod can reach any other pod **without NAT**. Kubernetes does not implement this itself: the container runtime creates the pod's network namespace and calls a **CNI plugin** (flannel, Calico, Cilium, a cloud VPC plugin…) to wire it up. Names come from **CoreDNS**: a Service `web` in namespace `default` is `web.default.svc.cluster.local`, and the kubelet writes a pod `resolv.conf` with search domains and `ndots:5`, which makes short names work but multiplies queries for external names.
**Use this when:** pods cannot reach each other, DNS lookups are slow or fail, you choose a CNI plugin, or you see `10.42.x.x` / `10.43.x.x` addresses and want to know what they are.
**Not this doc:** Service virtual IPs → `networking/services-and-kube-proxy.md`; the Linux pieces (namespaces, veth, bridges) → `linux/containers/container-networking.md`.

## Problem
Cross-node pod traffic silently failing (overlay or routes broken), external API calls that are slow because each lookup tries four search domains first, and "it works with the IP but not the name" are the classic pod-network and DNS problems.

## Mental model
**Analogy:** an office campus where every desk (pod) has a direct phone number, no switchboard in between (no NAT). The cabling contractor (CNI plugin) runs the wires — how is their business (overlay tunnels, routed VPC, eBPF). The campus directory (CoreDNS) maps names to numbers, and everyone's phone auto-completes short names with their own building first (search domains).

**Artifact:** a pod's DNS configuration and a lookup (lab, k3s v1.33.5 with flannel and CoreDNS, 2026-11-04) ✅[^3]:
```text
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.43.0.10            # the CoreDNS Service's ClusterIP
options ndots:5
Name:	web.default.svc.cluster.local
Address: 10.43.208.65            # a Service IP (10.43.0.0/16); pods use 10.42.0.0/16
```

## How it works
**4 actors:**
- **Container runtime (CRI)** — its job: create the pod's network namespace, via sandbox setup ✅[^1].
- **CNI plugin** — its job: give the namespace an interface, an IP and routes to other pods, via the pod network implementation ✅[^1].
- **CoreDNS** — its job: answer cluster names (and forward others), via a Service reachable at the `nameserver` IP ✅[^2] ✅[^4] (the lab cluster runs a `coredns` deployment) ✅[^3].
- **kubelet** — its job: write each pod's `/etc/resolv.conf` ✅[^2].

**The network model** ✅[^1]:
1. "Each pod in a cluster gets its own unique cluster-wide IP address."
2. Containers in a pod share a network namespace and reach each other on `localhost`.
3. "All pods can communicate with all other pods… without the use of proxies or address translation (NAT)."
4. Node agents (kubelet, daemons) can reach all pods on their node.
5. NetworkPolicy, if used, is enforced by the pod network implementation; plugins that do not implement it leave the API present but ineffective.

**How plugins meet the model** (common designs):

| Design | Example plugins | Cross-node packets |
|---|---|---|
| Overlay | flannel VXLAN (k3s default; lab node has a `vxlan` device `flannel.1`) ✅[^3] ✅[^5], Calico VXLAN ✅[^6] | Wrapped in a UDP tunnel between nodes |
| Routed | Calico BGP ✅[^6], cloud VPC CNIs | Pod IPs are routable on the underlying network |
| eBPF datapath | Cilium | eBPF data plane; can fully replace kube-proxy ✅[^7] |

**DNS names** ✅[^2]:

| Name form | Resolves to |
|---|---|
| `my-svc.my-ns.svc.cluster.local` | The Service's ClusterIP (A/AAAA) |
| Same name, headless Service | IPs of all selected pods |
| `_port-name._tcp.my-svc.my-ns.svc.cluster.local` | SRV record with port and target |
| `my-svc` from the same namespace | Expanded through the search list |
| `my-svc.other-ns` | Works from any namespace |

**`ndots:5`:** a name with fewer than five dots is first tried with each search domain appended ✅[^2]. So `api.example.com` (2 dots) is tried as `api.example.com.default.svc.cluster.local`, `…svc.cluster.local`, `…cluster.local` before the real name ✅[^3] (lab: CoreDNS query log showed `example.com.default.svc.cluster.local.`, `example.com.svc.cluster.local.`, `example.com.cluster.local.`, then `example.com.`).

## Worked example
Pod IPs and Service IPs in the lab (2026-11-04) ✅[^3]:

| Object | IP | Range |
|---|---|---|
| CoreDNS pod | 10.42.0.2 | Pod CIDR (flannel, per node /24) |
| `web` pods | 10.42.0.10–12 | Pod CIDR |
| `web` Service | 10.43.208.65 | Service CIDR (virtual, only in rules) |
| CoreDNS Service | 10.43.0.10 | Service CIDR |

A lookup of an external name from a pod with defaults costs up to four rounds (three search domains + the real name), each possibly for both A and AAAA ✅[^3]. In the same log, `getent hosts example.com.` (trailing dot) produced only `example.com.` queries ✅[^3]; lowering `ndots` in `dnsConfig.options` has the same effect by the resolver rule ✅[^2].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Pods on the same node talk, cross-node fails | Overlay/routes broken (firewall blocking VXLAN UDP, missing routes) | The CNI's cross-node path (single-node lab: not tested) |
| `nslookup data` from namespace `test` for Service in `prod` | Fails; `data.prod` works | Search list starts with own namespace ✅[^2] |
| CoreDNS down | Names fail, IPs still work | DNS is a separate Service ✅[^3] (lab: CoreDNS scaled to 0 → `nslookup` exit 1, ClusterIP `wget` OK) |
| `hostNetwork: true` pod | Uses the node's IP and namespace; needs `dnsPolicy: ClusterFirstWithHostNet` for cluster DNS | ✅[^8] |
| NetworkPolicy with a plugin that does not enforce it | No effect | Implementation-dependent ✅[^1] |
| Pod IP reused after a pod dies | Stale clients may hit a different pod | IPs are not stable identities; use Services/DNS |

## Takeaways
- Use Service names, never pod IPs, in configuration. [rule-candidate]
- For pods that call many external hosts, use fully qualified names with a trailing dot or a lower `ndots`.
- Choose the CNI plugin for the features you need (NetworkPolicy, eBPF, routed vs overlay) — Kubernetes leaves it to the plugin.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Services, Load Balancing, and Networking](https://kubernetes.io/docs/concepts/services-networking/) — Kubernetes project, living. Backs: the network model, CRI and CNI roles, NetworkPolicy implementation dependence. [^1]
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) — Kubernetes project, living. Backs: name forms, headless and SRV records, `resolv.conf`, search list, `ndots:5`, cross-namespace lookups. [^2]
- `kubernetes/lab-setup.md` — the k3s lab where the `resolv.conf`, lookup and IP ranges were captured on 2026-11-04. [^3]
- [CoreDNS](https://coredns.io/manual/toc/) — CoreDNS project, living. Backs: further reading on the DNS server.
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the deep dive this doc was distilled from.
- [Using CoreDNS for Service Discovery](https://kubernetes.io/docs/tasks/administer-cluster/coredns/) — Kubernetes project, living. Backs: CoreDNS as the cluster DNS server. [^4]
- [flannel](https://github.com/flannel-io/flannel) — flannel project, living. Backs: backends including VXLAN. [^5]
- [Calico](https://github.com/projectcalico/calico) — Project Calico, living. Backs: BGP and VXLAN networking; eBPF and standard Linux data planes. [^6]
- [Cilium](https://github.com/cilium/cilium) — Cilium project, living. Backs: eBPF-based data plane that can replace kube-proxy. [^7]
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) — Kubernetes project, living. Backs: `ClusterFirstWithHostNet` for `hostNetwork` pods. [^8]

## Related
- `linux/containers/container-networking.md` — veth, bridges and NAT underneath.
- `kubernetes/networking/ingress-gateway-and-network-policy.md` — controlling traffic on this network.
