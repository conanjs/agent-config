# Loop Engineering — Applied Playbook

Companion to [[loop-engineering]] (the concept/mechanism doc). That doc answers "what is it" — this one answers "what do I actually build." Split for the same reason `analytics/part-1..4` is split: the concept is stable, this playbook will change as templates get tried and revised against real repos.

## 1. Decision rule — when it's worth the setup

Loop engineering has setup cost (a policy skill + a hook, minimum). Don't pay it when plain instructions are already sufficient — that's when *you* are the loop (reviewing each turn yourself already catches what a hook would).

| Task shape | Loop-engineer it? | Why |
|---|---|---|
| One-off small edit, you're watching and will review the diff | **No** — plain instructions | You're already the verification step; a hook is redundant |
| Feature/bugfix where "done" is objectively checkable (tests/types/lint) and you want fewer manual round-trips | **Yes** — policy skill + hook | Removes self-grading risk (§ "hooks vs instructions" discussion, see [[loop-engineering]] §9) |
| Batch/migration work across many files, repetitive, could run unattended | **Yes** — full stack incl. autonomous execution | High iteration count makes manual babysitting the actual bottleneck |

## 2. The 5-step build checklist

1. **Objective + machine-checkable stop condition.** Not "code looks good" — a command with an exit code. In this repo (`ne-manage-shipment-frontend`), the real checks are: `yarn type-check` (`tsc -p tsconfig.custom.json`), `yarn lint` (`next lint --dir src`), `yarn test` (`jest --coverage=false`), `yarn build`.
2. **Policy skill** — phases + an explicit circuit-breaker threshold. Same shape as `systematic-debugging` (Phase 1–4, "3+ fails → stop and ask," not infinite retry).
3. **Mechanical check wiring** — a `PostToolUse` hook running the real command, *or*, if a hook is overkill for the task's stakes, an explicit instruction line ("after every edit, run `yarn type-check && yarn lint` and paste the output before claiming done") — weaker, but zero setup.
4. **Execution mode** — interactive (you drive; the Claude Code session itself is the loop) vs. autonomous/background (the `/loop` skill, or an external `until <check>; do ...; done` script) for things that don't need you present each cycle.
5. **Escalation path** — what happens when the circuit breaker trips. Must be a human checkpoint, not "try again." (This is the one step every "no root cause" agent horror story skips.)

## 3. Template A — policy skill skeleton (feature implementation)

Same shape as `systematic-debugging/SKILL.md`, retargeted at "implement a feature" instead of "debug a bug." Save as `.claude/skills/feature-implementation/SKILL.md` (project-scoped) when you want it enforced automatically for this repo, or invoke ad hoc.

```markdown
---
name: feature-implementation
description: Four-phase loop for implementing a feature/task — plan before code, verify before done, escalate instead of thrashing.
---

# Feature Implementation Loop

## The Iron Law
NO "DONE" WITHOUT A PASSING MECHANICAL CHECK.

## Phase 1: Understand
- Restate the requirement and acceptance criteria in your own words before touching code.
- Find the nearest existing pattern in the codebase (component, hook, service) doing something similar — read it fully.

## Phase 2: Plan
- List the files you expect to touch and why.
- Identify the stop condition up front: which of `yarn type-check`, `yarn lint`, `yarn test`, `yarn build` must pass, plus any manual acceptance criteria a human still has to eyeball (e.g. UI look).

## Phase 3: Implement
- Smallest coherent change that satisfies Phase 2's plan. No unrelated refactors.

## Phase 4: Verify
- Run the stop-condition commands from Phase 2. Report actual output, not a paraphrase.
- Failed? Form ONE hypothesis for why, fix, re-run.
- **3 failed verify passes on the same issue → STOP. Report to human with what was tried. Do not attempt a 4th fix unprompted.**
```

## 4. Template B — mechanical check via Claude Code hook

Verified schema (Claude Code docs, Sep 2026 — see References). Project-scoped, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "yarn type-check && yarn lint"
          }
        ]
      }
    ]
  }
}
```

This fires after every file edit and surfaces a real exit code back into the loop — the agent can no longer just *say* the types are fine. Add `yarn test -- <changed-spec>` in a `Stop` hook if you want the full suite gated only at the end (cheaper than running it after every single edit).

Don't hand-roll this file from memory when you're ready to actually wire it — invoke the `update-config` skill, it exists specifically to configure `settings.json` correctly.

## 5. Template C — autonomous/background loop (batch work)

For repetitive, high-iteration-count tasks where you don't want to sit through every cycle (e.g. touching many files the same way): the "Ralph Loop" pattern from [[loop-engineering]] §6.

```bash
until yarn type-check && yarn lint; do
  claude -p "type-check/lint is failing, output above — fix it, one issue at a time"
done
```

Only reach for this once Template A + B already work interactively — an unattended loop with a self-graded stop condition is exactly the infinite-loop failure mode in [[loop-engineering]] §7. The external exit-code check is what makes it safe to leave unattended, not the prompt.

## 6. Worked example against this repo — dead-code migration

`dead-code-rules.md`, `dead-code-deletion-guide.md`, `dead-code-report-shared.csv`, `dead-code-report-non-shared.csv`, and `import-migration-plan.md` are already sitting in this repo's working tree (currently the two `.md` rule files are empty placeholders — not yet populated). This is a genuinely good fit for the full stack:

- **Objective:** delete code flagged in the CSV reports without breaking the build.
- **Stop condition:** `yarn build && yarn type-check && yarn test` all pass, *and* the deleted symbol has zero remaining references (`grep`-checkable).
- **Policy skill:** once `dead-code-rules.md` is actually filled in, it *is* the rubric — a Verification Loop grader (§5 of [[loop-engineering]]) can literally read it as the pass/fail criteria for "is this safe to delete."
- **Execution mode:** batch/autonomous fits well here (Template C) — many independent, mechanically-checkable deletions, low judgment per item.
- **Circuit breaker:** if a deletion breaks the build 2x in a row for the same symbol, stop deleting it and flag it in `import-migration-plan.md` for manual review instead of retrying blindly.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering.md` — concept doc this playbook applies.
- `/Users/vinh.doq/workspace/ots-projects/one-ai-armor/skills/common/systematic-debugging/SKILL.md` — the policy-skill shape Template A is modeled on.
- `ne-manage-shipment-frontend/package.json` — source of the actual `type-check`/`lint`/`test`/`build` script names used in the templates (verified by reading the file directly, 2026-09-14).
- `ne-manage-shipment-frontend/dead-code-*.{md,csv}`, `import-migration-plan.md` — in-progress work used as the worked example in §6.

**External authoritative sources:**
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks) — verified `PostToolUse` JSON schema used in Template B.

## Related

- [[loop-engineering]] — the concept/mechanism doc this playbook implements.
- `update-config` skill (this environment) — the correct way to actually write hook config, rather than hand-editing `settings.json` from a template that may drift from the live schema.
- Worth a future doc once tried for real: how well the `systematic-debugging` circuit-breaker threshold (3 fails) generalizes to feature work vs. bug fixes — they may warrant different thresholds.
