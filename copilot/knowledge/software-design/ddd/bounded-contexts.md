---
schema: knowledge-doc/v1
type: concept
topic: software-design/ddd
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [ddd, bounded-contexts, ubiquitous-language, context-mapping]
---

# Bounded contexts and context maps

## Summary
**TL;DR:** A bounded context is the boundary within which a model and its language stay consistent. Context maps name how bounded contexts relate, so teams know when to share, translate, conform, publish, or stay separate.
**Use this when:** the same word means different things in different parts of a system, or two models must integrate without becoming one model.
**Not this doc:** aggregate consistency inside one context → `software-design/ddd/aggregates.md`.

## Problem
Large domains rarely have one vocabulary that stays precise everywhere. Fowler notes that as a domain grows, different groups use subtly different vocabularies, and forcing one unified model becomes infeasible or not cost-effective. ✅[^1]

## Mental model
**Analogy:** a word can mean one thing in a hospital and another in an airport; a glossary must say which room you are standing in.
**Artifact:**
```text
Context: Access Control
  Role = named set of permissions granted to users

Context: Hiring
  Role = job function in an organization

Map: Hiring -> Access Control uses Published Language + Anti-Corruption Layer
```
The boundary keeps each meaning clear, and the map says how translation happens.

## How it works
A bounded context is a central DDD pattern for dividing large models and making interrelationships explicit. ✅[^1]

Inside a bounded context, the model can be unified and internally consistent. ✅[^1]

Ubiquitous language is a common rigorous language between developers and domain experts based on the domain model. ✅[^2]

Evans emphasizes using the ubiquitous language in conversation with domain experts to test and evolve the model. ✅[^2]

Different bounded contexts may have different models of shared concepts and need mechanisms to map between them. ✅[^1]

A context map depicts relationships between bounded contexts. ✅[^1]

DDD Crew describes context maps as collections of patterns that describe contact between bounded contexts and teams. ✅[^3]

| Pattern | Use when | Risk |
|---|---|---|
| Partnership | Both sides succeed or fail together | Requires coordinated planning. ✅[^3] |
| Shared Kernel | Teams share a small stable model | Changes require consultation. ✅[^3] |
| Customer–Supplier | Downstream needs should influence upstream planning | Upstream commitment must be explicit. ✅[^3] |
| Conformist | Translation cost is higher than adopting upstream's model | Downstream model quality is limited by upstream. ✅[^3] |
| Anti-Corruption Layer | Upstream model is foreign, legacy, or unstable | Translation code must be owned. ✅[^3] |
| Open Host Service | Many consumers need stable access to an upstream capability | Published protocol needs governance. ✅[^3] |
| Published Language | Contexts need a documented shared exchange language | Translation still happens at borders. ✅[^3] |
| Separate Ways | Integration cost exceeds value | Capabilities may be duplicated. ✅[^3] |
| Big Ball of Mud | A messy model must be contained | The bad model can propagate if not isolated. ✅[^3] |

## Worked example
In an access-control context, `Role` means a named set of permissions. In a hiring context, `Role` means a job function. If hiring sends access requests, it publishes `JobRoleAssigned` in hiring language, and an anti-corruption layer translates it into access-control commands such as `grant PermissionKey("shipment:read")`.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Same term, different meaning | Split or clarify contexts | A unified model must be internally consistent. ✅[^1] |
| Two contexts share code casually | Prefer explicit Shared Kernel or translation | Shared Kernel needs a small boundary and consultation. ✅[^3] |
| Upstream will not adapt | Choose Conformist or Anti-Corruption Layer deliberately | The map makes the trade-off visible. ✅[^3] |
| No meaningful relationship | Use Separate Ways | A free team/context has no technical or organizational link. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| One unified model | Simple when domain is small | Breaks down with multiple meanings and teams |
| Bounded contexts | Clear language ownership | Requires translation and context maps |
| Anti-corruption layer | Protects local model | Adds mapping code |

## Takeaways
- Define the context before judging whether two uses of a term conflict. [rule-candidate]
- Put model translation at the boundary, not inside the domain model. [rule-candidate]
- Record context relationships with named mapping patterns. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 21 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [BoundedContext](https://martinfowler.com/bliki/BoundedContext.html) — Martin Fowler, 2014. Backs: Problem, How it works, Edge cases. [^1]
- [UbiquitousLanguage](https://martinfowler.com/bliki/UbiquitousLanguage.html) — Martin Fowler, 2006. Backs: How it works. [^2]
- [Context Mapping](https://github.com/ddd-crew/context-mapping) — DDD Crew, living. Backs: How it works, context mapping patterns, Edge cases. [^3]
- [DDD Reference](https://www.domainlanguage.com/ddd/reference/) — Eric Evans / Domain Language, 2015. Backs: Evans primary-source lineage for context mapping terms. [^4]
- Eric Evans, *Domain-Driven Design* (2003) — further reading; the free DDD Reference above is used for verified primary-source lineage.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) — further reading on strategic design and context maps.

## Related
- `software-design/ddd/aggregates.md`
- `software-design/ddd/building-blocks.md`
- `software-design/ddd/layering.md`
