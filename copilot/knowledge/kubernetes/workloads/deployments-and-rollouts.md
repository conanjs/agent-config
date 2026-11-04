---
schema: knowledge-doc/v1
type: concept
topic: kubernetes/workloads
status: verified
applies-to: ["Kubernetes ≥ 1.29"]
derived-from: [kubernetes/architecture/life-of-a-pod-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, deployment, replicaset, rolling-update, maxsurge, maxunavailable, rollback, revision-history]
---

# Deployments, ReplicaSets and rolling updates

## Summary
**TL;DR:** A Deployment does not manage pods directly: it owns one **ReplicaSet** per pod-template version (named by `pod-template-hash`), and each ReplicaSet keeps N pods alive. Changing the pod template (image, env, resources…) — and only that — starts a **rollout**: the new ReplicaSet scales up while the old one scales down, bounded by `maxSurge` (default 25%, rounded up) extra pods and `maxUnavailable` (default 25%, rounded down) missing pods. Old ReplicaSets are kept (10 by default) so `kubectl rollout undo` is instant. A rollout that makes no progress for 600 s is marked failed.
**Use this when:** you tune rollout speed and safety, a rollout hangs, you need to roll back, or you wonder why there are many empty ReplicaSets.
**Not this doc:** stateful or per-node workloads → `workloads/workload-controllers.md`; probes that gate a rollout → `workloads/pod-lifecycle-and-probes.md`.

## Problem
Rollouts that take down too much capacity at once, rollouts that hang forever because new pods never become ready, and "rollbacks" done by re-deploying an old manifest by hand all come from not knowing the ReplicaSet mechanics and the surge/unavailable arithmetic.

## Mental model
**Analogy:** replacing the staff of a shop shift by shift. Each uniform version is a separate team (ReplicaSet). The manager (Deployment) hires new-uniform staff while letting old-uniform staff go, never letting the shop be more than `maxUnavailable` short or more than `maxSurge` over-staffed. The old team's contact sheet is kept, so rehiring them (rollback) is quick.

**Artifact:** a rolling update captured in the lab (k3s v1.33.5, 2026-11-04) ✅[^2]:
```console
$ kubectl set image deploy/web nginx=nginx:1.28-alpine
$ kubectl get rs -l app=web
NAME             DESIRED   CURRENT   READY   AGE
web-66cc98c56d   3         3         3       12s     # new template hash
web-7dd566fbcc   0         0         0       22s     # old one kept at 0 for rollback
$ kubectl get deploy web -o jsonpath='{.spec.strategy}'
{"rollingUpdate":{"maxSurge":"25%","maxUnavailable":"25%"},"type":"RollingUpdate"}
```

## How it works
**3 actors:**
- **Deployment controller** — its job: own ReplicaSets, create a new one per template change and shift replicas between them, via the API server ✅[^1].
- **ReplicaSet controller** — its job: keep exactly `replicas` matching pods, via creating and deleting Pod objects.
- **kubelet + readiness probes** — its job: report when new pods are ready, which is what lets the rollout continue ✅[^1] (`AVAILABLE` counts replicas available to users).

1. **Trigger:** only a change to `.spec.template` creates a new revision; scaling does not ✅[^1].
2. **New ReplicaSet:** created with a `pod-template-hash` label so old and new pods do not overlap ✅[^1].
3. **Bounds:** during the rollout, total pods ≤ replicas + `maxSurge` and available pods ≥ replicas − `maxUnavailable`. Percentages convert to numbers: `maxSurge` rounds **up**, `maxUnavailable` rounds **down**; defaults are 25% each ✅[^1].
4. **Progress:** new pods count once ready (and `minReadySeconds` passed); the controller then scales the old ReplicaSet down further.
5. **Failure detection:** with no progress for `progressDeadlineSeconds` (default 600), the Deployment gets a failed `Progressing` condition (`ProgressDeadlineExceeded`); the rollout is not undone automatically ✅[^1]; "Kubernetes takes no action on a stalled Deployment other than to report a status condition" ✅[^1].
6. **History and rollback:** `revisionHistoryLimit` (default 10) old ReplicaSets are kept; `kubectl rollout undo` scales the previous one back up ✅[^1].
7. **Recreate strategy:** all old pods are killed before new ones are created (downtime, but never two versions at once) ✅[^1].

## Worked example
`replicas: 4` with the defaults:

| Quantity | Calculation | Value |
|---|---|---|
| `maxSurge` 25% of 4 | 1.0, round up | 1 → at most 5 pods |
| `maxUnavailable` 25% of 4 | 1.0, round down | 1 → at least 3 available |

With `replicas: 3` (the lab): 25% = 0.75 → `maxSurge` = 1 (up), `maxUnavailable` = 0 (down) ✅[^1]. So the rollout never drops below 3 available pods and adds one new pod at a time — matching the lab's log, which updated one replica at a time ✅[^2]:
```text
Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 2 out of 3 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 1 old replicas are pending termination...
deployment "web" successfully rolled out
```
`kubectl rollout undo deploy/web` then brought back `nginx:1.27-alpine` by scaling the old ReplicaSet up ✅[^2].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| New image never becomes ready | Rollout stalls with 1 surge pod; after 600 s condition `ProgressDeadlineExceeded` | `maxUnavailable` 0 keeps old pods; deadline ✅[^1] |
| `maxSurge: 0` and `maxUnavailable: 0` | Invalid | One must be non-zero ✅[^1] |
| Editing only `replicas` | No new ReplicaSet, no rollout | Template unchanged ✅[^1] |
| `latest` image tag re-pushed | No rollout (template string unchanged) | Template string unchanged → no new ReplicaSet (lab: re-applying the same manifest kept 1 ReplicaSet) ✅[^2] |
| Manually deleting a pod with Recreate | Replacement is created immediately | Recreate only orders upgrades ✅[^1] |
| Need canary or blue/green | Not built in | Use multiple Deployments (canary pattern) ✅[^1] |

## Trade-offs
| Setting | Gains | Costs |
|---|---|---|
| Higher `maxSurge` | Faster rollouts, capacity kept | Needs spare cluster capacity |
| Higher `maxUnavailable` | Faster without extra capacity | Less capacity during the rollout |
| `Recreate` | Never two versions running | Downtime |
| `minReadySeconds` > 0 | Catches pods that crash right after becoming ready | Slower rollouts |

## Takeaways
- Gate rollouts with a real readiness probe; without one, broken pods count as available. [rule-candidate]
- Roll back with `kubectl rollout undo`, not by re-applying old YAML by hand.
- Use immutable image tags or digests so every change is a template change.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — Kubernetes project, living. Backs: ReplicaSet ownership, `pod-template-hash`, template-only triggers, defaults and rounding of `maxSurge`/`maxUnavailable`, `revisionHistoryLimit` 10, `progressDeadlineSeconds` 600, Recreate semantics, rollback. [^1]
- `kubernetes/lab-setup.md` — the k3s lab where the rollout, ReplicaSets, strategy and undo were captured on 2026-11-04. [^2]
- `kubernetes/architecture/life-of-a-pod-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `kubernetes/workloads/pod-lifecycle-and-probes.md` — readiness gating.
- `kubernetes/operations/autoscaling.md` — HPA changes `replicas`, not the template.
