---
schema: repo-overview
last-updated: 2026-09-20
---

# Repo: ne-manage-shipment-frontend

## Purpose

React SPA for import shipment management (cargo release, tracking, booking management).
Customers use this to submit cargo release requests, track containers, manage bookings.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React (TypeScript), Next.js |
| API client | `safeApiClient` (axios wrapper, base: `ne-api-gateway`) |
| Feature Flags | LaunchDarkly hooks |
| State | React hooks + context |

## Entry Point

Next.js app. `next dev` locally; `next start -p ${PORT:=3000}` in deployed environments (default port `3000`).

## Module Map

```
src/
├── modules/
│   └── cargo-release/
│       ├── CargoReleasePage.tsx        ← Page entry point
│       ├── components/CargoReleaseView.tsx
│       └── apis/
│           ├── postSubmitCargoReleaseRequest.ts   ← POST /v1/cargo-release/submit
│           ├── getPresignedUrl.ts
│           └── ...
├── shared/
│   ├── api/
│   │   └── getCargoReleaseRequestStatusV2.ts      ← GET /v2/cargo-release/request-status/:blNo
│   ├── hooks/
│   │   ├── useGetCargoReleaseRequestStatusV2.ts
│   │   ├── useCheckCargoReleaseRequestStatusV2.ts
│   │   └── useCheckRequestCargoReleaseAvailable.ts
│   └── types/cargo-release.ts
```

## Features

- Cargo Release — this repo's own UI-side feature isn't documented as a feature doc yet; see `{{AGENT_HOME}}/companies/ots/repos/ne-import-shipment-api/features/cargo-release.md` for the owning repo's version in the meantime.
- [Container+ VAS Card](features/container-plus-vas.md)

## External Integrations

| System | Protocol | Direction | Purpose |
|---|---|---|---|
| `ne-api-gateway` | REST (via `safeApiClient`) | Outbound | All backend calls — cargo release submission, status checks, bookings |
| LaunchDarkly | SDK | Outbound | Feature flags |

## Env Vars (Key)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_ENDPOINT` | Base URL for `ne-api-gateway` |
| `NEXT_PUBLIC_AUTH_ENDPOINT` | Auth service endpoint |
| `NEXT_PUBLIC_BASE_URL` | This app's own public base URL |

(~20 more `NEXT_PUBLIC_*` vars exist for CMS/chatbot/analytics integrations — see `.env.development` for the full list; these three are the ones most tasks actually touch.)

## References

- `src/modules/cargo-release/`
- `src/shared/api/getCargoReleaseRequestStatusV2.ts`
- `src/shared/hooks/`

## Related

- [ne-api-gateway Overview]({{AGENT_HOME}}/companies/ots/repos/ne-api-gateway/overview.md)
- [Cargo Release Submit Flow]({{AGENT_HOME}}/companies/ots/flows/cargo-release-submit.md)
