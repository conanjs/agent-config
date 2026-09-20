# GKE Clusters — OTS Infrastructure

_Last updated: 2026-08-13_

## Project: one-global-ecommerce-stage

| Cluster | Zone/Region | Mode | Notes |
|---|---|---|---|
| `sea1-edu-ecom-gke` | asia-southeast1-a | Standard | Education/training |
| `sea1-stage-ecom-gke` | asia-southeast1-a | Standard | Main staging cluster |
| `sea1-stage-unicorn-gke` | asia-southeast1 | Standard | Project: `one-global-unicorn-stage` (no access) |
| `sea1-stg-ecom-gke` | asia-southeast1 | Autopilot | Staging autopilot |

## Project: one-global-ecommerce-dev

| Cluster | Zone/Region | Mode | Notes |
|---|---|---|---|
| `ane3-dev-ecommerce-autopilot-gke` | asia-northeast3 | Autopilot | — |
| `sea1-dev-ecom-aoq-gke` | asia-southeast1 | Autopilot | AOQ workloads |
| `sea1-dev-ecom-autopilot-gke` | asia-southeast1 | Autopilot | — |
| `sea1-dev-ecom-gke02` | asia-southeast1-a | Standard | `test-env` namespace visible |
| `sea1-dev-ecom-gke03` | asia-southeast1-a | Standard | `internal-test-env` namespace visible |
| `sea1-dev-ecom-gke04` | asia-southeast1-a | Standard | — |
| `sea1-dev-unicorn-gke` | asia-southeast1 | Standard | Project: `one-global-unicorn-dev` |
| `sea1-test-unicorn-gke` | asia-southeast1 | Standard | Project: `one-global-unicorn-test` |

## Namespaces of Interest (from Workloads view)

| Cluster | Namespace | Purpose |
|---|---|---|
| `sea1-dev-ecom-gke02` | `test-env` | QA testing environment |
| `sea1-dev-ecom-gke03` | `internal-test-env` | Internal/integration testing |

## Adding Clusters to Lens

```bash
# Stage clusters
gcloud container clusters get-credentials sea1-edu-ecom-gke --zone asia-southeast1-a --project one-global-ecommerce-stage
gcloud container clusters get-credentials sea1-stage-ecom-gke --zone asia-southeast1-a --project one-global-ecommerce-stage
gcloud container clusters get-credentials sea1-stg-ecom-gke --region asia-southeast1 --project one-global-ecommerce-stage

# Dev clusters (gke02 + gke03)
gcloud container clusters get-credentials sea1-dev-ecom-gke02 --zone asia-southeast1-a --project one-global-ecommerce-dev
gcloud container clusters get-credentials sea1-dev-ecom-gke03 --zone asia-southeast1-a --project one-global-ecommerce-dev
```

Lens auto-detects contexts from `~/.kube/config` after running these.

## Related

- [OTS Index]({{AGENT_HOME}}/companies/ots/index.md)
