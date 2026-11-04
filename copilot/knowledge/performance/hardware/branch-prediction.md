---
schema: knowledge-doc/v1
type: concept
topic: performance/hardware
status: verified
applies-to: ["pipelined CPUs with branch predictors (measurements: Apple M2 host, GCC 13.2.1)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, branch-prediction, pipeline, misprediction, branchless, if-conversion, csel]
---

# Branch prediction and branchless code

## Summary
**TL;DR:** CPUs start executing instructions before they know which way an `if` goes, guessing with a **branch predictor**. A correct guess costs nothing; a wrong one throws away the speculative work. Predictable branches (sorted data, rare error checks) are cheap; random ones are expensive. In the lab, the same loop over the same 32 768 values ran 4.9× slower on unsorted data than on sorted data — and the effect vanished when the compiler or the programmer removed the branch.
**Use this when:** a hot loop has data-dependent `if`s, sorting input makes code mysteriously faster, or a micro-benchmark shows no difference you expected.
**Not this doc:** memory effects → `hardware/memory-hierarchy-and-caches.md`; measuring correctly → `measurement/benchmarking-methodology.md`.

## Problem
Two runs with identical instruction counts take very different times because one has an unpredictable branch. Conversely, a benchmark designed to show the effect can show nothing because the compiler already replaced the branch with a conditional-select instruction.

## Mental model
**Analogy:** a railway junction operator who sets the points before the train arrives, based on what usually happens. If trains almost always go left, the operator is nearly always right. If trains go left or right at random, half the trains must stop, reverse and take the other track.

**Artifact:** the same summation with a real branch vs a branchless mask (lab, C, `-O2`, 32 768 random values 0–255, 5 000 passes, 2026-11-04) ✅[^2]:
```c
if (d[i] >= 128) hit(&s, d[i]);      // branchy (hit() is noinline, so the branch stays)
int m = -(d[i] >= 128); s += d[i] & m;  // branchless: same result, no jump
```
```text
branchy:    unsorted 0.54 s  sorted 0.11 s  (4.9x slower unsorted)
branchless: unsorted 0.05 s  sorted 0.05 s  (1.0x)
```

## How it works
1. **Pipeline:** the CPU fetches and executes many instructions ahead; at a conditional jump it must choose a path before the condition is known.
2. **Prediction:** the predictor learns patterns per branch. With sorted data the branch is "not taken" for the first half and "taken" for the second — almost perfectly predictable ✅[^2].
3. **Misprediction:** on random data, about half the guesses are wrong; each wrong guess flushes speculative work, which is where the 4.9× comes from ✅[^2].
4. **If-conversion:** compilers may replace a branch with a conditional move/select. GCC's `-fif-conversion` ("attempt to transform conditional jumps into branch-less equivalents") is enabled at `-O1` ✅[^1]; in the lab, the plain `if (d[i] >= 128) s += d[i];` loop compiled to an arm64 `csel` at `-O1`, and sorted vs unsorted ran at the same speed (0.33 s vs 0.33 s) ✅[^2].

## Worked example
How the first benchmark attempt went wrong — and what it teaches (lab, 2026-11-04) ✅[^2]:

| Attempt | Code | Result | Explanation |
|---|---|---|---|
| 1 | Simple `if … s += d[i]` at `-O1`/`-O3` | No difference (1.0×, 0.9×) | Compiler emitted `csel` (no branch) |
| 2 | Branch kept with a `noinline` call, results unused | 0.00 s for everything | Compiler removed the loops as dead code |
| 3 | Same, results printed | 4.9× unsorted vs sorted | Real misprediction cost |

Lesson: verify the generated code (`gcc -S`) and keep results live, or a benchmark measures the optimizer instead of the hardware (see `measurement/benchmarking-methodology.md`).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Error-check branches that almost never fire | Essentially free | Predicted correctly ✅[^2] |
| Branch on random data in a hot loop | Large slowdown | Mispredictions ✅[^2] |
| Branchless code on predictable data | Can be slower than a predicted branch | Always does both halves of the work |
| Different compiler flags | Branch may appear or disappear | If-conversion ✅[^1] |

## Takeaways
- For hot loops with data-dependent conditions, try sorting/partitioning the data or a branchless formulation, and measure.
- Inspect the assembly before concluding anything from a branch micro-benchmark.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html) — GNU Project, living. Backs: `-fif-conversion` and its inclusion at `-O1`. [^1]
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, GCC 13.2.1) where all three benchmark attempts and the `gcc -S` check ran on 2026-11-04. [^2]

## Related
- `performance/measurement/benchmarking-methodology.md` — dead-code elimination and other pitfalls.
- `performance/hardware/memory-hierarchy-and-caches.md`
