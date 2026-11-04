---
schema: topic-index/v1
kind: subtopic
topic: kubernetes/storage
last-updated: 2026-11-04
---

# Kubernetes storage

Persistent storage for pods: PersistentVolumeClaims, PersistentVolumes, StorageClasses with dynamic provisioning and binding modes, access modes, reclaim policies and CSI drivers. Secret, ConfigMap and projected volumes are in `kubernetes/volumes-secrets-and-projected.md`. Not covered: volume snapshots and backup tooling.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [persistent-volumes-and-csi.md](persistent-volumes-and-csi.md) | concept | A pod asks for storage with a **PersistentVolumeClaim** (PVC: size, access mode, class) | verified |

## References
- [Kubernetes documentation](https://kubernetes.io/docs/home/) — Kubernetes project, living. Backs: topic scope.

## Related
- `kubernetes/learning-path.md` — where this subtopic sits in the learning order.
- `kubernetes/lab-setup.md` — the k3s lab used for every captured example.
