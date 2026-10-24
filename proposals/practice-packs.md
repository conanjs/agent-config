# Proposal: Practice Packs — a Swappable, Evolving Coding-Paradigm Axis

**Status:** Superseded by `proposals/agentic-sdlc-v2-structure.md` (2026-10-04): "practice" is renamed **paradigm**, and selection is folded into the v2 profile model. §6 (learning loop) remains a reference for v2's open question 2. Original draft follows.

Draft, not yet implemented. Extends `proposals/agentic-sdlc-architecture.md`
and the framework at `copilot/frameworks/agentic-sdlc/` — read those first; this document
only adds the one axis described below and doesn't restate anything already decided there.

## 0. The question this document answers

> When the Orchestrator spawns an `engineering` agent to execute a task, what gives it
> knowledge of the stack?

**Nothing it remembers — a static lookup the Orchestrator performs and hands over, every
launch.** Trace, using the real `rbac-demo` project:

1. **Once, at P4:** `tech-stack` + `architecture` decide the stack per component and write
   it into `docs/architecture.md`'s `components:` block. rbac-demo's `api` component has
   `binding: typescript-node`.
2. **Every launch, at P6:** the Orchestrator maps the task's file path to a component, reads
   that component's `binding:` value, and uses it to filter `principles/taxonomy.yaml`
   (`conventions.md` §3: an entry's `stack` field must be `any` or match that binding id).
3. **It writes the result into the launch prompt** as `knowledge.binding:
   sdlc-binding-typescript-node` (a skill name where supported, otherwise the file path to
   `bindings/typescript-node/index.md`) plus the filtered `principles:` list.
4. **`engineering`'s role definition says what to do with that line**: load the named
   binding, follow its `idiom.*` slots, run only its `cmd.*` slots verbatim.

The agent carries no stack knowledge between launches — it is re-handed the same lookup
result every time (`conventions.md` §2.4, "instances remember nothing"). **Practice packs
reuse this exact pattern for paradigm, instead of inventing a new mechanism.**

## 1. The gap this fills

The binding mechanism answers *"which language, and how do I write idiomatic code in it"*
(errors, concurrency, DI, config, logging — `bindings/<stack>/idioms.md`). It does not answer
*"which paradigm"* — e.g. model the domain as encapsulated classes with invariants, vs. plain
data transformed by discrete pure functions. Today that choice is implicit, made ad hoc by
whichever `engineering` instance happens to execute a task, with no record, no deliberate
selection, and no way for the project (or the framework) to accumulate a preference over
time.

## 2. Naming — rejected terms and why

| Candidate | Rejected because |
|---|---|
| **"style"** / "style pack" | `coding-standards.md` already uses "style" for *formatting* style and explicitly says *"formatting and lint style are never review topics"* — reusing the word for paradigm would contradict that line on sight. |
| **`CS-Q1`** tree-node prefix | `coding-standards.md`'s rubric ids are already `CS-1..CS-17` ("Coding Standards"). A second, unrelated `CS-*` namespace (code *style*) would make every cross-reference ambiguous. |
| **`PR-*`** rubric/tree prefix | Collides with "pull request" shorthand used everywhere else in this framework's own conventions and in GitHub itself. |
| **"paradigm pack"** | Accurate, but reads as a judgment about programming-language theory than an engineering artifact; doesn't fit the existing `<noun> pack` / `<noun> binding` naming rhythm. |

**Chosen:**

| Thing | Name | Why |
|---|---|---|
| Knowledge kind | `practice` (as in `kind: practice` in `taxonomy.yaml`) | Matches the user's own term ("practice set") from the original ask; doesn't collide with "style" (formatting) or "pattern" (already used for `architecture-pattern-selection.tree.md`). |
| File | `principles/practices/<practice-id>.md` | Parallel to `principles/bindings/<stack>/` — same shape, different axis. |
| Slot prefix | `practice.*` (`practice.modeling`, `practice.state`, `practice.composition`, `practice.effects`, `practice.errors_shape`, `practice.test_shape`) | Mirrors `idiom.*` naming inside bindings — same reader, different axis, no new mental model. |
| Rubric ids | `PRAC-<practice-id>-Rn` | Unambiguous four-letter prefix; doesn't collide with `CS-*`, `ENG-R*`, `STY-*`, or `PR-*`. |
| Tree | `contextual/practice-selection.tree.md`, nodes `PRAC-Q1..Q4` | Same prefix as the rubric, since both describe the same axis; avoids `CS-Q*` entirely. |
| Decision record id | `PRAC-<component>` (e.g. `PRAC-core`) | Parallel to how `TS-*`/`AP-*` decisions are cited elsewhere. |
| Amendment record id | `PRAC-AMEND-<n>` | Distinguishes a learning-loop amendment from a per-component selection. |
| Project ledger file | `docs/practice-ledger.md` | Parallel to `docs/architecture.md`, `docs/style-ledger.md` renamed to avoid the same word collision as above. |

## 3. What a practice pack is

A new knowledge kind, independent of `stack` — **not** folded into the binding mechanism.
`binding.schema.md` fixes "one binding = one stack, slots are the swap unit"; nesting
paradigm inside it would need stack × paradigm bindings (`typescript-node-oop`,
`typescript-node-fp`, …), a combinatorial explosion that breaks "swapping the binding swaps
the stack." Keeping practice as its own axis, with the same slot discipline, lets each axis
swap independently — exactly how `stack` and `practice` differ for the same component today
(see §6).

- **Stack-agnostic pack** — `principles/practices/<id>.md`: prose only, no tool names (so
  validator rule V6 still holds), filling the `practice.*` slots, a `rubric:` list
  (`PRAC-<id>-Rn`), and `escape_hatches:` for explicitly allowed deviations.
- **Optional per-stack overlay** — `bindings/<stack>/practices/<id>.md`: the same slots
  restated in that language's terms (e.g., in TypeScript: `#private` fields + constructors
  for `class-modeled`, vs. `readonly` types + `pipe()` composition for `functional-pipeline`).

| Layer | Holds | Changes when |
|---|---|---|
| `coding-standards.md` | Rules true for every paradigm: naming, small functions, DI, no dead code | Almost never |
| `bindings/<stack>/idioms.md` | Language mechanics: errors, concurrency, config, logging | Stack changes |
| `practices/<id>.md` + overlay | The paradigm itself and how it shows up in code | Through the amendment loop (§5) |

## 4. Selection

- **Granularity:** per component, with optional non-overlapping `paths:` overrides for
  subtrees. Not per-task — that is exactly how drift starts.
- **Project default:** set in the constitution at P2 (e.g. "Default practice: `class-modeled@1`").
- **Owner:** `engineering` — §7's conflict table already gives it "code within boundaries";
  paradigm choice lives there. `architecture` reviews for structural side effects.
- **New tree:** `contextual/practice-selection.tree.md`, nodes `PRAC-Q1..Q4`:
  - `PRAC-Q1`: existing code already follows one paradigm consistently? → keep it (retrofit).
  - `PRAC-Q2`: long-lived domain with invariants enforced across operations? → `class-modeled`.
  - `PRAC-Q3`: input→output transform with no persistent identity (scripts, ETL)? → `functional-pipeline`.
  - `PRAC-Q4`: otherwise → the project default.
  - **Default:** the project default. **Escalate when:** a component genuinely needs both —
    `architecture` splits it or adds a `paths:` override.
- **Changes to `agents/engineering.md`:** phases become `P2, P4, P6, P6-review, P7`; add
  `mode: decide (P4)` (walk `PRAC-Q1..Q4`, emit one `PRAC-<component>` decision record) and
  `mode: propose (P7)` (the amendment proposal, §5). "Decision trees owned" becomes
  `PRAC-Q1..Q4`.
- **Where it's recorded:** decision record in `research.md`; pinned result in the
  `docs/architecture.md` component entry; both approved at the gate that closes P4.

## 5. Launch-prompt diff

```diff
 knowledge:
   binding: sdlc-binding-typescript-node
+  practice:
+    pack: principles/practices/class-modeled.md       # pinned: class-modeled@1
+    overlay: bindings/typescript-node/practices/class-modeled.md
+    ledger: docs/practice-ledger.md                   # project-local accepted rules, read-only
+    decision: research.md#PRAC-core
   principles:
     - principles/procedural/engineering/coding-standards.md
     - principles/procedural/engineering/error-handling.md
```

`practice:` is resolved by the Orchestrator exactly like `binding:` is today — a static
lookup from the component entry, not a taxonomy `owners`/`phases` match — so it doesn't
count against `max_files_per_role` (adds at most 3 files). `conventions.md` §3 gains one
step: *"4. Resolve `practice:` for C (path override > component > constitution default);
pass the pack, overlay and ledger paths."*

## 6. Accumulation without breaking statelessness

Two file tiers. Agents still read only the current files — nothing is kept in a model's head.

1. **Evidence (automatic, append-only)** — `docs/practice-ledger.md` → `## Evidence`. The
   Orchestrator appends every `PRAC-*` review finding and every human override at a gate.
   Workers never write to it.
2. **Trigger** — at P7 close-out, the Orchestrator launches `engineering` in `mode: propose`
   if the same rule id recurs 3+ times across 2+ tasks, any human override touched practice,
   or the human asked for a retro.
3. **Proposal** — `engineering` returns a `PRAC-AMEND-<n>` decision record: the evidence it
   cites, the proposed slot/rubric change, scope (`project` or `promote`), and rejected
   alternatives (always including "no change").
4. **Review** — `architecture` reviews for structural side effects; a human approves at the
   P7 gate. No approval, nothing is written.
5. **Apply (Orchestrator only):**
   - `project` scope → append to `docs/practice-ledger.md` → `## Accepted local rules`
     (`LR-<n>`, citing its `PRAC-AMEND-*` record). Binding for that project from then on.
   - `promote` scope → only once the same local rule is accepted in **2+ projects**. Then a
     framework PR bumps `principles/practices/<id>.md`'s version (minor for a clarification,
     major for a changed slot rule), guarded by the validator and normal review.

A major bump never reaches existing projects silently — pins are `@major`, so the validator
fails until each project records its own `PRAC-<component>` re-adoption decision.

## 7. Guardrails against ad hoc drift

- A worker in `execute` mode gets exactly one pack; it never switches on its own. If it thinks
  the pack fits badly, it returns `question` with `reason: practice-mismatch`, citing the slot.
- New rubric items on `engineering`'s review mode:
  - **ENG-R10:** code follows the assigned pack's slots, overlay, and the ledger's `LR-*`
    rules; any deviation must name an `escape_hatch`. Cites `PRAC-<id>-Rn`.
  - **ENG-R11:** the task's `artifacts` never touch `principles/practices/**`,
    `bindings/*/practices/**`, or `docs/practice-ledger.md`.
- Failing ENG-R10 → `reason: fixable`. A repeated `practice-mismatch` question routes back to
  a `PRAC` re-walk at P4 (the same path `spec-or-plan-wrong` already uses to return to P3).

## 8. Validator rules (continuing from V8)

- **V9** — every `practice:` reference resolves to `principles/practices/<id>.md` with
  `status: active`, and its pinned `@major` equals the file's current major.
- **V10** — every pack has front-matter `id`, `version`, `status`, fills every required
  `practice.*` slot, and has ≥1 `PRAC-<id>-R*` rubric item.
- **V11** — overlays exist only at `bindings/<stack>/practices/<id>.md`; `<id>` exists as a
  pack; the overlay's slots are a subset of the pack's slots.
- **V12** — each component has exactly one effective practice per path; `paths:` overrides
  don't overlap and stay inside the component's root.
- **V13** — every component `practice:` cites a `PRAC-*` decision id that exists in
  `research.md`; every `LR-*` cites an existing `PRAC-AMEND-*`.
- **V14** — taxonomy entries of `kind: practice` have `owners: [engineering]` and
  `select: by-component`; excluded from the V7 count; load is capped at 3 files.

V9, V12, V13 run per-project (`validate.mjs --project <path>`); V10, V11, V14 run on this
framework repo, same as today.

## 9. Worked example (rbac-demo, typescript-node)

**`taxonomy.yaml` additions:**
```yaml
- { id: tree.practice, path: contextual/practice-selection.tree.md, kind: contextual, owners: [engineering, architecture], phases: [P4, P7], stack: any }
- { id: practice.class-modeled, path: practices/class-modeled.md, kind: practice, owners: [engineering], phases: [P6, P6-review, P7], stack: any, select: by-component }
- { id: practice.functional-pipeline, path: practices/functional-pipeline.md, kind: practice, owners: [engineering], phases: [P6, P6-review, P7], stack: any, select: by-component }
- { id: bind.typescript-node.practice.class-modeled, path: bindings/typescript-node/practices/class-modeled.md, kind: binding, owners: [engineering], phases: [P6, P6-review], stack: typescript-node }
- { id: bind.typescript-node.practice.functional-pipeline, path: bindings/typescript-node/practices/functional-pipeline.md, kind: binding, owners: [engineering], phases: [P6, P6-review], stack: typescript-node }
```

**`docs/architecture.md`:**
```yaml
components:
  - name: core
    root: src/            # domain/ + application/
    binding: typescript-node
    practice: class-modeled@1
    practice_decision: PRAC-core
  - name: scripts
    root: scripts/
    binding: typescript-node
    practice: functional-pipeline@1
    practice_decision: PRAC-scripts
```

**`principles/practices/class-modeled.md` (abridged):**
```markdown
---
id: class-modeled
version: 1.2
status: active
---
## practice.modeling
Each aggregate is one type that owns its data; no anemic records plus free functions.
## practice.state
State is private; changes only through intention-named operations enforcing invariants.
## practice.composition
Behaviour lives on the owning type; variation via interfaces/polymorphism, not type switches.
## practice.effects
Domain types perform no I/O; application services orchestrate ports.
## rubric
- PRAC-class-modeled-R1: no public mutable fields on domain types.
- PRAC-class-modeled-R2: no exported function that mutates another type's data.
## escape_hatches
- Pure value-calculation helpers may be free functions if they own no state.
## changelog
- 1.2 (PRAC-AMEND-3, promoted from 2 projects): added R2.
```

**Engineering launch, task T014 (core):**
```yaml
mode: execute
task: "T014 [Eng] [llm] Add Role.grantPermission enforcing no-duplicate invariant (src/domain/role.ts)"
knowledge:
  binding: sdlc-binding-typescript-node
  practice: { pack: principles/practices/class-modeled.md, overlay: bindings/typescript-node/practices/class-modeled.md, ledger: docs/practice-ledger.md, decision: research.md#PRAC-core }
  principles: [procedural/engineering/coding-standards.md, procedural/engineering/error-handling.md, procedural/engineering/refactoring.md, declarative/axioms/design-principles.md, declarative/axioms/clean-architecture.md]
state: [specs/002-x/spec.md, specs/002-x/plan.md, specs/002-x/research.md, docs/architecture.md]
```

**Engineering launch, task T021 (scripts):**
```yaml
mode: execute
task: "T021 [Eng] [llm] Seed-roles script: read YAML → validate → upsert (scripts/seed-roles.ts)"
knowledge:
  binding: sdlc-binding-typescript-node
  practice: { pack: principles/practices/functional-pipeline.md, overlay: bindings/typescript-node/practices/functional-pipeline.md, ledger: docs/practice-ledger.md, decision: research.md#PRAC-scripts }
  principles: [same as above]
state: [...]
```

## 10. Migration (backward compatible)

- **Default: no `practice:` means `practice: none`.** No routing added, ENG-R10/R11 report
  N/A, and V9/V12/V13 skip that component — existing projects are unaffected.
- **Adopting it in rbac-demo, no rewrite:**
  1. Run `engineering` `mode: decide (P4)` in a short adoption mission; `PRAC-Q1` ("existing
     practice is consistent → keep it") describes the code as it already is.
  2. Add `practice:`/`practice_decision:` to each component in `architecture.md`, plus the
     `PRAC-*` records in `research.md`; approve at the P4 gate.
  3. Create `docs/practice-ledger.md` with empty `Evidence` / `Accepted local rules` sections.
  4. Any code that doesn't fit the chosen pack becomes a follow-up refactor task — not a
     blocker to adoption.
- **Framework side:** add `schemas/practice-pack.schema.md`, two starter packs, their TS
  overlays, the `PRAC` tree, and V9–V14. The `engineering` P4/P7 additions are additive only.

## 11. Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Fold practice into bindings | Stack × practice combinatorial explosion; breaks "one binding = one stack." |
| Extra sections in `coding-standards.md` | Not swappable per component. |
| Agent memory / vector store of past missions | Breaks statelessness (§2.4); not reviewable. |
| Choose practice per task | Makes drift the default, not the exception. |
| `architecture` owns the practice tree | Paradigm is "code within boundaries" (§7); architecture keeps its veto via review instead. |
| Auto-apply amendments from raw finding counts | One bad mission could corrupt the shared pack; a gate plus 2-project promotion prevents this. |

## 12. Open questions / next steps

1. Map "the gate that closes P4/P7" above to the actual G-number once reviewed against
   `conventions.md` §4's gate table.
2. Tune the amendment trigger thresholds (3 hits / 2 tasks, 2-project promotion) after a few
   real missions — these are starting guesses, not measured values.
3. If adopted: write `schemas/practice-pack.schema.md`, the `PRAC` tree file, add V9–V14 to
   `tools/validate.mjs`, author `class-modeled` and `functional-pipeline` starter packs plus
   their `typescript-node` overlays, and pilot the adoption flow (§10) on `rbac-demo`.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-architecture.md` — the base architecture this extends.
- `copilot/frameworks/agentic-sdlc/conventions.md` §2–3, §7, §10–11 — runtime model, knowledge
  routing, conflict precedence, decision trees, validator rules this proposal builds on.
- `copilot/frameworks/agentic-sdlc/agents/engineering.md` — the role gaining `PRAC` modes.
- `copilot/frameworks/agentic-sdlc/principles/procedural/engineering/coding-standards.md` —
  source of the "style" naming collision noted in §2.
- `copilot/frameworks/agentic-sdlc/schemas/binding.schema.md` — the "one binding = one stack"
  constraint this proposal avoids violating.

**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit) — the `/speckit-*` phases this
  framework hooks into.

## Related

- `proposals/agentic-sdlc-architecture.md` §4, §7 — knowledge vs. state, and the original
  three knowledge taxonomies this practice axis is a fourth instance of.
- `copilot/frameworks/agentic-sdlc/schemas/decision-record.schema.md` — the shape every
  `PRAC-*`/`PRAC-AMEND-*` record must follow.
