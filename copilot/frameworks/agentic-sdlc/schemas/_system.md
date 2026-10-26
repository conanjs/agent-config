---
schema: schema-system/v1
last-updated: 2026-10-04
---

# Agentic SDLC v2: Schema System

## What this is

**Every file the framework reads or writes has exactly one schema.** A schema fixes three things: a file's front-matter, its sections and their order, and the rules a validator or reviewer checks. Any reader, human or agent, then knows where to find each piece of information without scanning the whole file.

Analogy: a schema is a **form with fixed boxes**. Every filled-in form looks the same, so you know where the date is before you read it.

This file defines:
1. **Shared building blocks** that many schemas reuse: front-matter, the rule table, ids, paths, References and Related.
2. **The shape of a schema file** (the meta-schema).
3. **The compliance rules.**
4. **The registry**: every file type, which store it lives in, and its schema.

## 1. Shared building blocks

### 1.1 Front-matter

Every markdown file starts with:

```yaml
---
schema: <schema-id>/v<major>     # e.g. agent-role/v2
last-updated: YYYY-MM-DD
---
```

Schemas may add more keys, and list them under their own "Front-matter" section. YAML-only artifacts (launch prompt, message, service catalog) put `schema:` as their first key instead.

**Versioning:** a schema's major version changes when an existing file would stop complying. New schemas start at `v1`. Schemas that existed in framework v1 and changed are `v2`.

### 1.2 Rule table

Every file that states rules uses the same table. The columns are:

```markdown
| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| DP-1 | Single Responsibility | A unit has one reason to change | A service that validates, prices and audits | llm | knowledge/software-design/oop/srp.md |
```

| Column | Required | Meaning |
|---|---|---|
| `Id` | yes | Unique id (§1.3). Never reused after deletion |
| `Rule` | yes | One imperative sentence |
| `Holds when` | yes | An observable condition that shows the rule is met |
| `Typical violation` | yes | One concrete bad example |
| `Enforced by` | yes | `lint` · `typecheck` · `test` · `script` · `llm` (§1.4) |
| `Source` | no | A path into the knowledge base (`knowledge/…`), or `—` |

### 1.3 Ids

| Thing | Format | Prefix declared in | Example |
|---|---|---|---|
| Foundation rule | `<PREFIX>-<n>` | the foundation's front-matter `rule-prefix:` | `CS-4`, `DDD-8` |
| Stack rule (idioms) | `<PREFIX>-<n>` | `idioms.md` front-matter `rule-prefix:` | `TSN-12` |
| Paradigm rule | `PDM-<paradigm-id>-R<n>` | fixed | `PDM-class-modeled-R1` |
| Role review rubric | `<ROLE>-R<n>` | the role's front-matter `rubric-prefix:` | `ENG-R10` |
| Tree node | `<PREFIX>-Q<n>[a-z]` | the tree's front-matter `prefix:` | `PDM-Q2` |
| Decision record | `DR-<nnn>`, or `PDM-<component>` for paradigm | fixed | `DR-003`, `PDM-api` |
| Fitness function | `FF-<n>` | `foundations/review/fitness-functions.md` | `FF-1` |

Prefixes are **declared in front-matter, never hardcoded in the validator.** In v1, the validator's hardcoded `NODE_ID` regex and `ROLES` array were the reason that adding a tree or role needed code edits. In v2 the validator collects prefixes from front-matter and fails on any duplicate.

### 1.4 `Enforced by` values

| Value | Checked by | Where the concrete config lives |
|---|---|---|
| `lint` | the stack's `cmd.lint` | the stack paradigm overlay's or `idioms.md`'s **Enforcement** table |
| `typecheck` | the stack's `cmd.typecheck` | the same |
| `test` | `cmd.test_unit`, including architecture tests (FF-*) | the same |
| `script` | `tools/validate-project.mjs` or another framework script | the script itself |
| `llm` | a reviewer agent in review mode | — |

In a stack-agnostic file, `lint`, `typecheck` and `test` state the **intended** mechanism. Every stack that supports the file must map the rule in an Enforcement table. A stack that can't map it marks it `llm (fallback)`. The validator warns on any rule that has neither.

### 1.5 Paths

- Inside a framework, paths are relative to that framework's root (`foundations/code/coding-standards.md`).
- Links across stores are `{{AGENT_HOME}}`-anchored (`{{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md`). This is the same convention the Company KB uses (`{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`).
- Paths inside a project repo are relative to the repo root (`docs/architecture.md`).

### 1.6 References and Related

Every human-readable doc ends with these two sections:

```markdown
## References
**Local artifacts:**
- `<path>`: <what it is evidence for>
**External authoritative sources:**
- [<title>](<url>): <what it confirms>

## Related
- `<path>`: <why a reader goes there next>
```

Either section may say `> _None._` but may not be left out.

## 2. Shape of a schema file (meta-schema)

Every `*.schema.md` in this folder has these sections, in this order:

````markdown
---
schema: schema/v1
last-updated: YYYY-MM-DD
---
# Schema: <Name> (`<schema-id>/v<n>`)

**Applies to:** `<path glob>` · **Store:** A | B | C | D | runtime · **Written by:** <role/human> · **Read by:** <roles> · **Loaded as:** ① | ② | ③ | on-demand | n/a

<one paragraph: what this file is for, and what it is NOT for>

## Front-matter
<keys beyond §1.1, with required/optional; or "Standard (§1.1)">

## Required structure
```markdown
<the exact template: headings in order, placeholders in <angle brackets>>
```

## Rules
- <one bullet per rule a validator or reviewer checks>

## Example
<an abridged real or realistic instance>

## Checks
| Check | Tool |
|---|---|

## Changes from v1      <!-- only for schemas that existed in framework v1 -->
````

## 3. Compliance

1. **Before writing any file**, find its schema in the registry (§4) and read it.
2. **Include every required section, in order.** An optional section with nothing to say stays in as `> _None yet._`, so readers can tell it is empty on purpose rather than forgotten.
3. **Never add a section a schema doesn't define.** Extend the schema instead (bump the minor rule, or the major version if existing files would break).
4. **Retrofitting a pre-schema file:** add the front-matter, add any missing required sections (stubs are fine), and do **not** restructure unrelated content in the same edit. This is the same rule as `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`.

## 4. Registry

Store letters follow `README.md` §4: **A** framework rules · **B** global knowledge (references) · **C** Company KB (company facts) · **D** project repo (repo facts) · **runtime** (in-flight messages, never committed).

### 4.1 Framework files (store A)

| Schema | File | Applies to |
|---|---|---|
| `schema-system/v1` | this file | `schemas/_system.md` |
| `framework-index/v1` | `framework-index.schema.md` | `index.md` (the framework summary) |
| `conventions/v2` | `conventions.schema.md` | `conventions.md` |
| `agent-role/v2` | `agent-role.schema.md` | `agents/<role>.md` |
| `role-wrapper/v1` | `role-wrapper.schema.md` | `copilot/agents/sdlc-<role>.agent.md`, `claude/agents/sdlc-<role>.md`, `codex/agents/sdlc-<role>.toml` |
| `skill-wrapper/v1` | `skill-wrapper.schema.md` | `skills/agentic-sdlc/`, `skills/sdlc-<role>-preset/`, `skills/sdlc-stack-<id>/`, `skills/sdlc-paradigm-<id>/` (`SKILL.md`) |
| `foundation/v2` | `foundation.schema.md` | `foundations/<subject>/<name>.md` |
| `stack/v2` | `stack.schema.md` | `stacks/<id>/index.md` |
| `stack-idioms/v1` | `stack-idioms.schema.md` | `stacks/<id>/idioms.md` |
| `stack-framework/v1` | `stack-framework.schema.md` | `stacks/<id>/frameworks/<fw>.md` |
| `stack-paradigm/v1` | `stack-paradigm.schema.md` | `stacks/<id>/paradigms/<pdm>.md` |
| `stack-reference/v1` | `stack-reference.schema.md` | `stacks/<id>/reference/index.md`; the project files around it follow the store-D schemas (§4.3) |
| `paradigm/v1` | `paradigm.schema.md` | `paradigms/<id>.md` |
| `tree/v2` | `tree.schema.md` | `trees/<name>.tree.md` |
| — (code) | — | `tools/*.mjs`: code, documented by its header comment |

### 4.2 Runtime artifacts

| Schema | File | Applies to |
|---|---|---|
| `launch-prompt/v1` | `launch-prompt.schema.md` | the Orchestrator → role handoff packet |
| `message/v2` | `message.schema.md` | every role → Orchestrator reply |

### 4.3 Project repo files (store D)

| Schema | File | Applies to |
|---|---|---|
| `repo-architecture/v2` | `repo-architecture.schema.md` | `docs/architecture.md` |
| `integration/v1` | `integration.schema.md` | `docs/integrations/<svc>.md` |
| `constitution-sdlc/v1` | `constitution.schema.md` | framework-owned sections inside `.specify/memory/constitution.md` |
| `task-line/v1` | `task-line.schema.md` | the framework suffix on each line in `specs/<feature>/tasks.md` |
| `blueprint/v2` | `blueprint.schema.md` | `specs/<feature>/blueprint.md` |
| `decision-record/v2` | `decision-record.schema.md` | records inside `specs/<feature>/research.md` |
| *Spec Kit template* | owned by Spec Kit | `spec.md`, `plan.md`, `data-model.md`, `contracts/`, the body of `tasks.md` and `research.md` |

The framework never redefines a Spec Kit file. It only defines what it **adds** to one: a constitution section, a task-line suffix, or a decision record.

### 4.4 Files owned by sibling frameworks

| Store | Schema system |
|---|---|
| B. Global knowledge (`{{AGENT_HOME}}/knowledge/`) | `{{AGENT_HOME}}/frameworks/knowledge/schemas/_system.md` (deployed 2026-10-04; checked by `{{AGENT_HOME}}/frameworks/knowledge/tools/validate-knowledge.mjs`) |
| C. Company KB (`{{AGENT_HOME}}/companies/<co>/`) | `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`, including `system-architecture`, `service-catalog` and `cross-repo-feature` for the optional `system/` folder (applied 2026-10-04) |

### 4.5 Removed in v2

| v1 schema | Why removed |
|---|---|
| `taxonomy.schema.md` | `taxonomy.yaml` is removed (D5). Routing is now each role's Preset list plus the profile registry |
| `binding.schema.md` | Renamed and split into `stack`, `stack-idioms`, `stack-framework` and `stack-paradigm` (D1) |
| `system-architecture.schema.md`, `service-catalog.schema.md` (system repo) | The system repo is removed (D8). Both move to the Company KB `system/` folder, plus a new `cross-repo-feature` schema |

### 4.6 Pending

| File | Waiting on |
|---|---|
| Learning ledger (`docs/learning-ledger.md`?) | Open question 2, the learning loop |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/*.schema.md`: the 10 v1 schemas this set replaces.
- `copilot/frameworks/agentic-sdlc/tools/validate.mjs`: the hardcoded `ROLES`, `KINDS` and `NODE_ID` that §1.3 removes.
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`: source of the compliance and retrofit rules and the path convention reused here.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-v2-structure.md`: the design decisions (D1–D10) these schemas implement.

**External authoritative sources:**
- [YAML front matter (Jekyll docs)](https://jekyllrb.com/docs/front-matter/): the front-matter convention.
- [Semantic Versioning 2.0.0](https://semver.org/): the meaning of a major version bump.

## Related

- `../README.md`: the framework summary, which explains how every file type is used.
- `../knowledge-framework/schemas/_system.md`: the matching schema system for reference docs.
