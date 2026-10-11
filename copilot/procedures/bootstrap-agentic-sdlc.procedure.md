# Procedure: Bootstrap the Agentic SDLC Framework in a Project

Tool-agnostic procedure for adopting the Agentic SDLC framework (`{{AGENT_HOME}}/frameworks/agentic-sdlc/`) in one project repo. The framework layers onto GitHub Spec Kit, so Spec Kit setup comes first. Written once here; tool wrappers (Copilot prompt, the `agentic-sdlc` skill) only point here.

**Inputs needed:**
- **target repo path** (optional) — defaults to the current repo.
- **agent integration** — `claude`, `copilot` or `codex`, passed to Spec Kit.
- **system** (optional) — if this repo is one service of a multi-repo system: the company whose Company KB holds the system docs (`{{AGENT_HOME}}/companies/<co>/system/`). If that folder doesn't exist yet, run `init-system-workspace.procedure.md` first.

## Steps

1. **Check the working tree is clean** (`git status`). Every step below writes files; one clean diff keeps it reviewable and revertable.

2. **Set up Spec Kit**, if `.specify/` doesn't exist, by following `{{AGENT_HOME}}/procedures/spec-driven-development.procedure.md` Steps 1–4 (install and `specify init`). Stop after init — don't run the phase commands yet; the framework's Orchestrator drives them.

3. **Check the framework is installed** for the active tool: the `agentic-sdlc` skill and the `sdlc-*` role agents (see `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` → "How it's invoked"). If missing, the installer hasn't been run since they were added — run it (`SETUP.md`) before continuing.

4. **Detect the stack(s)** with a script, not by guessing: list manifest files (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`) up to two levels deep. Each directory holding one is a component; map it to a stack under `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/` (each stack's `index.md` front-matter `detect-by` lists its manifests). A manifest with no matching stack → stop and report; don't map it to the nearest stack. Also note any framework the manifest declares that has a `stacks/<id>/frameworks/<fw>.md` profile.

5. **Write `docs/architecture.md`** per `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/repo-architecture.schema.md`:
   - **New project:** create a stub with only `## Overview` (one line from the mission) and an empty `components:` block — P4/P7 fill the rest.
   - **Existing repo:** describe what's actually there — components from Step 4 (with `stack:` and `framework:`), structure from the real directory layout, data stores from config. Mark anything inferred rather than read as `(inferred)`.
   - **Paradigm:** for an existing repo, walk `trees/paradigm-selection.tree.md` PDM-Q1 only (does the code already follow one paradigm consistently?). If yes, record it as `paradigm: <id>@<major>` with an `(inferred)` mark for confirmation at the first gate; if not, leave `paradigm:` out — the Orchestrator asks at G0 of the first mission. Never pick one for a new project here.
   - **External dependencies (§6):** one row per third-party service the code calls; each row's `docs/integrations/<svc>.md` is written per `schemas/integration.schema.md` (stub sections are fine, marked `> _None yet._`).
   - **Service in a system:** fill `## 2. System context` — copy the `system:` block values from `{{AGENT_HOME}}/companies/<co>/system/service-catalog.yaml` (this service's entry), set `ref` to the `system-ref` integer in `companies/<co>/system/architecture.md`, write the 2–3 sentence summary and a neighbours-only diagram from the catalog's `provides`/`consumes`. If the company KB has a repo entry, also set the `company-kb:` front-matter link.

6. **Add the budgets block** to `.specify/memory/constitution.md` only if the project wants non-default budgets (`{{AGENT_HOME}}/frameworks/agentic-sdlc/conventions.md` §9). Otherwise leave defaults implicit — don't write a block that only restates them.

7. **Show the diff and stop.** The bootstrap ends here. The first mission is started separately via the `agentic-sdlc` skill/prompt, which runs P0.

## What this procedure does NOT do

- **Run any phase.** No constitution, spec or plan is written here — those are mission work with their own gates.
- **Create the Company KB `system/` folder.** That's `init-system-workspace.procedure.md`.
- **Pick a stack or paradigm for a new project.** Those are the TS tree (P1/P4) and the PDM tree (G0/P4), not bootstrap defaults.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` — the framework this procedure installs into a project.
- `{{AGENT_HOME}}/procedures/spec-driven-development.procedure.md` — Spec Kit setup reused in Step 2.
- `{{AGENT_HOME}}/procedures/init-system-workspace.procedure.md` — the multi-repo counterpart.

**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit) — the tooling set up in Step 2.

## Related

- `{{AGENT_HOME}}/patterns/shared-procedure-thin-wrapper.pattern.md` — why this is one procedure with thin per-tool wrappers.
