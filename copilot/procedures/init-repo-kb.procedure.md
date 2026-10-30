---
schema: procedure/v1
last-updated: 2026-10-27
depends-on: []
---

# Procedure: Initialize a Repo's KB Entry

Tool-agnostic procedure for bootstrapping a `repo-overview` doc for a repo that has none yet, so a newly-cloned/added repo doesn't sit undocumented. Written once here; tool-specific wrappers (Copilot prompt, future Claude Code Skill, etc.) should just point here rather than re-describing these steps.

**Inputs needed:**
- **company** (required) — e.g. `ots`.
- **repos** (optional) — one of:
  - a single name: `ne-shipment-api`
  - a comma-separated list: `ne-shipment-api,ne-api-gateway`
  - `all`, or omitted entirely — auto-discover every repo that needs bootstrapping (see Step 2).

## Steps

1. **Read the framework and the target instance once, before touching any individual repo.** `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` (compliance rules, structure options) and `{{AGENT_HOME}}/frameworks/company-kb/schemas/repo-overview.schema.md` (exact required sections, in order). Then the company's own `{{AGENT_HOME}}/companies/<company>/index.md` — its declared Structure (flat vs. grouped-by-project) and repo-root variable name (e.g. `OTS_REPOS_ROOT`), both defined near the top of that file / in `global-variables.md`. This step happens once regardless of how many repos are being processed.

2. **Resolve the target list of repos.**
   - Explicit single name or comma-separated list given → that's the list, as given.
   - `all` or nothing given → list every immediate subdirectory of `<repos-root-variable>` (flat) or every `<project>/<repo>` two levels deep (grouped), then drop any that already have `companies/<company>/repos/<repo>/overview.md` — what's left is the target list. If nothing is left, say so and stop; don't treat "nothing to do" as an error.
   - Either way, **show the resolved list to whoever asked before processing any of them** — auto-discovery in particular can pick up something unintended (a non-repo directory, a repo intentionally left undocumented); a human check here is cheap and catches that.

3. **For each repo in the resolved list, repeat steps 3a–3h independently** — one repo's failure (can't locate it on disk, already documented) must not abort the others:

   a. **Confirm it isn't already documented.** Check `companies/<company>/repos/<repo>/overview.md` (or the grouped-structure path) doesn't already exist. If it does, skip this repo and note why — this procedure bootstraps, it doesn't overwrite.

   b. **Locate the repo's actual code** at `<repos-root-variable>/<repo>` (flat) or `<repos-root-variable>/<project>/<repo>` (grouped). If it isn't there, skip this repo and say so rather than guessing at content — don't fabricate an overview for code you haven't read.

   c. **Investigate, targeted — not a full exploration.** Enough to fill the schema's required sections, no more:
      - **Purpose / Tech Stack**: `package.json`/`pyproject.toml`/equivalent — name, description, key dependencies, framework.
      - **Entry Point**: the actual start script (`scripts.dev`/`scripts.start` in `package.json`, or the language-equivalent) and the real entry file (`src/main.ts`, `main.py`, etc.) — read enough of it to state how the app actually starts (port, protocol, transport).
      - **Module Map**: top-level `src/` (or equivalent) directory structure, one line per module, 5–10 word description each — a directory listing plus a skim, not full-file reads of everything.
      - **External Integrations**: grep for other known company repos' names, and for obvious outbound client/SDK usage (HTTP clients, gRPC clients, cloud SDKs) — cross-reference against what the company's `index.md` already lists as other repos (including any others in this same batch).
      - **Env Vars (Key)**: `.env.example`/`.env.*` file **names only** (`grep -oE '^[A-Z_]+=' .env.example`) — never read or echo real values, even from a real `.env` file. Pick the 2–4 vars that actually matter to most tasks, not an exhaustive dump; note where the full list lives instead.
      - **Features**: leave empty/omit per `{{AGENT_HOME}}/frameworks/company-kb/schemas/repo-overview.schema.md` if no `features/*.md` exist yet — don't invent feature docs as part of this procedure, that's a separate, harder task requiring business-logic knowledge this step can't reliably infer from code alone.

   d. **Write `overview.md`** with the frontmatter (`schema: repo-overview`, today's date) and every required section in the schema's exact order. Where something can't be confidently determined from step 3c, write the schema's own stub convention (`> _Not documented yet._`) rather than guessing — an honest gap beats a plausible-sounding fabrication.

   e. **Use `{{AGENT_HOME}}`-anchored paths for every cross-reference** (`{{AGENT_HOME}}/companies/<company>/...`), per `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`'s "Structure Options" section — never relative `../` paths.

4. **Register every successfully-processed repo in the company's `index.md`** in one pass after the loop — add one row per repo to its repo table (Repo / Purpose / Path / Doc), using the company's repo-root variable for Path, not a hardcoded machine path. Batching this after the loop (rather than once per repo) avoids N separate edits to the same table.

5. **Report a summary across the whole batch**, not just a per-repo note: which repos got a real `overview.md`, which were skipped and why (already documented / not found on disk), and which sections in the successful ones ended up stubs. Don't silently present a partially-fabricated-feeling doc as complete for any of them.

## What this procedure does NOT do

- Generate `features/*.md` — business-rules content needs more than code-reading; leave that to a human-assisted pass once the feature is actually being worked on (see `{{AGENT_HOME}}/frameworks/company-kb/conventions.md`'s "Update Trigger").
- Overwrite an existing `overview.md` — that's a retrofit/update task, not initialization.
- Create a brand-new company (`companies/<new-company>/`) from nothing — plausible future extension, not built yet; flag it if asked for.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`, `schemas/repo-overview.schema.md` — what this procedure fills in.
- `{{AGENT_HOME}}/frameworks/company-kb/conventions.md` — writing rules this procedure's output must follow.
- `copilot/prompts/init-repo-kb.prompt.md` — the Copilot-specific invokable wrapper for this procedure.
- The 4 OTS repo overviews (`{{AGENT_HOME}}/companies/ots/repos/*/overview.md`) — this procedure is the codified version of how those were actually built/retrofitted.

## Related

- `copilot/prompts/init-repo-kb.prompt.md` — invoke this procedure from VS Code Copilot Chat.
