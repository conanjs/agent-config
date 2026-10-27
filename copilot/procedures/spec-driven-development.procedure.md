# Procedure: Bootstrap Spec-Driven Development (Spec Kit)

Tool-agnostic procedure for adopting [GitHub Spec Kit](https://github.com/github/spec-kit) in a project — the spec → plan → tasks → implement → converge workflow, run through whichever agent (Claude Code, Copilot, Codex) is active in that project.

**This procedure does not vendor Spec Kit.** The `specify` CLI and its templates live upstream at `github/spec-kit` — one canonical source, kept current by that project. This repo only documents how to invoke it and how an agent should behave once it's installed; copying its templates in here would create exactly the kind of second copy this repo's own `patterns/index.md` warns against.

**Inputs needed:**
- **target repo path** (optional) — defaults to the current repo.
- **new project or existing repo?** — determines which `specify init` form to use (Step 2).
- **agent integration** — `claude`, `copilot`, or `codex` (whichever is actually driving this project) — passed as `--integration <key>`. (Older Spec Kit used `--ai <value>`; that flag was removed in Spec Kit 0.10.0, so current releases reject it.)

## Steps

1. **Confirm prerequisites.** Spec Kit needs Python 3.11+ and a supported coding agent. Its CLI is distributed via `uv` (Python's package/tool manager) or `uvx` for a one-off run without installing. If `uv` isn't installed, get it from [astral.sh's install docs](https://docs.astral.sh/uv/getting-started/installation/) first — don't assume it's present.

2. **Initialize, based on which case applies:**
   - **Brand-new project** (nothing there yet): `uv tool install specify-cli` once (global, one-time), then `specify init <project-name> --integration <key>`.
   - **Existing repo** (already has code, like most real work here): `specify init --here --integration <key>` from inside the repo. If the directory isn't empty, `specify` will ask to confirm; `--force` skips that prompt — only pass `--force` after confirming with whoever's running this that it's actually wanted, same as any other command that writes into an existing tree unprompted. Upstream's existing-project guide uses `specify init --here --force --integration <key>`, and warns that `--force` "may replace files at conflicting managed paths" (it does not delete the rest of the application) — so commit or stash first and do the adoption on its own branch.
   - **One-off, without installing anything globally**: `uvx --from git+https://github.com/github/spec-kit.git specify init <args>` (e.g. `… specify init --here --integration <key>`) — same effect, nothing left behind afterward except the project's own `.specify/` output.

3. **Verify the working tree was clean before Step 2 ran** (`git status`) — same standing habit as every other procedure here; makes the change trivially reviewable/revertable as a single diff.

4. **Know what `specify init` actually produced**, so it doesn't get mistaken for something agent-config manages:
   - `.specify/` — memory (`constitution.md`), templates, and scripts. This is per-project, lives in the target repo, and is **not** touched by this repo's own `mapping.yaml`/installers.
   - Agent-specific skill or command files — these are what actually register the commands below inside that project. Claude Code: `.claude/skills/speckit-<command>/SKILL.md` (current Spec Kit writes skills; older releases wrote `.claude/commands/speckit-*.md`). Copilot: skills under `.github/skills/` in its default skills mode. They're generated fresh per project, not something to copy from one repo to another by hand.

5. **Follow the workflow in this order** (each is a command run in the agent's chat, not the terminal, inside the now-initialized project; review each result before the next):
   1. `/speckit-constitution` — once, near the start of the project. Establishes the project's own principles/constraints (code quality bar, testing expectations, architectural non-negotiables) that every later phase must respect.
   2. `/speckit-specify` — once per feature. Captures *what* and *why*, deliberately not *how* — implementation approach doesn't belong here yet.
   3. *(optional quality gate)* `/speckit-clarify` — after specify, before plan. Asks up to five targeted questions about underspecified parts of the spec and writes the answers back into it.
   4. `/speckit-plan` — once per feature, after specify. Turns the spec into a concrete technical approach.
   5. *(optional quality gate)* `/speckit-checklist` — after plan, before tasks. Generates a quality checklist for the *requirements* (complete, clear, consistent) — it tests the spec, not the code.
   6. `/speckit-tasks` — breaks the plan into discrete, actionable tasks (`tasks.md`, in dependency order).
   7. *(optional quality gate)* `/speckit-analyze` — after tasks, before implement. Read-only consistency check across `spec.md`, `plan.md` and `tasks.md`; it never edits files, so fix any finding at its source and re-run.
   8. `/speckit-implement` — executes the tasks.
   9. `/speckit-converge` — after implement. Checks the codebase against the spec, plan and tasks. If it finds gaps it appends new tasks to `tasks.md` (its only write — it never edits code); run `/speckit-implement` and converge again until it reports **Converged**.

   Upstream's quickstart calls 1–2, 4, 6, 8–9 the shorter path (constitution once, then specify → plan → tasks → implement → converge) and adds 3, 5 and 7 in the full path for larger or riskier features.

   **Invocation spelling depends on the agent:** Claude Code and Copilot (default skills mode) use `/speckit-<command>` as above; Codex uses `$speckit-<command>`; Spec Kit's reference pages write the same commands in dotted form, `/speckit.<command>`.

6. **Agent behavior during each phase** — this repo doesn't restate general explanation/verification rules here; they already apply globally via `personal-defaults.instructions.md` (e.g. don't state unverified technical behavior as fact; use `explaining-mechanisms.pattern.md` if a phase's output needs explaining to a human as a multi-actor flow). The one Spec-Kit-specific point: **don't skip ahead a phase** (e.g. writing implementation code during `/speckit-specify`) even if the answer seems obvious — the phases exist specifically so a human can review intent before commitment to an approach, and approach before commitment to code. And don't stop at `/speckit-implement`: the feature is done only when `/speckit-converge` reports **Converged** (or a human decides the remaining tasks are out of scope). Put a limit on implement → converge rounds and ask a human if it keeps finding gaps.

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
- [Spec Kit installation guide](https://github.github.com/spec-kit/installation.html) — `uv` install, Python 3.11+, and `specify init` flags (`--here`, `--integration`, `--force`) referenced in Steps 1–2; notes that the old `--ai` form fails.
- [Spec Kit existing-projects guide](https://github.github.io/spec-kit/guides/existing-projects.html) — `specify init --here --force --integration <key>`, the `--force` warning, and commit/branch-first advice (Step 2).
- [Spec Kit one-time usage (uvx)](https://github.com/github/spec-kit/blob/main/docs/install/one-time.md) — the `uvx --from git+…` forms in Step 2.
- [Spec Kit Claude Code integration](https://github.github.io/spec-kit/integrations/claude.html) — skills at `.claude/skills/speckit-<command>/SKILL.md`, invoked as `/speckit-<command>` (Steps 4–5).
- [Spec Kit quickstart](https://github.github.com/spec-kit/quickstart.html) — the full and shorter paths, and the implement → converge loop until **Converged** (Step 5).
- [Agentic SDD command reference](https://github.github.com/spec-kit/reference/agentic-sdd.html) — what each command does (clarify optional, analyze read-only, converge writes only `tasks.md`) and invocation forms per integration (Step 5).
- [Spec Kit command invocation](https://github.github.io/spec-kit/integrations/cli.html#command-invocation) — `/speckit-*` (Copilot skills), `$speckit-*` (Codex), dotted `/speckit.*` in references (Step 5).
- [Spec Kit CHANGELOG](https://github.com/github/spec-kit/blob/main/CHANGELOG.md) — 0.10.0 "remove legacy --ai, --ai-commands-dir, and --ai-skills flags"; 0.11.2 "add /speckit.converge command"; 0.14.2 "Claude Code files live in .claude/skills, not .claude/commands"; 0.16.0 Copilot "default integration to skills".
- [uv installation docs](https://docs.astral.sh/uv/getting-started/installation/) — the prerequisite tool referenced in Step 1.

## Related

- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` — why this is one procedure file with thin per-tool wrappers, not restated per agent.
- `copilot/patterns/explaining-mechanisms.pattern.md` — use this if a phase's output (e.g. the generated plan) needs explaining to a human as a multi-actor flow.
