---
schema: foundation/v2
last-updated: 2026-11-03
rule-prefix: CON
subject: design
---

# Contract Design

How to design, version, evolve, and retire the contracts between services and between a service and its clients — contract first, compatibility by default — and how a repo publishes every interface it exposes (commands, files, payloads, environment variables, APIs, events, libraries) so people and programs can use it without its code. Reviews cite `CON-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| CON-1 | Contract before code. No endpoint, message, or RPC exists without a contract file committed first. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-2 | Provider owns, consumers shape. The provider owns the contract; consumers' expectations are recorded as executable checks the provider runs. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-3 | Explicit errors. Every operation lists its error responses with a stable machine-readable code; retryability is stated (`../design/distributed-systems.md`, DS-3). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-4 | Idempotency is declared. Non-idempotent operations that clients may retry accept an idempotency key (DS-4). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-5 | Bounded collections. List operations are paginated with a documented max page size. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-6 | Events are facts with an envelope: id, type, version, occurred-at, producer, correlation id, payload. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-7 | No internal leakage. Contracts expose domain concepts, never table names, internal ids, or framework artifacts. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-8 | Security is in the contract: authentication scheme and required scopes/permissions per operation. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-9 | Backward compatible by default. A breaking change requires a new major version running side by side with the old one. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-10 | Tolerant reader. Consumers ignore unknown fields and handle unknown enum values with a defined fallback. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-11 | Version visibly. Major version in the path, media type, event type, or package name; minor changes don't change the identifier. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-12 | Deprecate before removal. Mark deprecated in the contract, announce a sunset date, emit deprecation signals (e.g. `Deprecation`/`Sunset` headers), and measure remaining usage. Remove only when usage is zero or the sunset has passed with consumer sign-off. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-13 | Compatibility is checked automatically on every change by diffing against the last released contract (`../review/fitness-functions.md`, FF-6). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CON-14 | Consumer-driven expectations run in the provider's pipeline; a provider change that breaks a recorded consumer expectation fails the build (run via `cmd.test_integration`). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| CON-15 | Publish an interface catalog. A repo lists every interface another program or person may use: commands and flags, exit codes, files it reads or writes, stdin/stdout payloads, environment variables, HTTP APIs, events and libraries. The list lives in `INTERFACES.md` (people) and a Backstage-format `catalog-info.yaml` (programs); each entry gives kind, direction (provides or consumes), visibility (public or internal), lifecycle and a link to its machine-readable description in the format the Formats table names. | A reader can learn every interface from the catalog and its links without opening the code; every public interface has a description file | A CLI documented only by its `--help`; a JSON file other tools read with no schema; an environment variable found only by reading the source | llm | `knowledge/documentation/interface-description-standards.md` |
| CON-16 | Descriptions are checked against the code. Each interface has one source; its other forms (help text, docs, types) are generated from it or tested against it, and a difference fails the build. A breaking change to a public interface is found by diffing against the last release (CON-13). | A check fails when a flag, command, field or variable exists on one side only; that check is proven to catch a planted fault | A hand-written spec folder that lists commands the tool no longer has; help text and docs that disagree | script (fallback llm) | `knowledge/documentation/interface-description-standards.md` |

## Interpreting

**Formats**

| Interaction | Contract format | Lives in |
|---|---|---|
| Synchronous request/response over HTTP | OpenAPI 3.x | `contracts/<service>/<name>.openapi.yaml` |
| Asynchronous events / messages | AsyncAPI 2.x/3.x (+ JSON Schema payloads) | `contracts/<service>/<name>.asyncapi.yaml` |
| Binary RPC / high-throughput internal calls | protobuf (proto3) | `contracts/<service>/<package>/*.proto` |
| JSON-RPC 2.0 calls | OpenRPC 1.4.x | `contracts/<service>/<name>.openrpc.json` |
| Command-line program (commands, flags, arguments, exit codes, outputs) | usage spec (KDL); OpenCLI (opencli.org) when the framework exports it, e.g. Spectre.Console | `<tool>/interfaces/<tool>.usage.kdl` |
| JSON files, JSON Lines records, stdin/stdout payloads, config files | JSON Schema 2020-12 | `<tool>/interfaces/schemas/*.schema.json` |
| Environment variables | A table in the catalog, generated from the code's declaration list | `INTERFACES.md` |
| TypeScript library | API Extractor report, committed | `etc/<package>.api.md` |
| The catalog of all of the above (CON-15) | `INTERFACES.md` + Backstage `catalog-info.yaml` (`kind: API`, `spec.definition`) | repo or tool root |

One format per interaction style per system; the choice is a decision record. The system repo owns cross-service contracts; a repo owns only its internal ones.

**Procedure (contract-first)**

1. **Start from the consumer's need** — the user story and the data the consumer must read or change.
2. **Draft the contract** before any implementation; name resources/events in the provider's published language (`../design/domain-driven-design.md`, DDD-5).
3. **Specify errors** as part of the contract: codes, shapes, and which ones are retryable.
4. **Review with every known consumer**; capture each consumer's expectations as contract tests (below).
5. **Freeze at G3**; implementation tasks reference the contract file.
6. **Generate or validate** server stubs and client types from the contract where the stack profile supports it, so code cannot drift from it.
7. **List it in the catalog** (CON-15) and add the check that compares it with the code (CON-16).

**Worked example (CON-15, CON-16):** agent-config's workflow-graph tool. `INTERFACES.md` lists 14 interfaces; the CLI is described in `interfaces/workflow-graph.usage.kdl`, from which `--help` and the catalog's command section are generated; the ledger and hook payloads have JSON Schemas that unit tests validate real output against; `workflow-graph interfaces` fails when a handler parses a flag the spec does not describe (specs/021 in agent-config).

**Design rules**

**Compatibility rules**

| Change | Backward compatible? |
|---|---|
| Add optional request field / new response field / new operation / new event type | Yes |
| Add enum value | Only if consumers were required to tolerate unknown values (CON-10) |
| Make optional field required; remove or rename field; change type or meaning; tighten validation | **No** |
| Reuse a protobuf field number; change a field number | **No — never** |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/contract-design.md`: this foundation file.
- `knowledge/documentation/interface-description-standards.md`: which format describes which kind of interface (CON-15, CON-16), with its deep dives on OpenCLI, usage and the other CLI formats.

**External authoritative sources:**
- OpenAPI Specification 3.1 — spec.openapis.org; AsyncAPI Specification — asyncapi.com; Protocol Buffers Language Guide (proto3) — protobuf.dev.
- usage spec — usage.jdx.dev/spec; OpenCLI — opencli.org; JSON Schema 2020-12 — json-schema.org/specification; OpenRPC — spec.open-rpc.org; Backstage descriptor format — backstage.io/docs/features/software-catalog/descriptor-format; API Extractor — api-extractor.com.
- Martin Fowler, "TolerantReader" (2011); Ian Robinson, "Consumer-Driven Contracts: A Service Evolution Pattern" (2006).
- RFC 8594, *The Sunset HTTP Header Field*; RFC 9745, *The Deprecation HTTP Response Header Field*.
- RFC 9457, *Problem Details for HTTP APIs*.

## Related

- `../design/distributed-systems.md` — DS-4, DS-11 behind these rules.
- `../design/domain-driven-design.md` — published language and context mapping.
- `../delivery/testing-strategy.md` — contract tests in the pyramid.
- `../delivery/release-pipeline.md` — expand-then-contract rollout of contract changes.
