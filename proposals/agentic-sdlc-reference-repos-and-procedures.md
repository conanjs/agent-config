# Proposal: Stack References as Separate Repos, and Procedures as Bounded Task Scopes

**Status:** Draft 2026-10-27, for the owner (V) to decide. Nothing here is implemented. Base design: `proposals/agentic-sdlc-v2-structure.md` (approved 2026-10-04).

**How to read:** each part gives the problem with evidence, the options, a recommendation, and a concrete artifact showing the result. Part A moves the stack reference code out of this repo. Part B makes stack procedures something the Orchestrator assigns to a task, instead of something an agent may or may not discover. They are independent; either can ship alone. §C lists the decisions needed.

**Open input from the owner:** the request that started this ended mid-sentence: *"One thing is that there is a …"*. Whatever that point was, it is not covered here yet.

---

## Part A — Stack references in their own repos

### A1. The problem

`copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference/` is a complete runnable project inside the framework.

| Evidence | Measured 2026-10-27 | Why it matters |
|---|---|---|
| Size on disk | 141 MB of the framework's 142 MB; 8,600+ files, almost all `node_modules/` (git-ignored, created by `pnpm install`) | `copilot/frameworks` is **symlinked** to `~/.copilot/frameworks` (`mapping.yaml`), so every agent that searches its config also searches these dependency files |
| Tracked files | 32 files, 4,663 lines | Small in git, large once it is made runnable |
| Its own check | `pnpm run check` (format, lint, typecheck, unit, integration, build) is run by nobody: not CI, not the doc guards | The rule "fix the reference or the rule in the same change" (`reference/index.md`) is not enforced |
| Scale | Only `typescript-node` has a reference; `go`, `python`, `rust` would each add a project with its own toolchain and dependencies | Four stacks → four dependency trees inside the deployed config |
| Discoverability | The framework `index.md` (§4 homes, §12 file map, §13 how to extend) never mentions references | Only `skills/sdlc-stack-typescript-node/SKILL.md` step 4 leads to it |
| Inbound links | 6 knowledge docs link to `…/reference/src/…` paths | Any move must update them |

Analogy: the framework is the **building code**; the reference is the **show home** built to it. Today the show home sits inside the code book. It makes the book heavy, and nobody inspects the house.

### A2. Options

| | A. Owner's original idea | B. Pointer file + pinned repo **(recommended)** | C. Git submodule |
|---|---|---|---|
| What stays in the framework | Copies of the reference's `architecture`, `constitution`, `glossary`, each linking to the repo | One file `stacks/<id>/reference.md`: repo, pinned tag + commit, the **Choices** table (rule → file), fetch steps | A submodule entry pinned to a commit |
| Where architecture / constitution / glossary live | Twice: the framework copy and the repo | Once: in the repo (`docs/architecture.md`, `.specify/memory/constitution.md`, `docs/glossary.md`) | Once: in the repo, checked out under the framework |
| Drift risk | High: two copies of three documents (the repo's own rule KB-8 says link, don't copy) | None for content; the pin can lag, and the freshness check warns | None, but pins lag silently |
| What an agent can do without cloning | Read the three documents | Read the Choices table: which rule is shown in which file | Nothing until `git submodule update` |
| Deployed size | Small | Small | Large again: the checkout lands inside the symlinked tree, and `pnpm install` brings `node_modules` back |
| Verdict | Simple, but duplicates the documents that change most | **Small deploy, one source of truth, works offline for the map** | Re-creates the problem |

**Why B keeps the Choices table but not the three documents:** the Choices table is the framework's view (rule id → where it is shown) and is written by the framework maintainer. Architecture, constitution and glossary are the project's own records (store D), and every project has its own. Copying them into the framework would give the framework a second, unowned copy.

### A3. Recommended design (option B)

**One repo per stack**, e.g. `conanjs/agentic-sdlc-reference-typescript-node`.
- Each stack has its own toolchain, CI image and release cadence.
- Clones stay small.
- A monorepo would make every stack's CI and pin move together.

**The framework keeps one pointer file per stack** (`stack-reference/v2`, replacing `stacks/<id>/reference/index.md`):

```markdown
---
schema: stack-reference/v2
stack: typescript-node
repo: conanjs/agentic-sdlc-reference-typescript-node
pinned: v1.0.0
commit: 3f2c9e1…                     # full SHA; a tag can move, a SHA cannot
verified: 2026-10-27                 # date the pinned commit passed its CI and validate-project.mjs
---

# Reference: TypeScript on Node.js

## What it shows        (unchanged)
## Choices              (unchanged table; "Where" paths are relative to the repo root)
## File map             (unchanged)
## How to fetch
1. `git clone https://github.com/conanjs/agentic-sdlc-reference-typescript-node "{{REFERENCE_REPOS_ROOT}}/typescript-node"` (once).
2. `git -C "{{REFERENCE_REPOS_ROOT}}/typescript-node" fetch --tags && git -C … checkout <commit>`.
3. Read only. Changes to the reference go through a PR to its own repo, never from a project task.
## References / Related
```

**Where clones live:** a new variable `{{REFERENCE_REPOS_ROOT}}` in `global-variables.md`. The default is outside `~/.copilot`, e.g. `~/agentic-sdlc-references`, so the deployed config stays small. `global-variables.md` is `seed-once`, so existing machines add the row by hand (SETUP step).

**Keeping the two repos in sync:**

| Guard | Where | What it checks |
|---|---|---|
| Reference repo CI | the reference repo | `pnpm run check`, then this repo's `validate-project.mjs` fetched at a pinned agent-config ref, so the reference is checked against the framework's current rules |
| Pin freshness | this repo, layer 4 (`validate.mjs` or `validate-procedures.mjs`-style `--upstream`) | warns when the reference repo has a newer tag than `pinned`, and when `verified` is older than 90 days |
| Pointer integrity | `validate.mjs` | `repo`, `pinned`, `commit` present; `commit` is a 40-char SHA |
| Knowledge links | the 6 docs | rewritten to GitHub permalinks at the pinned commit (`…/blob/<sha>/src/application/ReviseDocument.ts#L41`), so line numbers stay true |

**A rule change that also changes the reference** becomes:
1. A PR to the reference repo; its CI runs against the framework branch.
2. A PR here that changes the rule and bumps `pinned` and `commit`.
3. The two merge together.

That is the cost of this option, paid in exchange for a small, checked, scalable layout.

### A4. Migration steps

1. Create the repo; move `reference/` into it with its history (`git filter-repo --subdirectory-filter` on a clone, or a plain copy if history doesn't matter); add its CI; tag `v1.0.0`.
2. Replace `reference/` here with `reference.md` (`stack-reference/v2`); update `stack-reference.schema.md` and `validate.mjs`.
3. Update the stack skill (step 4), `procedures/typescript-node/*` ("Shape to copy" paths), and the 6 knowledge docs.
4. Add `{{REFERENCE_REPOS_ROOT}}` to `global-variables.md` and a SETUP step; add references to framework `index.md` §4, §12 and §13.
5. Run `scripts/check-docs.sh`; delete the local `node_modules`.

---

## Part B — Procedures as bounded task scopes

### B1. The problem

The owner's intent: a stack procedure (e.g. `procedures/typescript-node/add-port-and-adapter.procedure.md`) **bounds what an agent does**: fixed inputs, fixed steps, fixed "done". It keeps the agent from improvising across the codebase.

Today the procedure is linked from three places: the stack skill (step 5, "for a recurring task"), `reference/index.md` (Related), and `procedures/typescript-node/index.md`. **None of the places that drive the work know it exists:**

| Place that drives work | Accepts today | Consequence |
|---|---|---|
| Task line (`task-line.schema.md:24`) | `refs:` = knowledge paths only | The Orchestrator cannot assign a procedure to a task |
| Launch prompt (`launch-prompt.schema.md`) | `state.references` (knowledge docs) | The role never receives a procedure |
| `agents/engineering.md`, framework `index.md` | no mention | No role is told to look for one |
| `validate-project.mjs` | checks `refs:` paths exist | Nothing checks procedure assignments |

So an agent follows the procedure only if it loads the stack skill **and** decides by itself that the task is "recurring". The bound depends on the agent's own judgment, which is exactly what the procedure was meant to replace.

### B2. Recommended design

**1. Each stack's procedure catalog gains a "Use when" column**, which already exists in `procedures/typescript-node/index.md`. The planner reads it at P5, the same way it reads the stack's Reference topics table for `refs:` (D7).

**2. The task line gets a `procedure:` field** (`task-line/v2`). It is explicit, like `touches:` and `refs:`, and allows at most one procedure per task, so one task has one bounded scope.

```markdown
- [ ] T031 [US2] Add Clock port and SystemClock adapter (src/application/ports/)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: typescript-node/add-port-and-adapter  ·  hot-path: no
      inputs: capability=tell the time; technology=system clock; use-case=ExpireSessions
```

**3. Procedures declare their inputs and their footprint** (additions to `procedure/v1` front-matter, or `procedure/v2`):

```yaml
stack: typescript-node
inputs: [capability, technology, use-case]
allowed-paths:            # the only paths a task under this procedure may change
  - src/application/ports/**
  - src/application/*.ts
  - src/infrastructure/**
  - src/CompositionRoot.ts
  - test/**
  - docs/architecture.md
  - docs/glossary.md
  - docs/integrations/**
```

**4. The launch prompt carries it**: `state.procedure: { path, inputs }`. The role's rule becomes: *follow the procedure's steps in order, report each step's result in the message, and change nothing outside `allowed-paths`; if a step can't be done, stop and escalate.*

**5. The bound is checked mechanically, not just stated:**

| Check | Tool | When |
|---|---|---|
| `procedure:` names an existing procedure for the component's stack; every declared input is given | `validate-project.mjs` | P5 / G4 |
| Files changed by the task ⊆ `allowed-paths` (`git diff --name-only <base>`) | a new `validate-project.mjs --task T031` check | P6, before review |
| The message lists every procedure step with a result | reviewer (`llm`) | P6 review |

Analogy: today the procedure is a recipe in a drawer the cook may or may not open. With this change it is the **work order pinned to the ticket**: the head chef (Orchestrator) chooses it when planning, the cook gets it with the ticket, and the pass (the scope check) rejects any dish that used ingredients outside the order.

### B3. Also needed

- Framework `index.md`: add procedures to §4 (homes), §8 (one task end to end), §12 (file map) and §13 ("Add a procedure: write it under `procedures/<stack>/`, add a Use-when row, declare inputs and `allowed-paths`").
- `agents/engineering.md`: a Runtime-inputs row for `state.procedure`, and the follow-and-report rule.
- `stacks/<id>/index.md`: a line pointing to its procedure catalog, so the stack profile and its procedures are found together.
- Fix while there: `conventions.md:144` still calls `validate-project.mjs` "planned".

---

## C. Decisions needed

| # | Question | Recommended |
|---|---|---|
| R1 | Move references to separate repos? | Yes, option B (pointer file + pinned repo) |
| R2 | One repo per stack, or one monorepo? | One per stack |
| R3 | Repo name pattern | `agentic-sdlc-reference-<stack-id>` under `conanjs` |
| R4 | Keep git history of `reference/`? | Yes (cheap with `git filter-repo`) |
| R5 | Clone location | `{{REFERENCE_REPOS_ROOT}}`, default `~/agentic-sdlc-references` |
| P1 | Procedures as a `procedure:` task-line field (not inside `refs:`)? | Yes: a procedure is instructions to follow, not material to read |
| P2 | Enforce `allowed-paths` with a script at P6? | Yes |
| P3 | One procedure per task at most? | Yes; a task needing two is two tasks |
| — | The cut-off point ("One thing is that there is a …") | Owner to complete |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference/index.md` — the current reference and its Choices table.
- `copilot/frameworks/agentic-sdlc/schemas/stack-reference.schema.md`, `task-line.schema.md`, `launch-prompt.schema.md` — the schemas this changes.
- `copilot/procedures/typescript-node/index.md`, `add-port-and-adapter.procedure.md` — the procedure catalog and the first procedure.
- `copilot/procedures/procedure.schema.md` — `procedure/v1`, which Part B extends.
- `mapping.yaml` — the symlink that puts `reference/node_modules` inside `~/.copilot/frameworks`.
- `copilot/patterns/layered-guards.pattern.md` — the freshness and wiring approach reused in A3 and B2.

**External authoritative sources:**
- [Events that trigger workflows: schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) — GitHub Docs, living. Backs: "Scheduled workflows run on the latest commit on the default branch", relevant to where the pin-freshness job runs.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) — GitHub Docs, living. Backs: pin a full commit SHA because tags can move (A3 `commit:`).
- [gitsubmodules](https://git-scm.com/docs/gitsubmodules) — Git, living. Backs: option C's behaviour (a submodule records a commit and needs a separate checkout).
- [git-filter-repo](https://github.com/newren/git-filter-repo) — Elijah Newren, living. Backs: A4 step 1 (extracting a subdirectory with history).
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: the port/adapter task in the B2 example.

## Related

- `proposals/agentic-sdlc-v2-structure.md` — D7 (`touches:` / `refs:` written at planning time), which Part B extends to procedures.
- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` — why procedures live in `copilot/procedures/`.
- `copilot/patterns/artifact-types.pattern.md` — a procedure "has no trigger of its own"; Part B gives it one (the task line).
