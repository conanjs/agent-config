---
schema: schema/v1
last-updated: 2026-10-24
---

# Schema: Context Pack (`context-pack/v1`)

**Applies to:** the Resolver's output for one run · **Store:** runtime (not committed) · **Written by:** the Resolver · **Read by:** the agent

The ordered list of everything the agent should use for this task, each item with where it came from and why it was picked.

## Structure

```yaml
schema: context-pack/v1
charter: pr-reviewer
task: { kind: review, ref: "PR #512" }
items:
  - { id: Q-SEC-5, source: rules, floor: true, why: "diff adds config, check for secrets" }
  - { id: DS-2,     source: rules,             why: "tax_adapter.ts makes a remote call" }
  - { id: ZONE-1,   source: facts,             why: "vendor/legacy-tax-client is foreign, owner finance-platform" }
  - { id: LS-007,   source: lens, scope: "team:orders", why: "amounts as integer cents" }
  - { id: PR-512,   source: task,              why: "the diff" }
dropped:
  - { id: DDD-8, reason: "no aggregate changed" }
conflicts:
  - { between: [ERR-2, LS-014], resolved_by: R3, result: "major -> minor" }
budget: { limit: 60 items, used: 9 }
```

## Rules

- Items are listed strongest source first: rules, facts, lens, task.
- Floors are always present when their rule is relevant and are marked `floor: true`.
- Every dropped item has a reason.
- Every conflict names the resolver rule that settled it.
- A finding's `provenance` may only cite ids present in the pack.

## Checks

| Check | Tool |
|---|---|
| (runtime artifact) no static check; agents self-verify provenance | llm |

## References

**Local artifacts:**
- `../resolver.md`.

## Related

- `charter.schema.md`.
