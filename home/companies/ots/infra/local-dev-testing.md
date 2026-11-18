# Local Dev Testing Setup — OTS eCommerce

_Last updated: 2026-08-14_

> **One-prompt restore target:** When V says "set up local testing for cargo release restore", apply every change in this document. When V says "revert local testing changes", undo them all and restore git-tracked files to HEAD.

---

## Why IPv6 (`::1`) Instead of `localhost`

**Citrix VPN (Global Protect / Citrix Workspace) blocks all `127.0.0.1` / `localhost` loopback traffic on macOS.** This means:
- HTTP servers on `localhost:3001` are unreachable
- Docker-mapped ports on `0.0.0.0:5432` are unreachable
- gRPC clients targeting `0.0.0.0:5010` fail with `EADDRNOTAVAIL`

**IPv6 loopback `::1` is NOT blocked by Citrix VPN** — it uses a different network stack path. This is the sole reason all local dev addresses must use `::1`.

Rule: any time you see `localhost`, `127.0.0.1`, or `0.0.0.0` in a local `.env` or `docker-compose.yml`, replace with `::1` (with `[::1]` brackets where URL notation requires it).

---

## Architecture of the Cargo Release Feature (local ports)

```
Browser / curl
    │
    ▼ HTTP [::1]:3001
ne-api-gateway
    │  auth: auth.service.ts → ne-system-api gRPC [::1]:5000  (stub locally)
    │
    ▼ gRPC [::1]:5010  (CARGO_RELEASE_API_GRPC_URL)
ne-import-shipment-api
    │
    ├── PostgreSQL [::1]:5432  (cargo-release DB: cargo-release; import DB: import-shipment)
    └── Redis      [::1]:6379

```

**Critical: two "CargoReleaseController" classes exist in ne-api-gateway**

| Module | File path | Package | Loaded? |
|--------|-----------|---------|---------|
| `ImportShipmentModule` | `src/modules/import-shipment/controllers/cargo-release.controller.ts` | `IMPORT_SHIPMENT_PACKAGE` | ✅ YES — registered in `src/app/index.ts` |
| `CargoReleaseModule` | `src/modules/cargo-release/controllers/cargo-release.controller.ts` | `CARGO_RELEASE_PACKAGE` | ❌ NO — module never imported in app root |

All real routes go through `import-shipment/controllers/`. The `cargo-release/` module is dead code.

---

## Files to Change for Local Testing

### 1. `ne-import-shipment-api/docker-compose.yml`

Change all port bindings from IPv4 to IPv6, and pin Postgres version:

```yaml
# BEFORE
ports:
  - "5432:5432"
  - "6379:6379"
  - "5050:80"
image: postgres

# AFTER
ports:
  - "[::1]:5432:5432"
  - "[::1]:6379:6379"
  - "[::1]:5050:80"
image: postgres:16          # MUST pin — untagged pulls Postgres 18, breaks existing volumes
```

> **If Postgres fails to start after changing image tag:** run `docker compose down -v` (wipes volume) then `docker compose up -d`. `RUN_MIGRATIONS=true` in `.env` recreates the schema automatically.

---

### 2. `ne-import-shipment-api/.env`

```bash
# DB hosts: localhost → ::1
ECOM_POSTGRES_HOST=::1
IMPORT_SHIPMENT_POSTGRES_HOST=::1
CR_POSTGRES_HOST=::1

# Redis host: localhost → ::1
REDIS_HOST=::1

# gRPC server bind: 0.0.0.0 → [::1]  (so gateway can connect via IPv6)
IMPORT_SHIPMENT_API_GRPC_URL=[::1]:5010
```

---

### 2b. ODS DB — bypass VPN-only private IP for local boot

`ne-import-shipment-api`'s `ODSDatabaseModule` (imported unconditionally via `ImportShipmentModule` → `AppModule`, `src/app/index.ts`) connects to a real internal Cloud SQL instance (`ODS_DATABASE_HOST`, private `10.x` IP) **eagerly at every app boot**, regardless of whether the feature under test (cargo-release) ever queries ODS. Without VPN access to that specific subnet, the app fails to start entirely with:
```
ERROR [TypeOrmModule] Unable to connect to the database (ODS_DB_CONNECTION). Retrying (1)...
Error: connect ETIMEDOUT 10.103.2.241:5432
```

**Workaround:** point ODS at the same local docker-compose Postgres already used for `import-shipment`. `getODSDatabaseConfig()` (`src/modules/shared/services/module-config.ts`) sets `synchronize: false` and passes no `schema` option, so TypeORM only needs *a* reachable database at boot — not the real ODS schema/tables. Any code path that actually queries ODS entities (`OdsBookingEntity`, `OdsBookingCustomer`, `MdmStateEntity`, `SarOtsHdrEntity`) will still fail at runtime — acceptable since cargo-release testing never touches those.

```bash
# ne-import-shipment-api/.env — BEFORE (requires VPN to 10.103.2.0/24)
ODS_DATABASE_USERNAME="webapp"
ODS_DATABASE_PASSWORD="webapp12#$"
ODS_DATABASE_NAME="one-ods-tst-db"
ODS_DATABASE_HOST="10.103.2.241"
ODS_DATABASE_PORT="5432"

# AFTER (reuses local docker Postgres — no VPN needed)
ODS_DATABASE_USERNAME=postgres
ODS_DATABASE_PASSWORD=changeme
ODS_DATABASE_NAME=import-shipment
ODS_DATABASE_HOST=::1
ODS_DATABASE_PORT=5432
```

> **When to use the real ODS values instead:** if you're testing an import-shipment feature that actually calls `shipment.service.ts` methods using `odsDataSource` (e.g. `getOdsBookingInfo`, rate-of-exchange lookups), you need real VPN access to ODS — this workaround will not help, since the local DB has none of the real ODS data/schema.

---

### 3. `ne-api-gateway/.env`

```bash
# Both of these point to the same import-shipment-api gRPC server
IMPORT_SHIPMENT_API_GRPC_URL=[::1]:5010
CARGO_RELEASE_API_GRPC_URL=[::1]:5010    # default was wrong port 5019 — must be 5010

# (All other gRPC URLs stay unchanged — they point to company-side services, not local)
```

---

### 4. `ne-api-gateway/src/modules/auth/services/auth.service.ts` _(local stub)_

The gateway calls `ne-system-api` gRPC (`:5000`) for user info. That service isn't running locally.

Add a try/catch stub around `getUserInfoByUserId`:

```typescript
async getUserInfoByUserId(userId: string) {
  try {
    return await firstValueFrom(this.systemService.getUserInfoByUserId({ userId }));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn('auth stub: getUserInfoByUserId failed, returning stub');
      return { preferred_username: userId, email: userId };
    }
    throw error;
  }
}
```

> **Revert:** remove try/catch, restore original single-line `firstValueFrom(...)` call.

---

### 5. `ne-import-shipment-api/src/modules/import-shipment/services/shipment.service.ts` _(local stub)_

The `filterDOInformationByRequester` method calls `userService.getUserProfile` gRPC (`:5000`). Also not running locally.

Wrap the call:

```typescript
// BEFORE
const { userId } = await firstValueFrom(this.userService.getUserProfile(metadata));

// AFTER
let userId: string | undefined;
try {
  ({ userId } = await firstValueFrom(this.userService.getUserProfile(metadata)));
} catch (error) {
  if (!this.moduleConfig.isProduction()) {     // note: isProduction() does NOT exist in module-config after NE-74845 cleanup
    userId = metadata.get('userId')?.[0] as string | undefined;
  } else {
    throw error;
  }
}
```

> **Important:** `isProduction()` was removed from `ModuleConfig` in feature/NE-74845. Use `process.env.NODE_ENV !== 'production'` or add the method back temporarily. The parameter used here is `private readonly moduleConfig: ModuleConfig` (already in constructor).

> **Revert:** restore original single-line `const { userId } = await firstValueFrom(...)`.

---

### 6. `ne-import-shipment-api/src/modules/cargo-release/cargo-release.controller.ts` _(local HTTP endpoint)_

The cargo release controller is **gRPC-only**. There is no HTTP REST endpoint for submit/restore on port 3003. To test without going through the gateway, add a temporary HTTP endpoint:

```typescript
// Add to imports:
import { Body, Headers } from '@nestjs/common';

// Add at end of class (for local testing only — do NOT commit):
@Post('submit/http')
@UseGuards(PreventSubmitDuplicateContainersGuard, PreventSubmitInvalidContainerGuard)
@UsePipes(new ZodValidationPipe(() => submitRequestSchema, false))
async submitHttp(
  @Body() dto: SubmitRequestDto,
  @Headers('x-user-id') userId: string,
) {
  const effectiveUserId = userId || dto.submitter?.email;
  return this.cargoReleaseService.requestMultipleCargoRelease(dto, effectiveUserId);
}
```

> **Revert:** remove the method and `Body, Headers` imports. Do NOT commit this.

---

## Starting the Services

```bash
# 1. Start Docker containers (Postgres + Redis + pgAdmin)
cd ne-import-shipment-api
docker compose up -d

# 2. Start import-shipment-api (runs DB migrations on startup via RUN_MIGRATIONS=true)
npm run start:dev

# 3. Start gateway (in separate terminal)
cd ne-api-gateway
npm run start:dev
```

Both services must be running. Both already have `app.listen(port, '::1')` in `main.ts`.

---

## Test Cycle: Submit → Verify → Restore

### Step 1: Submit a cargo release request

```bash
# Via gateway (recommended — validates full flow)
curl -X POST http://[::1]:3001/api/v1/cargo-release/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "submitter": { "fullName": "Test User", "email": "test@one-line.com", "companyName": "ONE" },
    "requestDetails": {
      "blNo": "HAMG42298700",
      "bookingNo": "HAMG42298700",
      "arrivingVessel": "HMM OSLO",
      "podName": "YANTIAN, GUANGDONG",
      "delName": "TAIPING, GUANGDONG",
      "consigneeName": "DONGGUAN LAAYOUNE CHEMICAL CO., LTD.",
      "containerNos": ["BEAU2158477", "ONEU3247876", "DFSU1015272", "ONEU2932896", "ONEU3208864"],
      "referenceNo": null,
      "additionalRemarks": null
    },
    "releaseToParty": { ... },
    "attachments": [],
    "requestDateTime": "2026-08-14T00:00:00+00:00",
    "bookingMeta": { "etaPOD": "2026-08-24 09:00", "blType": null },
    "ofcEmails": [],
    "conditions": []
  }'
```

Known test booking: **`HAMG42298700`** (Hamburg→Tokyo, `canRequestCargoRelease: true`, 5 × DRY 20ft).

### Step 2: Check DB

```bash
psql -h ::1 -p 5432 -U <CR_POSTGRES_USER> -d <CR_POSTGRES_DB> \
  -c "SELECT id, \"blNo\", status, \"submissionCount\" FROM cargo_release_request WHERE \"blNo\" = 'HAMG42298700';"
```

### Step 3: Restore (reset for re-testing)

```bash
# Via gateway
curl -X DELETE http://[::1]:3001/api/v1/cargo-release/restore/HAMG42298700 \
  -H "x-api-key: <CARGO_RELEASE_RESTORE_API_KEY value from .env>"
```

Expected response: `{ "deletedCount": N }` where N = number of records deleted.

---

## Quick Revert Checklist

When done local testing, revert all of the above:

```bash
# Revert all git-tracked files modified for local testing:
cd ne-import-shipment-api
git checkout HEAD -- docker-compose.yml .env \
  src/modules/import-shipment/services/shipment.service.ts \
  src/modules/cargo-release/cargo-release.controller.ts

cd ../ne-api-gateway
git checkout HEAD -- .env \
  src/modules/auth/services/auth.service.ts
```

> `.env` files are gitignored — if changed manually (not committed), revert them manually.
> `docker-compose.yml` IS git-tracked — `git checkout HEAD` restores it.

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `EADDRNOTAVAIL 0.0.0.0:5010` | gRPC client targeting `0.0.0.0` — VPN blocks | Change URL to `[::1]:5010` |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres host still `localhost` | Change `*_POSTGRES_HOST=::1` |
| `ETIMEDOUT 10.103.2.241:5432` (ODS_DB_CONNECTION) | ODS is a real internal Cloud SQL private IP, no VPN route to that subnet | Not on VPN: connect it. On VPN but still times out: ACL issue, ask infra. For cargo-release-only testing: apply the ODS DB local stub in §2b instead |
| `503` gRPC on auth | `ne-system-api` not running locally | Add auth.service.ts stub |
| `503` gRPC on getUserProfile | `ne-system-api` not running locally | Add shipment.service.ts stub |
| Postgres 18 won't start | Untagged `image: postgres` pulled v18, old volume | Pin `image: postgres:16`, run `docker compose down -v` |
| `404` on restore endpoint | Calling wrong gateway module (`cargo-release/` dead module) | Use `import-shipment/` controller routes |
| restore returns `deletedCount: 0` | Wrong blNo, or records already deleted | Check DB directly |

---

## References

- `ne-import-shipment-api/docker-compose.yml`
- `ne-import-shipment-api/.env`
- `ne-api-gateway/.env`
- `ne-api-gateway/src/modules/auth/services/auth.service.ts`
- `ne-import-shipment-api/src/modules/import-shipment/services/shipment.service.ts`
- `ne-import-shipment-api/src/modules/cargo-release/cargo-release.controller.ts`
- [Citrix VPN IPv6 loopback workaround (community discussion)](https://discussions.citrix.com/topic/413652-localhost-not-working-with-citrix-gateway/)
- [PostgreSQL versioned Docker images](https://hub.docker.com/_/postgres)

## Related

- `infra/gke-clusters.md` — cluster inventory and kubeconfig setup
- `repos/ne-import-shipment-api/features/cargo-release.md` — implementation details of the restore endpoint
- `flows/cargo-release-submit.md` — full cross-repo sequence diagram
