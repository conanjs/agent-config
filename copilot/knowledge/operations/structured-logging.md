---
schema: knowledge-doc/v1
type: concept
topic: operations
status: verified
applies-to: ["services", "TypeScript", "Python", "12-factor services"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [logging, observability, json, redaction]
---

# Structured logging

## Summary
**TL;DR:** Treat logs as event streams and emit structured records with stable event names, levels, correlation fields, and redacted sensitive data ✅[^1]
**Use this when:** Use this when replacing `console.log`, designing request logs, or standardizing injected logger usage across services ✅[^1]
**Not this doc:** Use `operations/config-at-startup.md` for reading log level from config.

## Problem
Prose logs are hard to search, aggregate, and correlate because important data is embedded in free text instead of fields ✅[^2]
Twelve-Factor says an app should not manage log routing or storage and should write its event stream to stdout for the execution environment to collect ✅[^1]
Security logs can become dangerous if they include secrets, full payloads, or untrusted data without consistent handling ✅[^4]
Multiple ad-hoc logger instances make levels, redaction, and correlation fields inconsistent across a service.

## Mental model
**Analogy:** A structured log is a shipping label, not a diary entry: every package has predictable boxes for destination, tracking id, weight, and status, so machines can sort it quickly ✅[^2]
**Artifact:**
```ts
log.info(
  { event: "user.register.start", requestId, userId },
  "user.register.start",
);
```
OpenTelemetry's log model includes top-level fields such as timestamp, trace id, severity, body, attributes, and event name ✅[^2]

## How it works
1. The application emits one event per meaningful state change instead of writing narrative debugging prose ✅[^1]
2. Each record carries a stable event name such as `user.register.start`, which lets dashboards and alerts group events without parsing English sentences ✅[^2]
3. Correlation fields such as request ids, trace ids, and span ids connect logs from the same request or distributed trace ✅[^2]
4. Severity levels distinguish debugging, informational, warning, error, and fatal events in the OpenTelemetry severity model ✅[^2]
5. Pino creates JSON log lines and supports a `level` option that filters messages below the configured minimum level ✅[^3]
6. Pino child loggers can attach context to later log calls, which fits per-request correlation fields ✅[^3]
7. Pino's `redact` option can censor or remove configured paths from log output ✅[^3]
8. OWASP recommends consistent application logging and warns that event data from other trust zones must be treated as untrusted ✅[^4]

## Worked example
The composition root creates one logger with level and redaction policy from validated config ✅[^3]
```ts
const rootLogger = pino({
  level: config.LOG_LEVEL,
  redact: ["req.headers.authorization", "password", "token"],
});
```
A request handler derives a child logger that carries correlation fields ✅[^3]
```ts
function handle(req: Request, log = rootLogger) {
  const reqLog = log.child({ requestId: req.headers.get("x-request-id") });
  reqLog.info({ event: "user.register.start", route: "POST /users" }, "user.register.start");
}
```
The log sink can index `event`, `requestId`, `route`, and severity without regular expressions ✅[^2]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Secret in a logged object | It can be censored or removed when a redaction path matches ✅[^3] | Pino redaction applies configured paths ✅[^3] |
| User input in logs | Treat the field as untrusted data ✅[^4] | OWASP warns cross-zone data can be modified, forged, replayed, or malicious ✅[^4] |
| `console.log("failed " + id)` | Machines must parse prose to extract fields | Structured logs put event data into named fields ✅[^2] |
| Logger created in every module | Redaction and levels can drift | One injected logger centralizes policy ✅[^3] |
| App writes log files itself | Deployment cannot manage routing uniformly ✅[^1] | Twelve-Factor expects the environment to route stdout event streams ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Structured JSON logs | Easy indexing and correlation ✅[^2] | Less pleasant for raw local reading without pretty tooling |
| Stable event names | Durable alerts and dashboards ✅[^2] | Requires naming discipline |
| Single injected logger | Central level, redaction, and bindings ✅[^3] | More constructor parameters |
| Full payload logging | Fast debugging in development | Security and privacy risk under OWASP guidance ✅[^4] |

## Takeaways
- Log events with stable names and structured fields, not prose-only messages. [rule-candidate]
- Carry request or trace correlation fields on child loggers. [rule-candidate]
- Configure redaction centrally and never log secrets or full sensitive payloads. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-10 | Source: |

## Verification status
- Verified: 30 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [The Twelve-Factor App: Logs](https://12factor.net/logs) — Adam Wiggins, living. Backs: Summary, Problem, How it works, Edge cases. [^1]
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) — OpenTelemetry project, living. Backs: Problem, Mental model, How it works, Worked example, Edge cases, Trade-offs. [^2]
- [Pino API documentation](https://raw.githubusercontent.com/pinojs/pino/main/docs/api.md) — Pino project, living. Backs: How it works, Worked example, Edge cases, Trade-offs. [^3]
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) — OWASP, living. Backs: Problem, How it works, Edge cases, Trade-offs. [^4]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-10.

## Related
- `operations/config-at-startup.md` — logger level and redact paths come from validated startup config.
- `js-runtime/promise-rejections.md` — background rejection handlers need structured logs.
- `web-apis/http-error-mapping.md` — error mappers should log internals without leaking them to clients.
