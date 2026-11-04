---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/operations
last-updated: 2026-11-04
---

# Kubernetes operations

Running workloads day to day: a step-by-step procedure for pods that do not start or serve traffic, and autoscaling with the HPA, VPA and node autoscalers. Not covered: cluster upgrades, etcd backup, observability pipelines.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [troubleshooting-pods.md](troubleshooting-pods.md) | how-to | Read the pod's status column, then follow one branch: `Pending` → scheduling (events); `ImagePullBackOff`/`ErrImagePull` → image or registry; `CrashLoopBackOff` → the app exits (previous logs, exit code, `OOMKilled`); `Running` but restarting → liveness probe; `Running` but no traffic → readiness, Service selector, EndpointSlices, NetworkPolicy | verified |
| [autoscaling.md](autoscaling.md) | concept | Three loops scale three things | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
