---
schema: knowledge-doc/v1
type: concept
topic: versioning
status: verified
applies-to: ["SemVer 2.0.0"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [semver, versioning, release, pinning, compatibility]
---

# Semantic versioning and pinning

## Summary
**TL;DR:** A version `MAJOR.MINOR.PATCH` is a promise about compatibility. Patch means fixes only, minor means new things that do not break old users, major means something old now breaks. Consumers usually pin only the major, so they get fixes and additions automatically but never a break. A released version is never edited; any change is a new version.
**Use this when:** versioning a library, schema, rule set or framework; deciding whether a change is breaking; or choosing what a consumer should pin.
**Not this doc:** git tagging mechanics → `git/`.

## Problem
Without a shared meaning, "v2" says nothing. A consumer cannot tell whether an upgrade is safe, and an author who edits an old version in place leaves consumers pointing at text that no longer says what they agreed to.

## Mental model
**Analogy:** a building's floor plan. Fixing a typo on the plan is a patch. Adding a new room is a minor change: old routes still work. Removing a staircase is a major change, so anyone with the old plan may walk into a wall.

**Artifact:**
```text
1.4.2 → 1.4.3   patch: wording fix, nothing new
1.4.3 → 1.5.0   minor: new optional guidance; old compliant code still passes
1.5.0 → 2.0.0   major: a rule tightened; some old compliant code now fails

consumer pins "@1"  →  receives 1.4.3 and 1.5.0, never 2.0.0
```

## How it works
1. **Major.** Incremented when a backward-incompatible change reaches the public API. ✅[^1]
2. **Minor.** Incremented when new, backward-compatible functionality is added. ✅[^1]
3. **Patch.** Incremented when only backward-compatible bug fixes are made. ✅[^1]
4. **Released means frozen.** Once a version is released its contents must not be modified; any change is a new version. ✅[^1]
5. **Before 1.0.0.** Major version zero is initial development, and anything may change at any time. ✅[^1] If software is used in production, or has a stable API people depend on, it should already be 1.0.0. ✅[^1]
6. **Pre-release labels.** A version can carry a hyphenated pre-release suffix, such as `2.0.0-draft`. ✅[^1]
7. **Pin by immutable reference where safety matters.** A tag can be moved or deleted; a full commit SHA cannot be reassigned. GitHub recommends pinning actions to a SHA for that reason. ✅[^2]

**Two numbers, two jobs**

| Where | Form | Job |
|---|---|---|
| Changelog row | `MAJOR.MINOR.PATCH` | Exact history of what changed |
| Pin in a consumer (`@1`, `/v1`) | `MAJOR` only | The compatibility promise the consumer relies on |

## Worked example
A rule set is at `1.0.0`, and a project pins `@1`.

| Change | New version | Project pinned `@1` |
|---|---|---|
| Fix a typo in a rule | `1.0.1` | Gets it automatically |
| Add a new optional section | `1.1.0` | Gets it automatically |
| Add a rule that existing compliant code fails | `2.0.0`, published next to `1.x` | Stays on `1.x` until it decides to move |
| Edit `1.x` in place to add that rule | Not allowed | Would break silently: the pin now points at different text ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| A breaking change was shipped as a minor | Fix it and release a new minor; never rewrite the released one | Released versions must not be modified ✅[^1] |
| Still pre-release with no outside consumers | Break freely, but say so in the changelog | Major zero may change at any time ✅[^1] |
| Pinning a moving tag | The same tag can later point at other content | Tags can be moved; SHAs cannot ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Pin major only | Fixes arrive without effort | Trusts the author to keep the promise |
| Pin exact version or SHA | Nothing changes without review | Upgrades are manual |
| Keep old majors side by side | Old consumers keep working | Two texts to maintain for a while |

## Takeaways
- Never edit a released version in place; publish a new one. [rule-candidate]
- Pin the major for compatibility, and a SHA where tampering or moving tags is a risk. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [Semantic Versioning 2.0.0](https://semver.org/) — Tom Preston-Werner, living. Backs: How it works 1–6, Worked example, Edge cases. [^1]
- [Security hardening / secure use for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use) — GitHub, living. Backs: How it works 7, Edge cases. [^2]
- `copilot/frameworks/agentic-sdlc/conventions.md` — §13 Versioning applies this to paradigms, overlays and schemas.

## Related
- `git/`
