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
  - docs/architecture.md
  - docs/glossary.md
  - docs/integrations/**
  - package.json
  - pnpm-lock.yaml
---

# Procedure: Add a Port and Adapter (typescript-node)

A use case needs something from outside the core: storage, the clock, an external API, password hashing. This procedure adds the port (the interface the use case depends on) and one adapter (the class that implements it with a real technology), wired the way the stack reference does it. Analogy: the port is the wall socket shape; the adapter is the plug for one particular appliance.

**Inputs needed:**
- **capability** (required): what the use case needs, in domain words, e.g. "store documents", "tell the time".
- **technology** (required): what the adapter uses, e.g. "SQLite", "in-memory", "system clock".
- **use-case** (required): the class in `src/application/` that will consume the port.

**Scope:** a task that follows this procedure changes only the `allowed-paths` above (relative to the component's path). `package.json` and the lockfile are in scope only to add the one library the **technology** input names (already chosen in the plan). Anything else it seems to need — a new layer, a change in `src/domain/`, any other dependency — is out of scope: stop and escalate, so the planner can add a task for it.

**Shape to copy** (paths in the stack reference repo at its pinned commit; fetch it as `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/reference.md` "How to fetch" says, or open one file at `https://github.com/conanjs/agentic-sdlc-reference-typescript-node/blob/0f899099b469a63262fd113f2b0a88414c08f30e/<path>`):
- Port: `src/application/ports/DocumentStore.ts`
- Adapter: `src/infrastructure/InMemoryDocumentStore.ts`
- Consumer: `src/application/ReviseDocument.ts`
- Wiring: `src/CompositionRoot.ts`

## Steps

1. **Read the repo's own state first.** `docs/architecture.md` §4 (layer folders, aliases, alias Option) and §7 (Tier B files), and `docs/glossary.md`. The repo's choices outrank the reference's (`conventions.md` §3.4).

2. **Name the port and the adapter.**
   - Port: named for the capability, from the role glossary (NAM-6): no suffix for a single capability (`Clock`), or the repo's chosen `Store`/`Repository` (glossary).
   - Adapter: technology plus port name (`SqliteDocumentStore`). File name equals the class (NAM-8).
   - Add any new domain term to `docs/glossary.md` in the same change (NAM-2).

3. **Write the port** in `src/application/ports/<Port>.ts`, next to the use cases that consume it (TSN-2).
   - Expected failures are `Result` values in the signature, not thrown (TSN-4).
   - TSDoc on the interface and on every member: summary, `@param`, `@returns`, and `@remarks` for guarantees every adapter must keep (atomicity, ordering). This is the only place the contract is written (CMT-5, CMT-12, TSN-13).

4. **Write the adapter** in `src/infrastructure/<Adapter>.ts`, `implements <Port>`.
   - Each member's doc comment is `{@inheritDoc <Port>.<member>}`, plus only `@throws`, `@example` or `@deprecated` for what this adapter adds. No summary or `@remarks` beside it (TSN-13).
   - Implementation notes (why a lock, why no `await` between two lines) go in a comment inside the method body (CMT-1).
   - Third-party libraries for this technology are imported here and nowhere else (CA rules; FF-1).
   - Secrets the adapter holds are `readonly #field` (class-modeled State row).

5. **Inject the port into the use case** as a `private readonly` constructor parameter typed as the port, never the adapter (TSN-6, class-modeled State row).

6. **Wire it in the composition root only.** Construct the adapter in `src/CompositionRoot.ts` and pass it to the use case (PDM-class-modeled-R9). If the adapter needs config, add the setting to `src/infrastructure/config.ts` (TSN-9).

7. **Imports.** Same-folder files with `./`; everything else through the repo's alias (IMP-1, IMP-2, TSN-15, TSN-16).

8. **Tests.**
   - Unit test of the use case, next to it, using an in-memory adapter or a small fake through the port.
   - Integration test of the real adapter in `test/integration/`, run by `cmd.test_integration`.
   - If the repo has more than one adapter for the port, one shared contract test runs against each.

9. **Update the records.** A new data store gets a row in `docs/architecture.md` §5; a new external service gets a row in §6 and an integration doc (`integration/v1`).

10. **Verify.** Run the stack slots `cmd.format`, `cmd.lint`, `cmd.typecheck`, `cmd.test_unit`, `cmd.test_integration`, then `validate-project.mjs`. Done only when all pass. Never disable a lint rule to get there; if a rule looks wrong for this case, stop and report it.

## References

- `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/reference.md` — the pinned reference repo whose code this procedure produces.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — TSN-2, TSN-4, TSN-6, TSN-9, TSN-13, TSN-15, TSN-16.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — State row, R9.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — ports and adapters.
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/foundations/code/comments.md`, `naming.md`, `../design/import-paths.md` — CMT, NAM, IMP rules.
- [Alistair Cockburn, "Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/) — the ports-and-adapters pattern.

## Related

- `index.md` — other typescript-node procedures.
- `{{AGENT_HOME}}/knowledge/software-design/architecture-styles/` — hexagonal and clean architecture explained.
