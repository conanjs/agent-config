---
schema: stack-framework/v1
last-updated: 2026-10-04
stack: typescript-node
framework: express
rule-prefix: EXP
versions: [4, 5]
---

# express on typescript-node

## Placement

| Framework piece | Layer | Location |
|---|---|---|
| Express app bootstrap | interface / composition root | `src/main.ts` creates the app, installs middleware, mounts routers and starts the server. |
| Router modules | interface | `src/interface/routes/` with one router per resource or bounded HTTP surface. |
| Route handlers | interface | `src/interface/routes/` or `src/interface/handlers/`; handlers adapt HTTP to one application use case. |
| Middleware | interface | `src/interface/middleware/` for auth, authorization, correlation id, rate limiting, body parsing and observability. |
| Error mapper | interface | `src/interface/errors/` as the single HTTP mapping point for domain/application `Result` errors and thrown infrastructure failures. |

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

## Enforcement

| Rule | Tool config |
|---|---|
| EXP-1 | `llm (fallback)`: review handler body shape; optional ESLint restricted imports blocks repositories from `src/interface/routes/**`. |
| EXP-2 | `no-restricted-imports` in `src/interface/routes/**` for infrastructure adapters and DB clients. |
| EXP-5 | `llm (fallback)`: verify each handler uses the shared mapper. |
| EXP-6 | TypeScript `no-floating-promises`; Express 4 projects use a shared `asyncHandler` wrapper. |
| EXP-7 | `llm (fallback)`: verify validation schemas run before use-case calls. |

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
