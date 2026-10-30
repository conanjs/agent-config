---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: ERR
subject: code
---

# Error Handling

How engineering classifies, represents, propagates, and reports failures in any language. The concrete form (exceptions, result types, wrapped errors) comes from the stack profile's `idiom.errors`; logging form from `idiom.logging`. Reviews cite `ERR-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| ERR-1 | Expected failures are values in the contract. Domain and validation failures are part of a function's declared outcome (typed error / result per `idiom.errors`), not surprises. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-2 | Never swallow. Every caught failure is handled (recovered with a defined outcome), translated, or propagated. Empty catch/ignore blocks are forbidden. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-3 | Add context when propagating. Wrap with what was being attempted and key identifiers; keep the original cause chained. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-4 | Translate at boundaries. Adapters convert infrastructure errors into port-level errors; controllers convert application errors into contract error codes (`../design/contract-design.md`, CON-3). Inner layers never see transport or driver error types. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-5 | Fail closed. In authentication, authorization, validation, and payment paths, any unexpected error denies (`../quality/security.md`, Q-SEC-8). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-6 | Fail fast on bugs. Broken invariants abort the current unit of work loudly; don't limp on with corrupted state. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-7 | Log once, where handled. The layer that finally handles an error logs it (with correlation id); intermediate layers wrap and return, they don't log-and-rethrow. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-8 | No sensitive data in errors. Messages returned to clients carry a stable code and a safe message; stack traces, queries, and secrets stay in server logs, and secrets not even there. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-9 | Retry only transient failures of idempotent operations, bounded and with backoff (`../design/distributed-systems.md`, DS-3, DS-4). Retry in one layer only. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-10 | Clean up on every path. Resources acquired before a failure are released (scoped cleanup per stack profile idiom). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-11 | Partial failure is explicit. Batch operations report per-item outcomes; multi-step workflows define compensation. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| ERR-12 | Errors are tested. Each declared error outcome in the contract has at least one test that triggers it. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| ERR-13 | Process-level safety net. Unhandled failures at the top level are logged with context, reported, and terminate or isolate the unit of work — never silently ignored. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Classify every failure first**

| Class | Example | Caller's response | Retryable? |
|---|---|---|---|
| **Validation** | Malformed input, rule violated | Fix input; 4xx-style response | No |
| **Not found / conflict** | Missing resource, version mismatch | Business decision | No (conflict: maybe, after re-read) |
| **Authorization** | Unauthenticated, forbidden | Deny; never leak why in detail | No |
| **Transient dependency** | Timeout, connection reset, throttled | Retry with backoff | Yes (if operation is idempotent) |
| **Permanent dependency** | Bad credentials, contract mismatch | Alert; fail fast | No |
| **Bug / invariant broken** | Impossible state, null where forbidden | Crash the unit of work; alert | No |

**Rules**

**Error response shape (for external contracts)**

Use one shape system-wide — default RFC 9457 Problem Details: `type`, `title`, `status`, `detail` (safe), `instance`, plus a stable machine-readable `code` and the correlation id.

**Review checklist**

- [ ] Each new failure point is classified (table above)
- [ ] No swallowed errors (ERR-2); context added on propagation (ERR-3)
- [ ] Boundary translation present (ERR-4); fail-closed in security paths (ERR-5)
- [ ] Logged exactly once, no sensitive data (ERR-7, ERR-8)
- [ ] Error paths have tests (ERR-12)

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Small safe steps | Feature delivery | Keep changes scoped and green; split structural and behavioral work when needed. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/code/error-handling.md`: this foundation file.

**External authoritative sources:**
- RFC 9457, *Problem Details for HTTP APIs*.
- Michael Nygard, *Release It!* (2nd ed., 2018) — stability patterns.
- OWASP Cheat Sheet Series — "Error Handling" and "Logging".
- Joe Armstrong, *Making Reliable Distributed Systems in the Presence of Software Errors* (2003) — let it crash / supervision.

## Related

- `coding-standards.md`, `refactoring.md` — sibling engineering procedures.
- `../quality/reliability.md` — Q-REL-5 (no swallowed errors).
- `../quality/security.md` — Q-SEC-8 (fail closed).
- `../design/distributed-systems.md` — retry and idempotency rules.
