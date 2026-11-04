---
schema: topic-index/v1
kind: subtopic
topic: algorithms/fundamentals
last-updated: 2026-11-04
---

# Algorithm fundamentals

How cost grows with input size (Big-O, measured from O(1) to O(n²)) and amortized cost (why dynamic-array appends are O(1) on average). Not covered: formal proofs, lower bounds.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [complexity-and-big-o.md](complexity-and-big-o.md) | concept | Big-O describes how an algorithm's cost **grows** with input size n, ignoring constant factors: O(1) stays flat, O(log n) grows by a step each time n doubles, O(n) doubles when n doubles, O(n log n) slightly more than doubles, O(n²) quadruples | verified |
| [amortized-analysis.md](amortized-analysis.md) | concept | Some operations are usually cheap but occasionally expensive — appending to a growable array copies everything when the array runs out of room | verified |

## References
- [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) — NIST, living. Backs: topic scope.

## Related
- `algorithms/learning-path.md` — where this subtopic sits in the learning order.
- `performance/` — making real systems fast.
