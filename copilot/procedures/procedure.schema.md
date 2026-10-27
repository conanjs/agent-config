---
schema: schema/v1
last-updated: 2026-10-27
---

# Schema: Procedure (`procedure/v1`)

**Applies to:** `copilot/procedures/**/<slug>.procedure.md` · **Written by:** humans, or agents when a repeatable multi-step task shows up (`patterns/shared-procedure-thin-wrapper.pattern.md`) · **Read by:** any agent running the task, and its thin per-tool wrappers · **Checked by:** `tools/validate-procedures.mjs`

A procedure is **one repeatable task, written once in tool-neutral prose**. Many procedures tell an agent how to drive an *external* tool (Spec Kit, GitHub, git). Those tools change on their own schedule, so a procedure that was right when written goes stale silently. This schema makes that visible: every external tool the procedure describes is listed with the version it was checked against and the date, and the validator warns when either gets old.

Analogy: the **"best before" date and batch number** on a food label. The food may still be fine after the date, but you know to check it, and the batch number tells you which recipe it was made from.

Precedent: `spec-driven-development.procedure.md` was written on 2026-09-20 using `specify init --ai`, a flag Spec Kit had removed in 0.10.0 three months earlier, and `.claude/commands/` paths it had moved in 0.14.2. Nothing recorded what version it was written against, so nothing flagged it.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `procedure/v1` |
| `last-updated` | yes | Date of the last content change |
| `depends-on` | yes | External tools whose behaviour the steps state directly. `[]` when there are none (the procedure only uses this repo's own files or delegates to another procedure) |
| `last-verified` | yes if any dependency has a version | Date every `depends-on` source was last re-checked against the steps |

Each `depends-on` entry:

| Key | Required | Meaning |
|---|---|---|
| `tool` | yes | Human name, e.g. `GitHub Spec Kit (specify CLI)` |
| `verified-against` | yes | The upstream version the steps were checked against (e.g. `v1.2.3`), or `unverified` if never checked |
| `source` | yes | URL of the authoritative doc the steps were checked against |
| `repo` | no | `owner/name` on GitHub; lets `--upstream` compare `verified-against` with the latest release |

Stack procedures (files under `procedures/<stack>/`) also declare their **bounded scope**, so the Orchestrator can assign them to a task (`task-line.schema.md`, `procedure:`):

| Key | Required | Meaning |
|---|---|---|
| `stack` | yes, under `procedures/<stack>/` only | The stack id; equals the folder name |
| `inputs` | yes, under `procedures/<stack>/` only | Kebab-case names of the values the task line must supply (`inputs: name=value; …`); `[]` if none. A trailing `?` marks an optional input (`module?`), which the task line may omit. Each is described in **Inputs needed:** as `**<name>**` |
| `allowed-paths` | yes, under `procedures/<stack>/` only | Globs (`*`, `**`), relative to the component's path in `docs/architecture.md` §3, of every file a task following this procedure may change. A glob may name an input as `{name}` (`src/{module}/application/**`); `validate-project.mjs --task` fills it from the task line, and an empty optional input drops its path segment (`src/application/**`). It fails a task that changed anything else |

No other keys are allowed.

```yaml
---
schema: procedure/v1
last-updated: 2026-10-27
depends-on: []
stack: typescript-node
inputs: [capability, technology, use-case]
allowed-paths:
  - src/application/**
  - src/infrastructure/**
  - src/CompositionRoot.ts
  - test/**
---
```

```yaml
---
schema: procedure/v1
last-updated: 2026-10-27
last-verified: 2026-10-27
depends-on:
  - tool: GitHub Spec Kit (specify CLI)
    verified-against: v1.2.3
    source: https://github.github.com/spec-kit/quickstart.html
    repo: github/spec-kit
---
```

## Required structure

```markdown
# Procedure: <task>

<one paragraph: what it does, that it is tool-neutral, who wraps it>

**Inputs needed:** …            ← when the task takes inputs

## Steps
## What this procedure does NOT do   ← optional
## References                        ← local artifacts and, when depends-on is not empty, the external sources
## Related
```

## Rules

| Id | Rule | Enforced by |
|---|---|---|
| PR-1 | Front-matter present, `schema: procedure/v1`, only the keys above, dates `YYYY-MM-DD` | script |
| PR-2 | Every `depends-on` entry has `tool`, `verified-against`, `source` (a URL); `repo` is `owner/name`; any versioned entry requires `last-verified` | script |
| PR-3 | Title `# Procedure: …`; sections Steps → References → Related, Related last; References lists external sources when `depends-on` is not empty | script |
| PR-4 | Freshness: a dependency that is `unverified`, or a `last-verified` older than 90 days, is flagged for re-verification | script (warn) |
| PR-5 | Upstream drift: the latest GitHub release of a `repo` differs from `verified-against` | script (warn, `--upstream`, weekly in CI) |
| PR-7 | A procedure under `procedures/<stack>/` declares `stack` (= folder), `inputs` (each described under **Inputs needed:**) and a non-empty `allowed-paths` of repo-relative globs, and is listed in that folder's `index.md` catalog with a "Use when" | script |
| PR-6 | Re-verifying means opening each `source` (and the tool's changelog since `verified-against`), fixing every step that changed, then updating `verified-against` and `last-verified` together. Never bump the version or date without the check | llm (`review-docs.procedure.md`) |

## Checks

| Check | Tool |
|---|---|
| PR-1 … PR-4, PR-7 | `node copilot/procedures/tools/validate-procedures.mjs` (also run by `scripts/check-docs.sh`: pre-commit, Claude Code hook, CI) |
| PR-5 | `… validate-procedures.mjs --upstream` (weekly CI job; set `GITHUB_TOKEN` locally to avoid rate limits) |
| PR-6 | `procedures/review-docs.procedure.md` |

## References

**Local artifacts:**
- `copilot/procedures/tools/validate-procedures.mjs` — the validator for PR-1 … PR-5.
- `scripts/check-docs.sh`, `.githooks/pre-commit`, `.github/workflows/validate-docs.yml` — where it runs.
- `copilot/procedures/spec-driven-development.procedure.md` — the precedent above, and the first procedure with a versioned dependency.

**External authoritative sources:**
- [Spec Kit CHANGELOG](https://github.com/github/spec-kit/blob/main/CHANGELOG.md) — 0.10.0 removed `--ai`; 0.14.2 moved Claude Code files to `.claude/skills` (the precedent).
- [GitHub REST API: Get the latest release](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) — the endpoint PR-5 uses.

## Related

- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` — why procedures are written once and wrapped per tool.
- `copilot/procedures/review-docs.procedure.md` — the review that performs PR-6.
- `copilot/frameworks/knowledge/schemas/_system.md` — the matching rules for knowledge docs.
