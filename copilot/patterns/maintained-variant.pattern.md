---
schema: pattern/v1
last-updated: 2026-10-27
origin: 2026-10-27 — the stack reference had to move from four top-level layer folders to feature modules, and the user saw that the layer-first example many docs point to "would be lost"
related-patterns: [revise-without-erasing, layered-guards]
---

# Pattern: Maintained Variant

**Use when:** an example, template or reference that other documents point to must change shape, and the old shape is still the right answer for some readers (a small project, an older runtime, a simpler setup).
**Not for:** an old shape that is simply wrong. Replace it and revise the documents that cite it (`revise-without-erasing.pattern.md`).

## The pattern

1. **First write the rule that says when each shape applies.** Without it, two shapes are just two opinions. Example: MOD-9 makes feature-first the default and layer-first an explicit opt-in for one bounded context with at most three feature areas.
2. **Keep the old shape as a maintained branch, not a frozen tag.** A frozen copy is like a check that nobody runs: it stays correct only until the rules change, and nothing tells anyone when it stops being correct.
3. **Put every variant under the same automatic checks.** CI triggers name the variant branch, and a rule change lands as one pull request per variant. If a variant cannot be checked, it is not maintained; say so and freeze it on purpose.
4. **Give each variant its own version series and pin.** For example, `v1.x` tags come from the variant branch and `v2.x` from `main`. Each pointer names the variant, its tag and its full commit.
5. **Leave existing links on the variant they explain.** A document that teaches the old shape keeps its pinned link and gains one sentence pointing to the new shape. Do not move every link to the newest shape.
6. **Make the change of shape a pure move first.** Same behaviour and the same tests in the new folders, before any new feature, so the mapping can be checked one-to-one.
7. **Retire a variant only by decision.** When nothing points to it any more, record the retirement and stop its CI. Do not let it decay quietly.

## Why this exists

On 2026-10-27, asked to reorganise the reference app as features grow, the user wrote: "The example for this 4-direct-layer project would be lost and updated to the new one". Of four options (frozen tag, maintained branch, two repos, two apps in one repo), the user chose the maintained branch. They then linked it to an earlier lesson: "every check we ran today happened only because someone remembered to run it". That lesson is the reason for rule 2: an example nobody re-checks is the same as a check nobody runs.

The first gap appeared within the hour. The new `layout/layer-first` branch was created from v1.1.0, but the reference CI ran on push only for `main`. Merges to the variant would never have been checked after they landed.

## Worked example

The CI trigger of `conanjs/agentic-sdlc-reference-typescript-node`, `.github/workflows/check.yml`, in each version:

| v1.1.0 (variant branch just created) | [PR #2](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/pull/2) into `main` / [PR #3](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/pull/3) into `layout/layer-first` (both merged 2026-10-27) |
|---|---|
| `on:`<br>`  push:`<br>`    branches: [main]`<br>`  pull_request:` | `on:`<br>`  push:`<br>`    branches: [main, "layout/**"]`<br>`  pull_request:` |
| A merge into `layout/layer-first` runs no checks | Every push to either variant runs `pnpm run check`, `pnpm audit` and the framework validator |

The same fix went in as two pull requests, one per variant (rule 3). The pointer file, `stacks/typescript-node/reference.md`, pins `v1.1.0` at commit `0f899099b469a63262fd113f2b0a88414c08f30e`. From v2.0.0 it lists both variants (`proposals/agentic-sdlc-reference-feature-first.md` §A4).

## Checklist

- [ ] A rule says when each variant applies.
- [ ] Each variant has its own branch, tag series and pin.
- [ ] CI triggers include every variant branch; branch protection covers each one.
- [ ] Each document that links the old shape still links it, plus one sentence on the new shape.
- [ ] The change of shape went in as a pure move first.

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/foundations/design/module-boundaries.md` (MOD-9): the rule that decides between the two layouts (feature-first by default, layer-first by opt-in).
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`: the pointer that pins each variant.
- `proposals/agentic-sdlc-reference-feature-first.md` §A3: the four options compared, and the choice.

**External authoritative sources:**
- [GitHub Docs, "Events that trigger workflows" (`push` branch filters)](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#push): a `branches` filter limits which pushes run the workflow, so a variant branch has to be listed.
- [Semantic Versioning 2.0.0](https://semver.org/): a major version marks an incompatible change, so each shape gets its own major series.
- [Git, `git-tag`](https://git-scm.com/docs/git-tag): a tag names one commit, and it can be moved or deleted. That is why pins also record the full commit hash.

## Related

- `layered-guards.pattern.md`: rule 2 applies its "a validator nobody runs is documentation, not a guard" to examples.
- `revise-without-erasing.pattern.md`: keeping the old content while adding the new, applied to code instead of prose.
