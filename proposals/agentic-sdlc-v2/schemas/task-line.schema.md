---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Task Line Suffix (`task-line/v1`)

**Applies to:** each task line in `specs/<feature>/tasks.md` · **Store:** D · **Written by:** the Orchestrator at P5, after `/speckit-tasks` (the planner) · **Read by:** the Orchestrator, to build launch prompts · **Loaded as:** ③

Spec Kit owns the task line's start (`- [ ] T020 [P] [US2] <description>`). The framework appends **routing information** to it: which department owns the task, who executes it, which integrations it touches, and which reference docs to attach. Writing these at planning time (D7) makes every load visible and reviewable at G4. Nothing depends on an agent guessing.

## Structure

```
- [ ] <Tnnn> [P]? [US<n>]? <description> (<path>)  [<Dept>] [<Exec>]
      touches: <none | integration:<svc>[, integration:<svc>]>  ·  refs: <none | <knowledge path>[, …]>  ·  hot-path: <yes|no>
```

| Part | Required | Values | Set by |
|---|---|---|---|
| `[<Dept>]` | yes | a role tag from `conventions.md` §1 | inference rules (`conventions.md` §6), confirmed at G4 |
| `[<Exec>]` | yes | `[llm]` · `[script]` | the same |
| `touches:` | yes for `[llm]` | `none`, or `integration:<svc>` where `<svc>` is a row in architecture §6 | the planner checks the task against §6 |
| `refs:` | yes for `[llm]` | `none`, or paths taken from the matching stack's Reference topics table | the planner checks the task against the "Attach when" column |
| `hot-path:` | no | `yes` · `no` | the plan (performance-sensitive work) |

## Rules

- `none` is explicit. A missing `touches:` or `refs:` means the planner didn't check, and the validator fails it.
- The continuation line is indented under the task, so Spec Kit's checkbox parsing is unaffected.
- The agent may still read an unlisted doc mid-task, but it must report it in the message's `unlisted_needs`.

## Example

```markdown
- [ ] T021 [US4] Add SyncUsersFromHr use case (src/application/users/)  [Eng] [llm]
      touches: integration:apigee-hr  ·  refs: none  ·  hot-path: no
- [ ] T022 [US4] Batch-upsert 50k users per run (src/infrastructure/userRepo.ts)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md  ·  hot-path: yes
```

## Checks

| Check | Tool |
|---|---|
| Every `[llm]` task has `touches:` and `refs:` | `validate-project.mjs` |
| Every `integration:<svc>` has a row in architecture §6; every `refs:` path exists | `validate-project.mjs` |
| Completeness (nothing forgotten) | G4 human review; `unlisted_needs` feedback (open question 3) |
