---
schema: infra
last-updated: 2026-10-19
---

# Stage Secrets Migration to Google Secret Manager (shipment APIs)

_Last verified against the live stage cluster on 2026-10-19. Contains key names and file names only, never secret values._

## Purpose
Record how `ne-shipment-api` and `ne-import-shipment-api` get their secrets and service-account files in the **stage** environment, what moved from hand-made Kubernetes Secrets to Google Secret Manager (GSM), and what was verified on the live cluster. Generic mechanism (volumes, `projected`, symlinks): `{{AGENT_HOME}}/knowledge/kubernetes/volumes-secrets-and-projected.md`.

## Scope
| Item | Value |
|---|---|
| Jira | NE-80117 (commit and PR title); branch is named after NE-79444 |
| PR | `ocean-network-express/ne-ecom-gitops#1932` (supersedes `#1929`, closed because of a wrong branch name) |
| Environment | `stage` only (cluster `sea1-stage-ecom-gke`, namespace `stage-env`, GSM project `one-global-ecommerce-stage`). Not `stg`, `stage-dr`, `exp`, load test or education |
| Reference migrations | internal-test (`#1875`) and test (`#1884`) used the same pattern |

## How secrets reach the pods
```
GSM key ──► ExternalSecret (ESO, refresh 1h) ──► K8s Secret ──► env var (secretKeyRef)  or  file (projected volume)
```
- **Env vars:** `secretKeyRef` points at a K8s Secret name and key.
- **Files:** a `projected` volume named `service-account-credentials` picks single keys from several Secrets and mounts them as files.
- **Old file source:** a hand-made Secret `json-key` with 20 keys. It is not defined in `ne-ecom-gitops` and not backed by GSM.

## Env vars moved to new GSM-backed Secrets
Two new ExternalSecrets live in `infras/ecom/ne-secrets/overlays/stage/` (not in `base/`, so other environments are unaffected):

| New Secret | Keys | GSM key (proposed) |
|---|---|---|
| `external-sap-api-secret` | `SAP_API_AUTH_HOST`, `SAP_API_AUTH_USERNAME`, `SAP_API_AUTH_PASSWORD`, `SAP_API_HOST`, `SAP_COUNTRIES` | `STAGE_<same name>` |
| `external-shipment-secret` | `SHIPMENT_POSTGRES_PASSWORD`, `IMPORT_SHIPMENT_POSTGRES_PASSWORD`, `CARGO_EMAIL_RECIPIENTS` | `STAGE_<same name>` |

| Service | Moved | Removed | Kept as-is |
|---|---|---|---|
| `ne-shipment-api` | 5 SAP vars, `SHIPMENT_POSTGRES_PASSWORD` | — | `ENABLED_ADD_MOBILE_BOOKING_CHANEL` (stays a literal `'true'`; the code compares it with `=== 'true'`), `LOG_POSTGRES_PASSWORD`, `LOG_SECRET_KEY` (to be removed later), `ECOM_POSTGRES_INSTANCE`, `SHIPMENT_POSTGRES_HOST`, other `ECOM_POSTGRES_*` |
| `ne-import-shipment-api` | 5 SAP vars, `IMPORT_SHIPMENT_POSTGRES_PASSWORD`, `CARGO_EMAIL_RECIPIENTS` | — | `CR_POSTGRES_PASSWORD` (the stage image still reads it, see below; remove it in a later PR), `IMPORT_SHIPMENT_POSTGRES_HOST`, `IMPORT_ARRIVAL_NOTICE_STORAGE_PATH` |

Current values still sit in the K8s Secrets `sap-api-secret`, `environment-secret` and `sendgrid-secret`.

## Service-account files: env var → file → source
| Service (mount path) | Env var | File | Source Secret → GSM key | Read by | If missing |
|---|---|---|---|---|---|
| `ne-shipment-api` (`/var/secrets/google`) | `GCP_KEY_FILE_NAME` | `bucket-service-account.json` | `external-service-account-secret` → `BUCKET_SERVICE_ACCOUNT` | `src/modules/shipment-dashboard/services/storageClient.ts` | Storage calls fail |
| `ne-shipment-api` | `ECOM_POSTGRES_SERVICE_ACCOUNT_PATH` | `legacy-ecom-postgres-sa.json` | `external-legacy-db-secret` → `STAGE_LEGACY_DATABASE_SERVICE_ACCOUNT` | `src/database/unit-of-work/legacy/database.module.ts` | **Startup fails** (no try/catch around `readFile`) |
| `ne-shipment-api` | `ECOM_DB_POSTGRES_SERVICE_ACCOUNT_FILENAME` | `ecom-db-postgres-sa.json` | `external-ecom-db-secret` → `STAGE_ECOM_DB_POSTGRES_SERVICE_ACCOUNT_FILENAME` | `src/database/unit-of-work/new-ecom/database.module.ts` | Falls back to host and port |
| `ne-import-shipment-api` (`/secrets`) | `GCP_KEY_FILE_NAME` (`../secrets/...`, resolves because Dockerfile `WORKDIR` is `/app`) | `bucket-service-account.json` | `external-service-account-secret` → `BUCKET_SERVICE_ACCOUNT` | cargo-release GCP storage client and `cloud-storage.service.ts` | Storage calls fail |
| `ne-import-shipment-api` | `ECOM_DB_POSTGRES_SERVICE_ACCOUNT_FILENAME` | `ecom-db-postgres-sa.json` | `external-ecom-db-secret` → `STAGE_ECOM_DB_POSTGRES_SERVICE_ACCOUNT_FILENAME` | `src/modules/shared/services/module-config.ts` | Falls back to host and port |
| `ne-import-shipment-api` | `PUBSUB_SERVICE_ACCOUNT` | `pubsub_key.json` | `external-service-account-secret` → `PUB_SUB` | Only declared in `system-config.ts`; **nothing reads it** | No effect |

The stage deployments now mount only these files through a `projected` volume (shipment-api: 3 files, import-shipment-api: 3 files) instead of all 20 files of `json-key`. Mount paths and file names did not change.

## Live-cluster findings (2026-10-19, read-only)
| Finding | Detail |
|---|---|
| File contents match | `bucket-service-account.json`, `pubsub_key.json`, `ecom-db-postgres-sa.json` from the GSM-backed Secrets are byte-identical to `json-key` |
| Legacy file differs only in formatting | `legacy-ecom-postgres-sa.json`: same service account (`ecomm-exodus-cloudsqlauthproxy`) and same key id, different bytes |
| ExternalSecrets healthy | `external-service-account-secret`, `external-ecom-db-secret`, `external-legacy-db-secret` are `SecretSynced`; live specs equal the repo's stage render |
| DB modes from pod logs | shipment-api connects to the ecom DB "by using Instance"; import-shipment-api uses "Host and Port" for both DBs, so its `ecom-db-postgres-sa.json` is mounted but unused |
| Why import never uses Instance mode | `ECOM_POSTGRES_AUTH_SCOPE` is set in no import-shipment-api overlay (stage, internal-test, production), so `resolveDatabaseConnection` falls back. Pre-existing behavior |
| Other `json-key` files | efin, bigquery, tradelens and others are not read by either service's code |
| `CR_POSTGRES_PASSWORD` is still read in stage | The live import image (`904870a`, built 2026-09-11) has `CargoReleaseDatabaseModule`, whose factory calls `getCargoReleaseDatabaseConfig()`. The Cargo-Release repositories use that connection, and the pod connects to it at every boot (`migrationsRun: true`). The password from the Deployment differs from the placeholder in the image's baked `/app/.env`, so removing the variable would change the password the image uses. `develop` no longer has the caller (commit `5c9ead9`, NE-55517, moved the tables into the import DB), but stage runs an older image, 86 commits behind |
| Pods run on `json-key` today | Live Deployments still mount `json-key` until `#1932` is merged and synced |

## Open items and pitfalls
- **Host and path vars are config, not secrets:** `SHIPMENT_POSTGRES_HOST` and `IMPORT_SHIPMENT_POSTGRES_HOST` have the same value in the Deployment (from `environment-secret`) and in the committed `.env.stage`, which the Dockerfile bakes into the image as `/app/.env` (`COPY .env.${ENV_TAG} ./.env`), so they need no GSM key (internal-test dropped them for that reason). `IMPORT_ARRIVAL_NOTICE_STORAGE_PATH` is **different** in `environment-secret` (`/mnt/ecom/stg/...`, exists in the pod) and in `.env.stage` (`/mnt/ecom/stage/...`, does not exist in the pod), so it must stay set on the Deployment; keep it as is, or later make it a literal `value:`.
- **`environment-secret` is hand-made:** created 2022-08-12 with `kubectl apply` (it carries `last-applied-configuration`), later edited in Lens (`k8slens-edit-resource-version` label), 157 keys shared by many services, no owner reference, no Argo tracking, and no Secret manifest anywhere in `ne-ecom-gitops`. The same holds for `json-key`, `sap-api-secret`, `sendgrid-secret`, `legacy-ecom-database-secret`, `unicorn-migration-secret`, `shipment-environment-secret` and `import-shipment-environment-secret`.
- **Remove `CR_POSTGRES_PASSWORD` later, in a separate PR,** only after stage runs an image built after `5c9ead9` (check with `git grep "\.getCargoReleaseDatabaseConfig()" <sha> -- src` returning 0 callers). Deploying that image also needs a check of the stage import DB: the moved migrations (`cargoReleaseRequest`, mail table) only call `createTable` with no data copy and no "if not exists" guard, so existing rows in the old Cargo-Release database are not carried over, and tables already created by hand would make the boot fail unless the `migrations` table records them.
- **Existing stage crash loop:** the import pod restarted because the Cargo-Release email consumer threw an unhandled "Could not send emails because 'to' recipients list is empty/filtered". It is independent of this migration, but `CARGO_EMAIL_RECIPIENTS` now comes from `STAGE_CARGO_EMAIL_RECIPIENTS`, so copy its value exactly from `sendgrid-secret`.
- **Argo CD ownership:** the Deployments belong to the Argo apps `<service>-staging` (auto-sync, prune, self-heal, from `applicationset/overlays/stage/deployment.yaml`); the ExternalSecrets belong to the app `ne-secrets-stage`, which is **not defined in this repo** (a stage secrets ApplicationSet was added in #1027 and reverted in #1031). Its sync policy is unknown, so check whether it auto-syncs before relying on it after merge. The old `json-key`, `sap-api-secret` and `environment-secret` have no Argo owner (hand-made). The Argo CD control plane is not in the stage cluster.
- **GSM keys (status 2026-10-19):** the 8 `STAGE_*` keys this PR reads (5 SAP, 2 Postgres passwords, `CARGO_EMAIL_RECIPIENTS`) were created that day and each has an enabled version (metadata checked; values not compared, so check each against the current K8s secret before merge, watching for trailing newlines). `STAGE_ENABLED_ADD_MOBILE_BOOKING_CHANEL` does not exist and is not needed.
- **Dead file:** `overlays/stage/secret-service-account-external.yaml` maps `STAGE_BUCKET_SERVICE_ACCOUNT`, but stage's `kustomization.yaml` does not include it, so the base mapping (`BUCKET_SERVICE_ACCOUNT`) is what runs.
- **Naming is mixed:** stage GSM uses both unprefixed names (`BUCKET_SERVICE_ACCOUNT`, `PUB_SUB`) and `STAGE_` names. Check the live ExternalSecret before assuming a key name.
- **Not migrated (not on the sheet):** shipment-api's `ECOM_POSTGRES_DB`, `_USER`, `_PORT`, `_PASSWORD`, `_INSTANCE`, `_AUTH_SCOPE` still read the old `legacy-ecom-database-secret`.
- **Unrelated:** the old `legacy-db-secret` ExternalSecret showed `SecretSyncedError` on 2026-10-19; nothing in these deployments uses it.
- **Auth to inspect the cluster:** `gcloud auth login`, then `kubectl --context gke_one-global-ecommerce-stage_asia-southeast1-a_sea1-stage-ecom-gke -n stage-env ...`.

## References

**Local artifacts:**
- `ne-ecom-gitops/applications/ne-shipment-api/overlays/stage/deployment.yaml` and `.../ne-import-shipment-api/overlays/stage/deployment.yaml` — the stage Deployments.
- `ne-ecom-gitops/infras/ecom/ne-secrets/overlays/stage/` — `secret-sap-api-external.yaml`, `secret-shipment-external.yaml` and the stage `kustomization.yaml`.
- `ne-shipment-api/src/database/unit-of-work/legacy/database.module.ts`, `.../new-ecom/database.module.ts`, `src/modules/shipment-dashboard/services/storageClient.ts` — consumers of the files.
- `ne-import-shipment-api/src/modules/shared/services/module-config.ts`, `src/modules/shared/utils/get-instance-db.ts` — consumers in the import service.

## Related
- `{{AGENT_HOME}}/knowledge/kubernetes/volumes-secrets-and-projected.md` — what `secret:`, `projected:`, `sources` and `items` mean.
- `{{AGENT_HOME}}/companies/ots/infra/gke-clusters.md` — cluster list.
- `{{AGENT_HOME}}/companies/ots/repos/ne-shipment-api/overview.md` and `{{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/overview.md` — repo overviews.
