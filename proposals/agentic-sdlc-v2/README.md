---
schema: framework-index/v1
framework-version: 2.0.0-draft
status: draft
last-updated: 2026-10-04
target: "{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md"
---

# Agentic SDLC (v2)

A framework where one **Orchestrator** agent runs a software mission (new project, feature, fix or cross-repo change) through Spec Kit phases. It launches short-lived **role agents** (engineering, qa, security, …). Each agent gets exactly the knowledge it needs, in three layers:
- what it always knows (**preset**);
- what this part of the codebase uses (**profiles**: stack, paradigm, …);
- what this task is about (**state**).

Humans approve at gates. Tools check what they can; an LLM reviewer checks the rest.

> **Analogy:** a hospital. The Orchestrator is the charge nurse who assigns work. Role agents are locum specialists who arrive with their training (preset). They read the ward's equipment manual and treatment protocol (profiles) and today's patient chart (state). They leave when the job is done and remember nothing. Machines run the tests (tools). A senior doctor signs off (reviewer + human gate).

**How to read this file:** §1–§5 give the mental model. §6–§10 explain how it runs. §11–§15 are reference material. Any rule mentioned here is **defined** in the file it links to; this file only explains.

---

## 1. At a glance

```
                            ┌────────────────────────── HUMAN ──────────────────────────┐
                            │ mission ▼                         ▲ gates G0–G5 (approve) │
                            └─────────┼─────────────────────────┼───────────────────────┘
                                      ▼                         │
┌──────────── A. FRAMEWORK (rules) ────────────┐   ┌──────── ORCHESTRATOR (main session) ────────┐
│ conventions.md  roles + dimension registry   │──►│ P0 classify → P1…P7 phases                   │
│ agents/<role>.md   ① preset list per role    │   │ resolves ①②③ → writes LAUNCH PROMPT          │
│ foundations/<subject>/   ① preset docs       │   └───────┬──────────────────────────▲──────────┘
│ stacks/<id>/        ② stack profile          │           │ launch (one mode)         │ message
│ paradigms/<id>.md   ② paradigm profile       │           ▼                           │
│ trees/              decide-mode flowcharts   │   ┌──────── ROLE AGENT (fresh, no memory) ──────┐
│ schemas/            shape of every file      │──►│ loads ① preset  ② profiles  ③ state          │
└───────────┬──────────────────────────────────┘   │ propose | decide | execute | review         │
            │ Source: / Reference topics           └───────┬──────────────────────────┬──────────┘
            ▼                                              │ runs                     │ reads/writes
┌──── B. GLOBAL KNOWLEDGE (references) ────┐       ┌───────▼────────┐     ┌──────────▼──────────────────┐
│ {{AGENT_HOME}}/knowledge/<topic>/        │       │ TOOLS (tier 1) │     │ D. PROJECT REPO (facts)     │
│ "how it works, why" (V8, DDD, gRPC…)     │       │ cmd.lint/type/ │     │ docs/architecture.md  ②src  │
└───────────▲──────────────────────────────┘       │ test           │     │ docs/integrations/<svc>.md  │
            │ References                           └────────────────┘     │ .specify/ constitution      │
┌──── C. COMPANY KB (company facts) ───────┐                              │ specs/<feature>/ ③          │
│ {{AGENT_HOME}}/companies/<co>/           │◄── company-kb: / system.kb ──┤                             │
│ system/ = map BETWEEN repos (optional)   │                              │                             │
└──────────────────────────────────────────┘                              └─────────────────────────────┘
```

Read it as three flows:
1. **Control:** Human → Orchestrator → role agents → messages → gates.
2. **Knowledge:** A (rules) → B (references) ← C (company facts) ← D (repo facts).
3. **Checking:** tools first, then scripts, then the LLM reviewer.

---

## 2. Actors

| Id | Tag | Owns (one line) | Model tier | Trees | Defined in |
|---|---|---|---|---|---|
| `orchestrator` | — | The run: phases, launches, gates; never writes product code | Top | — | `agents/orchestrator.md` |
| `product-spec` | `[Spec]` | What to build: user stories, acceptance criteria, scope | Mid | SCOPE | `agents/product-spec.md` |
| `system-architecture` | `[SysArch]` | Everything *between* repos: context map, catalog, cross-repo features (in Company KB `system/`); contract-first ordering | Top | SA | `agents/system-architecture.md` |
| `architecture` | `[Arch]` | Structure *inside* one repo: components, layers, `docs/architecture.md` | Top | AP | `agents/architecture.md` |
| `tech-stack` | `[Stack]` | Language, framework, data store, toolchain | Mid | TS, TC | `agents/tech-stack.md` |
| `engineering` | `[Eng]` | How code is written inside architecture's boundaries; picks the paradigm | Mid | PDM | `agents/engineering.md` |
| `qa` | `[QA]` | Test bar and test depth; task-completion gate | Mid | TD | `agents/qa.md` |
| `security` | `[Sec]` | Risk tier, threat models; may block | Top | RT | `agents/security.md` |
| `devops` | `[Ops]` | CI/CD, environments, release and rollback; opens the PR | Mid | DT | `agents/devops.md` |

**Modes:** one per launch.

| Mode | Purpose | Example |
|---|---|---|
| `propose` | A preview for the blueprint (P1) | engineering: "class-modeled for `api`, confidence medium" |
| `decide` | Walk a tree and write a decision record | engineering walks PDM → `PDM-api` record |
| `execute` | Produce the artifact (code, spec, tests) | engineering implements T014 |
| `review` | Check an artifact against the rubric | engineering reviews T014 against `llm` rules |

**Hard rules** (defined in `conventions.md` §2):
- Only the Orchestrator launches agents.
- An agent has no memory between launches. Everything it needs is in the launch prompt or in files.

---

## 3. Knowledge kinds

Every piece of knowledge is exactly one of three kinds. **The kind decides where it lives.**

| Kind | Question it answers | Voice | Example | Lives in |
|---|---|---|---|---|
| **Rule** | What must I do? | "must / must not", checkable | `TSN-12` "Initialize all fields in the constructor, same order" | A |
| **Reference** | How does it work, and why? | explains, teaches | *V8 hidden classes and inline caches* | B |
| **Fact** | What is true about *our* system? | describes | "Apigee HR proxy: 100 req/min, key in `APIGEE_HR_KEY`" | C (company-wide) or D (this repo) |

**Test:** if it can fail a review, it is a Rule. If it is true for every user of the technology, it is a Reference. If it is about us, it is a Fact.

**Link rule:** a Rule cites its Reference (`Source:` column). A Reference never cites a Rule; the doc's *Used by* section is a generated backlink, not a dependency.

---

## 4. Knowledge homes

| Store | Path | Holds | Schema system | Loaded |
|---|---|---|---|---|
| **A1** Foundations | `frameworks/agentic-sdlc/foundations/<subject>/` | Stack-neutral rules: coding standards, design principles, DDD, … | `schemas/_system.md` | ① always (role's preset list) |
| **A2** Profiles | `stacks/<id>/`, `paradigms/<id>.md` | Rules for one stack or one paradigm, plus tool config | same | ② when the component uses it |
| **B** Global knowledge | `{{AGENT_HOME}}/knowledge/<topic>/` | References (concept, how-to, reference, case-study) | `frameworks/knowledge/schemas/_system.md` | ③ only when cited (`Source:`, `refs:`) |
| **C** Company KB | `{{AGENT_HOME}}/companies/<co>/` | Company facts: flows, infra, shared services; optional `system/` = context map, service catalog, cross-repo features (replaces the v1 system repo, D8) | `frameworks/company-kb/schemas/_system.md` (+ `company-kb-changes/`) | ③ via an integration doc's `company-kb:` link, or repo §2 `system.kb` for cross-repo work |
| **D** Project repo | `docs/`, `.specify/`, `specs/` | Repo facts, decisions, specs, tasks | `schemas/_system.md` §4.3 | ③ always (state) |
| runtime | in the chat | Launch prompts, messages | `launch-prompt`, `message` | never committed |

**Links between stores:**

| From → To | Mechanism | Example |
|---|---|---|
| A → B | `Source:` column on a rule; a stack's *Reference topics* table | `TSN-12` Source: `knowledge/js-runtime/v8-hidden-classes.md` |
| D → C | `company-kb:` front-matter in `docs/architecture.md` or an integration doc; §2 `system.kb` + `system.ref` | `apigee-hr.md` → `companies/ots/infra/apigee.md`; `system.kb` → `companies/ots/system/` |
| C → D | Service catalog `repo` and `provides` (contracts stay in provider repos) | `import-shipment: provides contracts/import.proto@2` |
| C → B | A Company KB doc's References section | an OTS flow cites `knowledge/grpc/stale-connection-keepalive.md` |
| A → C | **never** for content: framework rules stay company-neutral. The framework only uses C's *schemas* and finds C through D | — |

---

## 5. Loading model

```
LAUNCH ─► ① PRESET    static, per role        "who I am, what I always know"
          ② PROFILES  runtime, per component  "which stack, paradigm, …"
          ③ STATE     runtime, per task       "this project, this task"
```

| Layer | Resolved from | Example for engineering, task T014 in rbac-demo |
|---|---|---|
| ① Preset | `agents/engineering.md` → *Preset knowledge* table | `foundations/code/{coding-standards,error-handling,refactoring}.md`, `foundations/design/{design-principles,clean-architecture,domain-driven-design}.md`, `foundations/delivery/testing-strategy.md` |
| ② Profiles | `docs/architecture.md` §3 (component) and §4 (layer). The layer value wins, then the longest path match | `stack: typescript-node` → `stacks/typescript-node/{index,idioms}.md` + `frameworks/express.md`; `paradigm: class-modeled@1` → `paradigms/class-modeled.md` + `stacks/typescript-node/paradigms/class-modeled.md` |
| ③ State | The launch prompt, built by the Orchestrator from the task line | constitution, architecture, `specs/002-role-grants/*`, task line, `integrations: []`, `references: []` |

**Precedence** (defined in `conventions.md` §3, §7):
- On **form** (how code looks), the more specific layer wins: State > Paradigm > Stack > Preset.
- On **intent** (what must hold), Preset wins.
- If an agent can't satisfy both, it escalates; it doesn't guess.

> Example: the preset says "errors are explicit" (intent). The stack says "use `Result<T,E>` from `src/shared/result.ts`" (form). The constitution's style deviation says "throw `DomainError` in `src/legacy/**`" (form, more specific). Code in `src/legacy/` throws; code elsewhere returns `Result`. No intent is broken.

**No budget, no taxonomy** (D5, D6): the role's preset list *is* the routing. The profile registry decides ②. The task line decides which B docs and integrations are added to ③.

---

## 6. Profiles

A **profile dimension** is one axis along which a component can vary. Each dimension has four parts, registered in **one** YAML block in `conventions.md` §4:

```yaml
profile_dimensions:
  - { id: stack,     required_for: code, folder: stacks/,                    skill: sdlc-stack-<id>,    selected_by: tech-stack,  tree: TS,  layer_override: false }
  - { id: framework, required_for: none, folder: stacks/<stack>/frameworks/, skill: (in stack skill),   selected_by: tech-stack,  tree: TS,  layer_override: false }
  - { id: paradigm,  required_for: none, folder: paradigms/,                 skill: sdlc-paradigm-<id>, selected_by: engineering, tree: PDM, layer_override: true }
```

| Dimension | What it changes | Example values | Where the value is set |
|---|---|---|---|
| **stack** | Language, toolchain, idioms, commands | `typescript-node`, `python`, `go`, `rust` | `docs/architecture.md` §3 `stack:` |
| **framework** | Framework-specific placement and rules | `express`, `fastapi` | §3 `framework:` |
| **paradigm** | How the domain is modeled | `class-modeled`, `functional-pipeline` | §3 `paradigm:` or §4 per layer |

**Paradigm × stack:** a paradigm file says **what** (stack-neutral). Its overlay `stacks/<id>/paradigms/<pdm>.md` says **how** in that language, plus the lint config.

```
paradigms/class-modeled.md                         "State is private; change it only through intention-named methods"
stacks/typescript-node/paradigms/class-modeled.md  "private readonly fields; methods grant()/revoke(); eslint explicit-member-accessibility"
```

**Choosing a paradigm** (D3): engineering walks the `PDM` tree at P4 and records `PDM-<component>`. If the code gives no evidence, the Orchestrator asks the human at G0. The value is locked at G3.

---

## 7. Workflow

| Phase | Runs when | Owner(s) | Spec Kit | Output (committed) | Gate |
|---|---|---|---|---|---|
| **P0 Intake** | Every session | Orchestrator | — | Mission type; `validate-project.mjs` run | — |
| **P1 Blueprint** | New project/feature/cross-repo | All relevant roles, `propose` | — | `blueprint.md` | **G0** direction (+ paradigm question if unknown) |
| **P2 Constitution** | New project or amendment | architecture, engineering, qa, security | `/speckit-constitution` | `constitution.md` (+ framework sections) | **G1** principles |
| **P3 Specify** | Every feature | product-spec | `/speckit-specify`, `/speckit-clarify` | `spec.md` | **G2** spec |
| **P4 Plan** | Every feature | tech-stack, architecture, engineering (PDM), security, qa, devops in `decide` | `/speckit-plan` | `plan.md`, `research.md` (decision records) | **G3** plan (paradigm locked) |
| **P5 Tasks** | Every feature | Orchestrator, then qa | `/speckit-tasks`, `/speckit-analyze` | `tasks.md` with `touches:`/`refs:` lines | **G4** tasks |
| **P6 Implement** | Per task | owning role `execute` → tools → owning role `review` | `/speckit-implement` | code + `[X]` | automatic; escalate on repeated failure |
| **P7 Close-out** | Per feature | architecture (+ system-architecture), devops | — | updated `docs/architecture.md`, lessons, PR | **G5** merge |

**P0 classification** (first match wins): cross-repo → system-level flow in the Company KB · no `.specify/` → P1–P7 · new feature → P1, P3–P7 · behavior-changing fix → P3–P7 · fast-path fix → P6–P7.

**Cross-repo flow** (no system repo, D8):
1. P0 reads `companies/<co>/system/service-catalog.yaml` (path from the repo's §2 `system.kb`). More than one service touched → cross-repo.
2. P1, P3, P4 and P5 fill **one** doc, `companies/<co>/system/features/<id>.md`: blueprint, behaviour, contract changes, decisions and slices. Gates G0, G2, G3 and G4 apply to it.
3. Slice 0 is the contract change, merged in the **provider** repo first.
4. Each slice then runs P3–P7 as a normal Spec Kit feature in its own repo, with `mission_type: slice`.
5. System-level P7 updates `system/architecture.md` and the catalog, then bumps `system-ref`.

Details: `company-kb-changes/README.md`.

**Gate message format:** (1) what was produced, (2) what differs from the blueprint, (3) up to 3 open questions, (4) the exact reply that approves, e.g. `approve G3`.

---

## 8. One task end to end

**Task:** T021 "Add `SyncUsersFromHr`: fetch employees through the Apigee HR proxy and upsert users." It touches every store.

**Artifact — the task line** (`task-line/v1`, written at P5):

```markdown
- [ ] T021 [US4] Add SyncUsersFromHr use case (src/application/users/) [Eng] [llm]
      touches: integration:apigee-hr · refs: none · hot-path: no
```

**Steps:**

| # | Actor → Actor | What happens | Store touched |
|---|---|---|---|
| 1 | Orchestrator (local) | Reads architecture §3 (`api`: typescript-node, express, class-modeled@1), §4 (layer `application`), §6 (`apigee-hr` → doc) | D |
| 2 | Orchestrator (local) | Writes the launch prompt; **copies** `touches`/`refs` from the task line | runtime |
| 3 | Orchestrator → Engineering | ═══ launch, `mode: execute` ═══ | — |
| 4 | Engineering (local) | Loads ① preset, ② stack + framework + paradigm, ③ state + `docs/integrations/apigee-hr.md` | A1, A2, D |
| 5 | Engineering (local) | Follows `apigee-hr.md` front-matter: `reference:` → `knowledge/apigee/`; `company-kb:` → `companies/ots/infra/apigee.md` | B, C |
| 6 | Engineering (local) | Writes a `SyncUsersFromHr` class with a constructor-injected `HrDirectoryPort`; the adapter reads `APIGEE_HR_KEY`, retries on 429 at most 3 times, uses a 5 s timeout | code |
| 7 | Engineering → Tools | `cmd.lint` (PDM rules, FF-1), `cmd.typecheck`, `cmd.test_unit`; on failure it fixes and reruns | tier 1 |
| 8 | Engineering → Orchestrator | `message/v2`: `artifact` + `checks` + `references_used` + `unlisted_needs: []` | runtime |
| 9 | Orchestrator → Engineering | ═══ launch, `mode: review` ═══; checks only `llm` rules → `review-pass` / `review-fail` with rule ids | tier 3 |
| 10 | Orchestrator (P7) | Routes new lessons by kind: explanation → B, must-rule → A2 (with `Source:`), company fact → C, repo fact → D | all |

```
 ORCHESTRATOR                      ENGINEERING                  TOOLS        STORES
     │ read D (§3 §4 §6, tasks)        │                          │            │
     │══ launch execute ══════════════►│                          │            │
     │                                 │ load ① ② ③ ─────────────────────────►│ A1 A2 D
     │                                 │ follow apigee-hr.md ────────────────►│ B C
     │                                 │ write code               │            │
     │                                 │─────────────────────────►│ lint/type/test
     │                                 │◄──── fail? fix, rerun ───│            │
     │◄═ artifact + checks ════════════│                          │            │
     │══ launch review (llm rules) ═══►│                          │            │
     │◄═ pass | fail(rule ids) ════════│                          │            │
```

---

## 9. Enforcement

Every rule has an `Enforced by` value (`schemas/_system.md` §1.4): `lint` · `typecheck` · `test` · `script` · `llm`.

| Tier | Checker | When | On failure |
|---|---|---|---|
| 1 | Tools: the stack's `cmd.*`, plus architecture tests | Inside `execute`, before the agent replies | The agent fixes the code itself |
| 2 | Scripts: `validate.mjs` (framework files), `validate-project.mjs` (repo files: architecture.md fields, task lines, integration docs) | P0 and P7; CI | Blocks the gate |
| 3 | LLM reviewer | `review` mode, after tiers 1–2 pass | `review-fail` with rule ids → a new `execute` launch |

**WHAT vs HOW:** a stack-neutral file states the rule and its intended mechanism. The stack or overlay *Enforcement* table gives the concrete tool config. Tool names never appear outside `stacks/`.

```markdown
paradigms/class-modeled.md                          | PDM-class-modeled-R1 | State is private … | lint |
stacks/typescript-node/paradigms/class-modeled.md   | PDM-class-modeled-R1 | @typescript-eslint/explicit-member-accessibility on src/domain/** |
```

The goal over time: rules move from `llm` to `lint`/`test`. The reviewer's job shrinks to what tools can't judge.

---

## 10. Standalone use

Every role can be invoked directly, with no Orchestrator or Spec Kit flow (wrappers are `user-invocable: true`). The agent builds its own launch prompt:

| Layer | Standalone source |
|---|---|
| ① Preset | Its role file (unchanged) |
| ② Profiles | `docs/architecture.md` if present; otherwise detected from manifests (`package.json` → typescript-node); paradigm from the request or asked |
| ③ State | Whatever the user names: files, a diff, a PR |

**Example:** "`@sdlc-engineering` review `src/domain/role.ts` against class-modeled."
- It resolves: preset = engineering list; stack = typescript-node; paradigm = class-modeled (from the request).
- It runs `cmd.lint` on the file, then checks the `llm` rules.
- It replies with a `message/v2` `review-fail` listing rule ids and locations.

---

## 11. Learning loop

> _Open question 2._ The proposed flow:

1. At P7, the Orchestrator collects lessons from review findings, repeated tool failures and `unlisted_needs`.
2. It routes each lesson by kind (§3). Lessons that would become rules go to a ledger.
3. A lesson seen in 2+ projects is proposed as an A2 rule (with a B `Source:`), and the owner approves it.

Knowledge docs feed this too: a `[rule-candidate]` takeaway in a B doc is a pre-written proposal.

---

## 12. File map

| Store | File | Schema |
|---|---|---|
| A | `schemas/_system.md` | `schema-system/v1` |
| A | `index.md` (this file) | `framework-index/v1` |
| A | `conventions.md` | `conventions/v2` |
| A | `agents/<role>.md` | `agent-role/v2` |
| A | wrappers: `copilot/agents/sdlc-<role>.agent.md`, `claude/agents/sdlc-<role>.md`, `codex/agents/sdlc-<role>.toml` | `role-wrapper/v1` |
| A | `skills/*/SKILL.md` | `skill-wrapper/v1` |
| A1 | `foundations/<subject>/<name>.md` | `foundation/v2` |
| A2 | `stacks/<id>/index.md` | `stack/v2` |
| A2 | `stacks/<id>/idioms.md` | `stack-idioms/v1` |
| A2 | `stacks/<id>/frameworks/<fw>.md` | `stack-framework/v1` |
| A2 | `stacks/<id>/paradigms/<pdm>.md` | `stack-paradigm/v1` |
| A2 | `paradigms/<id>.md` | `paradigm/v1` |
| A | `trees/<name>.tree.md` | `tree/v2` |
| runtime | launch prompt | `launch-prompt/v1` |
| runtime | role reply | `message/v2` |
| D | `docs/architecture.md` | `repo-architecture/v2` |
| D | `docs/integrations/<svc>.md` | `integration/v1` |
| D | `.specify/memory/constitution.md` (framework sections) | `constitution-sdlc/v1` |
| D | `specs/<feature>/tasks.md` (task-line suffix) | `task-line/v1` |
| D | `specs/<feature>/blueprint.md` | `blueprint/v2` |
| D | `specs/<feature>/research.md` (records) | `decision-record/v2` |
| C | `companies/<co>/system/architecture.md` | `system-architecture` (company-kb, new) |
| C | `companies/<co>/system/service-catalog.yaml` | `service-catalog` (company-kb, new) |
| C | `companies/<co>/system/features/<id>.md` | `cross-repo-feature` (company-kb, new) |
| B | `knowledge/<topic>/<slug>.md` (**new docs only**; legacy docs exempt) | `knowledge-doc/v1`, or `deep-dive/v1` for free-form deep dives synthesized into knowledge-docs (knowledge framework) |
| B | `knowledge/**/index.md` (folders with at least one v1 doc) | `topic-index/v1` (knowledge framework) |
| C | `companies/<co>/**` (other folders) | company-kb schemas (existing) |

Removed in v2: `taxonomy.yaml` (D5), `binding` (renamed → `stack`, D1), the system repo (D8).

---

## 13. How to extend

**Add a role** (e.g. `perf-benchmark`):
1. `conventions.md` §1: add a YAML row (id, tag `[Perf]`, tier, owns, file).
2. `agents/perf-benchmark.md` per `agent-role/v2`: Preset list, Runtime inputs, Modes, rubric prefix `PERF-R`.
3. Preset docs it needs that don't exist yet: `foundations/quality/performance-efficiency.md` (exists) or new ones per `foundation/v2`.
4. Three wrappers per `role-wrapper/v1`, and a `sdlc-perf-benchmark-preset` skill.
5. `conventions.md` §5: the phases it joins (e.g. P4 `decide`, P6 `review` on `hot-path: yes` tasks).
6. If it decides things: `trees/benchmark-depth.tree.md` per `tree/v2`.
7. Run `validate.mjs`.

**Add a stack** (e.g. `kotlin-jvm`):
1. `stacks/kotlin-jvm/index.md` (`stack/v2`: detect-by, slots, `cmd.*`, Reference topics).
2. `idioms.md` (`stack-idioms/v1`, prefix `KTJ`).
3. Overlays for each supported paradigm: `paradigms/class-modeled.md`, … (`stack-paradigm/v1`).
4. `skills/sdlc-stack-kotlin-jvm/SKILL.md`.
5. A TS-tree leaf that can select it.

**Add a paradigm** (e.g. `actor-model`):
1. `paradigms/actor-model.md` (`paradigm/v1`).
2. An overlay in each stack that supports it.
3. A leaf in `trees/paradigm-selection.tree.md`.
4. The skill.

**Add a foundation:** `foundations/<subject>/<name>.md` (`foundation/v2`, new rule prefix), then add it to every role's Preset table that needs it.

**Add a profile dimension** (e.g. `compliance`): one YAML row in `conventions.md` §4, the folder, a selection tree, the skill pattern, and a field in `repo-architecture` §3/§4.

**Add a knowledge doc:**
1. Pick a type.
2. Write `knowledge/<topic>/<slug>.md` per `knowledge-doc/v1`.
3. Add a row to the topic `index.md`.
4. If a takeaway is a must-rule, add it to A with `Source:`.

**Add an integration (per repo):**
1. `docs/integrations/<svc>.md` per `integration/v1`.
2. Add a row in architecture §6 with a Doc link.
3. Tasks that call it carry `touches: integration:<svc>`.

---

## 14. Glossary

| Term | Meaning | Example |
|---|---|---|
| **Preset** (①) | The fixed list of foundation docs a role always loads | engineering's 7 docs |
| **Profile** (②) | Knowledge picked per component or layer along a dimension | `stack: typescript-node` |
| **State** (③) | Project and task files for this launch | `specs/002-role-grants/plan.md` |
| **Foundation** | A stack-neutral rule doc, grouped by subject | `foundations/design/domain-driven-design.md` |
| **Stack** | Language + toolchain profile (v1: "binding") | `stacks/python/` |
| **Paradigm** | A modeling style, independent of stack | `class-modeled`, `functional-pipeline` |
| **Overlay** | A stack × paradigm file mapping WHAT to HOW | `stacks/typescript-node/paradigms/class-modeled.md` |
| **Tree** | A decide-mode flowchart that ends in a choice | `trees/paradigm-selection.tree.md` (PDM) |
| **Decision record** | The result of a tree walk, with rejected options | `PDM-api` in `research.md` |
| **Launch prompt** | The packet the Orchestrator hands an agent | `launch-prompt/v1` YAML |
| **Gate** | A human approval point | `approve G3` |
| **Rule / Reference / Fact** | The three knowledge kinds (§3) | `TSN-12` / V8 doc / Apigee limits |
| **Integration doc** | Repo fact sheet for one external service | `docs/integrations/apigee-hr.md` |
| **Enforced by** | Which tier checks a rule | `lint` |

---

## 15. Status & decisions

**Version:** 2.0.0-draft. Design **approved 2026-10-04**. Migration to `frameworks/agentic-sdlc/` pending; the Company KB `system/` part (D8) is already live.

| Id | Decision |
|---|---|
| D1 | "binding" is renamed **stack** |
| D2 | Paradigm is its own profile dimension, not a field of stack |
| D3 | Paradigm is inferred, or asked at G0, and locked at G3 (`PDM-<component>` record) |
| D4 | The design round came first (approved 2026-10-04); framework files change only through the migration steps |
| D5 | `taxonomy.yaml` is removed; routing = preset lists + profile registry + task lines |
| D6 | No preset file budget |
| D7 | `touches:` / `refs:` are written on task lines at P5 and copied into the launch prompt |
| D8 | No separate system repo. The context map, service catalog and cross-repo features live in the Company KB `system/` folder; contracts stay in provider repos |
| D9 | Knowledge schemas apply to new docs only. Existing `knowledge/` docs are legacy: kept as-is, never retrofitted, skipped by the validator |
| D10 | Deep dives (deep-dive/v1) keep a free body under a fixed envelope, and are synthesized into knowledge-doc/v1 docs linked both ways; legacy docs may be synthesis sources |

**Open questions:**
1. Enforcement coverage: the first rules to move from `llm` to tools, per stack.
2. Learning loop: the ledger format and promotion gate (§11).
3. Keeping `refs:`/`touches:` honest: should a rubric line ask "were all needed references listed?"

**Known gaps:**
- The Company KB `infra` docs have no strict schema yet.
- The Company KB lives in agent-config, so teammates who don't use it can't see `system/` docs (D8 trade-off). Contracts and slice specs remain in product repos.

## References

**Local:**
- `schemas/_system.md` and every `schemas/*.schema.md` in this folder
- `knowledge-framework/index.md` and `knowledge-framework/schemas/*`
- `company-kb-changes/README.md`: design rationale for the Company KB `system/` folder (D8, **applied** 2026-10-04 to `{{AGENT_HOME}}/frameworks/company-kb/schemas/{system-architecture,service-catalog,cross-repo-feature}.schema.md`)
- `../agentic-sdlc-v2-structure.md`: the design rationale (§1–§10)
- `copilot/frameworks/agentic-sdlc/index.md`, `conventions.md`: v1
- `{{AGENT_HOME}}/frameworks/company-kb/index.md`

**External:**
- [github/spec-kit](https://github.com/github/spec-kit): the phases and commands
- [Diátaxis](https://diataxis.fr/): knowledge-doc types
- [Claude Code subagents](https://docs.claude.com/en/docs/claude-code/sub-agents) · [Agent Skills overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview): wrappers and skills
- [Building Evolutionary Architectures (fitness functions)](https://www.thoughtworks.com/insights/books/building-evolutionary-architectures): enforcement tiers
- [Martin Fowler: Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html): why the paradigm axis exists

## Related

- `{{AGENT_HOME}}/patterns/shared-procedure-thin-wrapper.pattern.md`
- `{{AGENT_HOME}}/patterns/explaining-mechanisms.pattern.md`
- `../practice-packs.md` (superseded)
