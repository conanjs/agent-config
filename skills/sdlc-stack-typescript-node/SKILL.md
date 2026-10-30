---
name: sdlc-stack-typescript-node
description: "Agentic SDLC stack profile for TypeScript on Node.js: project layout, format/lint/typecheck/test/build/audit commands, idioms for errors, concurrency, DI, config and logging, and framework idioms. Use when a task's component has stack: typescript-node."
---

Read and apply, in this order:
1. `~/.copilot/frameworks/agentic-sdlc/stacks/typescript-node/index.md` (the slot table; run checks only with its `cmd.*` commands, verbatim)
2. `~/.copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md`
3. `~/.copilot/frameworks/agentic-sdlc/stacks/typescript-node/frameworks/<fw>.md` for each framework named in the task's `profiles.framework` (e.g. `express`)
4. `~/.copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md` (which rule each file of the reference repo shows; when you need the code, fetch the repo at the pinned commit as its "How to fetch" says, read-only, and copy its shape)
5. If the launch prompt has `state.procedure`, follow that procedure step by step, change only its `allowed-paths`, and report each step (`procedure_steps`). Without one (standalone use), check `~/.copilot/procedures/typescript-node/index.md`; if a row's "Use when" matches the request, follow that procedure the same way

(On Windows `~/.copilot` is `%USERPROFILE%\.copilot`.)
The role's preset foundations say WHAT good code must do; this stack profile says HOW in this language. A paradigm skill, if named, adds the modeling style.
