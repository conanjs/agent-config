---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/security
last-updated: 2026-11-04
---

# Kubernetes security

Who may call the API (RBAC roles and bindings, service accounts and their short-lived tokens) and what a pod may do on its node (securityContext, Pod Security Standards, Pod Security Admission). Kernel-level mechanisms are in `linux/containers/container-isolation.md`. Not covered: secrets encryption at rest, audit logging, supply-chain policy.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [rbac-and-service-accounts.md](rbac-and-service-accounts.md) | concept | RBAC answers "may this identity do this verb on this resource?" | verified |
| [pod-security.md](pod-security.md) | concept | A pod's `securityContext` decides how its containers sit on the node's kernel: user ID, capabilities, privilege escalation, seccomp profile, read-only root filesystem, host namespaces and volumes | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
