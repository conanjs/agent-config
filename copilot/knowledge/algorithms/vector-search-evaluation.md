---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["Exact and graph-based vector search evaluation"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Vector search accuracy and performance

## Summary
**TL;DR:** Generate exact nearest neighbors as a correctness reference, then compare graph search at explicit recall, latency and memory targets.
**Use this when:** Choosing a retrieval index for embeddings, similarity search or recommendation.

## Scope
This reference covers exact search and Hierarchical Navigable Small World (HNSW) search. Exact search checks every eligible address on a map. HNSW follows links between landmarks at progressively finer scales. The output in both cases is a ranked list of vector identifiers.

## Catalog

| Option | Mechanism | Measure |
|---|---|---|
| Exact flat search | ✅ Compare the query with each eligible vector using the selected distance or similarity. [Faiss](https://faiss.ai/) | Exact result identifiers, latency and throughput |
| HNSW | ✅ Navigate a hierarchy of proximity graphs and search more closely at the base. The original paper evaluates the speed and recall trade-off empirically. [HNSW paper](https://arxiv.org/abs/1603.09320) | Recall distribution, 99th-percentile latency, throughput, index size and build time |
| Exact reranking | Recompute exact distances over retrieved candidates | Candidate recall, final recall and added latency |

## Lookup notes
If the exact top three are `[A, B, C]` and the approximate results are `[A, D, B]`, recall at three is `2 / 3`. This metric counts shared identifiers and ignores their order. Define how to handle distance ties before scoring. Reranking cannot recover an identifier absent from the candidate set.

Freeze the corpus, eligibility filters and distance metric. Generate exact answers on held-out queries, then sweep graph search effort under matched hardware, precision, concurrency and batch size. Report recall by cohort alongside the mean. If selective filters or frequent updates matter, measure those workloads separately. The paper supplies evidence for its tested configurations. This reference contains no local HNSW benchmark.

## Takeaways
- Choose an operating point that meets both recall and tail latency targets.
- Include graph build cost and memory when comparing with exhaustive search.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 2 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Faiss Documentation](https://faiss.ai/) — Faiss project, living. Backs: exact search baseline.
- [Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs](https://arxiv.org/abs/1603.09320) — Malkov and Yashunin, 2016 preprint. Backs: graph hierarchy and evaluation.
- [Workload selection](workload-selection.md) — local decision reference.

## Related
- [Load measurement](../performance/load-testing-and-regression.md)
