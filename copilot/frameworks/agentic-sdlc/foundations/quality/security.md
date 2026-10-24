---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: Q-SEC
subject: quality
---

# Security

ISO/IEC 25010 quality contract: the product protects information and data so that people and systems have access appropriate to their authorization, and defends against attack. Reviews cite `Q-SEC-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| Q-SEC-1 | Every non-public entry point requires authentication; public ones are listed explicitly in the contract | `contracts/` + route review | No evidence shows the rule holds. | llm | — |
| Q-SEC-2 | Authorization is checked server-side on every request, per resource (object-level), deny by default | Code review + negative tests | No evidence shows the rule holds. | llm (fallback) | — |
| Q-SEC-3 | All external input is validated at the boundary against an allow-list schema (type, length, range, format) | Code review | No evidence shows the rule holds. | llm (fallback) | — |
| Q-SEC-4 | No query, command, path, or markup is built by string concatenation of untrusted input; parameterized/encoded APIs are used | Code review / `cmd.lint` rules | No evidence shows the rule holds. | llm (fallback) | — |
| Q-SEC-5 | No secret appears in source, config committed to the repo, logs, error messages, or test fixtures | Secret scan / review | No evidence shows the rule holds. | llm (fallback) | — |
| Q-SEC-6 | Sensitive data is encrypted in transit (TLS) and at rest where classified as such; classification is in `data-model.md` | Plan + config | No evidence shows the rule holds. | llm | — |
| Q-SEC-7 | Dependencies pass `cmd.audit` with no known high/critical vulnerability unaccepted; new dependencies are justified in a decision record | Script output | No evidence shows the rule holds. | script | — |
| Q-SEC-8 | Errors fail closed: an exception in an authz or validation path denies, never allows | Code review + tests | No evidence shows the rule holds. | llm (fallback) | — |
| Q-SEC-9 | Abuse-prone endpoints (login, signup, search, upload) have rate limits and size limits | Config / contract | No evidence shows the rule holds. | llm | — |
| Q-SEC-10 | Security-relevant events (login, permission change, data export, admin actions) are audit-logged with actor, action, target, time, correlation id — without sensitive payloads | Log schema | No evidence shows the rule holds. | llm | — |
| Q-SEC-11 | Audit logs are append-only from the application's perspective | Design review | No evidence shows the rule holds. | llm | — |
| Q-SEC-12 | A threat model exists for MEDIUM/HIGH risk-tier features, and each threat has a mitigation or an accepted-risk decision record | `research.md` | No evidence shows the rule holds. | llm | — |
| Q-SEC-13 | Responses return only fields the caller is authorized to see (no over-fetching to the client) | Contract review | No evidence shows the rule holds. | llm | — |

## Interpreting

**Definition**

Security is the degree to which the product denies unauthorized access and modification, proves who did what, and fails closed. Security can **block** any gate (`../../../conventions.md` §7).

**Sub-characteristics**

| Sub-characteristic | Question it answers |
|---|---|
| **Confidentiality** | Is data accessible only to those authorized? |
| **Integrity** | Is unauthorized modification of data or code prevented? |
| **Non-repudiation** | Can actions be proven to have taken place, by whom? |
| **Accountability** | Can actions be traced uniquely to an entity? |
| **Authenticity** | Can the identity of a subject or resource be proven? |
| **Resistance** | Does the product sustain operation while under attack? |

**Checks — an artifact satisfies this when…**

**Failure severity defaults**

| Situation | Severity |
|---|---|
| Missing authn/authz, injection, secret exposure, fail-open (Q-SEC-1, 2, 4, 5, 8) | `blocker` |
| Unaccepted high/critical audit finding (Q-SEC-7) | `blocker` |
| Missing input validation or rate limit (Q-SEC-3, 9) | `major` |
| Missing audit event (Q-SEC-10) | `major` |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Quality bar | Delivery speed | Do not waive blocker or major quality failures; record accepted lower-risk trade-offs. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/quality/security.md`: this foundation file.

**External authoritative sources:**
- ISO/IEC 25010:2023, *Product quality model* — security.
- OWASP Top 10 (2021) and OWASP API Security Top 10 (2023).
- OWASP Application Security Verification Standard (ASVS) 4.x.
- NIST SP 800-63B, *Digital Identity Guidelines — Authentication*.

## Related

- `functional-suitability.md`, `maintainability.md`, `performance-efficiency.md`, `reliability.md` — sibling quality contracts.
- `../delivery/threat-modeling.md` — how threats and mitigations are derived.
- `../code/error-handling.md` — fail-closed error handling.
- `../delivery/release-pipeline.md` — where `cmd.audit` runs.
