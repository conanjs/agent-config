---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Integration (`integration/v1`)

**Applies to:** `docs/integrations/<svc>.md` in a project repo · **Store:** D · **Written by:** `architecture` (when a dependency is added at P4); `engineering` updates the facts it discovers · **Read by:** any role whose task line has `touches: integration:<svc>` · **Loaded as:** ③

**Facts about how this repo talks to one external service.** It covers endpoints, auth, setup, limits and failure handling. It is not a general explanation of the service. General explanations go in `{{AGENT_HOME}}/knowledge/<topic>/` (B). Company-wide facts, such as shared proxies, environments and owners, go in the Company KB (C). This doc links to both.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `service` | yes | Id used in task lines (`touches: integration:<service>`) and in architecture §6 |
| `company-kb` | no | `{{AGENT_HOME}}/companies/<co>/…`: company facts (link D → C) |
| `reference` | no | `{{AGENT_HOME}}/knowledge/<topic>/`: how the service works in general (link D → B) |

## Required structure

```markdown
# Integration: <display name>

## Purpose          <what this repo uses it for; which component/layer calls it>
## Endpoints        <method + path per operation used; base URL comes from config>
## Auth             <scheme; env var NAMES; where to obtain values — never the values>
## Local setup      <sandbox/test env, mock or fixture paths, how to run without real credentials>
## Limits           <rate limits, quotas, payload sizes, timeouts we set>
## Failure modes    | Failure | Detection | Our behaviour |
## Contract         <API version; where the spec lives; how breaking changes are announced>
## Owner            <team/contact owning the service; our internal owner>
## References
## Related
```

## Rules

- **No secret values, ever.** List only env var names and where to get the values. The validator rejects strings that look like keys or tokens.
- Every `## Failure modes` row has an "Our behaviour" (retry, abort, degrade) that the code must match. Reviewers check the code against it.
- `service` matches a row in architecture §6.

## Example

The v2 proposal §6.6 (`apigee-hr.md`).

## Checks

| Check | Tool |
|---|---|
| Front-matter; the 8 body sections plus References and Related, in order; `service` in architecture §6 | `validate-project.mjs` |
| Secret-pattern scan | `validate-project.mjs` |
| Code behaviour matches Failure modes | reviewer (llm) |

## References

**External authoritative sources:**
- [The Twelve-Factor App: Config](https://12factor.net/config): config in env vars, never in code.
