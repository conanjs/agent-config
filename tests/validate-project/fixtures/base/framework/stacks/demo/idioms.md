---
schema: stack-idioms/v1
stack: demo
rule-prefix: DMO
---

# Idioms: Demo

| Id | Rule | Enforced by |
|---|---|---|
| DMO-1 | Return errors as values. | lint |

```lint-baseline
config: demo.lint.json | .demolintrc
require:
  - "no-deep-imports"
require-if: demo.toml modules
  - "module-boundaries"
```
