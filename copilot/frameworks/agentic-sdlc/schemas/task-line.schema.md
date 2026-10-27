---
schema: schema/v1
last-updated: 2026-10-27
---

# Schema: Task Line Suffix (`task-line/v1`)

**Applies to:** each task line in `specs/<feature>/tasks.md` · **Store:** D · **Written by:** the Orchestrator at P5, after `/speckit-tasks` (the planner) · **Read by:** the Orchestrator, to build launch prompts · **Loaded as:** ③

Spec Kit owns the task line's start (`- [ ] T020 [P] [US2] <description>`). The framework appends **routing information** to it: which department owns the task, who executes it, which integrations it touches, which reference docs to attach, and which procedure (if any) the task must follow. Writing these at planning time (D7) makes every load visible and reviewable at G4. Nothing depends on an agent guessing.

## Structure

```
- [ ] <Tnnn> [P]? [US<n>]? <description> (<path>)  [<Dept>] [<Exec>]
      touches: <none | integration:<svc>[, integration:<svc>]>  ·  refs: <none | <knowledge path>[, …]>  ·  procedure: <none | <stack>/<slug>>  ·  hot-path: <yes|no>
      inputs: <name>=<value>; <name>=<value>                  ← only when the procedure declares inputs
```

| Part | Required | Values | Set by |
|---|---|---|---|
| `[<Dept>]` | yes | a role tag from `conventions.md` §1 | inference rules (`conventions.md` §6), confirmed at G4 |
| `[<Exec>]` | yes | `[llm]` · `[script]` | the same |
| `touches:` | yes for `[llm]` | `none`, or `integration:<svc>` where `<svc>` is a row in architecture §6 | the planner checks the task against §6 |
| `refs:` | yes for `[llm]` | `none`, or paths taken from the matching stack's Reference topics table | the planner checks the task against the "Attach when" column |
| `procedure:` | yes for `[llm]` when the component's stack has a procedure catalog (`{{AGENT_HOME}}/procedures/<stack>/index.md`); otherwise optional | `none`, or `<stack>/<slug>` naming `{{AGENT_HOME}}/procedures/<stack>/<slug>.procedure.md` for the task path's stack | the planner checks the task against the catalog's "Use when" column |
| `inputs:` | yes when the procedure's front-matter lists `inputs` | one `name=value` per declared input, separated by `;`; an optional input (declared `name?`) may be left out, for example `module-path` in a layer-first repo | the planner, from the spec and plan |
| `hot-path:` | no | `yes` · `no` | the plan (performance-sensitive work) |

## Rules

- `none` is explicit. A missing `touches:` or `refs:` means the planner didn't check, and the validator fails it.
- The continuation line is indented under the task, so Spec Kit's checkbox parsing is unaffected.
- The agent may still read an unlisted doc mid-task, but it must report it in the message's `unlisted_needs`.
- **At most one procedure per task.** A procedure is a bounded scope: fixed inputs, fixed steps, a fixed set of paths it may change (`allowed-paths`). Work that needs two procedures is two tasks.
- `refs:` lists material to *read*; `procedure:` names steps to *follow*. A procedure never goes in `refs:`.
- The field is additive: task lines written before 2026-10-27 without `procedure:` still parse; the validator warns where a catalog exists.

## Example

```markdown
- [ ] T021 [US4] Add SyncUsersFromHr use case (src/modules/users/application/)  [Eng] [llm]
      touches: integration:apigee-hr  ·  refs: none  ·  hot-path: no
- [ ] T022 [US4] Batch-upsert 50k users per run (src/modules/users/infrastructure/UserRepo.ts)  [Eng] [llm]
      touches: none  ·  refs: {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md  ·  hot-path: yes
- [ ] T031 [US2] Add Clock port and SystemClock adapter (src/modules/sessions/application/ports/)  [Eng] [llm]
      touches: none  ·  refs: none  ·  procedure: typescript-node/add-port-and-adapter  ·  hot-path: no
      inputs: capability=tell the time; technology=system clock; use-case=ExpireSessions; module-path=modules/sessions
```

## Checks

| Check | Tool |
|---|---|
| Every `[llm]` task has `touches:` and `refs:` | `validate-project.mjs` |
| Every `integration:<svc>` has a row in architecture §6; every `refs:` path exists | `validate-project.mjs` |
| `procedure:` names a procedure of the task path's stack; every declared input is given; `procedure:` is stated where the stack has a catalog (warn) | `validate-project.mjs` |
| Files changed by the task stay inside the procedure's `allowed-paths` | `validate-project.mjs <repo> --task <Tnnn> [--base <ref>]`, at P6 before review |
| Completeness (nothing forgotten) | G4 human review; `unlisted_needs` feedback (open question 3) |
