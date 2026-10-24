---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: THR
subject: delivery
---

# Threat Modeling

How security derives threats and mitigations for a feature using a lightweight STRIDE table, and the baseline controls every feature must meet regardless of tier. Reviews cite `THR-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| THR-1 | Secrets live only in the platform's secret store, are injected at runtime (`idiom.config`), never committed, never logged, and are rotatable without a code change. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-2 | Authentication uses a vetted standard protocol (OAuth 2.0 / OpenID Connect, or the platform's) — never home-made crypto or token formats. Passwords, if stored, use a slow adaptive hash. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| THR-3 | Authorization is deny-by-default, enforced server-side on every request at the object level, centralized in one policy point per module, and tested with negative cases. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| THR-4 | Service-to-service calls are authenticated (workload identity, mTLS, or signed tokens) with least-privilege scopes; network location is not identity. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-5 | Input validation happens at every trust boundary against an allow-list schema; output is encoded for its sink (HTML, SQL, shell, path, log). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-6 | Dependency risk: `cmd.audit` runs in CI and blocks on unaccepted high/critical findings; new dependencies need a decision record (maintenance, licence, footprint). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | script | — |
| THR-7 | Least privilege for runtime identities, database users, and CI tokens. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-8 | Sensitive data is classified in `data-model.md`; collect the minimum, mask in logs, encrypt where classified, define retention. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-9 | Security headers and transport: TLS everywhere; secure cookie flags; CORS restricted to known origins. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| THR-10 | Fail closed on any error in authn/authz/validation (`../code/error-handling.md`, ERR-5). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Procedure (STRIDE-lite, at P4)**

1. **Scope.** From `spec.md` and `plan.md`, list the feature's **assets** (data, capabilities), **actors** (anonymous, user, admin, other service), and **entry points** (endpoints, events, files, UI inputs).
2. **Sketch the data flow.** Mark each trust boundary — where data crosses from a less-trusted to a more-trusted zone (client → API, service → service, app → storage, app → third party).
3. **Walk STRIDE per boundary crossing.** For each crossing, ask the six questions below; record only credible threats.
4. **Rate** each threat Low/Medium/High by likelihood Ã— impact.
5. **Mitigate or accept.** Each threat gets a mitigation that maps to a task in `tasks.md`, or an accepted-risk decision record signed off by the human.
6. **Record** the table in the feature's `research.md`; the risk tier and threat ids are cited in security review at P6.

| STRIDE | Violates | Ask | Typical mitigation |
|---|---|---|---|
| **S**poofing | Authenticity | Can someone pretend to be another user/service? | Strong authentication, mutual TLS / signed tokens between services |
| **T**ampering | Integrity | Can data/messages be altered in transit or at rest? | TLS, signatures/HMAC, server-side validation, least-privilege writes |
| **R**epudiation | Non-repudiation | Can an actor deny an action? | Audit log with actor, action, target, time |
| **I**nformation disclosure | Confidentiality | Can data leak (responses, logs, errors, caches)? | Object-level authz, field filtering, safe errors, encryption |
| **D**enial of service | Availability | Can someone exhaust resources? | Rate/size limits, timeouts, pagination, quotas |
| **E**levation of privilege | Authorization | Can someone gain rights they shouldn't have? | Deny-by-default authz, role checks server-side, no client-trusted flags |

**Threat table format**

**Baseline controls (all tiers)**

**Depth by risk tier**

| Tier | Required |
|---|---|
| LOW | Baseline controls; no threat table |
| MEDIUM | Baseline + STRIDE table for new entry points; security review on flagged tasks |
| HIGH | Baseline + full STRIDE table for every boundary; negative tests for every authz rule; security review on every task touching the surface |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Process completeness | Fast feedback | Keep required evidence, but choose the lightest check that proves the rule. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/delivery/threat-modeling.md`: this foundation file.

**External authoritative sources:**
- Adam Shostack, *Threat Modeling: Designing for Security* (2014) — STRIDE.
- Microsoft, *STRIDE threat model* (Kohnfelder & Garg, 1999).
- OWASP Threat Modeling Cheat Sheet; OWASP ASVS 4.x; OWASP Top 10 (2021).
- Threat Modeling Manifesto (threatmodelingmanifesto.org).
- NIST SP 800-63B; RFC 6749 (OAuth 2.0); OpenID Connect Core 1.0.

## Related

- `../quality/security.md` — the checks reviews apply (Q-SEC-n).
- `../code/error-handling.md` — fail-closed rules.
- `../delivery/release-pipeline.md` — where `cmd.audit` and secret handling run.
- `../design/contract-design.md` — security in the contract (CON-8).
