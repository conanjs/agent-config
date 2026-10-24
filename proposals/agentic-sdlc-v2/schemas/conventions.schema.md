---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Conventions (`conventions/v2`)

**Applies to:** `conventions.md` · **Store:** A · **Written by:** framework maintainer · **Read by:** the Orchestrator (always); every role (via the wrapper) · **Loaded as:** ① for the Orchestrator; referenced by every role

The framework's **operating rules**: who exists, how agents are launched, how knowledge is loaded, the workflow, and how conflicts are resolved. It is the one machine-parsed source for the role list and the profile-dimension registry. The validator reads both from here instead of hardcoding them.

## Front-matter

Standard (`_system.md` §1.1).

## Required structure

````markdown
# Agentic SDLC — Conventions

## 1. Roles
```yaml
roles:
  - { id: <role-id>, tag: "[<Tag>]", tier: <Top|Mid>, owns: "<one line>", file: agents/<role-id>.md }
```

## 2. Runtime model
<numbered rules: only the Orchestrator launches; one mode per launch; executor types; instances remember nothing>

## 3. Loading model
<① preset (from the role file), ② profiles (from docs/architecture.md), ③ state (from the launch prompt); precedence on form vs. intent>

## 4. Profile-dimension registry
```yaml
profile_dimensions:
  - { id: <dim>, required_for: code|none, folder: <path>, skill: <pattern>, selected_by: <role>, tree: <PREFIX>, layer_override: true|false }
```

## 5. Workflow
<phase table P0–P7: runs when, owners, Spec Kit command, output, gate; P0 classification; gate format; P6 loop>

## 6. Task lines
<pointer to schemas/task-line.schema.md + default tag inference>

## 7. Conflict precedence
| Conflict | Winner |

## 8. Fix fast path
## 9. Budgets and model tiers
## 10. Decision trees and records
## 11. Enforcement tiers
<tier 1 tools → tier 2 scripts → tier 3 LLM review; pointer to _system.md §1.4>
## 12. Validation
<list of validator checks for framework files (validate.mjs) and repo files (validate-project.mjs)>
## References
## Related
````

## Rules

- §1 and §4 are fenced YAML under exactly those headings. They are the **only** place roles and dimensions are listed. Every other file refers to them.
- Every role in §1 has a file at `agents/<id>.md`, and three wrappers (`role-wrapper.schema.md`).
- Every dimension in §4 has its `folder`, a selection tree with the given `tree` prefix, and a skill pattern.
- There is no `max_files_per_role` (D6), and there is no taxonomy (D5).

## Example

```yaml
roles:
  - { id: engineering, tag: "[Eng]", tier: Mid, owns: "How code is written within architecture's boundaries", file: agents/engineering.md }
profile_dimensions:
  - { id: paradigm, required_for: none, folder: paradigms/, skill: sdlc-paradigm-<id>, selected_by: engineering, tree: PDM, layer_override: true }
```

## Checks

| Check | Tool |
|---|---|
| §1 and §4 YAML parse; ids are unique | `validate.mjs` |
| Each role has a file and 3 wrappers; each dimension has a folder and a tree | `validate.mjs` |

## Changes from v1

- §1 becomes YAML. It replaces the hardcoded `ROLES` array in `validate.mjs`.
- §3 "Knowledge routing" (taxonomy filter plus file budget) becomes "Loading model".
- New sections: §4 Profile-dimension registry, §11 Enforcement tiers.
- §11 "Knowledge-layer validation" moves to §12 and covers repo files too.
