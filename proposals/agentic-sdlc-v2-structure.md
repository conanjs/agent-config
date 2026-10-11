# Proposal: Agentic SDLC v2: Loading Model, Profiles, and Document Structures

**Status:** **Approved 2026-10-04** (owner: V). Implementation follows §10 next steps. The schema set and the framework summary now live in
[`agentic-sdlc-v2/`](agentic-sdlc-v2/README.md)** (`schemas/` for stores A and D plus runtime; `knowledge-framework/` for store B).
It supersedes `proposals/practice-packs.md`: that draft's "practice" axis is
renamed **paradigm** here and folded into the profile model. Base design: `proposals/agentic-sdlc-architecture.md`.

**How to read:** every section gives the rule first, then an **Example** block with a concrete artifact.
The running example throughout is `rbac-demo` (TypeScript/Express, clean architecture) and engineering task
**T014: "Add `Role.grant` enforcing the no-duplicate-permission invariant"**. §8 adds a hypothetical
integration task (T021, Apigee) to show every knowledge store in use. §6 shows how this framework connects to the
global knowledge base and the Company KB framework.

**Decisions confirmed by the owner (2026-10-04):**

| # | Decision |
|---|---|
| D1 | "binding" is renamed **stack** (folder, skill and field). |
| D2 | **Paradigm** is its own axis with its own folder and stack overlays. It is *selected* in the same component entry as the stack. |
| D3 | If the paradigm can't be inferred, the user is asked at P1 (open question at G0). The choice is locked at G3. |
| D4 | This round is design only. |
| D5 | `taxonomy.yaml` is **removed**. Routing is each role's Preset list (§4.1) plus the profile registry (§2.1), plus per-task state. |
| D6 | **No preset budget.** `max_files_per_role` is removed. A role's Preset list is as long as the role needs. |
| D7 | Integrations and references are **listed at planning time** on each task line (`touches:`, `refs:`), and copied into the launch prompt. The agent does not guess. In standalone mode, which has no plan, the agent reads the Reference topics table itself. |
| D8 | **No separate system repo.** The context map, service catalog and cross-repo feature docs move to the Company KB `companies/<co>/system/` folder. Contracts stay in provider repos (slice 0 merges the contract first). Details: `agentic-sdlc-v2/company-kb-changes/README.md`. |
| D9 | **Knowledge schemas apply to new docs only.** Existing `knowledge/` docs are legacy: kept as-is, never retrofitted, skipped by the validator (`agentic-sdlc-v2/knowledge-framework/schemas/_system.md` §6). |
| D10 | **Deep dives are free-form and connected by synthesis.** A deep-dive/v1 doc fixes only an envelope (front-matter, Summary, References, Related). An agent synthesizes it into knowledge-doc/v1 docs, linked both ways (synthesized-into ↔ derived-from). Legacy docs may be synthesis sources without being edited (gentic-sdlc-v2/knowledge-framework/schemas/deep-dive.schema.md). |

## 1. Why v2

Evidence from the first real run (`rbac-demo`, mission 001):
- **Two parallel channels delivered knowledge.**
  - Skills (`sdlc-engineering-principles`, `sdlc-binding-*`) and `taxonomy.yaml` routing both carried knowledge.
  - The files they carried overlapped.
- **Routing was by *ownership*, not by *who applies the rule*.**
  - DDD-14 ("no anemic model") is owned by `architecture`.
  - It therefore never reached `engineering`, which produced an anemic domain.
- **No paradigm was ever chosen.** The code became data interfaces plus free functions by default. That even broke the binding's own `idiom.di` ("use cases are classes with constructor-injected ports"), and review missed it.
- **`docs/architecture.md` drifted from its schema.**
  - It used `language:`/`framework:` instead of `binding:`.
  - It grew ad hoc sections.
  - No validator reads project files, so nothing caught it.

**Example — the evidence, verbatim from rbac-demo:**

```ts
// src/domain/role.ts — data only, behaviour lives elsewhere (anemic)
export interface Role { id: string; name: string; description: string; permissions: Permission[] }
export function roleHasPermission(role: Role, permissionKey: string): boolean { … }

// src/application/roles/roleUseCases.ts — ports passed as function params, not constructor-injected
export async function createRole(roles: RoleRepository, permissions: PermissionRepository, input: {…}) { … }
```

## 2. The loading model

Every launch hands an agent three layers, in this order:

```
LAUNCH ─► ① PRESET    (static, per role)       "who I am and what I always know"
          ② PROFILES  (runtime, per component) "which stack, which paradigm, …"
          ③ STATE     (runtime, per task)      "this project, this task"
```

| Layer | Contents | Chosen by | Changes |
|---|---|---|---|
| ① **Preset** | Foundation docs: principles, standards, rubrics | The role definition, as a fixed list | When the framework changes |
| ② **Profiles** | Stack profile, paradigm profile (and future dimensions) | The component or layer entry in `docs/architecture.md` | Per component or layer |
| ③ **State** | Constitution, architecture, spec, plan, research, tasks, task line, retry feedback | The Orchestrator, or the user when standalone (§4.7) | Every task |

**Analogy:** a locum doctor arriving at a hospital.
- ① is their medical training, which they always carry.
- ② is this hospital's equipment manual (stack) and its treatment protocol (paradigm).
- ③ is today's patient chart.

**Precedence:**
- On *form*, the most specific layer wins: State > Paradigm > Stack > Preset.
- On *intent*, Preset wins.
- If an agent can't satisfy both, it escalates.

**Example — what engineering actually loads for T014:**

```
① PRESET (from agents/engineering.md, same for every engineering launch)
   foundations/code/coding-standards.md        foundations/code/error-handling.md
   foundations/code/refactoring.md             foundations/design/design-principles.md
   foundations/design/clean-architecture.md    foundations/design/domain-driven-design.md   ← now reaches engineering
   foundations/delivery/testing-strategy.md

② PROFILES (resolved from rbac-demo docs/architecture.md: component "api", layer "domain")
   stack     typescript-node   → stacks/typescript-node/index.md, idioms.md, frameworks/express.md
   paradigm  class-modeled@1   → paradigms/class-modeled.md, stacks/typescript-node/paradigms/class-modeled.md

③ STATE (paths for this task)
   .specify/memory/constitution.md   docs/architecture.md
   specs/002-role-grants/{spec,plan,research,tasks}.md
   task line: T014 …
```

### 2.1 Profile dimensions (the flexibility point)

`stack` and `paradigm` are the first two **profile dimensions**. Every dimension has the same four parts:

| Part | stack | paradigm | Future: compliance |
|---|---|---|---|
| Knowledge location | `stacks/<id>/` | `paradigms/<id>.md` | `compliance/<id>.md` |
| Field on component or layer | `stack:` (required for code) | `paradigm:` (optional) | `compliance:` (optional) |
| Skill name | `sdlc-stack-<id>` | `sdlc-paradigm-<id>` | `sdlc-compliance-<id>` |
| Selected by, using tree | tech-stack, `TS-*` | engineering, `PDM-*` | security, its own tree |

You add a dimension in one place: a new row in the dimension registry in `conventions.md`.

**Example — the registry block in `conventions.md`:**

```yaml
profile_dimensions:
  - { id: stack,      required_for: code, folder: stacks/,     skill: sdlc-stack-<id>,      selected_by: tech-stack,  tree: TS,  layer_override: false }
  - { id: framework,  required_for: none, folder: stacks/<stack>/frameworks/, skill: (part of stack skill), selected_by: tech-stack, tree: TS, layer_override: false }
  - { id: paradigm,   required_for: none, folder: paradigms/,  skill: sdlc-paradigm-<id>,   selected_by: engineering, tree: PDM, layer_override: true }
  # later, one line to add:
  # - { id: compliance, required_for: none, folder: compliance/, skill: sdlc-compliance-<id>, selected_by: security, tree: CMP, layer_override: false }
```

### 2.2 Paradigm is its own axis (D2)

- **Independent of stack.** One paradigm spans many stacks, and one stack supports many paradigms. Putting paradigm inside stack would mean duplicating the paradigm knowledge once per stack.
- **Selected next to the stack.** Both fields sit on the same component entry, and a layer may override the paradigm.
- **Stack overlays.** A file at `stacks/<stack>/paradigms/<paradigm>.md` shows how the paradigm looks in that language. Each paradigm declares the stacks it supports with `supports:`.

**Example — the overlay `stacks/typescript-node/paradigms/class-modeled.md` (abridged):**

````markdown
# class-modeled on typescript-node

| Paradigm slot | TypeScript form |
|---|---|
| Modeling   | `class` per aggregate/entity; private constructor + static `create()` factory returning `Result` |
| State      | `#private` fields or `private readonly`; no public setters |
| Composition| behaviour as methods; variation via `interface` + implementations, not `switch (kind)` |
| Effects    | domain classes import nothing from `infrastructure/`; use-case classes get ports via constructor |

```ts
export class Role {
  private constructor(readonly id: RoleId, private name: RoleName, private readonly perms: Set<PermissionKey>) {}
  static create(name: RoleName, perms: PermissionKey[]): Result<Role, "empty_permissions"> { … }
  grants(key: PermissionKey): boolean { return this.perms.has(key); }
  grant(key: PermissionKey): Result<void, "already_granted"> {
    if (this.perms.has(key)) return err("already_granted");   // invariant lives on the aggregate
    this.perms.add(key); return ok(undefined);
  }
}
```
````

### 2.3 Paradigm selection (D3)

| Situation | Behaviour |
|---|---|
| Existing code has one dominant paradigm | Propose keeping it (`PDM-Q1`) |
| Greenfield with a clear signal | Tree proposes one, with a one-line rationale. Rule-rich domain → class-modeled; input→output transform → functional-pipeline |
| Ambiguous | Becomes one of the ≤3 open questions at **G0** |
| Always | Written as a decision record in `research.md` and locked at **G3**. Changed later only by a new record that supersedes it |

**Example A — open question at G0:**

```markdown
3. **Open questions**
   1. Paradigm for `api` (src/): code today is data-interfaces + free functions, but spec.md has
      invariants (no duplicate permissions, role-in-use cannot be deleted). Proposed: **class-modeled**
      for domain/application, keep **functional-pipeline** for interface/. Reply `paradigm: as proposed`
      or name another. — raised by engineering, confidence medium
```

**Example B — the resulting decision record in `research.md`:**

```markdown
### PDM-api — Paradigm for component `api`
- **Question:** How should `api` model its domain and use cases? (PDM-Q1 → PDM-Q2)
- **Decision:** `class-modeled@1` for src/domain + src/application; layer override `functional-pipeline@1` for src/interface.
- **Rationale:** spec.md FR-004/FR-011 define invariants that must be enforced in one place (DDD-8, DDD-14).
- **Rejected:** functional-pipeline everywhere — invariants would be scattered across use-case functions;
  no constraint — status quo produced an anemic model and an `idiom.di` violation.
- **Decided by:** human at G0 (engineering proposed) · **Supersedes:** —
```

## 3. Naming (D1)

| v1 | v2 | Why |
|---|---|---|
| `principles/bindings/<id>/` | `stacks/<id>/` | Says what it is |
| skill `sdlc-binding-<id>` | `sdlc-stack-<id>` | Same |
| field `binding:` | `stack:` | Matches "stack detection" and the trees named `TS` (tech stack) |
| `principles/declarative/…`, `procedural/…`, `meta/…` | `foundations/<subject>/` | Grouped by subject, not by the abstract "kind of knowledge" |
| `principles/contextual/*.tree.md` | `trees/*.tree.md` | "contextual" was jargon for "decision tree" |
| "practice pack" | `paradigms/<id>.md` | Accurate term for OOP vs. FP |
| prefix `PRAC-*` | `PDM-*` | Doesn't collide with `CS-*`, `DP-*`, `DDD-*`, `ENG-R*` or "PR" |

**Example — the same component line, before and after:**

```yaml
# v1 schema (and what rbac-demo actually wrote instead)
components:
  api: { path: src/, binding: typescript-node }          # schema
  - { name: api, language: typescript, framework: express } # what was written — drift

# v2
components:
  - { name: api, path: src/, kind: service, stack: typescript-node, framework: express, paradigm: class-modeled@1 }
```

## 4. Document structures

### 4.1 Role definition — `agents/<role>.md`

```markdown
# Role: <Name> (`<id>`)
**Tier** · **Task tag** · **Model tier** · **Phases**
## Identity          — what it owns; boundary with its nearest neighbour role
## Preset knowledge  — fixed list of foundations/ docs, always loaded
## Runtime inputs    — profiles it expects (+ required/optional) and state paths
## Trees owned       — tree prefixes
## Modes             — propose / decide / execute / review (omitted ones say why)
## Review rubric     — <ROLE>-R* ids
## Standalone use    — what it does when invoked directly, without an Orchestrator (§4.7)
## Escalate when
## Output            — schemas/message.schema.md
```

**Example — `agents/engineering.md` v2 (abridged):**

```markdown
# Role: Engineering (`engineering`)
**Tier:** 1 · **Task tag:** `[Eng]` · **Model tier:** Mid · **Phases:** P2, P4, P6, P6-review

## Identity
Owns how code is written inside the boundaries `architecture` sets. Structure disputes → architecture.

## Preset knowledge
- foundations/code/coding-standards.md · error-handling.md · refactoring.md
- foundations/design/design-principles.md · clean-architecture.md · domain-driven-design.md (DDD-7..14)
- foundations/delivery/testing-strategy.md
- foundations/review/review-rubrics.md (review mode only)

## Runtime inputs
| Input | Required | Source |
|---|---|---|
| stack     | yes (code tasks) | component/layer in docs/architecture.md |
| paradigm  | no — absent means "no paradigm constraint" | component/layer |
| framework | no | component |
| state     | execute: yes · review: optional (§4.7) | launch prompt |

## Trees owned
PDM (paradigm selection) — P4.

## Review rubric
ENG-R1..R9 (unchanged) + ENG-R10: code follows the assigned paradigm's PDM-<id>-R* rules or names an escape hatch.
```

### 4.2 Foundation doc — `foundations/<subject>/<name>.md`

The v1 principle-file structure stays as-is, because it worked:

```markdown
# <Title>
<one paragraph: what this governs>
## Rules          — table: Id | Rule | Holds when | Typical violation
## Interpreting   — edge cases
## Tensions       — rule-vs-rule default resolutions
## References     ## Related
```

**Example — `foundations/design/design-principles.md` (real rows, abridged):**

```markdown
| Id | Principle | Holds when | Typical violation |
|---|---|---|---|
| DP-1 | Single Responsibility | A unit has one reason to change | A service that validates, prices and audits |
| DP-2 | Open/Closed | New behaviour is added by adding code, not editing a central switch | A growing `if type == …` chain |
| DP-9 | Composition over inheritance | Inheritance only for a true is-a with a stable contract | Deep hierarchies to share helpers |
```

### 4.3 Stack profile — `stacks/<id>/`

```
index.md             — slots: language_version, package_manager, project_layout, cmd.*, tools, style_guide (new)
                       + "Reference topics" load-when table (new, §6.4)
idioms.md            — errors, concurrency, DI, config, logging (with code); each rule may cite Source: knowledge/…
frameworks/<fw>.md   — optional framework idioms
paradigms/<pdm>.md   — overlay per supported paradigm (example in §2.2)
```

**Example A — `stacks/typescript-node/index.md` (real slots, abridged):**

```markdown
| Slot | Value |
|---|---|
| `cmd.format`    | `pnpm exec prettier --check .` |
| `cmd.lint`      | `pnpm exec eslint . --max-warnings 0` |
| `cmd.typecheck` | `pnpm exec tsc --noEmit` |
| `cmd.test_unit` | `pnpm exec vitest run` |
| `idiom.di`      | Constructor injection of port interfaces; wiring only in `src/main.ts` |
```

**Example B — `stacks/typescript-node/frameworks/express.md` (new, abridged):**

```markdown
# express on typescript-node
- Routes live in `src/interface/routes/`; one router per resource, mounted in `main.ts`.
- Handlers only: parse input (schema) → call one use case → map `Result` to HTTP via the single error mapper.
- Middleware for cross-cutting HTTP concerns only (authn, authz, rate limit) — never business rules.
```

### 4.4 Paradigm profile — `paradigms/<id>.md`

```markdown
---
id · version · status · fits-when · avoid-when · supports: [stacks]
---
## Core idea · Modeling · State · Composition · Effects · Errors shape · Testing shape
## Rules (PDM-<id>-Rn) · Escape hatches · Sources · Changelog
```

**Example — `paradigms/class-modeled.md` (abridged):**

```markdown
---
id: class-modeled
version: 1.0
status: active
fits-when: rule-rich domain; invariants guarded across operations; long-lived entities
avoid-when: pure data transforms; CRUD pass-through; one-shot scripts
supports: [typescript-node, python, go]
---
## Core idea
Each domain concept is one type that owns its data and the rules over it. Callers tell objects what to do;
they don't pull data out and decide for them.
## Modeling      Aggregates/entities are types with identity; value objects are immutable and self-validating.
## State         Private; changed only through intention-named methods that enforce invariants.
## Composition   Behaviour on the owning type; variation via interfaces/polymorphism, not type switches.
## Effects       Domain types do no I/O; application-service objects orchestrate ports injected via constructor.
## Errors shape  Expected rule violations returned per the stack's `idiom.errors`; never silently ignored.
## Testing shape Tests call public methods and assert observable state/results; no reaching into fields.
## Rules
- PDM-class-modeled-R1: no public mutable fields on domain types.
- PDM-class-modeled-R2: no exported function outside a type that mutates that type's data.
- PDM-class-modeled-R3: use cases are types with constructor-injected ports.
## Escape hatches
- Pure stateless calculations may be free functions.
## Sources
Evans, DDD (2003) · Vernon, IDDD (2013) · Meyer, OOSC 2e (1997) · Fowler, "AnemicDomainModel", "TellDontAsk"
## Changelog
- 1.0 — initial (PDM-api, rbac-demo pilot)
```

For contrast, `paradigms/functional-pipeline.md` has these core rules:
- Plain immutable data plus pure functions.
- Workflows are composed pipelines (`parse → validate → decide → persist`).
- Effects are kept in a thin imperative shell.

Its sources are Wlaschin's *Domain Modeling Made Functional* and Bernhardt's "Functional Core, Imperative Shell".

### 4.5 Launch prompt (handoff packet)

This is the **one message the Orchestrator sends when it starts an agent**. The agent has seen nothing else from the conversation, so this packet is all it knows about the job. Think of it as a work order handed to a contractor.

**Example — T014:**

```yaml
mode: execute
role: engineering
phase: P6
task: "T014 [US2] [Eng] [llm] Add Role.grant enforcing no-duplicate invariant (src/domain/role.ts)"
profiles:
  stack: typescript-node
  framework: express
  paradigm: class-modeled@1
state:
  constitution: .specify/memory/constitution.md
  architecture: docs/architecture.md
  spec: specs/002-role-grants/spec.md
  plan: specs/002-role-grants/plan.md
  research: specs/002-role-grants/research.md
  tasks: specs/002-role-grants/tasks.md
context:
  attempt: 2 of 3
  feedback: |
    review-fail: ENG-R10 PDM-class-modeled-R1 — Role.permissions is public and mutable (src/domain/role.ts:4)
output: schemas/message.schema.md
```

**Line by line:**

| Line | Meaning | Where the Orchestrator got it | What the agent does with it |
|---|---|---|---|
| `mode: execute` | Which of the 4 modes to act in | P6 loop step 1 (`conventions.md` §4) | Follows the `execute` section of its role file: write code, run checks, reply |
| `role: engineering` | Which role definition to follow | The task tag `[Eng]` | Loads `agents/engineering.md` and its **① Preset** list |
| `phase: P6` | Where in the workflow we are | Current phase | Context only (e.g. no spec edits in P6) |
| `task:` | The single job | The line in `tasks.md` | Its scope: no more, no less (ENG-R1) |
| `profiles.stack` | Language and toolchain | Component that contains `src/domain/role.ts` → `stack:` | Loads skill `sdlc-stack-typescript-node`; runs only its `cmd.*` |
| `profiles.framework` | Framework idioms | Same component → `framework:` | Loads `stacks/typescript-node/frameworks/express.md` |
| `profiles.paradigm` | Modeling paradigm | Layer `domain` has no override → component `paradigm:` | Loads `paradigms/class-modeled.md` plus the TS overlay |
| `state.*` | Paths to project facts | Fixed locations in the repo and the feature folder | Reads them itself. Paths, not pasted text, keep the packet small |
| `context` | Retry-only feedback | The previous attempt's failing check or review reply | Must address every line of `feedback` |
| `output` | Reply format | Fixed | Replies with one message per `message.schema.md` |

**How the profile lines were resolved (step by step):**
1. Take the task path `src/domain/role.ts`.
2. Find the longest matching component `path` in architecture §3. That is `api` (`src/`).
3. Find the longest matching layer `path` in §4. That is `domain` (`src/domain/`).
4. For each dimension, use the layer value if it has one, otherwise the component value. Here `paradigm` falls back to the component's `class-modeled@1`.
5. Write the results under `profiles:`.

**Example — the agent's reply:**

```yaml
from: engineering
to: orchestrator
mode: execute
type: artifact
payload:
  summary: Role is now a class with private permission set; grant() rejects duplicates with "already_granted".
  confidence: high
  rationale: PDM-class-modeled-R1/R2; DDD-8 (changes only via root methods)
  artifacts: [src/domain/role.ts, src/domain/role.test.ts, src/application/roles/roleUseCases.ts]
  open_questions: []
```

### 4.6 Per-repo `docs/architecture.md`

The sections are fixed and numbered. Any section that holds YAML uses fenced YAML under a fixed heading, so `validate-project.mjs` can parse it.

```
front-matter: schema: repo-architecture/v2, last-updated, updated-by, company-kb (optional, §6.3 link 2)
1. Overview   2. System context (multi-repo)   3. Components (yaml)   4. Layers & dependency rules (yaml)
5. Data   6. External dependencies   7. Cross-cutting concerns   8. Key decisions
9. Verification status   10. Known gaps / out of scope
```

**§3 field rules:**

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique id |
| `path` | yes | Root directory. Every source directory is covered by exactly one component |
| `kind` | yes | `service`, `library`, `script` or `datastore` |
| `stack` | yes, for code | An id under `stacks/` |
| `framework` | no | An id under `stacks/<stack>/frameworks/` |
| `paradigm` | no | `<id>@<major>` under `paradigms/`. Absent means no paradigm constraint |
| `decisions` | yes, if `stack` or `paradigm` is set | The decision ids that chose them |

**§4 fields:** `name`, `path`, `may-depend-on`, optional `paradigm` override.

**Example — rbac-demo rewritten in v2 (abridged, every section shown):**

````markdown
---
schema: repo-architecture/v2
last-updated: 2026-10-04
updated-by: mission 002-role-grants (P7)
---
# Architecture: rbac-demo

## 1. Overview
RBAC demo API: users, roles and permissions gate a `posts` resource; every security event is audit-logged.
Risk tier HIGH (RT-Q1).

## 3. Components
```yaml
components:
  - { name: api,  path: src/,     kind: service,   stack: typescript-node, framework: express, paradigm: class-modeled@1,       decisions: [DR-001, PDM-api] }
  - { name: seed, path: scripts/, kind: script,    stack: typescript-node,                     paradigm: functional-pipeline@1, decisions: [DR-001, PDM-seed] }
  - { name: db,   path: prisma/,  kind: datastore }
```

## 4. Layers & dependency rules
```yaml
layers:
  - { name: domain,         path: src/domain/,         may-depend-on: [] }
  - { name: application,    path: src/application/,    may-depend-on: [domain] }
  - { name: infrastructure, path: src/infrastructure/, may-depend-on: [domain, application] }
  - { name: interface,      path: src/interface/,      may-depend-on: [domain, application], paradigm: functional-pipeline@1 }
```

## 5. Data
| Store | Kind | Owned entities | Notes |
|---|---|---|---|
| postgres | relational | User, Role, Permission, RolePermission, Post, AuditLogEntry | audit log append-only |

## 6. External dependencies
| Dependency | Kind | Used for | Doc |
|---|---|---|---|
| — | — | none (self-contained demo) | — (each real row links `docs/integrations/<svc>.md`, §6.6) |

## 7. Cross-cutting concerns
- **AuthN:** stateless JWT, 15 min. **AuthZ:** deny-by-default; re-evaluated against DB every request (FR-011).
- **Audit:** login, denial, role change logged; never secrets (FR-009).

## 8. Key decisions
| Id | Topic | Where |
|---|---|---|
| DR-001 | Stack: typescript-node + express | specs/001-rbac-demo/research.md |
| PDM-api | Paradigm for api | specs/002-role-grants/research.md |

## 9. Verification status
| Check | Last run | Result |
|---|---|---|
| validate-project | 2026-10-04 | pass |
| cmd.test_unit / cmd.test_integration | 2026-10-04 | 15/15 · 20/20 |

## 10. Known gaps / out of scope
- No CI pipeline; no refresh tokens; JWT secret in plaintext `.env` (demo only).
````

### 4.7 Standalone use (no Orchestrator, no Spec Kit flow)

Any role can be invoked **directly by you**, for example "engineering, review these files". It then runs with no Orchestrator, no gates and no feature folder. The three layers still apply, but the role resolves layers ② and ③ itself:

| Layer | With the Orchestrator | Standalone |
|---|---|---|
| ① Preset | Loaded from the role file | Same, always |
| ② Profiles | Arrive in `profiles:` | 1. Whatever you name in the request. 2. Otherwise read from `docs/architecture.md` §3/§4 if present. 3. Otherwise detected from the manifest (`package.json` → `typescript-node`). 4. Otherwise asked. Paradigm stays empty unless you name one or the repo declares one |
| ③ State | Paths in `state:` | Whatever exists in the repo. Rubric checks that need a spec (e.g. ENG-R1 "matches the acceptance criteria") are reported **N/A**, not failed |
| Gates / records | Yes | None. The role only reports. It never writes decision records or `tasks.md` |

**Required change:** each tool wrapper must allow direct invocation. For example, Copilot's `sdlc-engineering.agent.md` currently says `user-invocable: false`, and that changes to `true`.

**Example — your request:**

```
@sdlc-engineering mode: review
files: src/domain/*.ts, src/application/roles/*.ts
paradigm: class-modeled          # optional; omit to review against preset + stack only
```

**Example — what it resolves and replies:**

```yaml
# resolved: preset = engineering list; stack = typescript-node (from docs/architecture.md §3);
#           paradigm = class-modeled (from request); state = constitution + architecture only (no spec)
from: engineering
mode: review
type: review-fail
payload:
  summary: Domain is anemic and use cases bypass constructor injection.
  findings:
    - { check: ENG-R1,  result: n/a,  severity: nit,   detail: no spec/task given — scope not checked }
    - { check: ENG-R3,  result: fail, severity: major, detail: idiom.di — createRole() takes ports as params (roleUseCases.ts:5) }
    - { check: ENG-R10, result: fail, severity: major, detail: PDM-class-modeled-R1 — Role.permissions public & mutable (role.ts:11) }
  reason: fixable
```

## 5. Proposed framework layout

```
frameworks/agentic-sdlc/
├── index.md, conventions.md            ← rules + profile-dimension registry (§2.1)
├── agents/<role>.md                    ← role definitions (§4.1)
├── foundations/                        ← ① preset knowledge, grouped by SUBJECT (not by role)
│   ├── code/       coding-standards, error-handling, refactoring
│   ├── design/     design-principles, clean-architecture, domain-driven-design,
│   │               distributed-systems, module-boundaries, contract-design
│   ├── quality/    functional-suitability, maintainability, performance-efficiency, reliability, security
│   ├── delivery/   spec-writing, testing-strategy, threat-modeling, release-pipeline
│   └── review/     review-rubrics, fitness-functions
├── trees/                              ← decision trees (was principles/contextual/)
├── stacks/<id>/                        ← ② profile: stack (was principles/bindings/)
├── paradigms/<id>.md                   ← ② profile: paradigm (new)
├── schemas/
└── tools/  validate.mjs (framework) · validate-project.mjs (per repo, new)
```

### 5.1 `foundations/`: grouped by subject, not by role

The folders are **subjects**, meaning what the knowledge is *about*. They are **not roles**. A role's Preset list picks files from any subject. For example:
- engineering's preset takes from `code/`, `design/`, `delivery/` and `review/`;
- architecture's preset takes from `design/`, `quality/` and `review/`.

This is why one file, such as `domain-driven-design.md`, can serve both architecture (to decide boundaries) and engineering (to apply DDD-8 and DDD-14), without the v1 "owners" problem. No subject folder is named after a role, so the two can't be confused.

**Example — the complete v1 → v2 mapping:**

| v1 path (`principles/…`) | v2 path | Preset of (example) |
|---|---|---|
| `procedural/engineering/coding-standards.md` | `foundations/code/coding-standards.md` | engineering |
| `procedural/engineering/error-handling.md` | `foundations/code/error-handling.md` | engineering |
| `procedural/engineering/refactoring.md` | `foundations/code/refactoring.md` | engineering |
| `declarative/axioms/design-principles.md` | `foundations/design/design-principles.md` | engineering, architecture |
| `declarative/axioms/clean-architecture.md` | `foundations/design/clean-architecture.md` | engineering, architecture |
| `declarative/axioms/domain-driven-design.md` | `foundations/design/domain-driven-design.md` | engineering, architecture, product-spec, system-architecture |
| `declarative/axioms/distributed-systems.md` | `foundations/design/distributed-systems.md` | system-architecture, architecture, devops |
| `procedural/architecture/module-boundaries.md` | `foundations/design/module-boundaries.md` | architecture |
| `procedural/system-architecture/contract-design.md` | `foundations/design/contract-design.md` | system-architecture |
| `declarative/quality/*.md` (5 files) | `foundations/quality/*.md` | qa, security, architecture, … |
| `procedural/product/spec-writing.md` | `foundations/delivery/spec-writing.md` | product-spec |
| `procedural/qa/testing-strategy.md` | `foundations/delivery/testing-strategy.md` | qa, engineering |
| `procedural/security/threat-modeling.md` | `foundations/delivery/threat-modeling.md` | security |
| `procedural/devops/release-pipeline.md` | `foundations/delivery/release-pipeline.md` | devops |
| `meta/review-rubrics.md`, `meta/fitness-functions.md` | `foundations/review/` | every reviewing role / architecture, devops |
| `contextual/*.tree.md` | `trees/*.tree.md` | the owning role (decide mode) |
| `bindings/<id>/` | `stacks/<id>/` | profile (§4.3) |

### 5.2 `trees/`: decision trees

A tree is a **flowchart of questions that ends in a choice**, plus the rules for when to stop and ask a human. Each node has an id (`AP-Q1`) so that decision records can cite the exact path taken. Trees are used only in `decide` mode, and only by the role that owns them. They are not preset knowledge.

The trees in v2:

| Tree file | Owner | Decides |
|---|---|---|
| `tech-stack-selection` (TS) | tech-stack | language/framework/data store |
| `toolchain-selection` (TC) | tech-stack | linters, test runners, … |
| `architecture-pattern-selection` (AP) | architecture | single project vs. modular monolith vs. services |
| `test-strategy-depth` (TD) | qa | unit/integration/e2e depth |
| `risk-tier` (RT) | security | LOW/MEDIUM/HIGH |
| `deployment-topology` (DT) | devops | environments, deploy shape |
| `scope-boundary` (SCOPE) | product-spec | in/out of scope |
| `contract-change` (CC) | system-architecture | contract versioning |
| **`paradigm-selection` (PDM)** (new) | engineering | class-modeled / functional-pipeline / … |

**Example — real excerpt from `trees/architecture-pattern-selection.tree.md`:**

```
AP-Q1 Team size / deployment independence?
├─ Single team, single cadence        → AP-Q2
└─ Multiple teams, independent deploy → microservices (ESCALATE)
AP-Q2 Expected complexity growth?
├─ Demo / prototype / low growth → single project, layered
├─ Moderate, modular growth      → modular monolith
└─ High, clear domain seams      → modular monolith now; microservices only if AP-Q1 changes
```

**Example — the new `trees/paradigm-selection.tree.md` overview:**

```
PDM-Q1 Does existing code in this component follow one paradigm consistently?
├─ Yes → keep it (retrofit; no rewrite)
└─ No / greenfield → PDM-Q2
PDM-Q2 Does the component own invariants enforced across operations (spec rules, lifecycle states)?
├─ Yes → class-modeled
└─ No  → PDM-Q3
PDM-Q3 Is it an input→output transform with no persistent identity (scripts, ETL, handlers)?
├─ Yes → functional-pipeline
└─ No  → PDM-Q4: project default from constitution; if none → ASK at G0
```

## 6. Knowledge architecture: where every kind of knowledge lives

The framework is **one of three knowledge stores** that an agent reads. The other two already exist in `AGENT_HOME`: the **global knowledge base** and the **Company KB framework**. The project repo is a fourth source. v1 never drew how these connect. This section does.

### 6.1 Rule vs. Reference vs. Fact

Before you store a new piece of knowledge, decide its **kind**. The kind decides where it lives and how it gets loaded.

| Kind | Meaning | Size and shape | Example |
|---|---|---|---|
| **Rule** | A "must", the same for everyone using that profile | Short. Has an id. Can be checked | `DP-1` Single Responsibility; `TSN-12` "initialize every field in the constructor" |
| **Reference** | Explains "how X works". Not tied to any company | Long and descriptive. Rules cite it | How V8 hidden classes work; sorting algorithms; how Apigee proxies work |
| **Fact** | True for one company or one repo only | Specific: names, endpoints, owners | "ne-shipment-api calls Apigee proxy `hr-v2` with key from env `APIGEE_HR_KEY`" |

Analogy: the **textbook** is the Reference, the **checklist** made from the textbook is the Rule, and the **patient's file** is the Fact.

### 6.2 The five homes

| Home | Kind | Loaded as | Written by | Exists today? |
|---|---|---|---|---|
| A1. `frameworks/agentic-sdlc/foundations/<subject>/` | Rule, universal | ① Preset, always | framework maintainer | yes (as `principles/`) |
| A2. `frameworks/agentic-sdlc/stacks/<id>/`, `paradigms/` | Rule, per profile | ② Profile, per component/layer | maintainer; promoted from the learning loop | yes (as `bindings/`) / new |
| B. `knowledge/<topic>/` (global knowledge base) | Reference | ③ State, listed per task as `refs:` at planning (§6.4) | owner or an agent while researching | yes (`nodejs/`, `grpc/`, `gcp/`, `datadog/`, …) |
| C. `companies/<co>/` (Company KB framework instance) | Fact, shared across a company's repos | ③ State, on demand, by following links | KB procedures (`init-repo-kb`), learning loop | yes (OTS; already documents Apigee) |
| D. `<repo>/docs/`, `specs/`, constitution | Fact, this repo | ③ State | role agents, P1–P7 | yes (`docs/integrations/` is new) |

**Placement rules:**
1. Put something in `foundations/` only if it must bind **every** task of the roles that preset it. Foundations load on every launch, so they stay small.
2. Deep material goes to `knowledge/` (B). That includes algorithms, fundamentals consolidated from authoritative online sources, and engine internals. If a must-rule comes out of it, extract the rule into A1 or A2 and add `Source: knowledge/...`.
3. Engine or runtime internals belong in B, **not** inside a stack folder. V8 serves `typescript-node`, a future browser stack and Deno, so it is stored once in B and cited by each stack.
4. A third-party service has three layers:
   - how it works in general → B;
   - how the company uses it (shared proxies, environments, owners) → C;
   - how this repo calls it → D, in `docs/integrations/<svc>.md`.

### 6.3 System architecture

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║  ~/.copilot/   (AGENT_HOME, deployed from agent-config repo)                          ║
║                                                                                       ║
║  ┌─────────────────────────────── A. AGENTIC-SDLC FRAMEWORK (RULES) ───────────────┐  ║
║  │ frameworks/agentic-sdlc/                                                        │  ║
║  │   agents/        role definitions (orchestrator, engineering, qa, …)            │  ║
║  │   conventions.md routing, gates, dimension registry                             │  ║
║  │   schemas/       doc shapes (role, stack, paradigm, launch-prompt, arch.md v2)  │  ║
║  │   foundations/   ① PRESET rules   code/ design/ quality/ delivery/ review/      │  ║
║  │   stacks/<id>/   ② PROFILE rules  index.md (+Reference topics) · idioms.md      │  ║
║  │   paradigms/     ② PROFILE rules  class-modeled.md · functional-pipeline.md     │  ║
║  │   trees/         decision trees (TS-Q, TC-Q, PDM-Q …)                           │  ║
║  └───────────────────────────────┬─────────────────────────────────────────────────┘  ║
║                                  │ link 1: idioms cite "Source:"; index.md load-when  ║
║                                  ▼                                                    ║
║  ┌──────────────────── B. GLOBAL KNOWLEDGE (REFERENCE, company-neutral) ───────────┐  ║
║  │ knowledge/  js-runtime/ · algorithms/ · apigee/ · grpc/ · gcp/ · datadog/ …     │  ║
║  └───────────────────────────────▲─────────────────────────────────────────────────┘  ║
║                                  │ link 3: company facts cite general background      ║
║  ┌──────────────────── C. COMPANY KB FRAMEWORK (FACTS, per company) ───────────────┐  ║
║  │ frameworks/company-kb/   index.md · schemas/_system.md (+ doc schemas)          │  ║
║  │        │ defines shape of ▼                                                     │  ║
║  │ companies/ots/   index.md · domain/ · flows/ · infra/ · repos/<repo>/           │  ║
║  │ procedures/init-repo-kb.procedure.md   bootstrap a repo entry                   │  ║
║  └───────────────────────────────▲─────────────────────────────────────────────────┘  ║
╚══════════════════════════════════╪════════════════════════════════════════════════════╝
                                   │ link 2: architecture.md `company-kb:` + integration docs
╔══════════════════════════════════╪════════════════════════════════════════════════════╗
║  D. PROJECT REPO   ③ STATE (FACTS, this repo)                                         ║
║    .specify/memory/constitution.md   team rules / deviations from style guides       ║
║    specs/<feature>/  spec.md · plan.md · tasks.md   (task lines may carry touches:)   ║
║    docs/architecture.md  §3 components · §4 layers · §6 external deps                 ║
║    docs/integrations/<svc>.md ─────────────────────────────────────────────▶ C        ║
║    src/ …                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════ E. RUNTIME ════════════════════════════════════════╗
║   USER ◀─gates─▶ ORCHESTRATOR ══launch prompt══▶ ENGINEERING ──run──▶ TOOLS           ║
║                       │          (①②③ paths)        │  ▲            (cmd.lint/type/   ║
║                       │                              │  └─results──   test)           ║
║                       └══launch (review)══▶ REVIEWER (rules marked llm only, §7)      ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

**The three links:**

| Link | From → To | Mechanism | Example |
|---|---|---|---|
| 1 | A → B | `Source:` on an idiom; the "Reference topics" table in `stacks/<id>/index.md` | `TSN-12 … Source: knowledge/js-runtime/v8-hidden-classes.md` |
| 2 | D → C | `company-kb:` front-matter in `architecture.md`; a link in each `docs/integrations/<svc>.md` | `company-kb: companies/ots/repos/ne-shipment-api/` |
| 3 | C → B | a plain link inside a company KB doc | `companies/ots/infra/apigee.md` → `knowledge/apigee/proxies.md` |

There is **no A → C link**. The framework stays company-neutral, and company facts reach an agent only **through the project** (link 2).

**C vs. D overlap:** `docs/architecture.md` (D) is the source of truth for a repo's structure. The company KB repo entry (C) summarizes it and links to it; it never restates the YAML.

### 6.4 Reference topics: load on demand

A stack's `index.md` gets a **Reference topics** table. The **planner** (the tasks step) reads it and writes the matching topics on each task line as `refs:` (D7). The Orchestrator copies them into `state.references`, and the agent loads exactly those. Because of this, B can grow without making every launch bigger, and every load is visible in `tasks.md`. In standalone mode (§4.7) there is no plan, so the agent reads this table itself.

**Example — `stacks/typescript-node/index.md` (new section):**

```markdown
## Reference topics (load on demand)
| Topic | Load when | Path |
|---|---|---|
| V8 hidden classes & inline caches | task is marked hot-path, or performance review | {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md |
| Event-loop blocking | CPU-heavy work inside a request path | {{AGENT_HOME}}/knowledge/nodejs/event-loop.md |
```

**Example — a rule extracted from that reference, in `stacks/typescript-node/idioms.md`:**

```markdown
- TSN-12: In hot paths, initialize every field in the constructor and never add properties later
  (keeps one hidden class; avoids megamorphic inline caches). enforced-by: llm
  Source: knowledge/js-runtime/v8-hidden-classes.md
```

### 6.5 Language coding style

| Concern | Home | Checked by |
|---|---|---|
| Formatting (indent, quotes, line length) | the stack's `cmd.format` config | tool; never a review topic |
| Language conventions (PEP 8, Effective Go, Google TS style) | `stacks/<id>/index.md` slot `style_guide:` (a link) plus the subset that matters in `idioms.md` | lint where possible, otherwise LLM |
| Team deviations from the guide | repo `constitution.md` | as declared there |

**Example:** `| style_guide | https://google.github.io/styleguide/tsguide.html |`

### 6.6 Integration docs: `docs/integrations/<svc>.md`

One file for each external service the repo calls. It contains facts only. **Never put secret values in it.** List the env var *names* and where to obtain the values.

**Example — `docs/integrations/apigee-hr.md`:**

```markdown
---
schema: integration/v1
company-kb: companies/ots/infra/apigee.md
reference: knowledge/apigee/
---
# Integration: Apigee HR proxy
## Purpose          Fetch employee records to sync users.
## Endpoints        GET {APIGEE_BASE_URL}/hr/v2/employees?updatedSince=…
## Auth             Header x-api-key from env APIGEE_HR_KEY (obtain: platform team vault path, see company KB)
## Local setup      Sandbox env "test"; set APIGEE_BASE_URL=https://…-test…; mock: tests/fixtures/hr-employees.json
## Limits           100 req/min per key; 429 → retry with backoff, max 3
## Failure modes    5xx/timeout (5 s) → abort sync run, keep previous data, log `hr_sync_failed`
## Contract         v2; breaking changes announced by platform team (owner below)
## Owner            platform-integrations team
```

**Example — `docs/architecture.md` §6 (v2) row that points to it:**

```markdown
| Dependency | Kind | Used for | Doc |
|---|---|---|---|
| Apigee HR proxy | HTTP API | user sync | docs/integrations/apigee-hr.md |
```

### 6.7 Seeding B and A from books and online sources

The design books in References (Evans, Vernon, Meyer, Wlaschin) are **copyrighted**. Their text is never copied into either store. Instead, there are two steps:

1. **Reference notes (B):**
   - Written in our own words.
   - Built from **free, authoritative online sources** by the same authors or recognized experts.
   - Cite the book by chapter; never quote it.
2. **Rules (A):** short, own-words rules distilled from the notes. Each has an id, an `enforced-by` value, and a `Source:` link back to its note.

| Subject | Note (B) | Free sources to build from | Rules distilled into (A) |
|---|---|---|---|
| DDD tactical/strategic | `knowledge/software-design/ddd/` (aggregates, value objects, bounded contexts) | Evans' free *DDD Reference* summary; Fowler's bliki (DDD_Aggregate, BoundedContext, AnemicDomainModel) | `foundations/design/domain-driven-design.md` (DDD-*) |
| OO modeling | `knowledge/software-design/oop/` (encapsulation, Tell-Don't-Ask, design by contract) | Fowler's bliki (TellDontAsk); Eiffel/Meyer design-by-contract pages | `paradigms/class-modeled.md` (PDM-class-modeled-R*) |
| Functional modeling | `knowledge/software-design/functional-modeling/` (types as rules, railway errors, functional core) | Wlaschin's fsharpforfunandprofit.com articles; Bernhardt's Functional Core, Imperative Shell | `paradigms/functional-pipeline.md` (PDM-functional-pipeline-R*) |

**Example — a note line and the rule distilled from it:**

```markdown
# knowledge/software-design/ddd/aggregates.md   (B, explains)
An aggregate is a cluster of objects changed as one unit; outside code holds a reference
only to its root, so the root can guard every invariant. (Evans 2003, ch. 6; Fowler, bliki "DDD_Aggregate")

# foundations/design/domain-driven-design.md     (A, rule)
| DDD-8 | Change aggregate state only through the root's methods | enforced-by: llm | Source: knowledge/software-design/ddd/aggregates.md |
```

## 7. Enforcement: who checks a rule

Today almost every rule (ENG-R1..R9) is checked by an LLM reading the code. That is how rbac-demo's `idiom.di` violation passed review. `review/fitness-functions.md` already sets the target: *"If a rule can be a fitness function, it should be."* v2 makes this concrete. **Every rule declares how it is enforced:**

```
enforced-by: lint | test | script | llm
```

The rule (WHAT) lives in a stack-agnostic file. The concrete tool config (HOW) lives in the stack overlay. This keeps tool names out of shared files, which satisfies V6.

| Tier | Checker | When | On failure |
|---|---|---|---|
| 1 | Tools: `cmd.lint`, `cmd.typecheck`, `cmd.test_*`, architecture tests (FF-*) | Inside execute, before the agent replies | The agent fixes the code itself; the reviewer is not launched |
| 2 | Scripts: `validate-project.mjs` (architecture.md schema, required fields) | Orchestrator at P0 and P7 | Blocks the gate |
| 3 | LLM reviewer | review mode, after tiers 1–2 pass | `review-fail` with rule ids → relaunch execute |

The reviewer checks **only rules marked `llm`**. Over time, rules move from `llm` to `lint` or `test`.

**Example — `paradigms/class-modeled.md` (WHAT):**

```markdown
| Id | Rule | enforced-by |
|---|---|---|
| PDM-class-modeled-R1 | State is private; changed only through intention-named methods | lint |
| PDM-class-modeled-R2 | A type never mutates another type's data | llm |
| PDM-class-modeled-R3 | Use cases are types with constructor-injected ports | lint |
```

**Example — `stacks/typescript-node/paradigms/class-modeled.md` (HOW):**

```markdown
| Rule | Tool config |
|---|---|
| PDM-class-modeled-R1 | `@typescript-eslint/explicit-member-accessibility` + `prefer-readonly` on `src/domain/**` |
| PDM-class-modeled-R3 | `no-restricted-syntax: ExportNamedDeclaration > FunctionDeclaration` on `src/application/**` |
| FF-1 (layer deps)    | boundary rules generated from `docs/architecture.md` §4 `may-depend-on` |
```

## 8. End-to-end flow: one task, all stores

This is a hypothetical extension of the running example. **T021: "Add `SyncUsersFromHr` use case: fetch employees through the Apigee HR proxy and upsert users."** It touches an integration, so it exercises all five homes.

**Actors (6):**
- **User**: approves the plan and answers questions, through human gates in chat.
- **Orchestrator**: builds one launch prompt per task, from `docs/architecture.md` and `tasks.md`.
- **Engineering agent**: writes the code, from the launch prompt plus files it pulls itself.
- **Knowledge stores**: hold rules, references and facts, in homes A–D (§6.2).
- **Tools**: check the `lint`/`test` rules, through the stack's `cmd.*`.
- **Reviewer**: checks the `llm` rules, through a second launch in review mode.

**Artifact — the task line:**

```markdown
- [ ] T021 [US4] [Eng] Add SyncUsersFromHr use case (src/application/users/)
      touches: integration:apigee-hr · refs: none
```

The `touches:` and `refs:` lines are written **at planning time** (D7). The tasks step checks each task against architecture §6 (dependencies) and the stack's Reference topics table (§6.4), and lists every match. Here the planner saw the Apigee row in §6. It saw no hot-path, so it listed no V8 reference.

**Steps:**
1. **Orchestrator (local):** reads `docs/architecture.md`:
   - §3 → `api: stack typescript-node, framework express, paradigm class-modeled@1`;
   - §4 → layer `application`;
   - §6 → the row for `apigee-hr` → `docs/integrations/apigee-hr.md`.
2. **Orchestrator (local):** writes the launch prompt (§4.5). It copies `touches:` and `refs:` from the task line; it does not guess:
   ```yaml
   state:
     integrations: [docs/integrations/apigee-hr.md]
     references: []
   ```
3. **Orchestrator → Engineering (═══ agent-launch boundary ═══):** launches through the `sdlc-engineering` wrapper. The agent has no memory, so it knows only the packet.
4. **Engineering (local reads):**
   - Loads ① Preset (A1), then ② stack, framework and paradigm (A2), then ③ state (D), including every listed reference.
   - If the agent finds mid-task that it needs an unlisted topic (for example, the code turns out to be a hot path), it may read it, and it reports it under `open_questions` so the plan gets corrected.
   - From `apigee-hr.md` front-matter:
     - `reference:` → reads `knowledge/apigee/` (B);
     - `company-kb:` → reads `companies/ots/infra/apigee.md` (C).
5. **Engineering (local writes):**
   - Paradigm rules shape the code: `SyncUsersFromHr` is a class with a constructor-injected `HrDirectoryPort`.
   - Integration facts shape the adapter: reads env `APIGEE_HR_KEY`, retries on 429 at most 3 times, uses a 5 s timeout.
6. **Engineering → Tools (tier 1):** runs `cmd.lint` (which covers PDM-R1, PDM-R3 and FF-1), `cmd.typecheck` and `cmd.test_unit`.
   - On failure, it fixes the code and runs them again, with no reviewer involved.
7. **Engineering → Orchestrator:** returns an `artifact` message (§4.5 reply).
8. **Orchestrator → Reviewer (═══ agent-launch boundary ═══):** sends the same packet with `mode: review`. The reviewer checks only the `llm` rules (for example PDM-class-modeled-R2) and cites rule ids.
   - `review-fail` → back to step 3 with `context.feedback`;
   - `review-pass` → the task is ticked.
9. **P7 close-out (learning, open question 2):** each new insight is routed by its kind (§6.1):
   - an explanation → B;
   - a must-rule → A2 with `Source:`;
   - a company fact → C;
   - a repo fact → D.

**Diagram:**

```
 USER            ORCHESTRATOR                    ENGINEERING AGENT              TOOLS
  │ approve plan      │                                  │                         │
  │──────────────────▶│ read architecture.md §3,§4,§6     │                         │
  │                   │ read tasks.md (T021)              │                         │
  │                   │ resolve ① preset ② profiles ③ state                         │
  │                   │══ launch (execute) ══════════════▶│                         │
  │                   │                                  │ load ①②③ (A1, A2, D)    │
  │                   │                                  │ scan Reference topics   │
  │                   │                                  │  └ hot-path? no → skip V8
  │                   │                                  │ follow apigee-hr.md → B, C
  │                   │                                  │ write code              │
  │                   │                                  │────────────────────────▶│ lint/type/test
  │                   │                                  │◀── fail? fix & rerun ───│
  │                   │◀══ artifact ══════════════════════│                         │
  │                   │══ launch (review: llm rules) ════▶ REVIEWER                 │
  │                   │◀══ pass / fail(findings) ═════════                          │
  │                   │  fail → relaunch execute                                    │
  │◀── P7: route new insight by kind → B / A2 / C / D ──────────────────────────────│
```

## 9. Open questions (next round)

Resolved this round: `taxonomy.yaml` → D5, preset budget → D6, integration and reference detection → D7, system repo → D8, knowledge retrofit → D9.

1. **Enforcement coverage.** §7 defines the mechanism. Still open: the first list of rules to move from `llm` to `lint`/`test` for each stack.
2. **Learning loop.** How does the framework get smarter from finished projects without anyone editing files by hand?
   - Proposed flow:
     1. At P7 close-out, the Orchestrator collects lessons from review findings, repeated fixes and `open_questions`.
     2. It writes them to a ledger.
     3. A lesson seen in 2+ projects is proposed as a new rule (A2) or reference (B). The owner approves it at a gate.
   - Example: two repos both fail review on "`Role.permissions` is public". That lesson becomes a lint-enforced paradigm rule.
   - Source: `practice-packs.md` §6, plus the kind-based routing from §8 step 9.
3. **Keeping `refs:` and `touches:` honest.** `validate-project.mjs` can check that every `touches: integration:<x>` has a row in architecture §6, and every `refs:` path exists. It cannot check that the planner forgot nothing. Should a review rubric line ask "were all needed references listed?"

## 10. Next steps

1. ~~Schemas~~ ✅ done: `agentic-sdlc-v2/schemas/` (20 schemas + `_system.md`), `agentic-sdlc-v2/company-kb-changes/` (3 Company KB `system/` schemas, D8) and `agentic-sdlc-v2/knowledge-framework/` (store B: `knowledge-doc/v1`, `deep-dive/v1`, `topic-index/v1`).
2. ~~Framework summary~~ ✅ done: `agentic-sdlc-v2/README.md` (becomes the v2 `index.md`).
3. Owner review of the schema set and README.
4. Validators: design `validate.mjs` v2, `validate-project.mjs` and `validate-knowledge.mjs` from each schema's Checks table.
5. Seed B and A from free sources (§6.7): DDD, OOP and functional-modeling notes per `knowledge-doc/v1`, then the distilled rules with `Source:` links.
6. Migration:
   - rename bindings → stacks;
   - regroup the files into foundations;
   - update the validator and the wrappers (`user-invocable: true`);
   - apply `company-kb-changes/` to the company-kb framework (D8);
   - pilot on rbac-demo: rewrite `docs/architecture.md`, run PDM, refactor `Role`.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-architecture.md`: v1 design rationale.
- `proposals/practice-packs.md`: the superseded paradigm-axis draft.
- `copilot/frameworks/agentic-sdlc/conventions.md` §2–§4: v1 runtime model, routing and workflow.
- `copilot/frameworks/agentic-sdlc/schemas/repo-architecture.schema.md`, `binding.schema.md`, `agent-role.schema.md`, `message.schema.md`: the v1 schemas being restructured.
- `copilot/frameworks/agentic-sdlc/principles/bindings/typescript-node/index.md`: source of the real slot values in §4.3.
- `copilot/frameworks/agentic-sdlc/principles/contextual/architecture-pattern-selection.tree.md`: source of the tree excerpt in §5.2.
- `copilot/agents/sdlc-engineering.agent.md`: the `user-invocable: false` wrapper that §4.7 changes.
- `D:\Company\rbac-demo\docs\architecture.md`, `src/domain/role.ts`, `src/application/roles/roleUseCases.ts`: evidence for §1.
- `copilot/frameworks/agentic-sdlc/principles/meta/fitness-functions.md`: source of the "if a rule can be a fitness function, it should be" target and the FF-* catalog used in §7.
- `{{AGENT_HOME}}/knowledge/`: the existing global knowledge base (home B, §6.2).
- `{{AGENT_HOME}}/frameworks/company-kb/index.md`, `schemas/_system.md`, and `{{AGENT_HOME}}/companies/ots/`: the Company KB framework and its OTS instance (home C), which already documents Apigee usage.
- `{{AGENT_HOME}}/procedures/init-repo-kb.procedure.md`: how a repo gets its company KB entry.

**External authoritative sources:**
- [Claude Code subagents: `skills` frontmatter](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Agent Skills overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [github/spec-kit](https://github.com/github/spec-kit)
- [Martin Fowler: Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html)
- [Martin Fowler: Tell, Don't Ask](https://martinfowler.com/bliki/TellDontAsk.html)
- [Gary Bernhardt: Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
- [Neal Ford, Rebecca Parsons, Patrick Kua: *Building Evolutionary Architectures*, fitness functions](https://www.thoughtworks.com/insights/books/building-evolutionary-architectures)
- [ESLint: `no-restricted-syntax`](https://eslint.org/docs/latest/rules/no-restricted-syntax)
- [typescript-eslint: `explicit-member-accessibility`](https://typescript-eslint.io/rules/explicit-member-accessibility/)
- [V8 blog: Fast properties in V8 (hidden classes/shapes)](https://v8.dev/blog/fast-properties)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) · [PEP 8](https://peps.python.org/pep-0008/) · [Effective Go](https://go.dev/doc/effective_go)
- [The Twelve-Factor App: Config (env vars, no secrets in code)](https://12factor.net/config)
- [Eric Evans: *Domain-Driven Design Reference* (free summary)](https://www.domainlanguage.com/ddd/reference/)
- [Martin Fowler: DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) · [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html)
- [Scott Wlaschin: F# for Fun and Profit, domain modeling series](https://fsharpforfunandprofit.com/ddd/)
- Eric Evans, *Domain-Driven Design* (2003); Vaughn Vernon, *Implementing Domain-Driven Design* (2013); Bertrand Meyer, *Object-Oriented Software Construction* (2nd ed., 1997); Scott Wlaschin, *Domain Modeling Made Functional* (2018).

## Related

- `copilot/frameworks/agentic-sdlc/index.md`: the v1 framework overview.
- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md`: how role wrappers stay thin across tools.
- `copilot/patterns/explaining-mechanisms.pattern.md`: the structure used for §4.5's step-by-step resolution and §8.
- `{{AGENT_HOME}}/frameworks/company-kb/index.md`: the Company KB framework that §6 connects to.
