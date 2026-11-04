---
schema: deep-dive/v1
topic: kubernetes/architecture
status: verified
applies-to: ["Kubernetes ≥ 1.29 (lab: v1.33.5+k3s1, containerd 2.1.4, Linux 6.17.8)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into:
  - { path: kubernetes/architecture/control-plane-and-reconciliation.md, on: 2026-11-04 }
  - { path: kubernetes/workloads/pod-lifecycle-and-probes.md, on: 2026-11-04 }
  - { path: kubernetes/workloads/deployments-and-rollouts.md, on: 2026-11-04 }
  - { path: kubernetes/networking/services-and-kube-proxy.md, on: 2026-11-04 }
  - { path: kubernetes/networking/pod-networking-and-dns.md, on: 2026-11-04 }
tags: [kubernetes, architecture, api-server, etcd, scheduler, kubelet, cri, cni, kube-proxy, reconciliation]
---

# Life of a pod: from kubectl apply to a packet reaching a container

## Summary
**TL;DR:** `kubectl create deployment web --replicas=3` never starts a container itself. It stores one object in the API server; then a chain of independent control loops each notices a gap between desired and actual state and closes it: the Deployment controller creates a ReplicaSet, the ReplicaSet controller creates Pods, the scheduler binds each Pod to a node, the kubelet on that node asks the container runtime (CRI) for a pod sandbox and containers, the CNI plugin gives the pod an IP, the EndpointSlice controller records ready pods behind a Service, and kube-proxy turns that into iptables DNAT rules. This dive follows one Deployment through every actor, with output captured from a live cluster.
**Use this when:** you want the whole picture before the focused docs, debug something that falls between components (a pod that is Running but gets no traffic, a Deployment that never progresses), or need to explain "declarative" and "reconciliation" with evidence.
**Depth:** every actor from kubectl to the Linux kernel; captured events, owner chain, pod conditions, iptables chains and DNS config from a k3s v1.33.5 cluster; the matrix of what each component does when another fails; failure signatures with real messages; verified (✅) vs unverified (⚠️) marks.

## 1. The actors

**9 actors:**
- **kubectl** — its job: send the desired state, via HTTPS calls to the API server.
- **kube-apiserver** — its job: authenticate, authorize, run admission, validate and store objects, and serve watches, via its HTTP API ✅[^1] ✅[^2].
- **etcd** (or a compatible store) — its job: hold all API data, via a consistent key-value store ✅[^1]. The lab's k3s uses an embedded SQLite database behind an etcd-compatible shim (`/var/lib/rancher/k3s/server/db/state.db`) ✅[^9].
- **kube-controller-manager** — its job: run the built-in controllers (Deployment, ReplicaSet, EndpointSlice, …), via watch-and-reconcile loops ✅[^1] ✅[^3].
- **kube-scheduler** — its job: pick a node for each unbound Pod, via filtering and scoring ✅[^1] ✅[^4].
- **kubelet** (on every node) — its job: make the Pods bound to its node run, via the CRI ✅[^1].
- **Container runtime (containerd + runc)** — its job: create pod sandboxes and containers, via the CRI API and the Linux mechanisms in `linux/containers/` ✅[^1] ✅[^5].
- **CNI plugin** — its job: give each pod sandbox a network interface and an IP, via the pod network implementation ✅[^5].
- **kube-proxy** (optional) — its job: program node rules for Services, via iptables/nftables/IPVS ✅[^1] ✅[^6].

```
 kubectl ──HTTPS──► kube-apiserver ──► etcd/kine            (desired state stored)
                        ▲   │ watch streams
         ┌──────────────┼───┼────────────────────┬────────────────────────┐
         │              │   ▼                    ▼                        ▼
  Deployment ctrl   ReplicaSet ctrl        kube-scheduler          EndpointSlice ctrl
  "need a RS"       "need 3 pods"          "pod has no node"       "ready pods behind svc"
         │              │                        │ binding                 │
         └── writes ────┴──── writes ────────────┴──── writes ─────────────┘
                                                 │
                       node: kubelet (watch pods with spec.nodeName = me)
                              │ CRI: RunPodSandbox / CreateContainer / StartContainer
                              ▼
                       containerd ─► runc ─► namespaces + cgroups + overlay   (linux/containers/)
                              │ CNI ADD
                              ▼
                       pod IP 10.42.0.x        kube-proxy (watch Services + EndpointSlices) ─► iptables DNAT
```

## 2. Lab setup

A single-node k3s cluster (v1.33.5+k3s1, containerd 2.1.4) running in a privileged container on OrbStack (Linux 6.17.8, arm64), captured on 2026-11-04. k3s bundles all control-plane components in one process, flannel as CNI, CoreDNS, kube-proxy in iptables mode and a local-path storage provisioner. Setup: `kubernetes/lab-setup.md` ✅[^9].

## 3. Step by step

### Step 1 — kubectl → API server → storage

```console
$ kubectl create deployment web --image=nginx:1.27-alpine --replicas=3
```
The request passes, in order: TLS (port 6443 by default) → authentication (who are you) → authorization (may you create Deployments here; any allowing module wins, all denying → HTTP 403) → admission controllers (may mutate or reject) → validation → write to storage ✅[^2]. Nothing has run yet; the cluster now only *knows what you want*.

### Step 2 — Controllers turn one object into three Pods

Every controller follows the same loop: watch objects, compare `spec` (desired) with reality, act through the API server. "Each controller tries to move the current cluster state closer to the desired state" ✅[^3]. Captured events, in time order ✅[^9]:

```text
ScalingReplicaSet   Deployment   Scaled up replica set web-7dd566fbcc from 0 to 3
SuccessfulCreate    ReplicaSet   Created pod: web-7dd566fbcc-m7fk8
SuccessfulCreate    ReplicaSet   Created pod: web-7dd566fbcc-4rh2q
SuccessfulCreate    ReplicaSet   Created pod: web-7dd566fbcc-vh9k2
Scheduled           Pod          Successfully assigned default/web-7dd566fbcc-4rh2q to b12cb390c3b7
```

The **owner chain** records who created whom (garbage collection follows it) ✅[^9]:
```text
Pod web-7dd566fbcc-4rh2q  → ownerReference: ReplicaSet/web-7dd566fbcc
ReplicaSet web-7dd566fbcc → ownerReference: Deployment/web
```
`7dd566fbcc` is the `pod-template-hash`: a hash of the pod template, so each template version gets its own ReplicaSet ✅[^7].

### Step 3 — The scheduler binds each Pod to a node

The scheduler watches for Pods without `spec.nodeName`, filters out nodes that cannot run the Pod (resources, taints, affinity…), scores the rest, picks the best (random among ties) and writes a **binding** to the API server ✅[^4]. If no node passes, the Pod stays unscheduled (phase `Pending`). Real messages from the lab ✅[^9]:
```text
0/1 nodes are available: 1 Insufficient cpu. preemption: 0/1 nodes are available: 1 No preemption victims found for incoming pod.
0/1 nodes are available: 1 node(s) had untolerated taint {dedicated: batch}. preemption: … Preemption is not helpful for scheduling.
```

### Step 4 — The kubelet runs the Pod through the CRI

The kubelet on the chosen node sees a Pod bound to it and calls the runtime over the CRI: create a **pod sandbox** (a pause container holding the pod's shared namespaces), pull images, create and start each container ✅[^5]. The runtime's view ✅[^9]:
```text
$ crictl ps --name nginx
CONTAINER       IMAGE           STATE     NAME    ATTEMPT  POD ID          POD
b55005f566a40   96868d9fa38f4   Running   nginx   0        9f9a78e0eec26   web-7dd566fbcc-pjd8r
$ crictl inspect <id> | grep '"pid"'
    "pid": 3671                # an ordinary Linux process on the node
```
From here on, everything in `linux/containers/` applies: namespaces, a cgroup derived from requests and limits (a Guaranteed pod with `cpu: 250m` showed `cpu.max = 25000 100000`), an overlay root filesystem, dropped capabilities ✅[^9].

### Step 5 — The CNI plugin gives the Pod an IP

During sandbox creation the runtime invokes the CNI plugin, which creates the pod's interface and assigns an IP from the node's pod range (`10.42.0.x` in k3s/flannel). Kubernetes requires that every pod gets a unique cluster-wide IP and can reach every other pod without NAT ✅[^5] ✅[^9].

### Step 6 — Conditions, readiness and the pod phase

```text
PodReadyToStartContainers=True Initialized=True Ready=True ContainersReady=True PodScheduled=True
Running qos=BestEffort
```
Readiness matters beyond the pod: only Pods whose readiness probe passes are added to Service endpoints ✅[^8] ✅[^9].

### Step 7 — Service, EndpointSlices and kube-proxy

```console
$ kubectl expose deploy web --port=80
$ kubectl get svc web
web    ClusterIP   10.43.208.65   <none>   80/TCP
$ kubectl get endpointslices -l kubernetes.io/service-name=web
web-jxjbr   IPv4   80   10.42.0.10,10.42.0.11,10.42.0.12
```
kube-proxy watches Services and EndpointSlices and installs per-Service rules on every node ✅[^6]. The real iptables chain, trimmed ✅[^9]:
```text
-A KUBE-SERVICES -d 10.43.208.65/32 -p tcp --dport 80 -j KUBE-SVC-LOLE4ISW44XBNF3G
-A KUBE-SVC-LOLE4ISW44XBNF3G -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-KKJTHWGQ5EHIOKS2
-A KUBE-SVC-LOLE4ISW44XBNF3G -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-UJOO5W55X2FBY24Q
-A KUBE-SVC-LOLE4ISW44XBNF3G -j KUBE-SEP-VOP2THLXZNYIOIWU
-A KUBE-SEP-KKJTHWGQ5EHIOKS2 -p tcp -j DNAT --to-destination 10.42.0.10:80
```
The ClusterIP exists only as this rule: no interface owns `10.43.208.65`. The probabilities 1/3, then 1/2 of the rest, then all of the rest give each of three endpoints an equal share; in iptables mode a backend is picked at random per connection ✅[^6].

### Step 8 — DNS

The kubelet writes the pod's `/etc/resolv.conf`; CoreDNS answers Service names ✅[^10] ✅[^9]:
```text
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.43.0.10
options ndots:5
Name:	web.default.svc.cluster.local
Address: 10.43.208.65
```

## 4. What each component does when another one is down

| Down / broken | Existing pods keep running? | New pods / changes | Traffic to Services |
|---|---|---|---|
| kube-apiserver | Not tested here | Nothing can be created or changed ✅[^3] | Not tested here |
| etcd / storage | Not tested here | API server cannot read or write state ✅[^1] | Not tested here |
| kube-scheduler | Yes | New pods stay `Pending` (no binding) ✅[^4] | Unaffected |
| kube-controller-manager | Yes | No new ReplicaSets/Pods from Deployments; endpoints not updated ✅[^3] | EndpointSlices are maintained by a controller ✅[^6] |
| kubelet on a node | Not tested here | Pods bound there do not start | Not tested here |
| kube-proxy on a node | Yes | Unaffected | New Service/endpoint changes not applied on that node ✅[^6] |
| CNI plugin | Not tested here | New sandboxes fail to get an IP | — |
| CoreDNS | Yes | Unaffected | Name lookups fail; IP-based traffic still works ✅[^9] (lab: with CoreDNS scaled to 0, `nslookup` exited 1 while `wget` to the ClusterIP succeeded) |

## 5. Failure signatures seen in the lab

| Symptom (`kubectl get pod`) | Where the chain broke | Real evidence | Fix direction |
|---|---|---|---|
| `Pending` | Step 3, scheduler | `FailedScheduling … Insufficient cpu` / `untolerated taint` | Lower requests, add capacity, add toleration ✅[^9] |
| `ImagePullBackOff` | Step 4, runtime pull | `Failed to pull image "nginx:does-not-exist-123": … NotFound` | Fix image name/tag or pull secret ✅[^9] |
| `CrashLoopBackOff` (exit 3) | Step 4, the app exits | `lastState.terminated.exitCode=3`, `kubectl logs --previous` shows output | Fix the app/config ✅[^9] |
| `CrashLoopBackOff` with `OOMKilled`, exit 137 | Step 4, cgroup memory limit | `lastState.terminated.reason=OOMKilled` | Raise the limit or reduce memory ✅[^9] |
| `Running`, restarts climbing | Liveness probe | `Liveness probe failed … will be restarted` | Fix probe or app health ✅[^9] |
| `Running` but no traffic | Step 6/7, readiness or selector | Endpoints empty or missing the pod | Fix readiness probe or Service selector ✅[^8] |
| Deleting a pod takes 30 s | Termination | `sleep` as PID 1 ignored `SIGTERM`; SIGKILL after the 30 s grace period | Handle `SIGTERM` ✅[^8] ✅[^9] |

## 6. What to read next
- `kubernetes/architecture/control-plane-and-reconciliation.md`
- `kubernetes/workloads/pod-lifecycle-and-probes.md`
- `kubernetes/workloads/deployments-and-rollouts.md`
- `kubernetes/networking/services-and-kube-proxy.md`
- `kubernetes/networking/pod-networking-and-dns.md`

## References
- [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) — Kubernetes project, living. Backs: the job of each control-plane and node component. [^1]
- [Controlling Access to the Kubernetes API](https://kubernetes.io/docs/concepts/security/controlling-access/) — Kubernetes project, living. Backs: TLS on 6443, authentication, authorization (403 when all deny), admission, validation, persistence. [^2]
- [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/) — Kubernetes project, living. Backs: control loops, desired vs current state, acting through the API server. [^3]
- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) — Kubernetes project, living. Backs: filtering, scoring, random tie-break, binding, unschedulable pods. [^4]
- [Services, Load Balancing, and Networking](https://kubernetes.io/docs/concepts/services-networking/) — Kubernetes project, living. Backs: pod IP model, no NAT between pods, CRI sets up the pod network namespace, CNI plugins. [^5]
- [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/) — Kubernetes project, living. Backs: kube-proxy watches Services and EndpointSlices, iptables mode random selection, proxy modes. [^6]
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — Kubernetes project, living. Backs: Deployments manage ReplicaSets, `pod-template-hash`. [^7]
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: readiness removes pods from EndpointSlices, termination grace period and SIGKILL. [^8]
- `kubernetes/lab-setup.md` — the k3s lab (v1.33.5+k3s1, containerd 2.1.4, Linux 6.17.8) where every console block here was captured on 2026-11-04. [^9]
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) — Kubernetes project, living. Backs: Service DNS names, pod `resolv.conf`, `ndots:5`. [^10]

## Related
- `linux/containers/container-from-primitives-deep-dive.md` — what happens below the runtime.
- `kubernetes/cpu-limits-and-throttling.md` — how requests and limits reach the kernel.
- `kubernetes/operations/troubleshooting-pods.md` — the failure signatures as a procedure.
