---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/architecture
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
derived-from: [kubernetes/architecture/life-of-a-pod-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, control-plane, api-server, etcd, controllers, reconciliation, watch, admission, declarative]
---

# Control plane and the reconciliation loop

## Summary
**TL;DR:** Kubernetes is a database of desired state (the API server in front of etcd) plus many small, independent **control loops**. Every component — controllers, the scheduler, kubelets, kube-proxy — *watches* the objects it cares about and works to make reality match their `spec`, writing what it sees back into `status`. Nothing is commanded step by step: you change desired state, and the loops converge. Every request to the API server goes through authentication, authorization, admission and validation before it is stored.
**Use this when:** you need the mental model behind "declarative", wonder which component acts on an object, debug "I applied it but nothing happened", or design an operator/controller.
**Not this doc:** the full trace of one Deployment through every component → `architecture/life-of-a-pod-deep-dive.md`.

## Problem
People expect `kubectl apply` to *do* something synchronously and then look in the wrong place when it does not. Every Kubernetes behaviour — self-healing, rollouts, autoscaling, endpoints — is a controller closing a gap; knowing which loop owns a gap tells you where to look.

## Mental model
**Analogy:** a thermostat. You set the temperature (desired state, `spec`); the thermostat measures the room (current state, `status`) and switches the heater until they match, forever. Kubernetes is a building full of thermostats, one per concern (replica count, node placement, endpoints, …), all reading and writing one shared notice board (the API server) ✅[^2].

**Artifact:** the API server's watch stream — how every loop learns about changes (lab, k3s v1.33.5, 2026-11-04) ✅[^4]:
```console
$ kubectl get --raw "/api/v1/namespaces/default/pods?watch=1&labelSelector=app=web"
{"type":"ADDED","object":{"kind":"Pod","apiVersion":"v1","metadata":{"name":"web-7dd566fbcc-6r78f",
  "generateName":"web-7dd566fbcc-","namespace":"default","resourceVersion":"595", …
```
Each event (`ADDED`, `MODIFIED`, `DELETED`) carries the full object and a `resourceVersion`, so a client can resume a watch where it left off ✅[^8].

## How it works
**Control-plane and node components** ✅[^1]:

| Component | Job (from the docs) |
|---|---|
| kube-apiserver | "exposes the Kubernetes HTTP API" — the only component that talks to storage |
| etcd | "Consistent and highly-available key value store for all API server data" |
| kube-scheduler | "assigns each Pod to a suitable node" |
| kube-controller-manager | "Runs controllers to implement Kubernetes API behavior" |
| cloud-controller-manager (optional) | Integrates with the cloud provider (load balancers, node lifecycle) |
| kubelet (each node) | "Ensures that Pods are running, including their containers" |
| kube-proxy (each node, optional) | "Maintains network rules on nodes to implement Services" |
| Container runtime | "Software responsible for running containers" |

**A write request, step by step** ✅[^3]:
1. **Transport:** TLS, by default on port 6443.
2. **Authentication:** client certificate, bearer token, service-account JWT… → a username and groups.
3. **Authorization:** RBAC, Node, ABAC or webhook modules; any allow → proceed; all deny → HTTP 403.
4. **Admission:** controllers may modify or reject the request (e.g. set defaults, enforce Pod Security); one rejection fails it.
5. **Validation and persistence:** schema validation, then the object is stored.

**The reconcile loop every controller runs** ✅[^2]:
1. **Watch** the objects it owns and those it reacts to.
2. **Compare** `spec` with observed reality.
3. **Act through the API server** — the Job controller "creates Pods by asking the API server", it does not run containers ✅[^2].
4. **Record** what it observed in `status`, then go back to waiting. Many small controllers are used instead of one big one ✅[^2].

```
              ┌───────────── kube-apiserver (authn → authz → admission → validate) ─────────────┐
 kubectl ───► │  Deployment.spec.replicas=3    ReplicaSet    Pod.spec.nodeName    EndpointSlice  │ ◄──► etcd
              └───▲──────────────▲────────────────▲────────────────▲───────────────▲───────────┘
                  │ watch/write  │                │                │               │
          Deployment ctrl   ReplicaSet ctrl   scheduler       kubelet (node)   kube-proxy (node)
          spec→ReplicaSet   count→Pods        Pod→node        Pod→containers   Endpoints→iptables
```

**Ownership and cleanup:** objects created by a controller carry an `ownerReference` (Pod → ReplicaSet → Deployment in the lab) ✅[^4]; deleting the owner lets the garbage collector delete dependents ✅[^9] (lab: deleting a Deployment removed its ReplicaSet and pods within 6 s) ✅[^4].

**Leader election:** where several replicas of a controller run for high availability, only the holder of a `Lease` object acts (the lab shows the API server's own lease in `kube-system`) ✅[^4] ✅[^10].

## Worked example
Deleting a pod of a 3-replica Deployment — "self-healing" as loops:

| t | Actor | Observes | Acts |
|---|---|---|---|
| 0 s | You | — | `kubectl delete pod web-…-4rh2q` |
| next | ReplicaSet controller | 2 pods exist, `spec.replicas` = 3 | Creates a new Pod object (no node yet) ✅[^2] |
| next | Scheduler | Pod without node | Writes a binding to a node ✅[^5] |
| next | kubelet on that node | Pod bound to it | Starts containers via the runtime ✅[^1] |
| later | EndpointSlice controller | New pod Ready, old pod gone | Updates the slice ✅[^11] |
| last | kube-proxy | Slice changed | Rewrites iptables rules ✅[^6] |

No component told another what to do; each reacted to the shared state.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Manual edit of a ReplicaSet owned by a Deployment | Reverted or orphaned on the next rollout | The Deployment controller owns it ✅[^7] |
| Admission webhook down with `failurePolicy: Fail` | Matching creates are rejected cluster-wide | One admission rejection fails the request ✅[^3] ✅[^12] |
| API server unavailable | Running pods continue; nothing changes | Loops act only through the API server ✅[^2]; running containers are processes under the container runtime (see the deep dive) |
| `kubectl apply` succeeds but nothing runs | The object was stored; a later loop is stuck | Check `status`, events, and the owning controller |

## Takeaways
- Debug by asking "which loop owns this gap?" and read that object's `status` and events.
- Never hand-edit objects a controller owns; change the owner's `spec`.
- Treat admission webhooks as part of the control plane's availability.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) — Kubernetes project, living. Backs: component table. [^1]
- [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/) — Kubernetes project, living. Backs: thermostat analogy, control loops, acting via the API server, many small controllers. [^2]
- [Controlling Access to the Kubernetes API](https://kubernetes.io/docs/concepts/security/controlling-access/) — Kubernetes project, living. Backs: request stages and HTTP 403. [^3]
- `kubernetes/lab-setup.md` — the k3s lab where the watch stream, owner chain and lease were captured on 2026-11-04. [^4]
- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) — Kubernetes project, living. Backs: binding. [^5]
- [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/) — Kubernetes project, living. Backs: kube-proxy reacts to EndpointSlice changes. [^6]
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — Kubernetes project, living. Backs: do not manage Deployment-owned ReplicaSets. [^7]
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the deep dive this doc was distilled from.
- [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/) — Kubernetes project, living. Backs: a client starts a watch from the `resourceVersion` returned by a list. [^8]
- [Garbage Collection](https://kubernetes.io/docs/concepts/architecture/garbage-collection/) — Kubernetes project, living. Backs: owner references and cascading deletion. [^9]
- [Leases](https://kubernetes.io/docs/concepts/architecture/leases/) — Kubernetes project, living. Backs: Lease objects for node heartbeats and component leader election. [^10]
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: `restartPolicy` values and default `Always`; readiness and EndpointSlices. [^11]
- [Dynamic Admission Control](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/) — Kubernetes project, living. Backs: `failurePolicy: Fail` (the default) rejects the request when the webhook cannot be called. [^12]

## Related
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — one object through every loop.
- `kubernetes/security/rbac-and-service-accounts.md` — the authorization step.
