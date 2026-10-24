---
schema: topic-index/v1
kind: root
last-updated: 2026-10-04
---

# Global knowledge

Cross-project reference material (store B): how technologies and design techniques work and why, in our own words, with links to the original sources. Not covered here: rules an agent must follow (those live in `{{AGENT_HOME}}/frameworks/agentic-sdlc/`, which cite these docs through `Source:`) and facts about one company's systems (those live in `{{AGENT_HOME}}/companies/<co>/`).

New docs follow `{{AGENT_HOME}}/frameworks/knowledge/schemas/_system.md`. Topics marked *legacy* predate that framework and keep their own shape (never retrofitted).

## Topics
| Topic | Summary | Docs |
|---|---|---|
| [software-design/](software-design/index.md) | Design principles (SOLID, DRY, KISS/YAGNI, separation of concerns, least astonishment, cohesion/coupling) and domain modeling: OOP (core concepts, encapsulation, polymorphism, composition over inheritance, Law of Demeter, DI, design by contract), DDD (building blocks, aggregates, layering, bounded contexts) and functional modeling (immutability, functional core, types as rules, pipelines, testing) | 4 subtopics |
| [js-runtime/](js-runtime/index.md) | V8 and Node.js runtime behavior that shapes how TypeScript/JavaScript code is written: hidden classes, promise rejections, AbortSignal | topic index |
| [concurrency/](concurrency/index.md) | Cross-language concurrency: structured concurrency, blocking inside async runtimes, shared state and data races (Go, Python, Rust, TypeScript) | topic index |
| [error-handling/](error-handling/index.md) | Cross-language error design: handle errors once, library vs. application errors | topic index |
| [kubernetes/](kubernetes/index.md) | How workloads get configuration and credentials from the cluster (Secret vs volume vs mounted folder, `secret:` vs `projected:` volumes, external secret stores), and how container CPU/memory limits work: vCPU, CPU throttling, OOM kills, eviction | topic index |
| [operations/](operations/index.md) | Runtime operation concerns in code: config at startup, structured logging | topic index |
| [web-apis/](web-apis/index.md) | HTTP API design: mapping errors to status codes and problem details | topic index |
| [windows/](windows/index.md) | Windows specifics: creating symlinks needs admin, Developer Mode or the symlink user right regardless of shell or PowerShell version | 1 |
| [ai-agents/](ai-agents/) | *legacy* — loop engineering for AI agents | 3 |
| [analytics/](analytics/) | *legacy* — GTM → GA4 → BigQuery → Looker Studio pipeline | 5 |
| [blink/](blink/) | *legacy* — rollout notes | 1 |
| [datadog/](datadog/) | *legacy* — error-rate SLOs | 1 |
| [dead-code/](dead-code/) | *legacy* — dead-code detection rules | 1 |
| [documentation/](documentation/) | *legacy* — doc template and format guides (markdown, HTML, PDF, Excel) | 7 |
| [gcp/](gcp/) | *legacy* — GKE and GCP notes | 2 |
| [git/](git/) | *legacy* — multi-account SSH, shallow clones with SonarQube | 2 |
| [github-copilot/](github-copilot/) | *legacy* — Copilot CLI internals and setup | 2 |
| [grpc/](grpc/) | *legacy* — stale-connection keepalive deep dive (a candidate synthesis source) | 1 |
| [nodejs/](nodejs/) | *legacy* — nvm, corepack, pnpm and yarn architecture | 1 |

## References
- `{{AGENT_HOME}}/frameworks/knowledge/index.md` — the framework that governs this folder.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: the doc-type split used by v1 docs.

## Related
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` — the rules that cite these docs.
- `{{AGENT_HOME}}/companies/` — company-specific facts (store C).
