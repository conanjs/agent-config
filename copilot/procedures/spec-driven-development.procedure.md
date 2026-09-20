# Procedure: Bootstrap Spec-Driven Development (Spec Kit)

Tool-agnostic procedure for adopting [GitHub Spec Kit](https://github.com/github/spec-kit) in a project — the spec → plan → tasks → implement workflow, run through whichever agent (Claude Code, Copilot, Codex) is active in that project.

**This procedure does not vendor Spec Kit.** The `specify` CLI and its templates live upstream at `github/spec-kit` — one canonical source, kept current by that project. This repo only documents how to invoke it and how an agent should behave once it's installed; copying its templates in here would create exactly the kind of second copy this repo's own `patterns/index.md` warns against.

**Inputs needed:**
- **target repo path** (optional) — defaults to the current repo.
- **new project or existing repo?** — determines which `specify init` form to use (Step 2).
- **agent integration** — `claude`, `copilot`, or `codex` (whichever is actually driving this project) — passed as `--ai <value>`.

## Steps

1. **Confirm prerequisites.** Spec Kit's CLI is distributed via `uv` (Python's package/tool manager) or `uvx` for a one-off run without installing. If `uv` isn't installed, get it from [astral.sh's install docs](https://docs.astral.sh/uv/getting-started/installation/) first — don't assume it's present.

2. **Initialize, based on which case applies:**
   - **Brand-new project** (nothing there yet): `uv tool install specify-cli` once (global, one-time), then `specify init <project-name> --ai <agent>`.
   - **Existing repo** (already has code, like most real work here): `specify init --here --ai <agent>` from inside the repo. If the directory isn't empty, `specify` will ask to confirm; `--force` skips that prompt — only pass `--force` after confirming with whoever's running this that it's actually wanted, same as any other command that writes into an existing tree unprompted.
   - **One-off, without installing anything globally**: `uvx --from git+https://github.com/github/spec-kit.git specify init <args>` — same effect, nothing left behind afterward except the project's own `.specify/` output.

3. **Verify the working tree was clean before Step 2 ran** (`git status`) — same standing habit as every other procedure here; makes the change trivially reviewable/revertable as a single diff.

4. **Know what `specify init` actually produced**, so it doesn't get mistaken for something agent-config manages:
   - `.specify/` — memory (`constitution.md`), templates, and scripts. This is per-project, lives in the target repo, and is **not** touched by this repo's own `mapping.yaml`/installers.
   - Agent-specific command files (e.g. Claude Code's `.claude/commands/speckit-*.md`, or Copilot's equivalent) — these are what actually register the slash commands below inside that project. They're generated fresh per project, not something to copy from one repo to another by hand.

5. **Follow the workflow in this order** (each is a slash command, run inside the now-initialized project):
   1. `/speckit-constitution` — once, near the start of the project. Establishes the project's own principles/constraints (code quality bar, testing expectations, architectural non-negotiables) that every later phase must respect.
   2. `/speckit-specify` — once per feature. Captures *what* and *why*, deliberately not *how* — implementation approach doesn't belong here yet.
   3. `/speckit-plan` — once per feature, after specify. Turns the spec into a concrete technical approach.
   4. `/speckit-tasks` — breaks the plan into discrete, actionable tasks.
   5. `/speckit-implement` — executes the tasks.

6. **Agent behavior during each phase** — this repo doesn't restate general explanation/verification rules here; they already apply globally via `personal-defaults.instructions.md` (e.g. don't state unverified technical behavior as fact; use `explaining-mechanisms.pattern.md` if a phase's output needs explaining to a human as a multi-actor flow). The one Spec-Kit-specific point: **don't skip ahead a phase** (e.g. writing implementation code during `/speckit-specify`) even if the answer seems obvious — the phases exist specifically so a human can review intent before commitment to an approach, and approach before commitment to code.

## What this procedure does NOT do

- **Vendor or mirror Spec Kit's own files.** See the note above — upstream `github/spec-kit` is the one canonical source.
- **Pick which agent integration to use.** That's a per-project, per-human decision (Step "Inputs needed" above), not something to default silently.
- **Write a project's constitution or specs for it unprompted.** `/speckit-constitution` and `/speckit-specify` capture real project-specific intent — this procedure only gets the tooling in place to run them.

## References

**Local artifacts:**
- `copilot/prompts/spec-driven-development.prompt.md` — the Copilot-specific invokable wrapper for this procedure.
- `copilot/procedures/init-github-governance.procedure.md` — the sibling procedure a new project will often want alongside this one.

**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit) — the project itself; canonical source for the CLI and templates.
- [Spec Kit installation guide](https://github.github.com/spec-kit/installation.html) — `uv`/`uvx` install and `specify init` flags (`--here`, `--ai`, `--force`) referenced in Step 2.
- [uv installation docs](https://docs.astral.sh/uv/getting-started/installation/) — the prerequisite tool referenced in Step 1.

## Related

- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` — why this is one procedure file with thin per-tool wrappers, not restated per agent.
- `copilot/patterns/explaining-mechanisms.pattern.md` — use this if a phase's output (e.g. the generated plan) needs explaining to a human as a multi-actor flow.
