# Setup

This file is written to be fed to an AI agent (Claude Code, Copilot CLI, etc.) on a machine that just cloned this repo — not primarily for a human to read step-by-step. Give the agent this file and let it execute the steps below.

## Steps (agent: do these in order)

1. **Detect the OS** you're running on.
2. **Run the installer for that OS:**
   - macOS/Linux: `./installers/install.sh`
   - Windows (PowerShell): `.\installers\install.ps1`

   This applies `mapping.yaml` — symlinks the knowledge base, instructions, etc. into place, and seeds `global-variables.md` to `{{AGENT_HOME}}/global-variables.md` (only on first run; a second run won't touch it again). If the installer's output includes a "Backed up pre-existing content to: ..." line, real pre-existing content was moved there rather than overwritten — mention this to the user rather than staying silent about it, especially if anything backed up looks like it might have held content they cared about.

3. **Detect this machine's repo clone path yourself** — don't ask the user to type it. From inside the repo, run `git rev-parse --show-toplevel` (or the equivalent for your shell). This is the value `{{AGENT_CONFIG_REPO}}` needs.

4. **Write that path into the deployed `global-variables.md`** — open `{{AGENT_HOME}}/global-variables.md` (i.e. `~/.copilot/global-variables.md` or `%USERPROFILE%\.copilot\global-variables.md`) and replace the `{{AGENT_CONFIG_REPO}}` row's `<SETUP REQUIRED>` value with the path you detected in step 3.

5. **For each company folder under `{{AGENT_HOME}}/companies/`, detect that company's repo-root variable too** (e.g. `{{OTS_REPOS_ROOT}}` for `companies/ots/`). This isn't a git repo path itself — find it by locating any one of that company's known repos on disk (check `companies/<company>/index.md`'s repo table for real repo names, e.g. `ne-api-gateway`) and taking its parent directory. If none of the listed repos exist on this machine yet, leave the row as `<SETUP REQUIRED>` and tell the user rather than guessing.

6. **Show the user every variable you filled in (step 4 and step 5) and ask them to confirm each is correct** before considering setup done. Don't silently assume detection was right — a wrong path is exactly the kind of error that's easy to miss later, so a human check here matters even though the detection itself is automatic.

7. **Verify the whole chain resolves:** read `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` and confirm you can actually open it. If that works, `{{AGENT_HOME}}` resolution is proven end-to-end.

8. **Mention `{{LANGUAGE}}`** (default: English, in `global-variables.md`) to the user in case they want to change it now — don't change it yourself without being asked.

9. **Check `{{REFERENCE_REPOS_ROOT}}`** in `{{AGENT_HOME}}/global-variables.md` (where stack reference repos get cloned; default `~/agentic-sdlc-references`). On a machine set up before 2026-10-27 the row is missing, because `global-variables.md` is seed-once: copy the row from this repo's `global-variables.md`. **Set the path now; clone later.** Each reference is cloned the first time a project needs it: at project bootstrap for a detected stack (`{{AGENT_HOME}}/procedures/bootstrap-agentic-sdlc.procedure.md` step 4), or when a stack is chosen. Ask the user only whether they want to pre-clone now, for stacks they already work in; if yes, follow each `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/<id>/reference.md` "How to fetch".

10. **Enable the doc checks in this clone:** `pnpm install` (test dependencies: Cucumber.js), then `git config core.hooksPath .githooks`. The pre-commit hook then runs `scripts/check-docs.sh` (the knowledge, procedures, agentic-sdlc and agent-foundry validators, then the Cucumber scenarios in `tests/`; needs Node.js 24, the version in `.nvmrc`, found automatically under nvm) whenever a commit touches `copilot/knowledge/`, `copilot/procedures/`, `copilot/frameworks/{knowledge,agentic-sdlc,agent-foundry}/`, `tests/` or the test setup files. Claude Code sessions in this repo run the same check after each edit (`.claude/settings.json`), and CI runs it on every push (`.github/workflows/validate-docs.yml`). Confirm with `git config core.hooksPath` → `.githooks`.

## What NOT to do

- Don't hand-edit `personal-defaults.instructions.md` to record this machine's repo path — that file is git-tracked and meant to be byte-identical across every machine. The machine-specific value belongs only in the `seed-once`-deployed `global-variables.md`, never in a symlinked/tracked file.
- Don't re-run steps 3–5 on a machine where the relevant variable is already filled in correctly — nothing breaks if you do, but there's no reason to.
- Don't skip step 6's confirmation just because detection seems obviously correct.
- Don't invent a per-company file for company repo-root variables — they belong in `global-variables.md` alongside `{{AGENT_CONFIG_REPO}}`, for the same reason `{{AGENT_CONFIG_REPO}}` isn't in `personal-defaults.instructions.md` (see `global-variables.md`'s "Company repo roots" section for the exact constraint).

## References

**Local artifacts:**
- `global-variables.md` — what gets filled in.
- `mapping.yaml` — the `seed-once` entry that deploys it.
- `README.md` — full reference on the repo's structure and mechanisms.

## Related

- `README.md` "Path & preference variables" section.
