# Procedures: TypeScript on Node.js (`typescript-node`)

Step-by-step procedures for recurring code tasks in a repo whose component has `stack: typescript-node`. Each one produces code shaped like the stack reference (pinned in `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`) and cites the rules it applies; it never restates them. The planner assigns one to a task with the task line's `procedure:` field (D11), matching the "Use when" column below; in standalone use the `sdlc-stack-typescript-node` skill finds it here.

| Procedure | Use when |
|---|---|
| [add-port-and-adapter.procedure.md](add-port-and-adapter.procedure.md) | A use case needs a new capability from outside the core (storage, clock, external API, hashing) |

A procedure is done only when the repo's checks pass. If a step and a rule disagree, the rule wins and the procedure gets fixed.

## References

- `{{AGENT_HOME}}/patterns/artifact-types.pattern.md` — why procedures live here and skills only point at them.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/reference.md` — the pinned reference repo whose code these procedures produce.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/schemas/task-line.schema.md` — the `procedure:` and `inputs:` fields that assign a procedure to a task.

## Related

- `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — the stack rules (TSN-n).
