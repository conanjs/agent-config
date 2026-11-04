---
schema: knowledge-doc/v1
type: concept
topic: performance/optimization
status: verified
applies-to: ["in-process caches, distributed caches (Redis, Memcached), HTTP caches"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, caching, cache-aside, lru, hit-ratio, eviction, invalidation, effective-latency]
---

# Caching: hit ratio, eviction and the cache-aside pattern

## Summary
**TL;DR:** A cache keeps copies of expensive results close to where they are used. Its value is set by the **hit ratio**: effective latency = hit ratio × hit cost + miss ratio × miss cost. With real-world skew (a few keys are very popular) a small cache captures much of the traffic: in a simulated Zipf-like stream over 10 000 keys, an LRU cache holding 1% of the keys hit 39% of requests and 10% of the keys hit 67%. The usual application pattern is **cache-aside**: read the cache, on a miss load from the store and fill the cache.
**Use this when:** you add a cache, choose its size or eviction policy, or debug stale data or low hit ratios.
**Not this doc:** memoizing pure functions inside algorithms → `algorithms/techniques/dynamic-programming-and-greedy.md`.

## Problem
Caches are added without measuring the hit ratio, sized arbitrarily, or invalidated incorrectly — leading to no speed-up, wasted memory, or users seeing stale data. The arithmetic of hit ratio and the access pattern decide whether a cache helps.

## Mental model
**Analogy:** a kitchen's fridge versus the supermarket. Most meals use the same handful of ingredients, so a small fridge serves most needs and a supermarket trip (a miss) is rare. When the fridge is full, you throw out what you have not used for longest (LRU).

**Artifact:** hit ratio vs cache size for a skewed key stream (200 000 requests, weights ∝ 1/rank over 10 000 keys, `functools.lru_cache`; lab, Python 3.12.13, 2026-11-04) ✅[^3]:
```text
LRU size    10 (0.1% of keys): hit ratio 13.1%  -> effective latency with 1 ms hit / 50 ms miss = 43.6 ms
LRU size   100 (1.0% of keys): hit ratio 39.0%  -> effective latency                            = 30.9 ms
LRU size  1000 (10.0% of keys): hit ratio 67.4%  -> effective latency                            = 17.0 ms
```

## How it works
**Cache-aside** ✅[^1]:
1. The application reads the cache.
2. On a miss, it loads the item from the data store, returns it and puts it in the cache ("load data on demand into a cache from a data store").
3. On writes, it updates the store and invalidates (or updates) the cached entry, so later reads reload it.

**Eviction:** when full, the cache removes entries. LRU evicts the least recently used; Python's `lru_cache` bounds the size with `maxsize` and reports `hits`, `misses`, `maxsize` and `currsize` through `cache_info()` ✅[^2].

**Effective latency:** E = h·t_hit + (1 − h)·t_miss. Because misses are usually far more expensive, each point of hit ratio matters more at the high end: going from 39% to 67% cut effective latency from 30.9 ms to 17.0 ms in the example ✅[^3].

## Worked example
A product page calls a pricing service (50 ms). Traffic is skewed toward popular products.

| Cache size (share of catalogue) | Hit ratio (simulated) | Effective latency |
|---|---|---|
| None | 0% | 50 ms |
| 1% | 39% | 30.9 ms |
| 10% | 67% | 17.0 ms |

Numbers from the simulation above ✅[^3]. Real hit ratios depend on the actual key distribution: measure them from production access logs or the cache's own counters before sizing.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Uniform access (no skew) | Hit ratio ≈ cache size / key space | Popularity skew is what makes small caches effective ✅[^3] (skewed case) |
| Data changes in the store directly | Stale cache entries | Cache-aside relies on invalidation by the writer ✅[^1] |
| Many clients miss the same key at once | Burst of identical loads ("stampede") | In cache-aside every miss loads from the store ✅[^1]; coalesce concurrent loads for the same key |
| Unbounded in-process cache | Memory grows until the process is killed | Set a size bound (`maxsize`) ✅[^2] |
| Caching errors or empty results | Errors served from cache | Decide explicitly what is cacheable |

## Takeaways
- Measure the hit ratio and compute effective latency before and after adding a cache. [rule-candidate]
- Always bound cache size and define invalidation on writes.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Cache-Aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) — Microsoft Azure Architecture Center, living. Backs: loading data on demand into a cache; consistency with the store. [^1]
- [functools.lru_cache](https://docs.python.org/3/library/functools.html#functools.lru_cache) — Python Software Foundation, living. Backs: LRU with `maxsize`, `cache_info()` fields. [^2]
- `linux/lab-setup.md` — the lab where the Zipf-like LRU simulation ran on 2026-11-04 (Python 3.12.13). [^3]

## Related
- `algorithms/techniques/dynamic-programming-and-greedy.md` — memoization.
- `performance/optimization/optimization-playbook.md`
- `performance/fundamentals/latency-percentiles-and-tail.md`
