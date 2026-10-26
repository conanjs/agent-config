---
schema: tree/v2
last-updated: 2026-10-25
prefix: TC
owner: tech-stack
phases: [P4]
feeds: the values behind the stack `cmd.*` slots that P6 script workers run
---

# Toolchain Selection (TC)

Decides which concrete tools fill the stack slots (`package_manager`, `cmd.format`, `cmd.lint`, `cmd.typecheck`, `cmd.test_unit`, `cmd.test_integration`, `cmd.build`, `cmd.audit`) for one component. It does NOT decide the language (tech stack tree) or the testing bar (constitution, owned by qa). Roles and workers only ever refer to slot names; the tool names live in the stack.

## Overview

```
TC-Q1 Repo already has tool config?
├─ YES → inherit as-is; map existing commands onto slots. Done.
└─ NO  → TC-Q2 Constitution mandates tools?
          ├─ YES → use them for the mandated slots → TC-Q3 for the rest
          └─ NO  → TC-Q3 Fill every slot from the stack's defaults
```

## Nodes

### TC-Q1 — Does the repo already have tool configuration?
- **Criteria:** Formatter, linter, type-checker or test-runner config files in the repo; tool sections in the stack manifest; lockfiles; CI workflow files that run checks. Found by the P0 stack-detection script.
- **Branches:**
  - YES → inherit as-is; record which existing command fills each slot. Done.
  - Partial (some slots configured) → inherit the configured slots → TC-Q2 for the empty slots
  - NO → TC-Q2
- **Default:** YES if any check already runs in CI — never replace a working toolchain as a side effect of a feature.
- **Escalate when:** the existing tool cannot meet the constitution's QA bar (e.g. no coverage threshold, no contract testing) — qa's bar wins (conventions §7), but replacing a tool is a human decision.

### TC-Q2 — Does the org or system constitution mandate tools?
- **Criteria:** Tooling rules in the system constitution, then the project constitution (system wins; a project may only be stricter).
- **Branches:**
  - YES → use the mandated tool for those slots → TC-Q3 for any slot still empty
  - NO → TC-Q3
- **Default:** NO when the constitution is silent on tooling.
- **Escalate when:** the mandated tool has no entry in any available stack, or two constitutions mandate different tools for the same slot.

### TC-Q3 — Fill remaining slots from the stack's defaults
- **Criteria:** The active stack's `index.md` slot table and its "Toolchain defaults rationale" section (`{{AGENT_HOME}}/frameworks/agentic-sdlc/stacks/<stack>/index.md`).
- **Branches:**
  - Slot has a stack default → use it verbatim
  - Slot is `n/a — <reason>` in the stack → leave unfilled; the script worker skips it and the reason is recorded
  - The stack's `idioms.md` has an `## Options` table → propose each choice's default and present the alternatives to the human at the gate; never pick an alternative silently
- **Default:** the stack default for every remaining slot, and each Option's default unless the human picks another.
- **Escalate when:** the constitution's QA bar needs a capability the stack default lacks (coverage threshold, mutation testing, contract testing) — qa's bar is fixed; the tooling must change, and the change is surfaced at the gate.

## Recording

One decision record per component, `DR-<NNN>: Toolchain for <component>`, in the feature's `specs/<NNN-feature>/research.md`, listing slot → source (existing config / constitution / stack default), and each stack Option → the chosen value. An alias-mechanism choice is also reflected in the `alias:` prefixes of `docs/architecture.md` §4. Rejected alternatives name the other source that was considered (e.g. "stack default — repo already configured").

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `stacks/<id>/index.md` ? stack slot list used by this tree.

**External authoritative sources:**
> _None._

## Related

- `tech-stack-selection.tree.md` ? chooses the stack first.
- `test-strategy-depth.tree.md` ? decides whether `cmd.test_integration` runs.
