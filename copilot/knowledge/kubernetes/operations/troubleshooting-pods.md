---
schema: knowledge-doc/v1
type: how-to
topic: kubernetes/operations
status: verified
applies-to: ["Kubernetes ≥ 1.29", "kubectl"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, troubleshooting, pending, crashloopbackoff, imagepullbackoff, oomkilled, kubectl, events, debugging]
---

# Troubleshoot a pod that is not working

## Summary
**TL;DR:** Read the pod's status column, then follow one branch: `Pending` → scheduling (events); `ImagePullBackOff`/`ErrImagePull` → image or registry; `CrashLoopBackOff` → the app exits (previous logs, exit code, `OOMKilled`); `Running` but restarting → liveness probe; `Running` but no traffic → readiness, Service selector, EndpointSlices, NetworkPolicy. Each branch has one or two `kubectl` commands that show the cause.
**Use this when:** a pod or Deployment does not come up or does not serve traffic.
**Not this doc:** node-level performance → `linux/system-management/performance-triage.md`; the mechanisms behind each state → `architecture/life-of-a-pod-deep-dive.md`.

## Goal & prerequisites
**End state:** the failing component is named with the line of `kubectl` output that proves it, and the fix direction is known.

**Needs:** `kubectl` with read access to the namespace (pods, events, logs, services, endpointslices); for step 7, `exec` permission.

## Steps
1. **Get the status and restarts.**
   ```console
   $ kubectl get pod <pod> -o wide
   ```
2. **Read the events** (most answers are here).
   ```console
   $ kubectl describe pod <pod> | sed -n '/Events:/,$p'
   $ kubectl get events --field-selector involvedObject.name=<pod> --sort-by=.lastTimestamp
   ```
3. **`Pending`:** look for `FailedScheduling`; the message lists one count per reason (`Insufficient cpu`, `untolerated taint`, node affinity, unbound PVC) ✅[^2]. Fix requests, tolerations/affinity, capacity, or the PVC.
4. **`ErrImagePull` / `ImagePullBackOff`:** the `Failed` event shows the registry error (`NotFound`, `unauthorized`) ✅[^2]. Fix the image reference or `imagePullSecrets`.
5. **`CrashLoopBackOff`:** the container keeps exiting; restarts back off 10 s → 20 s → … → 300 s ✅[^1].
   ```console
   $ kubectl logs <pod> --previous
   $ kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[*].lastState.terminated}'
   ```
   Exit code 137 with `reason: OOMKilled` → memory limit; other non-zero codes → the application's own error ✅[^2].
6. **Restarts while `Running`:** check for `Unhealthy … Liveness probe failed` and `failed liveness probe, will be restarted` events ✅[^2]; fix the probe or the app's health endpoint.
7. **`Running`, no traffic:**
   ```console
   $ kubectl get pod <pod> -o jsonpath='{.status.conditions}'          # Ready=True?
   $ kubectl get svc <svc> -o jsonpath='{.spec.selector}'; kubectl get pod <pod> --show-labels
   $ kubectl get endpointslices -l kubernetes.io/service-name=<svc>
   $ kubectl get networkpolicy
   $ kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- nc -zv -w3 <svc> 80      # TCP reachability of the Service port
   ```
   Not ready → readiness probe; empty slice → selector mismatch; reachable by IP but not name → DNS; refused/timeouts with a policy present → NetworkPolicy ✅[^3] ✅[^4].
8. **Slow to delete:** if deletion takes the full grace period (30 s by default), the app is not handling `SIGTERM` ✅[^1] ✅[^2].
9. **Look inside without a shell in the image:** `kubectl debug -it <pod> --image=busybox:1.36 --target=<container>` adds an ephemeral debug container sharing the pod's namespaces ✅[^6].

## Verify
Expected signatures, each captured in the lab (k3s v1.33.5, 2026-11-04) ✅[^2]:

| Check | Expected output when this is the cause |
|---|---|
| Step 3 | `FailedScheduling   0/1 nodes are available: 1 Insufficient cpu.` |
| Step 4 | `Failed   Failed to pull image "nginx:does-not-exist-123": rpc error: code = NotFound …` |
| Step 5 (app error) | `kubectl get pod` → `CrashLoopBackOff   3 (37s ago)`; `exitCode: 3`; `logs --previous` → the app's last output |
| Step 5 (memory) | `lastState.terminated.reason=OOMKilled exit=137` |
| Step 6 | `Liveness probe failed: cat: can't open '/tmp/ok': No such file or directory` |
| Step 7 (policy) | `wget: can't connect to remote host (10.43.208.65): Connection refused`, gone after labelling the client as allowed |
| Step 8 | `kubectl delete pod` returns after ~32 s |

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| No events at all | Events expired (they are short-lived) (kept for 1 h by default, `--event-ttl`) ✅[^7] | Reproduce, or check the owning ReplicaSet/Deployment events |
| Pods never created (Deployment shows 0/3, no pods) | ReplicaSet `FailedCreate`: quota, Pod Security admission, webhook | `kubectl describe rs <rs>` ✅[^5] |
| `CreateContainerConfigError` | Missing Secret/ConfigMap key referenced by env | Create it or fix the reference ✅[^2] (lab: env from a missing Secret → `CreateContainerConfigError`) |
| `Init:CrashLoopBackOff` | An init container fails | `kubectl logs <pod> -c <init-container>` ✅[^2] (lab: failing init container → `Init:CrashLoopBackOff`; its log read with `-c init`) |
| `Terminating` forever | Finalizer or unreachable node | Check `metadata.finalizers`; force-delete only as last resort ✅[^1] |
| Works on one node only | Node-specific (image cache, CNI, local volume) | Compare `-o wide` node column across pods |

## Takeaways
- Read events before logs: most non-running states explain themselves in `describe` output.
- For `CrashLoopBackOff`, always read `logs --previous` and `lastState.terminated` — the current container may not have logged yet.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) — Kubernetes project, living. Backs: back-off timings, grace period and SIGKILL, force deletion. [^1]
- `kubernetes/lab-setup.md` — the k3s lab where every signature in Verify was captured on 2026-11-04. [^2]
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/) — Kubernetes project, living. Backs: selectors drive EndpointSlices. [^3]
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) — Kubernetes project, living. Backs: isolation by policy. [^4]
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) — Kubernetes project, living. Backs: admission can reject pods. [^5]
- [Debug Running Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/) — Kubernetes project, living. Backs: further reading on `kubectl debug`.
- [Debug Running Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/) — Kubernetes project, living. Backs: ephemeral debug containers (stable since v1.25). [^6]
- [kube-apiserver](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/) — Kubernetes project, living. Backs: `--event-ttl` default 1h0m0s. [^7]

## Related
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the chain each step inspects.
- `kubernetes/workloads/pod-lifecycle-and-probes.md` — probe and termination details.
