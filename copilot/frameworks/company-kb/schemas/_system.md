# KB Schema System

_Last updated: 2026-09-20_

## What This Is

This is the schema-compliance mechanism of the **Company KB Framework** — the reusable pattern behind every per-company knowledge base under `{{AGENT_HOME}}/companies/<company>/` (e.g. `{{AGENT_HOME}}/companies/ots/`). This file and everything else in `frameworks/company-kb/` is shared across every company instance, not duplicated per company.

Every document in a company knowledge base must conform to one of the defined schemas.
Schemas enforce consistent structure so any reader (human or AI) knows exactly where
to find each piece of information without scanning the full file.

## Structure Options

A company instance organizes its `repos/` folder one of two ways — pick one and declare it in that company's `index.md`:

| Structure | Layout | When to use |
|---|---|---|
| **Flat** (default) | `repos/{repo}/overview.md`, `repos/{repo}/features/*.md` | Most companies. Repos don't cluster into distinct products, or there are few enough that a flat list is easy to scan. Currently used by OTS. |
| **Grouped by project** | `repos/{project}/{repo}/overview.md`, `repos/{project}/{repo}/features/*.md` | Enough repos that they naturally cluster into distinct products/initiatives, and a flat list would bury that structure. Adds one path segment everywhere `{repo}` appears below. |

Both are equally valid and must be supported — an agent reading a company's `index.md` should check its declared structure before assuming `repos/{repo}/...` paths.

**Recommended on-disk clone layout mirrors the declared structure.** Whichever option a company's KB uses, recommend the actual project repos be cloned the same way relative to that company's repo-root variable (e.g. `{{OTS_REPOS_ROOT}}`): flat → clone every repo directly under the root (`{{OTS_REPOS_ROOT}}/{repo}/`); grouped-by-project → clone under a project subfolder (`{{COMPANY_REPOS_ROOT}}/{project}/{repo}/`). Keeping these two structures (the KB's doc layout and the actual code's clone layout) in sync means one mental model covers both — an agent that knows where a KB doc lives also knows where the real code lives, and vice versa. This isn't enforced, just recommended; note in a company's `index.md` if its actual clone layout ever diverges from its KB structure.

**Cross-reference paths use `{{AGENT_HOME}}`, not relative dot-paths.** Write `{{AGENT_HOME}}/companies/<company>/flows/foo.md`, not `../../flows/foo.md`. Reasoning: a relative path's correct number of `../` depends on how deep the *referencing* doc sits — which differs between flat and grouped structure, and would silently break every existing cross-reference if a company ever migrates from one to the other. A `{{AGENT_HOME}}`-anchored path is the same string regardless of either doc's depth. **Trade-off, stated plainly:** a `{{AGENT_HOME}}/...` path is not a real, clickable link in a plain markdown viewer (GitHub, VS Code preview) — it only resolves once an agent (or a human who knows the convention) substitutes the variable, per `global-variables.md`. This KB is written primarily for agent consumption, where that resolution is already expected practice throughout this repo, so the trade-off favors robustness over plain-renderer clickability. If a doc is likely to be read raw by someone unfamiliar with the convention, a relative path may still be the better choice for that specific link — this is a default, not an absolute rule.

A company can migrate from flat to grouped later if it outgrows flat — link text doesn't need touching (already `{{AGENT_HOME}}`-anchored); only the physical file locations move.

## How to Declare a Schema

Every doc must start with a front-matter block:

```
---
schema: <schema-name>
last-updated: YYYY-MM-DD
---

# <Title>
```

Valid schema names: `flow`, `feature`, `repo-overview`, `domain`, `infra`, `api-surface`

## Compliance Rule

When generating or updating a doc:
1. Identify which schema applies based on the file location (see `{{AGENT_HOME}}/frameworks/company-kb/conventions.md`).
2. Read the corresponding `schemas/<name>.schema.md` before writing.
3. Include **all required sections** in the order defined by the schema.
4. Mark optional sections explicitly as omitted if they have no content, e.g.:
   `> _No error cases documented yet._`
5. Never add sections not defined in the schema — extend the schema instead.

## Retrofitting Existing Docs

When a pre-schema doc is encountered during a task:
- Add the `schema:` front-matter.
- Add any missing required sections (can be stubs).
- Do NOT restructure unrelated content in the same edit.

## Schema Files

Paths below use flat structure; under grouped-by-project, prepend `{project}/` to every `repos/...` path.

| Schema | File | Applies to |
|---|---|---|
| `flow` | `schemas/flow.schema.md` | `flows/*.md` |
| `feature` | `schemas/feature.schema.md` | `repos/{repo}/features/*.md` |
| `repo-overview` | `schemas/repo-overview.schema.md` | `repos/{repo}/overview.md` |
| `domain` | `schemas/domain.schema.md` | `domain/*.md` |
| `infra` | _(no strict schema yet)_ | `infra/*.md` |
| `api-surface` | `schemas/api-surface.schema.md` | `repos/{repo}/api-surface.md` |

## References

**Local artifacts:**
- `{{AGENT_HOME}}/frameworks/company-kb/conventions.md` — overall writing rules and update triggers.
- `{{AGENT_HOME}}/companies/ots/` — the current worked instance of this framework (flat structure).

## Related

- All schema definition files in this directory.
- `{{AGENT_HOME}}/companies/<company>/index.md` — where a company declares which structure option it uses.
