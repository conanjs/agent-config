---
schema: knowledge-doc/v1
type: concept
topic: algorithms/graphs
status: verified
applies-to: ["any language", "Python graphlib (3.9+) and heapq examples"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, graphs, bfs, dfs, dijkstra, shortest-path, topological-sort, dependency-graph]
---

# Graph algorithms: BFS, DFS, Dijkstra and topological sort

## Summary
**TL;DR:** Many engineering problems are graphs: services calling services, build targets depending on each other, network hops, state machines. Four algorithms cover most needs. **Breadth-first search (BFS)** visits neighbours level by level and finds fewest-hop paths. **Depth-first search (DFS)** goes deep first and underlies cycle detection and topological sorting. **Dijkstra's algorithm** finds cheapest paths when all edge weights are non-negative, using a priority queue. **Topological sort** orders tasks so every dependency comes first, and fails when there is a cycle.
**Use this when:** you model dependencies, routes or reachability, order builds or migrations, or detect cycles.
**Not this doc:** heaps used by Dijkstra → `data-structures/trees-heaps-and-b-trees.md`.

## Problem
Teams reinvent graph traversal with ad-hoc recursion that loops forever on cycles, use BFS where edge weights matter, or apply Dijkstra to graphs with negative weights. The four standard algorithms, with their preconditions, avoid these mistakes.

## Mental model
**Analogy:** a rumour spreading. **BFS** is everyone telling all their friends at once: the first wave reaches direct friends, the second wave friends-of-friends — so the wave number is the fewest hops. **DFS** is one person following a single chain of friends as far as it goes before backtracking. **Dijkstra** is the rumour travelling through phone calls of different costs, always extending the cheapest known route next. **Topological sort** is getting dressed: socks before shoes, shirt before jacket.

**Artifact:** a weighted graph and Dijkstra's result (lab, Python 3.12.13, 2026-11-04) ✅[^6]:
```text
graph:  A→B (4)  A→C (1)  C→B (2)  C→D (7)  B→D (1)
dijkstra from A: {'A': 0, 'B': 3, 'C': 1, 'D': 4}     # A→C→B→D is cheaper than A→B→D (5) or A→C→D (8)
```

## How it works
**BFS:** considers the neighbours of a vertex before going further — implemented with a FIFO queue ✅[^1]. Each vertex and edge is processed once, so it is O(V + E); the first time a vertex is reached is by a fewest-edges path.

**DFS:** considers a vertex's children before its siblings — implemented with a stack or recursion ✅[^2]. Detects cycles (an edge back to a vertex still on the stack) and produces a topological order when the graph has no cycles.

**Dijkstra** ✅[^3]:
1. Precondition: shortest paths from one source in a weighted directed graph where **all weights are non-negative**.
2. Keep a priority queue of (distance, vertex); repeatedly pop the closest unfinished vertex.
3. **Relax** each outgoing edge: if `dist[u] + w < dist[v]`, update `dist[v]` and push it.
4. Stale queue entries (an older, larger distance) are skipped when popped — the lab implementation does `if du > d[u]: continue` ✅[^6].

**Topological sort:** arranges items according to a partial order ✅[^4]. Python's `graphlib.TopologicalSorter` does this and raises `CycleError` when a cycle is detected ✅[^5].

## Worked example
Lab runs (2026-11-04) ✅[^6]:

| Algorithm | Input | Output |
|---|---|---|
| BFS | 300 × 300 grid, 90 000 vertices, ~360 000 directed edges | 36.0 ms; farthest cell 598 hops away (= 299 + 299) |
| Dijkstra | The graph above | `B = 3` via A→C→B |
| Topological sort | `deploy` needs `build`, `test`; `test` needs `build`; `build` needs `fetch` | `['fetch', 'build', 'test', 'deploy']` |
| Cycle | `a` needs `b`, `b` needs `a` | `CycleError: nodes are in a cycle` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Negative edge weights | Dijkstra may return wrong distances | Requires non-negative weights ✅[^3]; use Bellman-Ford |
| Unweighted graph | BFS is enough and simpler than Dijkstra | Every edge costs 1 |
| Cycle in a dependency graph | No valid order | `CycleError` ✅[^5] |
| Deep recursion in DFS | Stack overflow on large graphs | Use an explicit stack |
| Revisiting vertices | Infinite loop on cycles | Track a visited set |

## Takeaways
- Model dependencies as a graph and order them with a topological sort; treat a cycle as an error to report. [rule-candidate]
- Use BFS for hop counts and Dijkstra only with non-negative weights.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [breadth-first search](https://xlinux.nist.gov/dads/HTML/breadthfirst.html) — NIST DADS, living. Backs: neighbours before further edges; queue implementation. [^1]
- [depth-first search](https://xlinux.nist.gov/dads/HTML/depthfirst.html) — NIST DADS, living. Backs: children before siblings. [^2]
- [Dijkstra's algorithm](https://xlinux.nist.gov/dads/HTML/dijkstraalgo.html) — NIST DADS, living. Backs: single-source shortest paths, non-negative weights. [^3]
- [topological sort](https://xlinux.nist.gov/dads/HTML/topologicalSort.html) — NIST DADS, living. Backs: ordering by a partial order. [^4]
- [graphlib — Functionality to operate with graph-like structures](https://docs.python.org/3/library/graphlib.html) — Python Software Foundation, living. Backs: `TopologicalSorter`, `CycleError`. [^5]
- `linux/lab-setup.md` — the lab where the BFS, Dijkstra and topological-sort runs happened on 2026-11-04 (Python 3.12.13). [^6]

## Related
- `algorithms/data-structures/trees-heaps-and-b-trees.md` — the priority queue.
- `algorithms/techniques/dynamic-programming-and-greedy.md` — Dijkstra is a greedy algorithm.
