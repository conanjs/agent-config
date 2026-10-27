---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Repo Architecture (`repo-architecture/v2`)

**Applies to:** `docs/architecture.md` in every project repo · **Store:** D · **Written by:** `architecture` (P4 decisions, P7 rewrite) · **Read by:** the Orchestrator at P0 and for every launch; every role as ③ · **Loaded as:** ③, and the **source of ②** (profiles)

The living description of what this repo **is right now**. Spec Kit organizes knowledge per feature; this file is the one current, repo-wide answer. It is also where profiles come from: §3 and §4 decide which stack and paradigm every launch gets.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `updated-by` | yes | The feature folder or commit that triggered the last update |
| `company-kb` | no | `{{AGENT_HOME}}/companies/<co>/repos/<repo>/`: the link from D to C |

## Required structure

````markdown
# Architecture: <repo name>

## 1. Overview
<one paragraph: what it does, for whom; risk tier>

## 2. System context
<!-- required if part of a multi-repo system; otherwise "> _Standalone repo._" -->
```yaml
system: { kb: "{{AGENT_HOME}}/companies/<co>/system/", ref: <system-ref int>, service_id: <id>, contracts_provided: [], contracts_consumed: [] }
```
<2–3 sentence summary; mermaid of direct neighbours only>

## 3. Components
```yaml
components:
  - { name: <id>, path: <dir>/, kind: service|library|script|datastore, stack: <id>, framework: <id>, paradigm: <id>@<major>, decisions: [<ids>] }
```

## 4. Layers & dependency rules
```yaml
layers:
  - { name: <id>, path: <dir>/, may-depend-on: [<layer names>], paradigm: <id>@<major>, alias: <prefix> }   # paradigm and alias optional
modules:                                                                                                    # feature-first only (MOD-9)
  - { name: <id>, path: <dir>/, may-depend-on: [<module names>], public: [<globs relative to the module>], alias: <prefix> }
```

## 5. Data
| Store | Kind | Owned entities | Notes |

## 6. External dependencies
| Dependency | Kind | Used for | Doc |
|---|---|---|---|
| <name> | HTTP API \| queue \| SaaS \| … | <purpose> | docs/integrations/<svc>.md |

## 7. Cross-cutting concerns
<authn, authz, audit, observability, config — one bullet each, citing spec ids>

## 8. Key decisions
| Id | Topic | Where |

## 9. Verification status
| Check | Last run | Result |

## 10. Known gaps / out of scope
- <gap>
````

## Rules

- Sections are numbered and in this order. §3 and §4 are fenced YAML directly under their heading.
- **§3:**
  - Every source directory is covered by exactly one component.
  - `stack` is required for components that contain code, and must exist under `stacks/`.
  - `framework` must be listed in that stack's front-matter.
  - `paradigm` is `<id>@<major>`, and that paradigm's `supports` must include the stack.
  - `decisions` is required when `stack` or `paradigm` is set.
- **§4:** `may-depend-on` names only layers from the same list. A feature-first repo (MOD-9, the default) also lists `modules`: each module's `may-depend-on` names other modules, `public` lists the files other modules may import (MOD-3, IMP-5), and layer `path`s are then relative to each module, which must contain every layer folder (an empty one keeps a `.gitkeep`). An opted-in layer-first repo has no `modules` list and its layer paths are relative to the repo root. The stack turns it into FF-1 boundary rules. An optional `alias: <prefix>` on a layer or module is its import alias (`foundations/design/import-paths.md`, IMP-7); the stack turns it into runtime and type-check alias config.
- **§7 (optional):** when a component's paradigm is tiered (`paradigms/class-modeled.md`), a bullet `Tier B files:` lists the globs where free functions are allowed, one reason each. It is the allow-list the stack's lint config mirrors (PDM-class-modeled-R7).
- **§6:** every external service the code calls has a row. Every row of kind other than `none` has a `Doc` that complies with `integration/v1`.
- **§8** links to records and never restates them.
- **§2 drift:** P0 flags it stale when `ref` ≠ `system-ref` in `<kb>/architecture.md`. There is no separate system repo (D8): system topology lives in the Company KB `system/` folder (`../company-kb-changes/`).

## Example

The v2 proposal §4.6 (rbac-demo, every section shown).

## Checks

| Check | Tool |
|---|---|
| Front-matter; 10 sections in order; YAML parses | `validate-project.mjs` |
| §3 coverage, ids exist, paradigm–stack support, decisions present | `validate-project.mjs` |
| Manifest detection agrees with §3 `stack` (e.g. `package.json` → typescript-node) | `validate-project.mjs` |
| §6 docs exist and comply | `validate-project.mjs` |

## Changes from v1

- `binding:` becomes `stack:`. Components become a list with `name`, `kind`, `framework`, `paradigm` and `decisions`.
- Sections are numbered and fixed. New: §4 Layers (YAML), §7, §9 and §10, which formalize the ad-hoc sections that rbac-demo invented.
- §6 gains a `Doc` column. New optional front-matter key `company-kb`.
