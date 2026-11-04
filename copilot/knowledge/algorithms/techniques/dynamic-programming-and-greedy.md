---
schema: knowledge-doc/v1
type: concept
topic: algorithms/techniques
status: verified
applies-to: ["any language", "Python functools.lru_cache examples"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, dynamic-programming, memoization, greedy, divide-and-conquer, recursion, caching]
---

# Dynamic programming, memoization and greedy algorithms

## Summary
**TL;DR:** **Dynamic programming (DP)** solves a problem by combining answers to overlapping subproblems and **caching** them instead of recomputing ("memoization" top-down, or a table filled bottom-up). A **greedy** algorithm always takes the best local step; it is optimal for some problems (Dijkstra's shortest paths) and wrong for others. In the lab, naive recursive Fibonacci(27) made 635 621 calls (32 ms); the memoized version computed 28 distinct values (15 µs).
**Use this when:** a recursive solution recomputes the same inputs, you face optimization problems (cheapest, longest, fewest), or you wonder whether "take the best option each step" is good enough.
**Not this doc:** caching as a systems technique → `performance/optimization/caching.md`.

## Problem
Recursive solutions to problems like diffs, edit distance, route costs or pricing combinations often explode exponentially because they solve the same subproblem many times. Greedy shortcuts look right on examples and then fail on edge cases.

## Mental model
**Analogy:** climbing stairs one or two steps at a time — how many ways to reach step n? Without notes you recount the ways to reach step 25 every time you pass through it. DP is writing the count for each step on the wall once and reading it back. Greedy is a hiker always taking the steepest uphill path: great on a single hill, stuck on a local peak in a mountain range.

**Artifact:** naive vs memoized recursion (lab, Python 3.12.13, 2026-11-04) ✅[^4]:
```python
def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)          # exponential: 635,621 calls for n = 27, 32 ms
@functools.lru_cache(None)
def mfib(n): return n if n < 2 else mfib(n-1) + mfib(n-2)       # 28 misses + 25 hits, 15 µs
```
```text
memoized fib(27): CacheInfo(hits=25, misses=28, maxsize=None, currsize=28)
```

## How it works
**Dynamic programming:**
1. Define the answer for input i in terms of answers for smaller inputs (the recurrence).
2. **Cache** each subproblem's answer instead of recomputing it ✅[^1]; memoization saves a computed answer for later reuse ✅[^2].
3. Top-down: recursion + cache (`functools.lru_cache`, which reports hits and misses via `cache_info()`) ✅[^3]. Bottom-up: fill a table from the smallest subproblem.
4. Cost = number of distinct subproblems × work per subproblem: Fibonacci has n subproblems → O(n); longest common subsequence of lengths m and n fills an m × n table → O(m·n).

**Greedy:**
1. Always take the best immediate (local) choice ✅[^5].
2. Finds the global optimum for some optimization problems but may find a worse solution for others ✅[^5]. Dijkstra's algorithm is greedy and correct when weights are non-negative (see `graphs/graph-algorithms.md`).

## Worked example
Longest common subsequence (LCS) of `ABCBDAB` and `BDCABA` with a bottom-up table (lab result: 4, e.g. `BCBA`) ✅[^4]:

| Rule | Meaning |
|---|---|
| `T[i][j] = T[i-1][j-1] + 1` if `a[i-1] == b[j-1]` | Characters match → extend the common subsequence |
| `T[i][j] = max(T[i-1][j], T[i][j-1])` otherwise | Skip a character from one string |

The table has 8 × 7 cells, each filled once — O(m·n) instead of trying all 2⁷ × 2⁶ subsequence pairs. This is the same machinery behind `diff` tools.

Greedy failing: coins of 1, 3 and 4, target 6. Greedy takes 4 + 1 + 1 (3 coins); the optimum is 3 + 3 (2 coins). DP over amounts 0…6 finds 2.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Unbounded `lru_cache` on large inputs | Memory grows with distinct arguments | Every miss is stored (`currsize`) ✅[^3] |
| Deep recursion in top-down DP | Recursion limit errors | Prefer bottom-up for large n |
| Arguments not hashable (lists) | `lru_cache` raises `TypeError` | Cache keys must be hashable ✅[^3] |
| Subproblems do not overlap | Memoization adds overhead without benefit | Plain divide and conquer is enough |

## Takeaways
- When a recursive function is called repeatedly with the same arguments, memoize it or rewrite it bottom-up.
- Prove (or test against brute force on small inputs) before trusting a greedy algorithm.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [dynamic programming](https://xlinux.nist.gov/dads/HTML/dynamicprog.html) — NIST DADS, living. Backs: solving by caching subproblem solutions rather than recomputing. [^1]
- [memoization](https://xlinux.nist.gov/dads/HTML/memoize.html) — NIST DADS, living. Backs: saving a computed answer for later reuse. [^2]
- [functools.lru_cache](https://docs.python.org/3/library/functools.html#functools.lru_cache) — Python Software Foundation, living. Backs: `cache_info()` with hits, misses, maxsize, currsize; hashable arguments. [^3]
- `linux/lab-setup.md` — the lab where the Fibonacci and LCS runs happened on 2026-11-04 (Python 3.12.13). [^4]
- [greedy algorithm](https://xlinux.nist.gov/dads/HTML/greedyalgo.html) — NIST DADS, living. Backs: best local choice; optimal for some problems, not others. [^5]

## Related
- `algorithms/graphs/graph-algorithms.md` — Dijkstra as a greedy algorithm.
- `performance/optimization/caching.md` — caching outside algorithms.
