---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/security
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, rbac, role, clusterrole, rolebinding, service-account, token, least-privilege, authorization]
---

# RBAC and service accounts

## Summary
**TL;DR:** RBAC answers "may this identity do this verb on this resource?". A **Role** (namespaced) or **ClusterRole** (cluster-wide) lists allowed verbs on resources; a **RoleBinding** or **ClusterRoleBinding** grants it to subjects (users, groups, service accounts). Permissions only add up — there are no deny rules. Pods authenticate as a **ServiceAccount**; since v1.22 they get a short-lived, automatically rotated token mounted through a projected volume, bound to that pod. Built-in user roles `view` / `edit` / `admin` / `cluster-admin` cover most human needs; `view` cannot read Secrets.
**Use this when:** you grant a workload or a person API access, debug `Forbidden` (HTTP 403) errors, review who can read Secrets, or want to stop mounting tokens into pods that do not need them.
**Not this doc:** the full API request path → `architecture/control-plane-and-reconciliation.md`; pod-level hardening → `security/pod-security.md`.

## Problem
Over-broad grants are the common failure: `cluster-admin` for CI, `edit` for an app that only reads ConfigMaps, or every pod carrying a token it never uses. Under-granting shows up as cryptic `Forbidden` errors. Both are fixed by reading RBAC as verbs × resources × scope.

## Mental model
**Analogy:** an office key system. A Role is a key ring description ("can open the pods cabinet to look and list"). A RoleBinding hands that key ring to someone, valid in one building (namespace); a ClusterRoleBinding makes it valid everywhere. You can be given several key rings; keys only add doors, nothing removes one. A ServiceAccount is a badge issued to a machine (pod), re-printed regularly with an expiry.

**Artifact:** a least-privilege grant and its check (lab, k3s v1.33.5, 2026-11-04) ✅[^4]:
```console
$ kubectl create sa demo
$ kubectl create role pod-reader --verb=get,list,watch --resource=pods
$ kubectl create rolebinding demo-read --role=pod-reader --serviceaccount=default:demo
$ kubectl auth can-i list pods    --as=system:serviceaccount:default:demo
yes
$ kubectl auth can-i delete pods  --as=system:serviceaccount:default:demo
no
$ kubectl auth can-i list secrets --as=system:serviceaccount:default:demo
no
```

## How it works
**4 actors:**
- **Subject** — its job: be identified by authentication, as a user, group, or service account (`system:serviceaccount:<ns>:<name>`).
- **Role / ClusterRole** — its job: list `apiGroups` × `resources` × `verbs` ✅[^1].
- **RoleBinding / ClusterRoleBinding** — its job: grant a role to subjects, in a namespace or cluster-wide ✅[^1].
- **RBAC authorizer in the API server** — its job: allow the request if any binding grants it ✅[^1] ✅[^3].

1. **Scope:** a Role grants within one namespace; a ClusterRole can grant cluster-scoped resources (nodes), non-resource URLs (`/healthz`), or namespaced resources in all namespaces ✅[^1].
2. **Binding scope:** a RoleBinding may reference a ClusterRole, applying it only within the binding's namespace — the usual way to reuse `view`/`edit` per namespace ✅[^1].
3. **Additive:** "Permissions are purely additive (there are no "deny" rules)" ✅[^1].
4. **Escalation prevention:** you can only create a role containing permissions you already hold (or with the `escalate` verb), and only bind a role whose permissions you hold (or with the `bind` verb) ✅[^1].

**Default user-facing ClusterRoles** ✅[^1]:

| Role | Grants | Notable limits |
|---|---|---|
| `cluster-admin` | Everything (bound to `system:masters`) | — |
| `admin` | Read/write most namespace resources, including Roles and RoleBindings | No writes to ResourceQuota or the namespace itself |
| `edit` | Read/write most namespace objects | Cannot view/modify Roles/RoleBindings; **can** read Secrets and run pods as any ServiceAccount (an escalation path) |
| `view` | Read-only most objects | **Cannot read Secrets** |

**Service accounts** ✅[^2]:
1. Every namespace has a `default` ServiceAccount with no permissions beyond API discovery; pods use it unless `spec.serviceAccountName` is set.
2. Since v1.22, pods receive a **short-lived, automatically rotating** token through the TokenRequest API and a projected volume; long-lived Secret-based tokens are discouraged.
3. `automountServiceAccountToken: false` (pod or ServiceAccount) stops token injection.
4. `kubectl create token <sa> --duration=1h` issues a token for external use.

## Worked example
What a pod's token looks like (lab, 2026-11-04) ✅[^4]:
```text
/var/run/secrets/kubernetes.io/serviceaccount/: ca.crt  namespace  token
token payload (decoded JWT): {"aud":["https://kubernetes.default.svc.cluster.local","k3s"],
  "exp":1825309627, "iat":1793773627, "iss":"https://kubernetes.default.svc.cluster.local",
  "kubernetes.io":{"namespace":"default","node":{…},"pod":{"name":"tok", …},"serviceaccount":{"name":"demo", …}}}
```
The token names the **pod** and **node** it was issued for, has an audience and an expiry: if it leaks, it is bound to that pod's lifetime and expires ✅[^4] (lab: the token returned HTTP 200 while its pod existed and 401 once the pod was gone).

Debugging a 403 for an app:

| Step | Command | Looks for |
|---|---|---|
| 1 | Read the error | `… is forbidden: User "system:serviceaccount:shop:api" cannot list resource "configmaps" in API group "" in the namespace "shop"` (format seen in the lab) ✅[^4] |
| 2 | `kubectl auth can-i list configmaps -n shop --as=system:serviceaccount:shop:api` | `no` confirms |
| 3 | `kubectl get rolebindings,clusterrolebindings -A -o wide \| grep shop:api` | Which roles it has |
| 4 | Add a Role with only `get,list,watch` on `configmaps` and bind it | Least privilege |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Giving `edit` to a CI robot | It can read Secrets and impersonate any SA in the namespace by running pods | `edit` semantics ✅[^1] |
| ClusterRoleBinding of `view` "for one namespace" | Read access everywhere | Use a RoleBinding instead ✅[^1] |
| Trying to deny one verb | Not possible | Additive model ✅[^1] |
| Pod that never calls the API | Still gets a token by default | Disable automount ✅[^2] |
| Deleting the `default` ServiceAccount | Recreated by the control plane | ✅[^2] |

## Takeaways
- One ServiceAccount per workload, bound with a namespaced Role holding only the verbs it uses. [rule-candidate]
- Set `automountServiceAccountToken: false` for pods that do not call the API. [rule-candidate]
- Audit who can read Secrets (`edit`, `admin`, custom roles) — not just who has `cluster-admin`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) — Kubernetes project, living. Backs: Role/ClusterRole scope, bindings, ClusterRole in RoleBinding, additive permissions, default user-facing roles, escalation prevention. [^1]
- [Service Accounts](https://kubernetes.io/docs/concepts/security/service-accounts/) — Kubernetes project, living. Backs: default ServiceAccount, short-lived projected tokens since v1.22, automount opt-out, `kubectl create token`. [^2]
- [Controlling Access to the Kubernetes API](https://kubernetes.io/docs/concepts/security/controlling-access/) — Kubernetes project, living. Backs: authorization step and HTTP 403. [^3]
- `kubernetes/lab-setup.md` — the k3s lab where the grant, `can-i` results and token payload were captured on 2026-11-04. [^4]

## Related
- `kubernetes/security/pod-security.md` — what a pod may do on its node.
- `kubernetes/volumes-secrets-and-projected.md` — projected volumes, which carry the token.
