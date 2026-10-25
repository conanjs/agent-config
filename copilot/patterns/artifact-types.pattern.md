# Pattern: Artifact Types

**Use when:** adding anything new to this repo that an AI agent will read or run, and you must decide *what kind of file it is* and *where it lives* (instruction, skill, prompt, agent, procedure, framework, knowledge, pattern).

## The idea

These types are **not one list**. They sit on three axes. Pick the axis first, then the type.

| Axis | Question | Types |
|---|---|---|
| **Trigger** | How does it start? | Instruction, Skill, Prompt |
| **Actor** | Who runs it? | Agent |
| **Content** | What gets read? | Procedure, Framework, Knowledge, Pattern |

## The types

| Type | One-line definition | Loaded when | Home | Example |
|---|---|---|---|---|
| **Instruction** | A preference that applies to every request | Every session, automatically | `copilot/instructions/` | `personal-defaults.instructions.md` |
| **Skill** | A capability the model finds by its `description` | When the description matches the task | `skills/<name>/SKILL.md` (flat) | `sdlc-stack-go` |
| **Prompt** | A shortcut a human invokes, with arguments | When the user types it | `copilot/prompts/` | `init-repo-kb.prompt.md` |
| **Agent** | A persona with its own context, tools and model | When delegated to | `copilot/agents/` (+ per-tool wrappers) | `sdlc-qa` |
| **Procedure** | The ordered steps of one repeatable task; **has no trigger of its own** | When a skill or prompt points at it | `copilot/procedures/` | `init-repo-kb.procedure.md` |
| **Framework** | Rules and schemas for a domain | When a role or procedure cites it | `copilot/frameworks/<name>/` | `agentic-sdlc` |
| **Knowledge** | Explanations of how things work, not orders | When cited | `copilot/knowledge/<topic>/` | `grpc/stale-connection-keepalive.md` |
| **Pattern** | A named way to build things in this repo | When designing a new artifact | `copilot/patterns/` | `shared-procedure-thin-wrapper` |

## Decision order

Ask in this order; the first "yes" wins.

1. Should it apply to **every** request? → Instruction.
2. Does it need **its own context, tool limits or model**? → Agent.
3. Will a **human type a command with arguments**? → Prompt (a thin wrapper).
4. Should the **model find it by description**? → Skill.
5. Is it the **steps of a task**? → Procedure.
6. Otherwise: a rule that can fail a review → Framework; an explanation → Knowledge; a how-we-build-things rule → Pattern.

## Rules

1. **Trigger = skill or prompt. Content = procedure.** A skill or prompt points at a procedure and never restates its steps. This is [Shared Procedure + Thin Wrapper](shared-procedure-thin-wrapper.pattern.md) applied to triggers.
2. **Skills stay flat.** Deployed layout is `<skills-dir>/<name>/SKILL.md`; no tool documents nested skill folders. Namespace with a name prefix (`sdlc-*`), not folders.
3. **Skill frontmatter stays inside the open standard** (agentskills.io): `name` (must equal the folder name), `description`, and optionally `license`, `compatibility`, `metadata`, `allowed-tools`. Tool-only keys belong in agent wrappers, not skills.
4. **Skill, procedure overlap is deliberate.** A skill is a procedure plus a trigger. Revisit collapsing procedures into skills only if most procedures end up with a skill wrapper anyway.

## Checklist when adding something new

1. Walk the decision order above and write down which type it is.
2. Put it in that type's home. Do not nest it inside the subject's framework (see the placement rule in Shared Procedure + Thin Wrapper).
3. If it needs a trigger, add the thinnest skill or prompt that points at it.
4. Add the new entry to the relevant `index.md`.

## References

**Local artifacts:**
- `shared-procedure-thin-wrapper.pattern.md`: the wrapper rule this pattern builds on.
- `proposals/agent-artifact-taxonomy.md`: the investigation behind this pattern, with sources.
- `mapping.yaml`: where each type is deployed per tool.

**External authoritative sources:**
- [Agent Skills specification](https://agentskills.io/specification): the open skill format.
- [Claude Code skills](https://code.claude.com/docs/en/skills.md): discovery paths and frontmatter.

## Related

- `index.md`: the catalog this pattern is listed in.
