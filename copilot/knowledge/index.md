---
schema: topic-index/v1
kind: root
last-updated: 2026-11-07
---

# Global knowledge

Cross-project reference material (store B): how technologies and design techniques work and why, in our own words, with links to the original sources. Not covered here: rules an agent must follow (those live in `{{AGENT_HOME}}/frameworks/agentic-sdlc/`, which cite these docs through `Source:`) and facts about one company's systems (those live in `{{AGENT_HOME}}/companies/<co>/`).

New docs follow `{{AGENT_HOME}}/frameworks/knowledge/schemas/_system.md`. Topics marked *legacy* predate that framework and keep their own shape (never retrofitted).

## Topics
| Topic | Summary | Docs |
|---|---|---|
| [software-design/](software-design/index.md) | Design principles (SOLID, DRY, KISS/YAGNI, separation of concerns, least astonishment, cohesion/coupling) and domain modeling: OOP (core concepts, encapsulation, polymorphism, composition over inheritance, Law of Demeter, DI, design by contract), DDD (building blocks, aggregates, layering, bounded contexts), architecture styles (hexagonal, clean, onion, how they combine) and functional modeling (immutability, functional core, types as rules, pipelines, testing) | 5 subtopics |
| [algorithms/](algorithms/index.md) | Practical algorithms and data structures with foundational lab measurements; workload selection and streaming/approximation research synthesis: Big-O measured, amortized cost, data-structure costs, hash tables, trees/heaps/B-tree indexes, library sorting (stability, adaptivity), BFS/DFS/Dijkstra/topological sort, dynamic programming and greedy | 5 subtopics + 8 root docs |
| [performance/](performance/index.md) | Performance engineering: percentiles and tail latency, queueing and Little's law, Amdahl's law, caches and locality, branch prediction, false sharing, trustworthy benchmarking, profiling and flame graphs, optimization playbook, caching — foundations measured; added cross-layer workload, database, overload, load-test, runtime/client, accelerator/cost synthesis and three sourced cases | 4 subtopics + 13 root docs |
| [code-documentation/](code-documentation/index.md) | Doc-comment standards: C# XML tags, TSDoc, JSDoc, Python, Go and Rust side by side, and the lint that requires them | topic index |
| [versioning/](versioning/index.md) | Semantic versioning: MAJOR.MINOR.PATCH meaning, frozen releases, pre-1.0 rules, pinning by major or commit SHA | topic index |
| [javascript/](javascript/index.md) | The JavaScript language, consolidated from javascript.info Part 1 into one subtopic per chapter: types and conversions, operators, functions, objects and `this`, data types and collections, closures, prototypes, classes, errors, promises and the event loop, generators, modules, Proxy, BigInt and Unicode — every behaviour run in Node 24, with a lesson-to-doc map | 14 subtopics + 1 reference |
| [floating-point/](floating-point/index.md) | IEEE 754 end to end: binary formats and limits, rounding and error growth, ±0/∞/NaN/subnormals and exception flags, choosing representations for money and IDs — measured in C, Python and JavaScript | 1 deep dive + 4 docs |
| [js-runtime/](js-runtime/index.md) | V8 and Node.js runtime behavior that shapes how TypeScript/JavaScript code is written: hidden classes, promise rejections, AbortSignal | topic index |
| [concurrency/](concurrency/index.md) | Cross-language concurrency: structured concurrency, blocking inside async runtimes, shared state and data races (Go, Python, Rust, TypeScript) | topic index |
| [error-handling/](error-handling/index.md) | Cross-language error design: handle errors once, library vs. application errors | topic index |
| [linux/](linux/index.md) | Linux internals from the system-call boundary to containers: system calls, boot, permissions, modules and udev, KVM, processes, signals, EEVDF scheduling, IPC, virtual memory, page cache and OOM killer, VFS, `fsync`, ext4 and LVM, the packet path, netfilter/NAT, TCP states, epoll and io_uring, namespaces, cgroups v2, overlayfs, container networking and isolation (with a build-a-container-by-hand deep dive), LSMs and Landlock, systemd, observability, eBPF and triage; a learning path and a lab, with outputs captured on Linux 6.17 | 8 subtopics + 1 reference + 1 how-to |
| [macos/](macos/index.md) | macOS behavior a developer hits: launchd and the environment apps get, shell startup and PATH, Homebrew, code signing and Gatekeeper, TCC privacy permissions, SIP and the App Sandbox, Keychain, APFS volumes, diagnostics tools; captured on macOS 26.1 | 5 concepts, 2 how-tos, 3 references |
| [kubernetes/](kubernetes/index.md) | How the cluster works and workloads run: life of a pod from kubectl to iptables (deep dive), control plane and reconciliation, pods, probes, rollouts, workload controllers, scheduling, CNI and DNS, Services and kube-proxy, Ingress/Gateway/NetworkPolicy, persistent volumes, RBAC and Pod Security, troubleshooting and autoscaling; plus config and credential delivery (Secret, projected volumes) and container CPU/memory limits (throttling, OOM kills) | 6 subtopics + 6 docs |
| [operations/](operations/index.md) | Runtime operation concerns in code: config at startup, structured logging | topic index |
| [web-apis/](web-apis/index.md) | HTTP API design: mapping errors to status codes and problem details | topic index |
| [testing/](testing/index.md) | Putting tests around code and tools that have none: characterization tests, Gherkin scenarios, proving coverage by sabotage | topic index |
| [product-tours/](product-tours/index.md) | In-app onboarding tours with Product Fruits: integration in React/Next.js, per-user state, settings and API catalog | topic index |
| [windows/](windows/index.md) | Windows internals mapped to Linux: user/kernel mode, boot phases, registry and services, processes, handles, jobs and scheduling, reserve/commit memory and the page file, NTFS and IRPs, tokens, DACLs, integrity levels and UAC, the Windows Filtering Platform, Windows containers and WSL 2, diagnostics tools; plus symlink privileges | 8 subtopics + 1 reference + 1 legacy |
| [ai-agents/](ai-agents/index.md) | Prompt, context and harness engineering deep dives, Graph Engineering study guide, comparison with SDD / AI-DLC / Spec Kit, cross-host skill portability, subagent execution boundaries, prompt-cache economics, Claude Code agents and skills, token accounting and usage references for Claude Code, Codex and GitHub Copilot, official tokenizers and count endpoints per model vendor, tested findings on how agents follow instruction wording, token-saving tools, LangGraph.js runtime facts, and existing loop-engineering guides | 3 deep dives + 4 concepts + 10 references + 1 how-to + 2 legacy |
| [analytics/](analytics/) | *legacy* — GTM → GA4 → BigQuery → Looker Studio pipeline | 5 |
| [blink/](blink/) | *legacy* — rollout notes | 1 |
| [datadog/](datadog/) | *legacy* — error-rate SLOs | 1 |
| [dead-code/](dead-code/) | *legacy* — dead-code detection rules | 1 |
| [documentation/](documentation/index.md) | Learning Explanation Framework, team doc conventions, and format guides (Markdown, HTML, Word, PDF, Excel) | 1 how-to + 7 legacy |
| [gcp/](gcp/index.md) | Google Cloud: Apigee limits, GKE access | 1 concept + 2 legacy |
| [git/](git/index.md) | Merging stacked pull requests; *legacy:* multi-account SSH, shallow clones with SonarQube | 1 how-to + 2 legacy |
| [github-copilot/](github-copilot/) | *legacy* — Copilot CLI internals and setup | 2 |
| [grpc/](grpc/) | *legacy* — stale-connection keepalive deep dive (a candidate synthesis source) | 1 |
| [nodejs/](nodejs/) | *legacy* — nvm, corepack, pnpm and yarn architecture | 1 |

## References
- `{{AGENT_HOME}}/frameworks/knowledge/index.md` — the framework that governs this folder.
- [Diátaxis](https://diataxis.fr/) — Daniele Procida, living. Backs: the doc-type split used by v1 docs.

## Related
- `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md` — the rules that cite these docs.
- `{{AGENT_HOME}}/companies/` — company-specific facts (store C).
