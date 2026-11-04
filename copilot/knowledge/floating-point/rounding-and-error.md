---
schema: knowledge-doc/v1
type: concept
topic: floating-point
status: verified
applies-to: ["IEEE 754 arithmetic in C, Python, JavaScript"]
derived-from: [floating-point/ieee-754-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [floating-point, rounding, ulp, epsilon, cancellation, summation, fma, ties-to-even]
---

# Rounding, ulp and how floating-point errors grow

## Summary
**TL;DR:** Each floating-point operation rounds its exact result to a representable number — by default to the nearest one, ties to even. One rounding is tiny (at most half an **ulp**, the gap between neighbouring numbers), but errors **accumulate** over many operations, small terms get **absorbed** by large ones, and subtracting nearly equal values **cancels** the correct digits and leaves the noise. Exact or compensated summation and fused multiply-add (one rounding instead of two) are the standard defences.
**Use this when:** results drift (sums slightly off, order-dependent totals), a difference of large numbers looks random, or you need to know how precise a double really is at a given magnitude.
**Not this doc:** encodings and limits → `floating-point/binary-formats.md`; NaN/∞/subnormals → `floating-point/special-values-and-exceptions.md`.

## Problem
"Doubles have 15–17 significant digits" suggests errors are negligible. They are, per operation — but a loop of a million additions, a variance computed as E[x²] − E[x]², or a difference of two large timestamps can lose most or all correct digits.

## Mental model
**Analogy:** a ruler with marks only every few millimetres (and the marks get farther apart the farther you go from zero). Every measurement snaps to the nearest mark. Adding many snapped measurements adds their snapping errors; measuring a 1 mm difference between two long distances read on a coarse part of the ruler gives garbage.

**Artifact:** how coarse the "ruler" is at different magnitudes, and what that does (lab, Python 3.12.13, 2026-11-04) ✅[^1]:
```text
math.ulp(1.0) = 2.220446049250313e-16      math.ulp(1e6) = 1.1641532182693481e-10
math.ulp(2.0**53) = 2.0                    -> float(2**53 + 1) == 2.0**53 is True
(1 + 1e-8) - 1 = 9.99999993922529e-09      -> relative error 6e-09 instead of ~1e-16
```

## How it works
1. **Exact, then round:** each result is computed as if with infinite precision and rounded once to the format; the default direction is nearest, ties to even (`rint(2.5) = 2.0`) ✅[^1]; C can switch direction with `fesetround` (`FE_UPWARD` turned `rint(2.5)` into 3.0) ✅[^2] ✅[^1].
2. **Bounded relative error:** rounding to nearest is off by at most half an ulp; the ulp scales with magnitude, so the error is relative ✅[^1].
3. **Accumulation:** ten additions of 0.1 give 0.9999999999999999 ✅[^1].
4. **Absorption:** if one term is below half an ulp of the other, it vanishes (ulp(1e16) = 2, so 1e16 + 1 rounds back to 1e16).
5. **Cancellation:** subtracting nearly equal values is exact itself, but exposes the earlier rounding error as a large *relative* error — Goldberg's "catastrophic cancellation" ✅[^3] ✅[^1].
6. **Defences:**
   - `math.fsum` returns an accurate sum (`fsum([0.1]*10) == 1.0`) ✅[^4] ✅[^1].
   - Compensated summation: since Python 3.12, `sum()` uses Neumaier summation for floats; `sum([1e16, 1, -1e16])` returns 1.0 ✅[^5] ✅[^1].
   - **FMA** computes x·y + z with a single rounding ✅[^2]; in the lab it returned the exact −2⁻⁵⁴ where `x*y + z` returned 0 ✅[^1].

## Worked example
Summing a column of 10 prices of 0.10:

| Method | Result | Why |
|---|---|---|
| Loop `s += 0.1` (Python or JavaScript) | 0.9999999999999999 ✅[^1] | 10 roundings |
| `math.fsum` | 1.0 ✅[^1] | Exact partials |
| Integers of cents (`10 * 10 = 100`) | 100 cents exactly | Integers below 2⁵³ are exact |
| `Decimal('0.10')` × 10 | `Decimal('1.00')` | Decimal arithmetic (see `floating-point/choosing-and-comparing-numbers.md`) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `round(2.675, 2)` → 2.67 | Looks like a wrong tie | Stored value is 2.67499999999999982… ✅[^1] |
| `(1.005).toFixed(2)` → "1.00" in JavaScript | Same effect | Stored below the half ✅[^6] ✅[^1] |
| `Math.round(-2.5)` → −2 in JavaScript | Not ties-to-even | Rounds .5 toward +∞ ✅[^7] ✅[^1] |
| Different summation order | Different result | Rounding is not associative |
| Variance via E[x²] − E[x]² | Can be negative or wildly wrong | Cancellation; use Welford's algorithm |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Plain loop sum | Fastest | Error grows with n |
| Compensated (Kahan/Neumaier) | Near-exact for typical data | ~4× the operations |
| `fsum` / exact | Correctly rounded | Slower, more memory |
| FMA | Fewer roundings, often faster | Results differ slightly from separate multiply-add |

## Takeaways
- Use `fsum` or compensated summation for long sums; never assume a loop sum is exact. [rule-candidate]
- Avoid subtracting nearly equal large numbers; rearrange formulas to keep significant digits.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 21 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (GCC 13.2.1 with `-frounding-math`, Python 3.12.13, Node 24.22.1) where every rounding and error example ran on 2026-11-04. [^1]
- [fma](https://en.cppreference.com/w/c/numeric/math/fma) and [FE_round](https://en.cppreference.com/w/c/numeric/fenv/FE_round) — cppreference.com, living. Backs: single rounding; rounding-direction macros. [^2]
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) — David Goldberg, 1991. Backs: catastrophic cancellation. [^3]
- [math.fsum](https://docs.python.org/3/library/math.html#math.fsum) — Python Software Foundation, living. Backs: accurate floating-point sum. [^4]
- [What's New In Python 3.12](https://docs.python.org/3/whatsnew/3.12.html) — Python Software Foundation, 2023. Backs: `sum()` uses Neumaier summation. [^5]
- [Number.prototype.toFixed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed) — MDN, living. Backs: imprecise decimal fractions. [^6]
- [Math.round](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round) — MDN, living. Backs: .5 rounds toward +∞. [^7]
- `floating-point/ieee-754-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `floating-point/choosing-and-comparing-numbers.md`
- `floating-point/binary-formats.md`
