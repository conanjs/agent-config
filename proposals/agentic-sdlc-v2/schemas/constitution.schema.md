---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Constitution — framework sections (`constitution-sdlc/v1`)

**Applies to:** the framework-owned sections of `.specify/memory/constitution.md` · **Store:** D · **Written by:** P2 (architecture, engineering, qa, security propose; human approves at G1) · **Read by:** every role as ③ · **Loaded as:** ③

Spec Kit owns the constitution's template and principles. The framework adds **only the sections below**, so a team can override framework defaults per repo without editing the framework.

## Required structure

Appended after Spec Kit's content:

```markdown
## Agentic SDLC: defaults
- **Default paradigm:** <id>@<major> | none        <!-- used by PDM-Q4 when a component has no signal -->
- **Unit size / complexity:** ≤ <n> lines, ≤ <n> complexity   <!-- overrides CS-2 defaults -->

## Agentic SDLC: style deviations
| From | Deviation | Reason |
|---|---|---|
| <style_guide rule or rule id> | <what this team does instead> | <why> |

## Agentic SDLC: budgets
| Loop | Budget |
|---|---|
| Re-execute after failed check | 2 |
| Re-execute after review-fail | 2 |
| Automatic rework per feature | 1 |
| Parallel [P] tasks | 4 |
```

## Rules

- The three headings are exact, so the Orchestrator can find them.
- A deviation may **relax** a stack or paradigm rule for this repo. It may never relax a security rule or a foundation rule marked `blocker` without a decision record.
- An empty section says `> _Framework defaults apply._`

## Checks

| Check | Tool |
|---|---|
| Headings present; default paradigm exists; budgets are integers | `validate-project.mjs` |
