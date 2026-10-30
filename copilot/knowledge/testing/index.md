---
schema: topic-index/v1
kind: topic
topic: testing
last-updated: 2026-10-29
---

# Testing

How to put tests around code and tools that have none, and how to keep requirements and tests in step as they change. Not covered: the testing rules an agent must follow (those are `TST-n` in the agentic-sdlc framework's `foundations/delivery/testing-strategy.md`) and stack-specific test commands (stack profiles).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [characterization-tests.md](characterization-tests.md) | concept | Pin what untested code does today before changing it, written as Gherkin scenarios, and prove the tests guard every check. | verified |

## References
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- [Gherkin: Reference](https://cucumber.io/docs/gherkin/reference/) — Cucumber, living. Backs: topic scope (scenario syntax).

## Related
- `software-design/`
