---
schema: topic-index/v1
kind: topic
topic: operations
last-updated: 2026-10-04
---

# Operations practices

Operations practices covers runtime configuration and observability patterns that keep services deployable, diagnosable, and safe across environments. It does not cover JavaScript engine internals or HTTP status semantics.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [config-at-startup.md](config-at-startup.md) | concept | Environment-backed config validated once at startup and passed as typed immutable data | verified |
| [structured-logging.md](structured-logging.md) | concept | JSON event logs with stable names, correlation fields, levels, redaction, and one injected logger | verified |
| [Node.js / nvm / corepack / pnpm / yarn Architecture](../nodejs/node-nvm-corepack-pnpm-yarn-architecture.md) | legacy | Windows Node.js package-manager dispatch and Corepack behavior | — |

## References
- [The Twelve-Factor App](https://12factor.net/) — Adam Wiggins, living. Backs: topic scope.
- [OpenTelemetry documentation](https://opentelemetry.io/docs/) — OpenTelemetry project, living. Backs: observability scope.

## Related
- `js-runtime/` — runtime behavior that operational rules depend on.
- `web-apis/` — API error boundaries that use config and logs.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — legacy Node.js operations reference.
