---
schema: topic-index/v1
kind: topic
topic: floating-point
last-updated: 2026-11-04
---

# Floating point (IEEE 754)

How computers store and round real numbers under IEEE 754: the binary16/32/64 formats and their limits, rounding to nearest with ties to even, ulp and error growth, cancellation, compensated summation and fused multiply-add, ±0, ±∞, NaN, subnormals and exception flags, and how to choose a representation for money, counts and IDs. Every result was measured in C (GCC 13.2.1), Python 3.12.13 and Node.js 24.22.1. Start with the deep dive for the whole model, or go straight to a focused doc. Not covered: decimal floating-point hardware, interval arithmetic, GPU reduced-precision formats (bfloat16, FP8).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [ieee-754-deep-dive.md](ieee-754-deep-dive.md) | deep-dive | The whole standard end to end — encodings, rounding, error growth, special values, flags and language behaviour — with lab output and a failure matrix | verified |
| [binary-formats.md](binary-formats.md) | reference | Field widths, precision, epsilon and range for binary16, binary32 and binary64, encoding classes and the named constants in C, Python and JavaScript | verified |
| [rounding-and-error.md](rounding-and-error.md) | concept | Each operation rounds to nearest (ties to even); errors accumulate, absorb and cancel; `fsum`, compensated summation and FMA defend | verified |
| [special-values-and-exceptions.md](special-values-and-exceptions.md) | concept | ±0, ±∞, NaN, subnormals and the five sticky exception flags, and how C, Python and JavaScript surface them | verified |
| [choosing-and-comparing-numbers.md](choosing-and-comparing-numbers.md) | how-to | Doubles for measurements, integer minor units or decimals for money, strings or BigInt for big IDs; compare with relative plus absolute tolerance | verified |

## References
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) — David Goldberg, 1991. Backs: topic scope.
- [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html) — Python Software Foundation, living. Backs: topic scope.

## Related
- `javascript/data-types/numbers-and-strings.md` — JavaScript `Number` methods.
- `linux/lab-setup.md` — the lab where every measurement ran.
