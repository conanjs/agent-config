---
schema: stack-idioms/v1
last-updated: 2026-10-01
stack: demo
rule-prefix: DMO
---

# Idioms: Demo

## idiom.errors
| Id | Rule | Enforced by | Source |
|---|---|---|---|
| DMO-1 | Return errors as values. | lint | — |

## idiom.concurrency
One task at a time.

## idiom.di
Constructors.

## idiom.config
Load once.

## idiom.logging
Structured.

## Runtime & performance
| Id | Rule | Enforced by | Source |
|---|---|---|---|
| DMO-2 | Avoid copies in loops. | llm | knowledge/demo/doc.md |

## Enforcement
| Rule | Tool |
|---|---|
| DMO-1 | lint |
