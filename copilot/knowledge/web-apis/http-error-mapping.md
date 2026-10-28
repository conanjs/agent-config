---
schema: knowledge-doc/v1
type: concept
topic: web-apis
status: verified
applies-to: ["HTTP APIs", "REST-like services", "TypeScript interface layers"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [http, errors, problem-details, api]
---

# HTTP error mapping

## Summary
**TL;DR:** Map domain and application errors to HTTP responses in one interface-layer mapper, and use problem details when clients need a machine-readable error body ✅[^1]
**Use this when:** Use this when handlers are choosing status codes ad hoc or exposing exception messages directly to API clients ✅[^1]
**Not this doc:** Use `operations/structured-logging.md` for logging the internal error details.

## Problem
HTTP status codes carry generic protocol semantics, but they often cannot carry enough application-specific detail for API clients by themselves ✅[^1]
If each handler maps errors independently, the same domain error can become different status codes and response shapes.
If raw exception messages reach clients, internal implementation details can leak through the public API.
A single mapper keeps the protocol boundary explicit and lets internal logging stay separate from external response design.

## Mental model
**Analogy:** The mapper is a customs desk between two countries: internal error passports are translated into public HTTP documents, but private notes stay behind the desk.
**Artifact:**
```ts
type AppError =
  | { kind: "validation"; fields: Record<string, string> }
  | { kind: "not-found"; resource: "user" }
  | { kind: "conflict"; reason: "email-taken" };
```
The mapper owns the table from `AppError.kind` to status code, problem type, title, and safe detail.

## How it works
1. RFC 9457 defines problem details as a JSON or XML format for describing HTTP API problems ✅[^1]
2. RFC 9457 says the JSON representation uses the `application/problem+json` media type ✅[^1]
3. RFC 9457 problem details identify problem types with URIs and can include occurrence-specific information ✅[^1]
4. Problem details can be used with any HTTP status code, but RFC 9457 says they naturally fit 4xx and 5xx responses ✅[^1]
   - The five standard members are `type` and `instance` (URI references), `status` (number), `title` and `detail` (strings) ✅[^1]
   - `type` `about:blank` means the problem has no meaning beyond its status code, and its `title` should then be the status code's recommended reason phrase ✅[^1]
   - A relative `type` is resolved against the document's base URI; RFC 9457 recommends absolute URIs where possible ✅[^1]
   - Relative URIs can confuse clients, so a relative `type` should carry its full path (`/types/123`, or `/problems/not-found` in the stack reference) ✅[^1]
   - A `type` URI may be non-resolvable, such as a `tag:` URI. An `http`/`https` one should lead to human-readable documentation for the problem type, but clients should not fetch it automatically ✅[^1]
   - Defining a new problem type means documenting its type URI, its title and the status it is used with (§4). An API mints its own types; the IANA "HTTP Problem Types" registry is only for common, widely used types, and application-specific ones cannot be registered ✅[^1]
   - Moving to a different `type` URI later gives the problem a new identity, which breaks clients that match on the old one; RFC 9457 encourages resolvable URIs from the start for this reason ✅[^1]
   - The body's `status` is advisory, but a generator must send the same code as the actual HTTP status ✅[^1]
   - Problem types may add extension members, and clients must ignore extensions they do not recognize ✅[^1]
5. RFC 9110 groups status codes by first digit: 4xx indicates client error and 5xx indicates server error ✅[^2]. A client must understand the class of any status code and treat an unknown one as the `x00` code of its class (§15) ✅[^2]
6. A mapper receives typed domain/application errors and returns an HTTP status, headers, and a public problem body.
7. The mapper can log the original error through structured logging while sending only safe fields to the client.
8. Handlers call the mapper instead of embedding protocol choices beside business logic.

## Worked example
The interface layer maps known application errors to stable HTTP responses.
```ts
function toProblem(error: AppError): { status: number; body: object } {
  switch (error.kind) {
    case "validation":
      return { status: 400, body: { type: "/problems/validation", title: "Invalid request" } };
    case "not-found":
      return { status: 404, body: { type: "/problems/not-found", title: "Not found" } };
    case "conflict":
      return { status: 409, body: { type: "/problems/conflict", title: "Conflict" } };
  }
}
```
A validation failure is a 4xx response because the request cannot be processed as submitted under HTTP client-error semantics ✅[^2]
An unexpected database exception is logged internally and mapped to a generic 500 problem instead of exposing the database error string.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Validation error | Return 400 with a validation problem body | The client can change the request and retry under 4xx semantics ✅[^2] |
| Missing resource | Return 404 with a not-found problem body | 404 means the origin server did not find a current representation for the target resource ✅[^2] |
| Domain conflict | Return 409 with a conflict problem body | 409 indicates the request conflicts with current target resource state ✅[^2] |
| Authentication missing | Return 401 and include the authentication challenge required by HTTP semantics ✅[^2] | 401 is tied to authentication credentials and challenge semantics ✅[^2] |
| Authorization denied | Return 403 without saying which hidden resource or policy failed | 403 indicates the server understood the request but refuses to fulfill it ✅[^2] |
| No route matches the path or method | Express answers with its own HTML 404 page, not a problem, unless a catch-all handler after the routes sends one | Tested 2026-10-28 on Express 5.3 (stack reference): `GET /nope` and `PATCH /documents/d1` returned `text/html`; a final `NotFoundHandler` now sends an `about:blank` 404 problem. Strictly, a known path with an unsupported method is a 405 that must carry an `Allow` header (RFC 9110 §15.5.6) ✅[^2] |
| Unexpected exception | Return 500 with a generic problem body | 5xx indicates the server is aware it erred or cannot perform the request ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| One central mapper | Consistent status codes and body shape | Requires error taxonomy discipline |
| RFC 9457 problem details | Standard media type and problem-type URI model ✅[^1] | Clients must learn the problem schema |
| Handler-local mapping | Quick for prototypes | Diverges across endpoints over time |
| Exposing raw messages | Fast debugging for clients | Leaks internals and couples clients to implementation details |

**Choosing the `type` URI** (each is valid RFC 9457; the choice is the API's):

| Form | Example | Gains | Costs |
|---|---|---|---|
| Relative, full path | `/problems/version-conflict` | Short; no host in the code; the stack reference's choice | Resolved against the API's base URI, which RFC 9457 warns can confuse ✅[^1]; leads to documentation only if the API serves a page at that path |
| Absolute documentation URL | `https://docs.example.com/problems/version-conflict` | Recommended form ✅[^1]; a developer can open it | The host becomes part of the identity; moving the docs changes every `type` |
| `tag:` URI | `tag:example.com,2026:version-conflict` | Stable, owned, needs no server ✅[^1] | Not resolvable; documentation must be found another way |
| `about:blank` | `about:blank` | No problem type to define; the status says it all ✅[^1] | Clients cannot tell two refusals with the same status apart |

What resolving a relative `type` does, tested 2026-10-28 with Node 24's WHATWG `URL` (the resolution RFC 3986 §5 defines): `/problems/version-conflict` received from `https://api.example.com/documents/d1` becomes `https://api.example.com/problems/version-conflict`; from `https://staging.example.com/…` it becomes a different URI on the staging host; and behind a gateway prefix (`https://gw.example.com/docs-api/v1/documents/d1`) it becomes `https://gw.example.com/problems/version-conflict`, outside the API's own path. So a client that resolves the URI, as RFC 9457 asks, sees one problem type as several identities, one per host. An absolute `type` must therefore be a fixed constant, not built from the request's host or an environment variable, or it has the same flaw.

Whichever form, list every type with its title and status in one document (the stack reference: `docs/problem-types.md`), and choose before clients depend on it: a later change is a breaking change.

## Takeaways
- Keep HTTP status and problem-body mapping in the interface layer. [rule-candidate]
- Use a small mapping table for known domain/application errors. [rule-candidate]
- Log internal causes, but send clients only stable and safe problem details. [rule-candidate]
- Document every problem type (URI, title, status) in one place, and treat a change of `type` as a breaking API change. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-11 | Source: |
| stack idiom | TSN-19 | Source: |
| stack framework | EXP-8 | Source: |

## Verification status
- Verified: 32 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF, 2023. Backs: Summary, Problem, How it works, Trade-offs. [^1]
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes) — IETF, 2022. Backs: How it works, Worked example, Edge cases. [^2]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-11 and TSN-19.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/frameworks/express.md` — EXP-8, problem bodies for every error response.
- Stack reference `conanjs/agentic-sdlc-reference-typescript-node` v3.0.0, `src/modules/shared/interface/ProblemDetails.ts` — a tested implementation.

## Related
- `operations/structured-logging.md` — log internal error details safely.
- `operations/config-at-startup.md` — feature flags and public error policy should come from startup config when deploy-specific.
- `js-runtime/promise-rejections.md` — async failures should be caught before reaching the mapper as unknown exceptions.
