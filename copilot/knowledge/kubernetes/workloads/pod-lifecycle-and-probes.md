---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/workloads
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
derived-from: [kubernetes/architecture/life-of-a-pod-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, pod, lifecycle, probes, liveness, readiness, startup, crashloopbackoff, termination, grace-period, qos]
---

# Pod lifecycle, probes and graceful termination

## Summary
**TL;DR:** A pod moves through phases (`Pending` → `Running` → `Succeeded`/`Failed`, or `Unknown`), while each container is `Waiting`, `Running` or `Terminated`. The kubelet restarts failed containers per `restartPolicy`, with an exponential **back-off** of 10 s, 20 s, 40 s… capped at 5 minutes — that waiting state is `CrashLoopBackOff`. Three probes steer it: **startup** (hold other probes until the app has started), **liveness** (restart the container when it fails), **readiness** (remove the pod from Service endpoints when it fails, no restart). Deletion runs `preStop`, sends `SIGTERM` to PID 1 of each container, and sends `SIGKILL` after the grace period (30 s by default).
**Use this when:** you configure probes, see `CrashLoopBackOff` or restarts, lose requests during deploys, or need to understand QoS classes.
**Not this doc:** how Deployments replace pods → `workloads/deployments-and-rollouts.md`; signals inside the container → `linux/processes/signals.md`.

## Problem
Badly set probes are a top cause of self-inflicted outages: a liveness probe that checks a database restarts every pod when the database blips; a missing readiness probe sends traffic to pods still warming up; an app that ignores `SIGTERM` drops in-flight requests on every deploy.

## Mental model
**Analogy:** a hospital ward. The **startup** check is "has the patient come round from anaesthesia?"; until yes, nobody runs other tests. **Liveness** is "is the heart beating?" — if not, resuscitate (restart). **Readiness** is "can the patient receive visitors?" — if not, the front desk stops sending visitors (endpoints) but nobody resuscitates. Discharge (termination) gives the patient 30 seconds to pack (`SIGTERM`) before security escorts them out (`SIGKILL`).

**Artifact:** a container spec with all three probes and a drain hook:
```yaml
containers:
- name: api
  image: example/api:1.4.2
  startupProbe:   {httpGet: {path: /healthz, port: 8080}, periodSeconds: 5, failureThreshold: 24}  # up to 120 s to start
  livenessProbe:  {httpGet: {path: /healthz, port: 8080}, periodSeconds: 10, failureThreshold: 3}  # process stuck → restart
  readinessProbe: {httpGet: {path: /ready,   port: 8080}, periodSeconds: 5}                         # deps OK → receive traffic
  lifecycle:
    preStop: {exec: {command: ["sleep", "5"]}}     # let endpoint removal propagate before SIGTERM
terminationGracePeriodSeconds: 40
```

## How it works
**3 actors:**
- **kubelet** — its job: run containers, execute probes and drive restarts and termination, via the container runtime ✅[^1].
- **API server / EndpointSlice controller** — its job: record pod status and keep only ready pods in Service endpoints ✅[^1].
- **Application** — its job: report health on probe endpoints and shut down cleanly on `SIGTERM`.

**Phases** ✅[^1]:

| Phase | Meaning |
|---|---|
| `Pending` | Accepted, but containers not all set up — includes waiting for scheduling and pulling images |
| `Running` | Bound to a node, all containers created, at least one running/starting/restarting |
| `Succeeded` | All containers terminated successfully and will not restart |
| `Failed` | All terminated, at least one with non-zero exit or killed by the system |
| `Unknown` | State could not be obtained, usually a node communication error |

**Restarts:** `restartPolicy` is `Always`, `OnFailure` or `Never` — default `Always` ✅[^1] (lab: a pod created without it showed `restartPolicy=Always`) ✅[^2]. Repeated failures wait 10 s, 20 s, 40 s… up to 300 s; the timer resets after 10 minutes of healthy running; `CrashLoopBackOff` means that back-off is in effect ✅[^1].

**Probes** run by the kubelet with `exec`, `httpGet`, `tcpSocket` or `grpc` ✅[^1]:

| Probe | When it runs | On failure |
|---|---|---|
| Startup | Only at start; blocks liveness and readiness until it succeeds | Container killed, restart policy applies |
| Liveness | Whole life (does not wait for readiness) | Container restarted after `failureThreshold` |
| Readiness | Whole life | Pod IP removed from matching Services' EndpointSlices; no restart |

**Termination sequence** ✅[^1]:
1. The API server marks the pod terminating with a deadline (`terminationGracePeriodSeconds`, default 30).
2. The kubelet runs `preStop` hooks (a one-off 2 s extension if the hook overruns the grace period).
3. The kubelet sends `SIGTERM` (or the image's `STOPSIGNAL`) to PID 1 of each container.
4. In parallel, the pod's endpoints are marked not ready/terminating so Services stop sending new traffic.
5. At the deadline, remaining processes get `SIGKILL`; the pod object is removed.

**QoS classes** (from requests and limits): `Guaranteed` when every container has equal requests and limits for CPU and memory; `Burstable` when some are set; `BestEffort` when none ✅[^4]. In the lab a pod with `cpu`/`memory` requests = limits = `250m`/`64Mi` was `Guaranteed`, with `cpu.max 25000 100000` and `memory.max 67108864` in its cgroup; a pod with nothing set was `BestEffort` ✅[^2].

## Worked example
Real runs in the lab (k3s v1.33.5, 2026-11-04) ✅[^2]:

| Pod | Spec | Observed |
|---|---|---|
| `crash` | `sh -c "echo starting; exit 3"` | `CrashLoopBackOff`, 3 restarts in 75 s; `lastState.terminated.exitCode=3`; `kubectl logs --previous` → `starting` |
| `liveness` | Deletes `/tmp/ok` after 12 s; liveness `cat /tmp/ok` every 3 s, threshold 2 | Events: `Liveness probe failed: cat: can't open '/tmp/ok'` → `Container c failed liveness probe, will be restarted` |
| `oom` | Allocates 300 MiB with `limits.memory: 64Mi` | `OOMKilled`, exit 137, then `CrashLoopBackOff` |
| `guaranteed` (runs `sleep`) | Deleted with default grace | `kubectl delete` took 32 s: `sleep` as PID 1 has no `SIGTERM` handler, so it waited for `SIGKILL` at 30 s ✅[^1] ✅[^3] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Liveness probe checks a shared dependency (DB) | All pods restart together when the DB blips | Liveness restarts; use readiness for dependencies |
| Slow-starting app, no startup probe | Killed by liveness before it is up | Liveness does not wait for readiness ✅[^1] |
| App exits on `SIGTERM` immediately | Requests still routed for a moment fail | Endpoint removal runs in parallel with `SIGTERM` ✅[^1]; add a short `preStop` sleep |
| `kubectl delete --grace-period=0 --force` | Object removed at once; process may keep running on the node | Force deletion does not wait for the kubelet ✅[^1] |
| Node lost | Pods become `Unknown`, later `Failed` | Node unreachable ✅[^1] |
| Shell wrapper as PID 1 | `SIGTERM` not forwarded; always killed at the deadline | See `linux/processes/signals.md` |

## Takeaways
- Liveness checks only the process itself; dependencies belong in readiness. [rule-candidate]
- Add a startup probe for slow starters instead of a long `initialDelaySeconds` on liveness.
- Handle `SIGTERM`, drain within `terminationGracePeriodSeconds`, and add a short `preStop` delay for endpoint propagation. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 17 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: phases, back-off timings and reset, probe kinds, mechanisms and outcomes, termination sequence, force deletion, Unknown phase. [^1]
- `kubernetes/lab-setup.md` — the k3s lab where the crash, liveness, OOM, QoS and termination runs were captured on 2026-11-04. [^2]
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages project, living. Backs: `SIGKILL` cannot be caught; default dispositions. [^3]
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the deep dive this doc was distilled from.
- [Pod Quality of Service Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) — Kubernetes project, living. Backs: Guaranteed, Burstable, BestEffort and eviction order. [^4]

## Related
- `kubernetes/memory-limits-and-oom-kill.md` — OOMKilled in depth.
- `kubernetes/operations/troubleshooting-pods.md` — what to do for each status.
- `linux/processes/signals.md` — graceful shutdown at the process level.
