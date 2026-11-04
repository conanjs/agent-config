---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/security
status: verified
applies-to: ["Kubernetes ≥ 1.25 (Pod Security Admission GA)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, pod-security-standards, pod-security-admission, securitycontext, restricted, baseline, runasnonroot, seccomp, capabilities]
---

# Pod Security Standards, admission and securityContext

## Summary
**TL;DR:** A pod's `securityContext` decides how its containers sit on the node's kernel: user ID, capabilities, privilege escalation, seccomp profile, read-only root filesystem, host namespaces and volumes. The **Pod Security Standards** group these into three levels — **Privileged** (no limits), **Baseline** (blocks known escalations such as privileged containers, host namespaces and hostPath), **Restricted** (current hardening: non-root, drop ALL capabilities, no privilege escalation, `RuntimeDefault` seccomp, limited volume types). The built-in **Pod Security Admission** controller applies a level per namespace through labels, in `enforce`, `audit` or `warn` mode.
**Use this when:** you harden workloads, a pod is rejected with "violates PodSecurity", you set namespace security levels, or you translate container-security knowledge into pod specs.
**Not this doc:** the kernel mechanisms (capabilities, seccomp, user namespaces) → `linux/containers/container-isolation.md`; API permissions → `security/rbac-and-service-accounts.md`.

## Problem
Without a namespace-level guard, any developer can deploy a privileged pod or mount the host filesystem — equivalent to root on the node. With a guard but no understanding, teams fight rejections field by field. Knowing the levels and the matching `securityContext` turns this into a checklist.

## Mental model
**Analogy:** building codes for rooms in a shared building. Privileged = no code (for the building's own maintenance rooms). Baseline = no knocking down walls or tapping the main gas line. Restricted = full modern fire code. The inspector (admission) can **block** construction (`enforce`), **write a report** (`audit`), or **warn** the builder (`warn`) — chosen per floor (namespace).

**Artifact:** a container `securityContext` that passes Restricted:
```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  seccompProfile: {type: RuntimeDefault}
  capabilities: {drop: ["ALL"]}           # add: ["NET_BIND_SERVICE"] is the only allowed addition
  readOnlyRootFilesystem: true            # not required by Restricted, but cheap hardening
```

## How it works
**3 actors:**
- **Namespace labels** — its job: select a level and mode, via `pod-security.kubernetes.io/<mode>: <level>` ✅[^1].
- **Pod Security Admission controller** — its job: check pods at creation against the level, in the API server's admission step ✅[^1] ✅[^3].
- **kubelet + runtime** — its job: apply the `securityContext` to the container via Linux mechanisms (UIDs, capabilities, seccomp) ✅[^4] (lab: `runAsUser: 1000`, drop ALL, `RuntimeDefault` → `/proc/1/status` showed `Uid 1000`, `CapEff 0`, `NoNewPrivs 1`, `Seccomp 2`) ✅[^2].

**Levels** ✅[^1]:

| Level | Intent | Examples of what it blocks |
|---|---|---|
| Privileged | Unrestricted; trusted system workloads | Nothing |
| Baseline | Prevent known privilege escalations, allow default pods | Privileged containers, host namespaces, hostPath, extra capabilities beyond a default list |
| Restricted | Current hardening best practice | Everything Baseline blocks, plus the controls below |

**Restricted controls** ✅[^1]:

| Control | Required value |
|---|---|
| `runAsNonRoot` | `true` (pod-level is enough); `runAsUser` must not be 0 |
| `allowPrivilegeEscalation` | `false` on every container, init and ephemeral container |
| `capabilities` | `drop` includes `ALL`; `add` only `NET_BIND_SERVICE` |
| `seccompProfile.type` | `RuntimeDefault` or `Localhost` — `Unconfined` and unset are rejected |
| Volume types | Only `configMap`, `csi`, `downwardAPI`, `emptyDir`, `ephemeral`, `persistentVolumeClaim`, `projected`, `secret` |

Privilege escalation, seccomp and capability checks are Linux-only and skipped for pods with `spec.os.name: windows` ✅[^1].

**Modes:** `enforce` rejects violating pods; `audit` records an audit annotation; `warn` returns a warning to the client. A safe rollout: set `warn` and `audit` first, fix workloads, then `enforce` ✅[^1].

## Worked example
Real rejection in the lab (k3s v1.33.5, 2026-11-04) ✅[^2]:
```console
$ kubectl create ns locked
$ kubectl label ns locked pod-security.kubernetes.io/enforce=restricted
$ kubectl -n locked run priv --image=busybox:1.36 --privileged --command -- sleep 1
Error from server (Forbidden): pods "priv" is forbidden: violates PodSecurity "restricted:latest":
privileged (container "priv" must not set securityContext.privileged=true),
allowPrivilegeEscalation != false (container "priv" must set securityContext.allowPrivilegeEscalation=false),
unrestricted capabilities (container "priv" must set securityContext.capabilities.drop=["ALL"]),
runAsNonRoot != true …
```
Each clause maps to one row of the Restricted table; fixing the spec means adding the artifact's `securityContext` and an image that runs as a non-root UID.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Deployment in an `enforce` namespace with a violating template | The Deployment is created, but its pods are rejected; ReplicaSet shows `FailedCreate` | Admission checks pods ✅[^2] (lab: `kubectl create deployment` printed a "would violate PodSecurity" warning, the Deployment stayed 0/1, and events showed `Error creating: pods … is forbidden`) |
| Image runs as root by default (`USER` not set) | Restricted rejects or the container fails to start with `runAsNonRoot` | Must run non-root ✅[^1] (lab: `CreateContainerConfigError: container has runAsNonRoot and image will run as root`) ✅[^2] |
| Seccomp not set | Rejected by Restricted | Absence is prohibited ✅[^1] |
| Node agents (CNI, log shippers) | Need Privileged namespaces | They use host namespaces/paths ✅[^1] |
| Windows pods | Linux-only checks skipped | `spec.os.name` ✅[^1] |

## Takeaways
- Label every application namespace at least `baseline` enforce and `restricted` warn/audit; move to `restricted` enforce. [rule-candidate]
- Build images that run as a non-root UID, so Restricted works without per-pod overrides.
- Keep Privileged namespaces for node-level agents only.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) — Kubernetes project, living. Backs: the three levels, Restricted controls and allowed volume types, Linux-only checks, admission modes and labels. [^1]
- `kubernetes/lab-setup.md` — the k3s lab where the Restricted rejection was captured on 2026-11-04. [^2]
- [Controlling Access to the Kubernetes API](https://kubernetes.io/docs/concepts/security/controlling-access/) — Kubernetes project, living. Backs: admission control step. [^3]
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/) — Kubernetes project, living. Backs: further reading on the controller.
- [Configure a Security Context for a Pod or Container](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) — Kubernetes project, living. Backs: `runAsUser`, capabilities, seccomp and `allowPrivilegeEscalation` settings. [^4]

## Related
- `linux/containers/container-isolation.md` — what each control does in the kernel.
- `kubernetes/security/rbac-and-service-accounts.md` — API-level permissions.
