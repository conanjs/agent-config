---
schema: stack/v2
last-updated: 2026-10-01
id: demo
detect-by: [demo.lock]
frameworks: [web]
paradigms: [demo-paradigm]
---

# Stack: Demo (`demo`)

## Slots
| Slot | Value |
|---|---|
| `language_version` | Demo 1 |
| `package_manager` | demo-pm |
| `project_layout` | src/ |
| `style_guide` | https://example.com/style |
| `cmd.install` | `demo install` |
| `cmd.format` | `demo fmt` |
| `cmd.lint` | `demotool check` |
| `cmd.typecheck` | `demo types` |
| `cmd.test_unit` | `demo test` |
| `cmd.test_integration` | `demo test --integration` |
| `cmd.build` | `demo build` |
| `cmd.audit` | `demo audit` |
| `idiom.errors` | return errors |
| `idiom.concurrency` | one task at a time |
| `idiom.di` | constructors |
| `idiom.config` | load once |
| `idiom.logging` | structured |
| `tools` | `demotool` |

## Foundation mapping
| Rule | Enforced by |
|---|---|
| DEM-2 | `demotool check` |

## Reference topics
| Topic | Path | Attach when |
|---|---|---|
| Demo doc | knowledge/demo/doc.md | always |

## References
- `schemas/stack.schema.md`

## Related
- _None._
