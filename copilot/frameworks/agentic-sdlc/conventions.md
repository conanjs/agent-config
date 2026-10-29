---
schema: conventions/v2
last-updated: 2026-10-27
---
# Agentic SDLC — Conventions

The operating rules of the framework. Every role follows this file; the Orchestrator enforces it. The framework uses three loading layers: ① Preset, ② Profiles, and ③ State.

## 1. Roles
```yaml
roles:
  - { id: orchestrator, tag: "—", tier: Top, owns: "Intake, launch prompts, gates, conflict precedence, budgets", file: agents/orchestrator.md }
  - { id: product-spec, tag: "[Spec]", tier: Mid, owns: "Requirements, user stories, acceptance criteria, scope", file: agents/product-spec.md }
  - { id: system-architecture, tag: "[SysArch]", tier: Top, owns: "Between repos: context map, service catalog, contracts, data ownership", file: agents/system-architecture.md }
  - { id: architecture, tag: "[Arch]", tier: Top, owns: "Inside one repo: components, layers, dependency direction, architecture docs", file: agents/architecture.md }
  - { id: tech-stack, tag: "[Stack]", tier: Mid, owns: "Stack, framework, data store, dependency, and toolchain choices", file: agents/tech-stack.md }
  - { id: engineering, tag: "[Eng]", tier: Mid, owns: "Code implementation within architecture boundaries and paradigm selection", file: agents/engineering.md }
  - { id: qa, tag: "[QA]", tier: Mid, owns: "Testing bar, test depth, test tasks, consistency analysis", file: agents/qa.md }
  - { id: security, tag: "[Sec]", tier: Top, owns: "Risk tier, threat model, security review, veto on fail-open", file: agents/security.md }
  - { id: devops, tag: "[DevOps]", tier: Mid, owns: "CI/CD, environments, deployment topology, release, rollback, PR", file: agents/devops.md }
  - { id: coordinator, tag: "[Coord]", tier: Mid, owns: "The atlas: where every file is, what checks it, where a request starts", file: agents/coordinator.md }
```

## 2. Runtime model
1. Only the Orchestrator launches role instances and script workers. Roles never launch other agents.
2. Every role runs in exactly one mode per launch:
   - `mode: propose` — P1 blueprint input.
   - `mode: decide` — walk owned decision trees and record decisions.
   - `mode: execute` — produce the assigned artifact for one task.
   - `mode: review` — check output against that role's rubric.
3. Executor types: `[llm]` tasks run as roles in execute mode; `[script]` tasks run active profile slots exactly as declared.
4. Instances remember nothing. Every launch carries role, mode, profiles, state paths, retry context, and output schema.

## 3. Loading model
1. ① Preset: the role file's `## Preset knowledge` table. It contains only `foundations/` paths and has no budget cap.
2. ② Profiles: stack, framework, paradigm, and future dimensions resolved from docs/architecture.md component/layer entries.
3. ③ State: project and task facts in the launch prompt: constitution, architecture, spec, plan, research, tasks, integrations, references, procedure, review target, and retry feedback.
4. Precedence on form: State > Paradigm > Stack > Preset. Precedence on intent: Preset wins. If both cannot be satisfied, escalate.
5. The Orchestrator copies `touches:`, `refs:` and `procedure:` (with `inputs:`) from task lines; it does not guess integrations, reference docs or procedures. A procedure is chosen once, by the planner at P5 against the stack's procedure catalog, approved at G4, and checked at P6 with `validate-project.mjs --task` (D11).

## 4. Profile-dimension registry
```yaml
profile_dimensions:
  - { id: stack, required_for: code, folder: stacks/, skill: sdlc-stack-<id>, selected_by: tech-stack, tree: TS, layer_override: false }
  - { id: framework, required_for: none, folder: stacks/, skill: sdlc-stack-<id>, selected_by: tech-stack, tree: TS, layer_override: false }
  - { id: paradigm, required_for: none, folder: paradigms/, skill: sdlc-paradigm-<id>, selected_by: engineering, tree: PDM, layer_override: true }
```

## 5. Workflow
| Phase | Runs when | Owner(s) | Spec Kit command | Output | Gate |
|---|---|---|---|---|---|
| P0 Intake | Every session | Orchestrator, with security/devops for fast-path checks; the coordinator when the starting point is unclear (NAV) | — | Mission type, profile-detection report, validation notes | — |
| P1 Blueprint | New project, feature, or cross-repo mission | Relevant roles in propose mode | — | blueprint.md | G0 direction |
| P2 Constitution | New project or amendment | architecture, engineering, qa, security | constitution command | constitution sections | G1 principles |
| P3 Specify | Every feature or behaviour-changing fix | product-spec | specify/clarify commands | spec.md | G2 spec |
| P4 Plan | Every feature | tech-stack, architecture, engineering, security, qa, devops, system-architecture when contracts change | plan command | plan.md, research.md, data model, contracts | G3 plan |
| P5 Tasks | Every feature | Orchestrator, then qa | tasks/analyze commands | tasks.md with tags, touches, refs | G4 tasks |
| P6 Implement | Per task | owning role execute, script checks, owning role review | implement semantics | code/config/docs plus task marked complete | automatic; escalate on budget |
| P7 Close-out | Per feature | architecture, system-architecture when cross-repo, security for high risk, devops | — | updated architecture/system docs, PR | G5 merge |

P0 classification, first match wins:

| Condition | Path |
|---|---|
| Company KB system catalog shows more than one service touched | Run system-level P1/P3/P4/P5 in Company KB `system/features/`; each slice then runs in its repo |
| No `.specify/` yet or new project | P1 → P2 → P3 → P4 → P5 → P6 → P7 |
| New feature | P1 → P3 → P4 → P5 → P6 → P7 |
| Fix changes specified behaviour | P3 → P4 → P5 → P6 → P7 |
| Fix passes fast-path check | P6 → P7 |

P0 also checks architecture freshness, known stack manifests against docs/architecture.md components, and whether paradigm is missing where PDM reaches PDM-Q4 without a project default. That paradigm case becomes a G0 open question.

Gate format: one message with (1) produced paths, (2) blueprint deltas, (3) top open questions, max 3, (4) spend so far and budget notes, (5) exact approval reply. Nothing after a gate starts before approval.

P6 loop per task:
1. Launch owning role in execute mode.
2. Run active profile checks required by the task and TD decision.
3. On check failure, relaunch execute with failing output; budget applies.
4. On pass, launch owning role in review mode; add security review for flagged medium/high-risk surfaces.
5. On review-pass, mark task complete. On `spec-or-plan-wrong`, stop affected tasks, return to P3 or P4, and re-gate.

## 6. Task lines
The Orchestrator appends framework suffixes to task lines per `schemas/task-line.schema.md` without rewriting Spec Kit's body:

```markdown
- [ ] T020 [P] [US2] [Eng] [llm] Implement assigned behaviour
      touches: integration:<id> · refs: <paths or none> · hot-path: yes|no
```

Default inference, confirmed at G4: test-only work → `[QA]`; delivery files → `[DevOps]`; contracts → `[SysArch]` in system context or `[Arch]` in one repo; auth/secrets paths → `[Eng]` with security review; profile-check-only work → `[script]`; source implementation → `[Eng] [llm]`; system slices → `[Slice] <service_id>`.

## 7. Conflict precedence
| Conflict | Winner |
|---|---|
| system-architecture vs. architecture | system-architecture between repos; architecture inside a repo |
| architecture vs. engineering | architecture for structure; engineering for code within boundaries |
| architecture vs. devops | architecture for internal structure; devops for deployment topology |
| security vs. any role | security can block; only the human lifts a block, recorded as a decision |
| qa vs. tech-stack | qa's constitution bar is fixed; tooling must satisfy it |
| system constitution vs. project constitution | system wins; project may only add stricter rules |
| preset intent vs. profile form | preset intent wins; profile chooses form |
| anything else | escalate to the human |

## 8. Fix fast path
Eligible only if all hold: no acceptance-criterion change, no API/event/contract shape change, risk tier LOW, no new dependency, and DT-Q1 is NO. Flow: P0 → one `[Eng] [llm]` task → P6 → P7. Minimum record: regression test or reason none applies, fast-path restoration note, root cause, and a line under the feature fix log. If review finds behaviour changes, reroute to P3.

## 9. Budgets and model tiers
| Loop | Default budget | When exhausted |
|---|---|---|
| Re-execute after failed script check | 2 | Escalate with failing output |
| Re-execute after review-fail | 2 | Escalate with review feedback |
| Automatic rework to P3/P4 per feature | 1 | More rework only on explicit human request |
| Parallel `[P]` tasks in flight | 4 | Queue |

Project overrides live in the constitution under `## Agentic SDLC budgets`. Token/cost budgets are soft; the Orchestrator reports spend at every gate and escalates when exceeded.

| Tier | Roles |
|---|---|
| Top | orchestrator, system-architecture, architecture, security |
| Mid | product-spec, tech-stack, engineering, qa, devops |
| Fast | tagging, summarizing script output |

## 10. Decision trees and records
Trees live in `trees/*.tree.md` and use the schema in `schemas/tree.schema.md`. Every decide-mode tree walk ends in a decision record in research.md, or in the Company KB system feature doc for cross-repo work. Rejected alternatives are mandatory. Tree node ids are cited exactly.

## 11. Enforcement tiers
| Tier | Checker | When | On failure |
|---|---|---|---|
| 1 | Active profile checks | Inside execute before reply | Owning role fixes within budget |
| 2 | Framework/project scripts | P0, P7, and CI | Blocks gate or close-out |
| 3 | LLM reviewer | Review mode after tier 1/2 pass | review-fail with rule ids |

`Enforced by` values are defined in `schemas/_system.md` §1.4. Tool names and concrete configs stay in stack/profile files; shared framework files name only enforcement categories.

## 12. Validation
Framework validator (`tools/validate.mjs`) checks:
- conventions §1 and §4 YAML parse; role and dimension ids are unique;
- role files match `agent-role/v2`, preset paths exist under `foundations/`, rubric ids match prefixes;
- tree prefixes, owners, nodes, defaults, and citations are valid;
- profile folders, stack/paradigm overlays, and schema registry entries exist;
- index has all 15 sections and resolving links;
- V6: files outside stack profiles do not name stack-specific tools;
- wrappers and skills match role presets when present.

Per-repo validator (`tools/validate-project.mjs`) checks repo architecture, task-line suffixes (including `procedure:` and `inputs:`), integration docs, decision records, profile ids, references, and cross-repo system links. It already fails a project whose `paradigm: <id>@<major>` pin (architecture §3/§4 or constitution default) has no matching paradigm file. It also fails a project whose lint config lacks a string from its stack's `lint-baseline` block (stack idioms, Enforcement). That is how documentation and import-path rules reach every repo instead of depending on who writes the code.

## 13. Versioning
Two numbers, two jobs (`knowledge/versioning/semantic-versioning.md`):

| Where | Form | Meaning |
|---|---|---|
| Paradigm, stack overlay and schema **changelog rows** | `MAJOR.MINOR.PATCH` | Full history: patch = wording fix, minor = new guidance compatible with old code, major = existing compliant code now fails |
| Paradigm front-matter `version:` and every **pin** (`class-modeled@1`, `schema: paradigm/v1`) | `MAJOR` only | The compatibility promise. A project pins the major, and minor and patch changes reach it automatically. This is the same idea as `actions/checkout@v4` |

**Phase 1: unpublished (now).** The framework has no outside consumers, so nothing is bumped. Breaking changes are folded into the current major and marked "breaking in substance" in the changelog. The only consumer is a local demo repo, which is updated in the same change.

**Phase 2: after the first published release.**
1. The framework is released as a git tag equal to `framework-version` in `index.md`. A project records the commit SHA of the release it was built against in `docs/architecture.md` §2. The `framework-ref` field is added to `repo-architecture` at that point, not before. An upgrade is a reviewed change to that SHA.
2. A major bump never edits the old text in place. The old major's file is frozen as `paradigms/<id>@<old-major>.md` and its stack overlays as `stacks/<s>/paradigms/<id>@<old-major>.md`, and it receives fixes only. The validator learns to register both files before the first such bump.
3. The current and previous majors are supported. Removing a major needs a changelog note with migration steps, and a check that no known project still pins it.
4. A project moves to a new major only through a decision record (`schemas/paradigm.schema.md`, Changelog rules).

## References
**Local artifacts:**
- `schemas/_system.md`: schema registry and enforcement values.
- `schemas/launch-prompt.schema.md`: runtime handoff packet.
- `schemas/message.schema.md`: role reply shape.
- `proposals/agentic-sdlc-v2-structure.md`: approved D1-D10 design.
- `proposals/agentic-sdlc-v2/README.md`: source framework summary.
**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit): phase model integrated by this framework.
- [Semantic Versioning 2.0.0](https://semver.org/): MAJOR.MINOR.PATCH meaning; item 4, anything may change before a first stable release.
- [GitHub Actions, secure use](https://docs.github.com/en/actions/reference/security/secure-use): pin a full commit SHA because tags can move.

## Related
- `index.md`: framework overview.
- `agents/`: role definitions.
- `trees/`: role-owned decision trees.
- `stacks/` and `paradigms/`: runtime profiles.