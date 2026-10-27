---
schema: stack-framework/v1
last-updated: 2026-10-27
stack: typescript-node
framework: express
rule-prefix: EXP
versions: [4, 5]
---

# express on typescript-node

## Placement

| Framework piece | Layer | Location |
|---|---|---|
| Express app bootstrap | composition root | `src/CompositionRoot.ts` builds the app, installs middleware and mounts every module's routes; `src/main.ts` starts the server. |
| Router modules | interface | `src/<module>/interface/routes/` (feature-first, MOD-9; `src/interface/routes/` in an opted-in layer-first repo), one router per resource or bounded HTTP surface. |
| Route handlers | interface | `src/<module>/interface/routes/`; handlers adapt HTTP to one application use case. |
| Middleware | interface | `src/shared/interface/` for cross-cutting middleware used by every module: auth, correlation id, rate limiting, observability, the error middleware. |
| Error mapper | interface | `src/<module>/interface/errors/` maps that module's `Result` errors to problems; `src/shared/interface/` holds the problem type and the error middleware for thrown failures. |

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| EXP-1 | Keep handlers as adapters: parse input, call one use case and map the result. | Handler code has no domain branching beyond HTTP adaptation. | A handler checks role invariants or updates repositories directly. | llm | — |
| EXP-2 | Route modules compose routers and do not build the dependency graph. | Routers receive already-constructed handlers or use cases from `src/main.ts`. | A router creates database clients or concrete repositories. | llm | — |
| EXP-3 | Put auth, correlation id and observability in middleware, not in use cases. | Cross-cutting HTTP concerns are attached before handlers and passed through context/loggers. | Every handler repeats request id parsing or auth token decoding. | llm | — |
| EXP-4 | Keep domain logic out of middleware. | Middleware only authenticates, authorizes, enriches context or rejects malformed transport state. | Middleware applies business rules such as "role cannot be deleted while in use." | llm | — |
| EXP-5 | Use one error mapper for HTTP responses. | All handlers call the same mapper for `Result` errors and thrown errors. | Two routes map the same `not-found` result to different status codes. | llm | — |
| EXP-6 | Propagate async errors through Express' error flow. | Express 5 handlers return promises directly; Express 4 handlers are wrapped with a shared async wrapper. | A handler catches every error and sends ad hoc JSON. | llm | — |
| EXP-7 | Validate request bodies, params and query at the interface boundary. | Use cases receive typed validated input, never raw `Request` objects. | A use case reads `req.body` or parses HTTP headers. | llm | — |
| EXP-8 | Every error response is an RFC 9457 problem: `application/problem+json` with `type`, `title` and `status`, the body's `status` equal to the response's. A named refusal uses `type` `/problems/<reason>` (or an absolute URI); a failure the API does not name uses `about:blank` with the status code's reason phrase as `title`. Internal causes go to the log, never into the body. | Integration tests assert status, media type and body for each refusal and for malformed input | `res.status(409).json({ error: "version-conflict" })`; a 500 body with the exception message | llm | `knowledge/web-apis/http-error-mapping.md` |

## Enforcement

| Rule | Tool config |
|---|---|
| EXP-1 | `llm (fallback)`: review handler body shape; optional ESLint restricted imports blocks repositories from `src/interface/routes/**`. |
| EXP-2 | `no-restricted-imports` in `src/interface/routes/**` for infrastructure adapters and DB clients. |
| EXP-5 | `llm (fallback)`: verify each handler uses the shared mapper. |
| EXP-6 | TypeScript `no-floating-promises`; Express 4 projects use a shared `asyncHandler` wrapper. |
| EXP-7 | `llm (fallback)`: verify validation schemas run before use-case calls. |
| EXP-8 | `llm (fallback)`, backed by integration tests that assert `content-type` `application/problem+json` and the problem body per refusal (stack reference `test/integration/documents.int.test.ts`). |

## Example

```ts
router.post("/roles", asyncHandler(async (req, res) => {
  const input = CreateRoleRequest.parse(req.body);
  const result = await createRole.run(input);
  return sendResult(res, result, roleErrorToHttp);
}));
```

```ts
app.use(correlationId());
app.use(authenticateJwt(authVerifier));
app.use("/roles", rolesRouter({ createRole }));
app.use(errorMiddleware(roleErrorToHttp));
```

## References

**Local artifacts:**
- `stacks/typescript-node/index.md`: declares `express` as a framework profile.
- `stacks/typescript-node/idioms.md`: TypeScript error, DI, config and logging idioms used by Express handlers.
- `schemas/stack-framework.schema.md`: schema for this file.

**External authoritative sources:**
- [Express routing guide](https://expressjs.com/en/guide/routing.html): router and handler behaviour.
- [Express error handling guide](https://expressjs.com/en/guide/error-handling.html): async error propagation and error middleware.
- [Express middleware guide](https://expressjs.com/en/guide/using-middleware.html): middleware composition model.

## Related

- `stacks/typescript-node/index.md`: parent stack profile.
- `stacks/typescript-node/idioms.md`: stack idioms used by Express code.
- `foundations/design/clean-architecture.md`: layer direction that keeps Express in the interface layer.
- `foundations/code/error-handling.md`: error mapping rules used by `EXP-5`.
