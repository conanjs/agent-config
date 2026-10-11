# Procedure: Initialize a System Workspace (multi-repo)

Tool-agnostic procedure for a multi-repo system under the Agentic SDLC framework: create (or adopt) the system docs in the company's **Company KB** (`{{AGENT_HOME}}/companies/<co>/system/`, decision D8 — there is no separate system repo), and clone every repo of the system into the standard local layout. Written once here; tool wrappers only point here.

**Inputs needed:**
- **company** — the Company KB instance, e.g. `ots` (`{{AGENT_HOME}}/companies/<co>/index.md` must exist; if not, create the instance first per `{{AGENT_HOME}}/frameworks/company-kb/index.md`).
- **system name** — e.g. `checkout`.
- **repos root variable** — the `{{<NAME>_REPOS_ROOT}}` in `global-variables.md` where this system's repos live (e.g. `{{ACME_REPOS_ROOT}}`). Add a row there first if it doesn't exist, following that file's "Company repo roots" section.
- **layout** — `flat` (one system under the root; default) or `grouped` (a folder per system under the root).

## Steps

1. **Resolve the workspace path.** Read the root variable's value from `{{AGENT_HOME}}/global-variables.md`. Workspace = `<root>/` (flat) or `<root>/<system name>/` (grouped). If the value is still `<SETUP REQUIRED>`, stop and ask — don't guess a path.

2. **Get the system docs into the Company KB.**
   - **Existing:** `{{AGENT_HOME}}/companies/<co>/system/` already exists — read it; nothing to create.
   - **New:** create `companies/<co>/system/` with `architecture.md` per `{{AGENT_HOME}}/frameworks/company-kb/schemas/system-architecture.schema.md` (`system-ref: 1`, workspace layout and root variable from the inputs), an empty `service-catalog.yaml` per `service-catalog.schema.md`, and an empty `features/` folder (filled later with `cross-repo-feature` docs). Read `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` first — every doc must comply. Contracts are **not** copied here; they stay in the provider repos.

3. **Read the catalog.** List `services[].repo` from `companies/<co>/system/service-catalog.yaml`. Show the list (name, URL, target path) to whoever asked **before cloning anything** — catalogs can be stale, and cloning is cheap to verify first but noisy to undo.

4. **Clone each repo** to `<workspace>/<repo.name>/`. Skip — don't overwrite — any target folder that already exists; report whether it's a git repo with a matching remote or something else.

5. **Check each service repo's link back.** For each cloned repo, open `docs/architecture.md`:
   - **Has `## 2. System context` with a `system:` block:** compare its `ref` with `system-ref` in `companies/<co>/system/architecture.md`; list stale ones.
   - **Missing it:** list the repo. Adding it is `bootstrap-agentic-sdlc.procedure.md` Step 5, run per repo — not done silently here.

6. **Link the system from the Company KB index** (`companies/<co>/index.md`): add or update the `system/` entry, as `{{AGENT_HOME}}/frameworks/company-kb/conventions.md` describes.

7. **Report**: Company KB `system/` path, workspace path, what was cloned/skipped, stale or missing System context sections.

## What this procedure does NOT do

- **Design the system.** The context map, catalog entries and cross-repo features come from missions run through the `agentic-sdlc` Orchestrator (`system-architecture` role).
- **Create a separate system repo.** Removed in agentic-sdlc v2 (D8); system docs live in the Company KB.
- **Push anything.** Clones and local file edits only.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/system-architecture.schema.md`, `service-catalog.schema.md`, `cross-repo-feature.schema.md` — formats created/read here.
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` — schema rules and the clone-layout rule this procedure follows ("Recommended on-disk clone layout").
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/repo-architecture.schema.md` — the `system:` block in each service repo.
- `{{AGENT_HOME}}/global-variables.md` — where the repos root variable is defined.

**External authoritative sources:**
- [git clone documentation](https://git-scm.com/docs/git-clone) — the clone step.

## Related

- `{{AGENT_HOME}}/procedures/bootstrap-agentic-sdlc.procedure.md` — per-repo setup, including the System context section.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` — the framework that uses these docs.