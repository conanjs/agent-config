---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/networking
status: verified
applies-to: ["Kubernetes ≥ 1.29", "Gateway API v1"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, ingress, gateway-api, httproute, network-policy, default-deny, north-south, east-west]
---

# Ingress, Gateway API and NetworkPolicy

## Summary
**TL;DR:** Two different traffic controls. **North-south** (into the cluster): an **Ingress** or, its successor, the **Gateway API** (GatewayClass → Gateway → HTTPRoute/GRPCRoute) describes HTTP routing to Services; both do nothing until a **controller** implements them. The Ingress API is frozen and the project recommends Gateway. **East-west** (between pods): **NetworkPolicy** isolates pods. Pods accept all traffic until a policy selects them; then only what some policy allows gets in (or out). Policies only add allowances — there are no deny rules — and they only work if the network plugin enforces them.
**Use this when:** you expose HTTP services, migrate from Ingress to Gateway, lock down pod-to-pod traffic, or a policy "does nothing".
**Not this doc:** Services and kube-proxy → `networking/services-and-kube-proxy.md`; pod IPs and CNI → `networking/pod-networking-and-dns.md`.

## Problem
Teams apply an Ingress and nothing happens (no controller installed), write NetworkPolicies on a plugin that ignores them, or expect a policy to "deny" something another policy allows. Each comes from these APIs being declarations that something else must implement, with additive semantics.

## Mental model
**Analogy:** a building. The **Gateway** is the front entrance with a receptionist who reads each visitor's request ("/login → accounts team") — the routes. The building owner picks the receptionist company (GatewayClass); each team writes its own directions (HTTPRoute). **NetworkPolicy** is the badge system on internal doors: by default every door is open; once a door gets a badge reader (a policy selects the pod), only listed badges open it, and adding readers can only add badges, never revoke one.

**Artifact:** a default-deny plus one allowance (the shape tested in the lab):
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: web-allow-labeled}
spec:
  podSelector: {matchLabels: {app: web}}      # these pods become isolated for ingress …
  policyTypes: [Ingress]
  ingress:
  - from: [{podSelector: {matchLabels: {access: "true"}}}]   # … except from pods labelled access=true
```

## How it works
**4 actors:**
- **Ingress / Gateway API objects** — its job: declare routing; Gateway API kinds are add-on custom resources ✅[^2].
- **Ingress or Gateway controller** — its job: program a proxy or cloud load balancer from those objects; without one, an Ingress "has no effect" ✅[^1] ✅[^2].
- **NetworkPolicy objects** — its job: declare which traffic selected pods accept or send ✅[^3].
- **Network plugin** — its job: enforce policies; "Creating a NetworkPolicy resource without a controller that implements it will have no effect" ✅[^3].

**Gateway API roles and kinds** ✅[^2]:

| Kind | Owned by (role) | Purpose |
|---|---|---|
| GatewayClass | Infrastructure provider | Type of gateway, bound to a controller (`controllerName`) |
| Gateway | Cluster operator | An instance (LB or proxy) with listeners; refers to one GatewayClass |
| HTTPRoute / GRPCRoute | Application developer | Rules mapping hostnames/paths/headers to backend Services; attach to a Gateway via `parentRefs` |

**Ingress status:** "The Kubernetes project recommends using Gateway instead of Ingress. The Ingress API has been frozen." It stays GA and is not planned for removal ✅[^1].

**NetworkPolicy semantics** ✅[^3]:
1. Pods are non-isolated by default, for both ingress and egress.
2. A pod becomes isolated for a direction when some policy selects it and lists that direction in `policyTypes`.
3. Once isolated for ingress, only traffic from its own node and traffic allowed by some policy's `ingress` rules gets in.
4. Policies are additive (a union); order does not matter; there is no deny rule.
5. A connection needs the source's egress **and** the destination's ingress to allow it; replies are allowed implicitly.
6. Peers are chosen with `podSelector` (same namespace), `namespaceSelector`, or `ipBlock` (CIDR with `except`).
7. Default deny for a namespace: `podSelector: {}` with `policyTypes: [Ingress]` and no rules.

## Worked example
Lab run (k3s v1.33.5 with its built-in policy controller, 2026-11-04) ✅[^4]:

| Step | Command / change | Result from `client` pod |
|---|---|---|
| 1 | No policy; `wget` to the `web` Service | reachable |
| 2 | Apply `web-allow-labeled` (artifact above) | `can't connect to remote host (10.43.208.65): Connection refused` → blocked |
| 3 | `kubectl label pod client access=true` | reachable |

Note the failure shape: this implementation (k3s) rejected the connection ("refused"); other plugins may behave differently. Either way the Service IP was still resolved and DNAT'd — the policy acts on the pod-to-pod traffic after that.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Ingress created, no controller | Nothing | Needs a controller ✅[^1] |
| NetworkPolicy on a plugin without support | No effect, no error | Implementation-dependent ✅[^3] |
| Policy allows A→B ingress, but A is egress-isolated without an egress rule to B | Blocked | Both sides must allow ✅[^3] |
| Egress default deny | DNS breaks too | DNS to CoreDNS is egress; allow UDP/TCP 53 ✅[^4] (lab: with egress denied, `nslookup web` failed; after allowing UDP/TCP 53 to `k8s-app: kube-dns` it resolved) |
| Trying to block one pod that another policy allows | Not possible | No deny rules ✅[^3] |
| Traffic from the node (kubelet probes) | Always allowed | Node traffic exception ✅[^3] |

## Takeaways
- Install and choose the controller first; Ingress/Gateway objects are only declarations.
- Start namespaces with default-deny ingress, then add explicit allowances; remember DNS when adding egress deny. [rule-candidate]
- Prefer Gateway API for new work; Ingress is frozen.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) — Kubernetes project, living. Backs: Ingress frozen and Gateway recommended, still GA, needs a controller. [^1]
- [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/) — Kubernetes project, living. Backs: add-on CRDs, GatewayClass/Gateway/HTTPRoute/GRPCRoute, roles, controller requirement, parentRefs. [^2]
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) — Kubernetes project, living. Backs: non-isolated default, per-direction isolation, additive semantics, both sides must allow, peer selectors, node exception, default deny, plugin requirement. [^3]
- `kubernetes/lab-setup.md` — the k3s lab where the policy test was run on 2026-11-04. [^4]

## Related
- `kubernetes/networking/services-and-kube-proxy.md` — the Services routes point to.
- `kubernetes/security/pod-security.md` — the other half of workload hardening.
