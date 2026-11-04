---
schema: knowledge-doc/v1
type: concept
topic: floating-point
status: verified
applies-to: ["IEEE 754 in C (fenv), Python, JavaScript"]
derived-from: [floating-point/ieee-754-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [floating-point, nan, infinity, negative-zero, subnormal, exceptions, fenv, object-is]
---

# Special values: ±0, ±∞, NaN, subnormals and exception flags

## Summary
**TL;DR:** IEEE 754 never stops a computation for a bad operation by default; it returns a special value and sets a sticky **flag**. Overflow gives **±∞**, invalid operations (0/0, ∞ − ∞) give **NaN**, results too small for normal numbers become **subnormal** and then 0, and zero has a sign (**−0**). NaN is unequal to everything, including itself; −0 equals +0 but behaves differently in division. Each language exposes these slightly differently — and some (Python's `math.sqrt`) raise exceptions instead.
**Use this when:** NaN or Infinity appears in output, equality checks misbehave around 0 or NaN, very small values silently become 0, or you need to detect floating-point exceptions.
**Not this doc:** rounding error → `floating-point/rounding-and-error.md`.

## Problem
A single NaN from bad input propagates through sums and comparisons and corrupts a report; sorting or `min`/`max` with NaN gives order-dependent results; `x === 0` checks cannot tell −0 from +0. These are standard behaviours, not bugs.

## Mental model
**Analogy:** a calculator that, instead of showing "Error" and stopping, writes a special symbol in the answer box and lights a warning lamp that stays on until reset. ∞ means "too big", NaN means "no meaningful answer", and the lamps (flags) tell you afterwards what happened.

**Artifact:** results and flags from C `fenv` (lab, GCC 13.2.1, 2026-11-04) ✅[^1]:
```text
1/0           = inf     divbyzero=1  invalid=0
0/0           = nan     invalid=1
DBL_MAX*2     = inf     overflow=1   inexact=1
DBL_MIN/3     = 0x1.5555555555554p-1024   underflow=1  (subnormal)
0.1+0.2                inexact=1
```

## How it works
1. **Infinity:** results beyond the max finite value round to ±∞ (Python `1e308*10 == inf`) and set overflow ✅[^1]; x/0 for finite non-zero x gives ±∞ and sets divide-by-zero ✅[^1].
2. **NaN:** invalid operations (0/0, ∞ − ∞, 0 × ∞) produce NaN and set invalid ✅[^1]. NaN compares unequal to everything; ECMAScript represents all NaN encodings as one NaN value ✅[^3].
3. **Signed zero:** +0 and −0 have different encodings and compare equal; the sign shows in `1/-0 = -Infinity` and `copysign(1, -0.0) = -1.0` ✅[^1].
4. **Subnormals:** below the smallest normal number (2⁻¹⁰²² for binary64), values lose precision gradually down to 2⁻¹⁰⁷⁴ = 5e-324; halving that rounds to 0 ✅[^1] — gradual underflow, discussed by Goldberg ✅[^4].
5. **Flags:** `FE_DIVBYZERO`, `FE_INEXACT`, `FE_INVALID`, `FE_OVERFLOW`, `FE_UNDERFLOW` are sticky status bits tested with `fetestexcept` and cleared with `feclearexcept` ✅[^2].

**How each language surfaces them** ✅[^1]:

| Situation | C | Python | JavaScript |
|---|---|---|---|
| 1 / 0 | +∞, flag | `ZeroDivisionError: float division by zero` ✅[^1] | `Infinity` |
| `sqrt(-1)` | NaN, invalid flag | `math.sqrt(-1)` → `ValueError: math domain error` ✅[^1] | `NaN` |
| Test for NaN | `isnan(x)` | `math.isnan(x)` | `Number.isNaN(x)`, `Object.is(x, NaN)` ✅[^5] |
| NaN in arrays | — | `min(nan, 1)` = nan but `min(1, nan)` = 1 ✅[^1] | `[NaN].includes(NaN)` true, `[NaN].indexOf(NaN)` −1 ✅[^1] |
| Distinguish −0 | `signbit`, `copysign` | `math.copysign(1, x)` | `Object.is(x, -0)` ✅[^5] ✅[^1] |

## Worked example
Average response time where one sample failed to parse:

| Step | Value |
|---|---|
| Samples | 12.0, 15.0, `float('nan')` (parse failure) |
| Sum | NaN (NaN propagates through addition) |
| Average | NaN |
| `max(samples)` in Python | 15.0 or nan depending on position (comparisons with NaN are false) ✅[^1] |

Fix: reject or count invalid samples at input, before any arithmetic; then check results with `isnan` at boundaries.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `NaN === NaN` | false | IEEE comparison rule ✅[^1] |
| `-0 === 0` | true; `Object.is(-0, 0)` false | Equal value, different sign ✅[^1] |
| Very small physics/finance values | Silently become 0 | Underflow past subnormals ✅[^1] |
| JSON serialization of NaN/Infinity | `JSON.stringify([NaN, Infinity, -0])` gives `[null,null,0]` | JSON has no NaN/∞, and −0 loses its sign ✅[^1] |

## Takeaways
- Validate numeric input at boundaries; once NaN is in a calculation it spreads silently. [rule-candidate]
- Use `isnan`/`Number.isNaN`/`Object.is`, never `x == NaN`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (GCC 13.2.1, Python 3.12.13, Node 24.22.1) where every special-value result and flag was produced on 2026-11-04. [^1]
- [FE_exceptions](https://en.cppreference.com/w/c/numeric/fenv/FE_exceptions) — cppreference.com, living. Backs: the five exception macros. [^2]
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: single NaN value in ECMAScript. [^3]
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) — David Goldberg, 1991. Backs: denormalized numbers and gradual underflow. [^4]
- [Object.is](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) — MDN, living. Backs: `Object.is(NaN, NaN)` true; distinguishes ±0. [^5]
- `floating-point/ieee-754-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `floating-point/rounding-and-error.md`
- `floating-point/binary-formats.md`
