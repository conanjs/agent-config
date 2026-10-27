---
schema: framework-index/v1
last-updated: 2026-10-27
framework-version: 2.0.0
status: active
---
# Agentic SDLC (v2)

Agentic SDLC is a framework where one Orchestrator runs a software mission through Spec Kit phases and launches short-lived role agents. Each role receives three layers of knowledge: ① preset foundations, ② runtime profiles, and ③ project state. Analogy: a hospital shift — the charge nurse assigns specialists, specialists bring training, read the ward manual, check the patient chart, and leave after the job.

## 1. At a glance
```text
Human → Orchestrator → role launch prompt → role agent → message → gate
                  │              │
                  │              ├─ ① Preset: agents/<role>.md + foundations/
                  │              ├─ ② Profiles: stacks/ and paradigms/
                  │              └─ ③ State: docs/, specs/, integrations, references
                  └─ validates workflow, budgets, conflicts, and gates
```

The framework keeps rules in Store A, broad references in Store B, company facts in Store C, and repo facts in Store D.

## 2. Actors
| Id | Tag | Owns | Model tier | Trees | Defined in |
|---|---|---|---|---|---|
| orchestrator | — | Phases, launch prompts, gates, conflicts, budgets | Top | — | agents/orchestrator.md |
| product-spec | [Spec] | User stories, acceptance criteria, scope | Mid | SCOPE | agents/product-spec.md |
| system-architecture | [SysArch] | Cross-repo context, catalog, contracts, ownership | Top | CC | agents/system-architecture.md |
| architecture | [Arch] | Components, layers, dependency direction, architecture docs | Top | AP | agents/architecture.md |
| tech-stack | [Stack] | Stack, framework, data store, toolchain | Mid | TS, TC | agents/tech-stack.md |
| engineering | [Eng] | Code implementation and paradigm selection | Mid | PDM | agents/engineering.md |
| qa | [QA] | Testing bar, test depth, consistency | Mid | TD | agents/qa.md |
| security | [Sec] | Risk tier, threat model, security veto | Top | RT | agents/security.md |
| devops | [DevOps] | CI/CD, environments, release, rollback, PR | Mid | DT | agents/devops.md |

Modes are `propose`, `decide`, `execute`, and `review`; every launch uses exactly one.

## 3. Knowledge kinds
| Kind | Answers | Example | Home |
|---|---|---|---|
| Rule | What must hold? | A review or design rule with an id | A |
| Reference | How/why does it work? | Technology or design background | B |
| Fact | What is true for this company or repo? | Service ownership, endpoint, env var name | C or D |

If a statement can fail a review, it is a Rule. If it explains a concept generally, it is a Reference. If it is about one organization or repository, it is a Fact.

## 4. Knowledge homes
| Store | Path | Holds | Loaded as |
|---|---|---|---|
| A1 Foundations | frameworks/agentic-sdlc/foundations/<subject>/ | Stack-neutral rules | ① preset |
| A2 Profiles | frameworks/agentic-sdlc/stacks/<id>/ and paradigms/<id>.md | Stack and paradigm rules | ② profile |
| B Global knowledge | {{AGENT_HOME}}/knowledge/<topic>/ | References | ③ state when cited |
| C Company KB | {{AGENT_HOME}}/companies/<company>/ | Company facts and optional system maps | ③ state through repo links |
| D Project repo | docs/, .specify/, specs/ | Repo facts and mission artifacts | ③ state |
| Stack procedures | {{AGENT_HOME}}/procedures/<stack>/ | Bounded, step-by-step code tasks for one stack (inputs, steps, `allowed-paths`) | ③ state, when a task line names one (`procedure:`) |
| Runtime | chat | Launch prompts and role messages | not committed |

A rules file may cite B as `Source:`. A repo fact may point to C through `company-kb:`. The framework never hardcodes company facts.

## 5. Loading model
```text
① PRESET    static per role        → foundations listed in agents/<role>.md
② PROFILES  runtime per component  → stack/framework/paradigm from docs/architecture.md
③ STATE     runtime per task       → launch prompt paths and retry context
```

Precedence on form is State > Paradigm > Stack > Preset. Precedence on intent is Preset first. If form and intent cannot both hold, the role escalates.

## 6. Profiles
Profile dimensions are registered once in conventions.md §4.

| Dimension | What it changes | Where set | Selected by |
|---|---|---|---|
| stack | language/toolchain/profile slots | docs/architecture.md §3 | tech-stack |
| framework | framework-specific placement and idioms | docs/architecture.md §3 | tech-stack |
| paradigm | modelling style for state, behaviour, effects, and errors | docs/architecture.md §3 or §4 | engineering |

Paradigm is independent of stack. A paradigm file states what must hold; a stack overlay states how that appears for a particular stack.

## 7. Workflow
| Phase | Runs when | Main owners | Output | Gate |
|---|---|---|---|---|
| P0 Intake | every session | orchestrator | mission type, profile detection, validation notes | — |
| P1 Blueprint | new project/feature/cross-repo | relevant roles | blueprint.md | G0 |
| P2 Constitution | new project/amendment | architecture, engineering, qa, security | constitution clauses | G1 |
| P3 Specify | every feature/behaviour fix | product-spec | spec.md | G2 |
| P4 Plan | every feature | tech-stack, architecture, engineering, security, qa, devops | plan.md, research.md | G3 |
| P5 Tasks | every feature | orchestrator, qa | tasks.md | G4 |
| P6 Implement | per task | owning role plus reviewers | changed artifacts and completed task | automatic |
| P7 Close-out | per feature | architecture, system-architecture when needed, devops | architecture updates and PR | G5 |

Fast-path fixes skip to P6 only when no specified behaviour, contract/API shape, risk, or dependency decision changes.

## 8. One task end to end
Example flow for one engineering task:

| Step | Actor | Action | Data |
|---|---|---|---|
| 1 | Orchestrator | Finds component/layer for the task path | docs/architecture.md |
| 2 | Orchestrator | Copies `touches:`, `refs:` and `procedure:` (+ `inputs:`) from task line | tasks.md |
| 3 | Orchestrator | Builds `launch-prompt/v1` | runtime |
| 4 | Role | Loads preset, profiles, and state | A1, A2, D |
| 5 | Role | Follows listed integrations/references only | B, C, D |
| 6 | Role | Produces artifact and runs profile checks; with a procedure, follows its steps and reports each one | repo |
| 6b | Orchestrator | With a procedure, runs `validate-project.mjs <repo> --task <Tnnn>`: every changed file must be inside the procedure's `allowed-paths` | repo |
| 7 | Reviewer | Checks only remaining `llm` rules | message/v2 |
| 8 | Orchestrator | Marks task, retries, or escalates | tasks.md/gate |

Worked example: a task touching an external integration lists `touches: integration:hr-directory`; the launch prompt includes `state.integrations: [docs/integrations/hr-directory.md]`. The role follows that doc to any company and reference facts.

Worked example with a procedure: at P5 the planner matches "Add Clock port and SystemClock adapter" against `procedures/typescript-node/index.md` ("A use case needs a new capability from outside the core") and writes `procedure: typescript-node/add-port-and-adapter` with `inputs: capability=tell the time; technology=system clock; use-case=ExpireSessions`. The launch prompt carries `state.procedure`; the role follows the ten steps and changes only `src/application/**`, `src/infrastructure/**`, `src/CompositionRoot.ts`, `test/**` and the listed docs. A change to `src/domain/` fails the scope check.

## 9. Enforcement
| Tier | Checker | When |
|---|---|---|
| 1 | active profile checks | role execute before reply |
| 2 | framework/project scripts | P0, P7, and CI |
| 3 | LLM reviewer | review mode after tiers 1-2 pass |

Every rule declares `Enforced by`: `lint`, `typecheck`, `test`, `script`, or `llm`. Concrete tool names live in stack/profile files, not in shared role files.

## 10. Standalone use
Every non-Orchestrator role wrapper can be invoked directly. The role still loads its Preset, then resolves profiles from the request, docs/architecture.md, detected manifests, or by asking. With no Spec flow, spec-dependent checks become `n/a` rather than failures. Standalone roles report or execute only the named scope and never launch other agents.

## 11. Learning loop
Open design item: at P7, the framework should collect lessons from repeated review failures, check failures, and unlisted knowledge needs. Lessons are routed by kind: explanations to B, must-rules to A2 with sources, company facts to C, and repo facts to D. Promotion into rules should require owner approval.

## 12. File map
| Store | File | Schema |
|---|---|---|
| A | schemas/_system.md | schema-system/v1 |
| A | index.md | framework-index/v1 |
| A | conventions.md | conventions/v2 |
| A | agents/<role>.md | agent-role/v2 |
| A | copilot/agents, claude/agents, codex/agents wrappers | role-wrapper/v1 |
| A | skills/*/SKILL.md | skill-wrapper/v1 |
| A1 | foundations/<subject>/<name>.md | foundation/v2 |
| A2 | stacks/<id>/index.md | stack/v2 |
| A2 | stacks/<id>/idioms.md | stack-idioms/v1 |
| A2 | stacks/<id>/frameworks/<fw>.md | stack-framework/v1 |
| A2 | stacks/<id>/paradigms/<pdm>.md | stack-paradigm/v1 |
| A2 | paradigms/<id>.md | paradigm/v1 |
| A | trees/<name>.tree.md | tree/v2 |
| A | tools/validate.mjs | framework validator: every store A file above |
| A | tools/validate-project.mjs | project repo validator for Store D schemas: `node tools/validate-project.mjs <repo>` |
| B | `{{AGENT_HOME}}/knowledge/**` | knowledge-doc/v1, deep-dive/v1, topic-index/v1 (`{{AGENT_HOME}}/frameworks/knowledge/`; checked by its `tools/validate-knowledge.mjs`) |
| runtime | launch prompt | launch-prompt/v1 |
| runtime | role reply | message/v2 |
| D | docs/architecture.md | repo-architecture/v2 |
| D | docs/integrations/<svc>.md | integration/v1 |
| D | .specify/memory/constitution.md framework sections | constitution-sdlc/v1 |
| D | specs/<feature>/tasks.md suffix (`touches:`, `refs:`, `procedure:`, `inputs:`) | task-line/v1 |
| — | `{{AGENT_HOME}}/procedures/<stack>/<slug>.procedure.md` + `index.md` catalog | procedure/v1 (`{{AGENT_HOME}}/procedures/procedure.schema.md`; checked by `procedures/tools/validate-procedures.mjs`) |
| D | specs/<feature>/blueprint.md | blueprint/v2 |
| D | specs/<feature>/research.md records | decision-record/v2 |

## 13. How to extend
1. Add a role: update conventions.md §1, create agents/<id>.md, wrappers, preset skill, and any tree/foundation docs it needs.
2. Add a stack: add stacks/<id>/index.md, idioms.md, overlays, skill, and TS tree leaf.
3. Add a paradigm: add paradigms/<id>.md, stack overlays, skill, and PDM tree leaf.
4. Add a foundation: create foundations/<subject>/<name>.md and add it to role Preset tables deliberately.
5. Add a profile dimension: add one conventions.md §4 row, folder, tree, skill pattern, and architecture field support.
6. Add a knowledge doc: write the Store B doc under its schema and cite it from rules or task `refs:`.
7. Add an integration: create docs/integrations/<svc>.md, add architecture §6 row, and list `touches:` on tasks.
8. Add a stack procedure: write `{{AGENT_HOME}}/procedures/<stack>/<slug>.procedure.md` (`procedure/v1` with `stack`, `inputs`, `allowed-paths`), add a "Use when" row to that folder's `index.md`, and point to it from `stacks/<stack>/index.md`. The planner can then assign it with `procedure:`.

## 14. Glossary
| Term | Meaning |
|---|---|
| Preset | Role's fixed foundation docs |
| Profile | Runtime rules selected per component or layer |
| State | Project and task facts for one launch |
| Foundation | Stack-neutral framework rule doc |
| Stack | Language/toolchain profile |
| Framework | Optional framework-specific profile under a stack |
| Paradigm | Modelling style such as class-modeled or functional-pipeline |
| Overlay | Stack-specific mapping for a paradigm |
| Tree | Decide-mode question flow with node ids |
| Decision record | Recorded result of a tree walk |
| Launch prompt | Runtime work order sent to a role |
| Gate | Human approval point |
| Rule / Reference / Fact | Knowledge kinds for stores A/B/C/D |

## 15. Status & decisions
Version 2.0.0 is live and active. Phase 1 migration completed 2026-10-04 for the live framework files in this scope.

Decisions: D1 stack naming; D2 paradigm as its own dimension; D3 paradigm inferred or asked at G0 and locked at G3; D4 design approved before migration; D5 routing via Preset plus profiles plus state; D6 no Preset cap; D7 `touches:` and `refs:` copied from task lines; D8 system context in Company KB; D9 legacy knowledge docs are not retrofitted; D10 deep dives synthesize into structured knowledge docs; D11 (2026-10-27) stack procedures are bounded task scopes assigned on task lines (`procedure:`) and checked by `validate-project.mjs --task` (`{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-repos-and-procedures.md` Part B).

Completed 2026-10-04 after phase 1: `validate-project.mjs`; the knowledge framework deployed with `validate-knowledge.mjs`; 23 verified knowledge docs seeded (OOP, DDD, functional modeling, JS runtime, concurrency, error handling, operations, web APIs), so every paradigm and stack runtime rule has a `Source`; rbac-demo piloted on the v2 store D schemas (paradigm `functional-pipeline@1`, kept under PDM-Q1); OTS Company KB `system/` created.

Open: the learning loop (open question 2: the learning ledger and `[rule-candidate]` promotion); filling the OTS `system/` TODOs (owners, contract versions, auth); synthesizing the legacy `grpc/stale-connection-keepalive.md` into typed docs.

## References
**Local artifacts:**
- `schemas/_system.md`: schema registry and path conventions.
- `conventions.md`: operating rules summarized here.
- `agents/`: role definitions.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-v2/README.md`: source summary for this index.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-v2-structure.md`: approved v2 design and decisions.
- `{{AGENT_HOME}}/frameworks/company-kb/index.md`: sibling framework for Company KB facts.
**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit): Spec-driven workflow used by the framework.
- [Diátaxis](https://diataxis.fr/): documentation categories used by the knowledge framework (`{{AGENT_HOME}}/frameworks/knowledge/index.md`).
- [Agent Skills overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview): skill wrapper concept.

## Related
- `conventions.md`: authoritative workflow and registry.
- `schemas/_system.md`: authoritative schema registry.
- `trees/`: decision trees.
- `stacks/` and `paradigms/`: runtime profiles.