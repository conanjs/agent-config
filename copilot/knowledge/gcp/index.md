---
schema: topic-index/v1
kind: topic
topic: gcp
last-updated: 2026-11-06
---

# Google Cloud

Google Cloud covers behaviour of Google Cloud products seen from the services that call or run on them: GKE access and API gateway limits. It does not cover Kubernetes itself; see the Kubernetes topic.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [apigee-request-line-limit.md](apigee-request-line-limit.md) | concept | Apigee Edge's 7,168-byte request-line limit (HTTP 414 `TooBigLine`), how many encoded IDs fit in a GET query string, and why retrying it only adds delay | verified |
| [GKE + Lens Setup Guide](gke-lens-setup.md) | legacy | Connecting kubectl and Lens to GKE clusters | — |
| [Roadmap](roadmap.md) | legacy | GCP learning notes | — |

## References
- [Apigee Edge documentation](https://docs.apigee.com/) — Google, living. Backs: topic scope.
- [Google Kubernetes Engine documentation](https://cloud.google.com/kubernetes-engine/docs) — Google, living. Backs: topic scope.

## Related
- `kubernetes/` — cluster and workload behaviour independent of GKE.
