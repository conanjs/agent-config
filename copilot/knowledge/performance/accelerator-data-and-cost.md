---
schema: knowledge-doc/v1
type: reference
topic: performance
status: draft
applies-to: ["PyTorch CUDA semantics; Spark 4.1.1; inference measurement; SCI v1.1.0"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Accelerator, data and cost performance

## Summary
**TL;DR:** Measure time to a correct result and cost per useful result. High throughput or a busy GPU does not prove that users receive results faster or more cheaply.
**Use this when:** inference, training, batch analytics, streaming or cost/energy optimization.

## Scope
A GPU (Graphics Processing Unit) accelerates parallel processing, like many stations doing the same kind of work. Transporting data to those stations still takes time. The timing artifact should separate `input→transfer→compute→output`, including batch waiting. The table lists candidate techniques, not hardware purchase recommendations.

## Catalog

| Workload | Result unit / metrics | Sourced mechanism | Trade-offs to measure |
|---|---|---|---|
| GPU kernel | Compute and end-to-end duration | ✅ [PyTorch CUDA](https://docs.pytorch.org/docs/2.15/notes/cuda.html): operations are often enqueued asynchronously; synchronization/events are needed for correct duration measurement | Excess synchronization loses overlap; measure transfers too |
| Deep learning pipeline | Time to a quality target; correct outputs/s | ✅ [PyTorch tuning](https://docs.pytorch.org/tutorials/recipes/recipes/tuning_guide.html): data loading, pinned memory, fusion/compilation and layout are conditional optimization options | Warmup/compilation, shape changes, memory, copying |
| Interactive language-model inference | Time to first token (TTFT), time per subsequent token, whole-response latency | ✅ [NVIDIA methodology](https://developer.nvidia.com/blog/llm-inference-benchmarking-performance-tuning-with-tensorrt-llm/): sweep concurrency and measure request/token throughput with TTFT and time per output token | Larger batches raise aggregate throughput but can make each user wait; preserve prompt/output distribution and quality |
| Analytical query | Time to the correct result table; scanned/shuffled/spilled bytes | ✅ [Spark 4.1.1](https://spark.apache.org/docs/4.1.1/sql-performance-tuning.html): Adaptive Query Execution changes plans using runtime statistics, coalesces partitions and handles skew | State/cache/batch memory; one large partition can hold up the job |
| Carbon | Emissions per functional unit, the defined unit of work | ✅ [SCI v1.1.0](https://sci.greensoftware.foundation/): energy, carbon intensity and hardware embodied emissions within a system boundary | Do not infer carbon reduction from CPU time alone; a model and uncertainty are needed |

| Situation | Experiment candidate | Conditions and validation metrics |
|---|---|---|
| Offline inference | Larger batches, transfer/compute overlap, fusion | Unchanged quality, outputs/s, memory, GPU-hours/job |
| Training | Mixed precision, data-loader parallelism | Time to target quality, numerical behavior, communication |
| Chat | Continuous batching, prefix cache, smaller model/quantization | TTFT, output speed, quality, queue and VRAM (GPU memory) |
| Streaming | Count/time-based batches, incremental state, bounded buffers | Event-time lag, work age, late-data/duplicate/loss contract |
| Multi-tenant | Admission and per-tenant quotas | Per-tenant p99, fairness, spare capacity |
| Cost | Remove unnecessary work, right-size, autoscale | Cost per useful operation, cold starts and failure headroom |

## Lookup notes
⚠️ unverified: candidates in the second table have not been benchmarked on the target. Quantization reduces numerical representation precision, like rounding numbers to save space: for example, storing weights with fewer bits. Evaluate quality rather than assuming equivalence for every task. Pin the model, tokenizer, engine, precision, hardware and workload.

Illustrative calculation: option A costs 120 currency units/hour and correctly completes 60,000 requests → 0.002/request. B costs 100 but correctly completes only 40,000 → 0.0025/request. B is cheaper per hour but 25% more expensive per result. Compare at equal quality and latency budgets; a retry is not a new product.

Data skew is uneven load, like one counter receiving 90% of customers. The partition artifact `[10,10,10,970]` records has an average of 250, which hides the 970-record partition. Measure task-time and byte distributions, not only the total worker count.

## Takeaways
- Optimize per correct result while holding quality and waiting-time constraints fixed.
- Separate enqueueing, transfers, compute and end-to-end duration when measuring accelerators.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 5 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [CUDA semantics](https://docs.pytorch.org/docs/2.15/notes/cuda.html) — PyTorch 2.15. Backs: asynchronous timing.
- [Performance tuning guide](https://docs.pytorch.org/tutorials/recipes/recipes/tuning_guide.html) — PyTorch, living. Backs: pipeline options.
- [LLM inference benchmarking](https://developer.nvidia.com/blog/llm-inference-benchmarking-performance-tuning-with-tensorrt-llm/) — NVIDIA, 2025. Backs: inference metrics.
- [SQL performance tuning](https://spark.apache.org/docs/4.1.1/sql-performance-tuning.html) — Apache Spark 4.1.1. Backs: adaptive plans/skew.
- [Software Carbon Intensity](https://sci.greensoftware.foundation/) — Green Software Foundation, v1.1.0. Backs: carbon boundary.
- [Load experiment](load-testing-and-regression.md) — local experiment contract.

## Related
- [Architecture selection](architecture-selection.md)
- [Coverage map](performance-map.md)
