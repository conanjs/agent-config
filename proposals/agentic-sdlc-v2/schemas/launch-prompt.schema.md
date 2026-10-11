---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Launch Prompt (`launch-prompt/v1`)

**Applies to:** the first message of every role launch · **Store:** runtime (not committed) · **Written by:** the Orchestrator, or the user in standalone use · **Read by:** the launched role instance · **Loaded as:** the carrier of ② and ③

The **work order**. The launched agent has no memory of the conversation, so this packet is all it knows about the job. It holds **ids and paths, not pasted content**. The agent reads the files itself, which keeps the packet small and the sources exact. The preset (①) is not listed here: the role file defines it.

## Structure

```yaml
schema: launch-prompt/v1
mode: propose | decide | execute | review        # required
role: <role-id>                                   # required
phase: P0..P7 | standalone                        # required
task: "<the task line verbatim>"                  # required for execute/review
profiles:                                         # one key per dimension in conventions §4 that applies
  stack: <id>
  framework: <id>
  paradigm: <id>@<major>
state:
  constitution: .specify/memory/constitution.md
  architecture: docs/architecture.md
  spec: specs/<feature>/spec.md
  plan: specs/<feature>/plan.md
  research: specs/<feature>/research.md
  tasks: specs/<feature>/tasks.md
  integrations: [docs/integrations/<svc>.md]      # copied from the task line's touches: (D7)
  references: [{{AGENT_HOME}}/knowledge/<topic>/<doc>.md]   # copied from the task line's refs: (D7)
  trees: [trees/<name>.tree.md]                   # decide mode only
  review_target: [<paths under review>]           # review mode only
context:                                          # retries only
  attempt: <n> of <budget+1>
  feedback: |
    <failing tool output or review findings, verbatim>
output: schemas/message.schema.md
```

## Rules

- **Resolution of `profiles`:**
  1. Take the task's path.
  2. Find the longest matching component `path` in architecture §3.
  3. Find the longest matching layer `path` in §4.
  4. For each dimension, use the layer value if set, otherwise the component value.
  5. Leave out a dimension that has no value.
- `state.integrations` and `state.references` are **copied** from the task line (`task-line.schema.md`). The Orchestrator never invents them.
- An absent optional state key is left out, not given an empty value. `integrations: []` and `references: []` are allowed, and mean the planner checked and found none.
- **Standalone use:** `phase: standalone`. `profiles` are resolved in this order: the request, then `docs/architecture.md`, then manifest detection, then asking the user. Spec-dependent checks are reported as N/A.
- Never include secrets or file contents. Paths only.

## Example

```yaml
schema: launch-prompt/v1
mode: execute
role: engineering
phase: P6
task: "T021 [US4] Add SyncUsersFromHr use case (src/application/users/) [Eng] [llm] · touches: integration:apigee-hr · refs: none · hot-path: no"
profiles: { stack: typescript-node, framework: express, paradigm: class-modeled@1 }
state:
  constitution: .specify/memory/constitution.md
  architecture: docs/architecture.md
  spec: specs/004-hr-sync/spec.md
  plan: specs/004-hr-sync/plan.md
  tasks: specs/004-hr-sync/tasks.md
  integrations: [docs/integrations/apigee-hr.md]
  references: []
output: schemas/message.schema.md
```

## Checks

| Check | Tool |
|---|---|
| Required keys per mode; every path exists; `profiles` ids exist | Orchestrator self-check before launch |
