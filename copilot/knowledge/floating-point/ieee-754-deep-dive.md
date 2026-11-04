---
schema: deep-dive/v1
topic: floating-point
status: verified
applies-to: ["IEEE 754-2019 (binary formats)", "C (GCC 13, glibc/musl fenv)", "Python 3.12", "JavaScript (ECMAScript, Node 24)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into:
  - { path: floating-point/binary-formats.md, on: 2026-11-04 }
  - { path: floating-point/rounding-and-error.md, on: 2026-11-04 }
  - { path: floating-point/special-values-and-exceptions.md, on: 2026-11-04 }
  - { path: floating-point/choosing-and-comparing-numbers.md, on: 2026-11-04 }
tags: [floating-point, ieee-754, binary64, rounding, ulp, nan, subnormal, fma, decimal, javascript-number]
---

# IEEE 754 floating point, end to end

## Summary
**TL;DR:** IEEE 754 defines how computers store real numbers as **sign × significand × 2^exponent** in fixed bit fields, how every operation is **rounded** (by default to the nearest representable value, ties to even), and what happens at the edges: **±0, ±∞, NaN, subnormal** numbers and five **exception flags**. Almost every language's "double" or "float" is this standard: Python floats map to binary64 on essentially all platforms, and the JavaScript `Number` type *is* binary64. Most surprises — `0.1 + 0.2 !== 0.3`, `2^53 + 1 == 2^53`, `NaN != NaN`, money rounding errors — follow mechanically from these rules, and every one of them is reproduced below with real output.
**Use this when:** you want the complete model behind floating-point behaviour before reading the focused docs, or you debug a numeric issue that crosses representation, rounding and special values.
**Depth:** bit layouts of binary16/32/64 with real encodings; what is and is not exactly representable; rounding modes and their effect (C `fenv`); ulp, machine epsilon and error growth; cancellation, compensated summation and fused multiply-add; ±0, ±∞, NaN, subnormals and exception flags; how C, Python and JavaScript expose all of it; a failure matrix; verified (✅) vs unverified (⚠️) marks.

## 1. Why a standard, and who uses it

Before IEEE 754 (first published 1985, current edition 2019) every machine rounded differently, so the same program gave different answers. The standard fixed formats, rounding and exceptional cases so results are reproducible across hardware. Today:

| Environment | What its floating-point type is |
|---|---|
| C `double` / `float` | IEEE binary64 / binary32 on mainstream platforms; `<float.h>` exposes the parameters (lab: `DBL_MANT_DIG=53`, `FLT_MANT_DIG=24`) ✅[^6] |
| Python `float` | "almost all platforms map Python floats to IEEE 754 binary64" ✅[^1] |
| JavaScript `Number` | "the double-precision floating point IEEE 754-2019 binary64 values", with all NaNs collapsed into one NaN value ✅[^3] |
| Rust `f64` | "the binary64 type defined in IEEE 754-2008" ✅[^5] |

The standard itself is a paid IEEE document; everything below is taken from free primary sources that implement or explain it, and from measurements.

## 2. The bit layout

A binary floating-point number has three fields: **sign** s (1 bit), biased **exponent** e, and **fraction** f (the significand without its leading bit). For normal numbers the leading significand bit is an implicit 1, so the value is (−1)^s × 1.f × 2^(e − bias).

Real binary64 encodings (sign | 11 exponent bits | 52 fraction bits), lab Python 3.12.13 ✅[^6]:
```text
1.0                      0 01111111111 0000…0000                      0x3ff0000000000000
-2.0                     1 10000000000 0000…0000                      0xc000000000000000
0.1                      0 01111111011 1001100110011001…1001100110011010 0x3fb999999999999a
-0.0                     1 00000000000 0000…0000                      0x8000000000000000
inf                      0 11111111111 0000…0000                      0x7ff0000000000000
nan                      0 11111111111 1000…0000                      0x7ff8000000000000
5e-324 (min subnormal)   0 00000000000 0000…0001                      0x0000000000000001
2.2250738585072014e-308  0 00000000001 0000…0000   (min normal)       0x0010000000000000
1.7976931348623157e+308  0 11111111110 1111…1111   (max finite)       0x7fefffffffffffff
```

Reading `1.0`: exponent field 01111111111 = 1023 = the bias, so 2^(1023−1023) = 2^0; fraction 0 → 1.0 × 1 = 1. Reading `-2.0`: sign 1, exponent 1024 → 2^1, fraction 0 → −2.

Format parameters measured in the lab (Python `struct`, C `<float.h>`) ✅[^6]:

| Format | Total bits | Exponent bits | Significand precision (with implicit bit) | Machine epsilon | Max finite | Min normal | Min subnormal |
|---|---|---|---|---|---|---|---|
| binary16 (half) | 16 | 5 | 11 | 2⁻¹⁰ = 0.0009765625 | 65504 | 6.103515625e-05 | 5.96e-08 |
| binary32 (single) | 32 | 8 | 24 | 2⁻²³ (`FLT_EPSILON = 0x1p-23`) | ≈ 3.4e38 | 2⁻¹²⁶ | 2⁻¹⁴⁹ |
| binary64 (double) | 64 | 11 | 53 | 2⁻⁵² ≈ 2.22e-16 | 1.7976931348623157e+308 | 2⁻¹⁰²² ≈ 2.2250738585072014e-308 | 2⁻¹⁰⁷⁴ = 5e-324 |

(binary32 max and minimum values follow from its field widths; the lab measured its epsilon and mantissa digits directly.)

## 3. What can be represented exactly

A binary64 value is an integer (up to 53 bits) times a power of two. Python's tutorial describes floats as a binary fraction whose numerator uses the first 53 significant bits and whose denominator is a power of two ✅[^1]. Consequences:

| Value | Exact? | Why / evidence |
|---|---|---|
| 0.5, 0.25, 0.375 | Yes | Denominators are powers of two |
| 0.1 | No | 1/10 has a factor 5 in the denominator; the stored value is 0.1000000000000000055511151231257827021181583404541015625 ✅[^6] |
| 0.1 + 0.2 | Rounds to 0.3000000000000000444…, while 0.3 is stored as 0.2999999999999999888… — so they differ ✅[^6] | Two different rounding results |
| Integers up to 2⁵³ | Yes | Fit the 53-bit significand |
| 2⁵³ + 1 = 9007199254740993 | No | Rounds to 9007199254740992: `float(2**53+1)` and JS `2**53+1` both give …992 ✅[^6] |

In binary, 0.1 is the repeating fraction 0.000110011001100110011… (JS `(0.1).toString(2)`) ✅[^6]; it has to be cut off somewhere. This is "not a bug", as Python's documentation puts it, but the result of decimal fractions not being representable in binary ✅[^2].

## 4. Rounding

Every arithmetic result is computed as if exactly and then **rounded** to a representable value. IEEE 754 defines several rounding directions; C exposes four through `<fenv.h>` (`FE_TONEAREST`, `FE_UPWARD`, `FE_DOWNWARD`, `FE_TOWARDZERO`) ✅[^7]. Lab, GCC 13.2.1 with `-frounding-math` ✅[^6]:
```text
to-nearest   1/3 = 0.33333333333333331483  rint(2.5)=2.0 rint(-2.5)=-2.0
upward       1/3 = 0.33333333333333337035  rint(2.5)=3.0 rint(-2.5)=-2.0
downward     1/3 = 0.33333333333333331482  rint(2.5)=2.0 rint(-2.5)=-3.0
toward-zero  1/3 = 0.33333333333333331482  rint(2.5)=2.0 rint(-2.5)=-2.0
```
- **Round to nearest, ties to even** is the default: exact halves go to the neighbour with an even last digit, so `rint(2.5) = 2`. Python's `round()` documents the same rule ("rounding is done toward the even choice") and returns 0, 2, 2 for 0.5, 1.5, 2.5 ✅[^2] ✅[^6]. ECMAScript specifies roundTiesToEven for converting mathematical values to Numbers ✅[^3].
- Language-level rounding functions can differ: JavaScript `Math.round` rounds an exact .5 "in the direction of +∞" (`Math.round(2.5) = 3`, `Math.round(-2.5) = -2`) ✅[^9] ✅[^6].
- **Decimal "ties" that are not ties:** `round(2.675, 2)` gives 2.67 because 2.675 is stored as 2.67499999999999982236431605997495353221893310546875 ✅[^6]; JavaScript `(1.005).toFixed(2)` gives "1.00" for the same reason, which MDN attributes to decimal fractions not being representable precisely ✅[^10] ✅[^6].

## 5. Precision: ulp and machine epsilon

The **ulp** (unit in the last place) of x is the gap to the next representable number; it grows with magnitude ✅[^6]:
```text
ulp(1)       = 2.220446049250313e-16     (= machine epsilon, 2^-52)
ulp(1e6)     = 1.1641532182693481e-10
ulp(2^53)    = 2.0                        (above 2^53, only even integers exist)
ulp(1e300)   = 1.487016908477783e+284
```
Machine epsilon is the difference between 1 and the next larger representable number: `Number.EPSILON === 2**-52`, `sys.float_info.epsilon == 2**-52`, `DBL_EPSILON = 0x1p-52` ✅[^8] ✅[^6]. Correctly rounded operations have relative error at most half an ulp; the error is **relative**, so absolute errors are large for large numbers.

JavaScript's safe-integer range follows: integers are exactly representable and distinguishable only up to 2⁵³ − 1 = `Number.MAX_SAFE_INTEGER` ✅[^11] ✅[^6]; beyond that, use `BigInt` (lab: `2n**64n = 18446744073709551616` exactly) ✅[^6].

## 6. How errors grow

| Effect | Lab demonstration ✅[^6] | Mechanism |
|---|---|---|
| Accumulation | Adding 0.1 ten times gives 0.9999999999999999 (Python and JavaScript) | Each addition rounds; errors add up |
| Absorption | Naively, 1e16 + 1 = 1e16 (ulp(1e16) = 2) | The small term is below half an ulp |
| Cancellation | (1 + 1e-8) − 1 = 9.99999993922529e-09, relative error 6e-9 instead of 1e-16 | Subtracting nearly equal numbers keeps their earlier rounding error and drops the matching leading digits |
| Fix: exact summation | `math.fsum([0.1]*10) = 1.0` | Tracks partial sums exactly ✅[^2] |
| Fix: compensated summation | Python 3.12 `sum([1e16, 1, -1e16]) = 1.0` | `sum()` now uses Neumaier summation for floats ✅[^12] |

Goldberg's classic paper calls the cancellation case **catastrophic cancellation**, which "occurs when the operands are subject to rounding errors" ✅[^4].

**Fused multiply-add (FMA)** computes x·y + z "as if to infinite precision and rounded only once" ✅[^7]. Lab, x = 1 + 2⁻²⁷, y = 1 − 2⁻²⁷, z = −1 (exact answer −2⁻⁵⁴) ✅[^6]:
```text
plain x*y + z = 0x0p+0       (x*y rounded to 1.0 first, then 1 - 1 = 0)
fma(x, y, z)  = -0x1p-54     (exact)
```

## 7. Special values and exceptions

| Operation | Result | Flag raised (C `fenv`, lab) ✅[^6] |
|---|---|---|
| 1 / 0 | +∞ | divide-by-zero |
| 0 / 0, ∞ − ∞, 0 × ∞ | NaN | invalid |
| `DBL_MAX * 2` | +∞ | overflow (+ inexact) |
| `DBL_MIN / 3` | 0x1.5555555555554p-1024 (subnormal) | underflow |
| 0.1 + 0.2 | rounded result | inexact |

The five flags (`FE_DIVBYZERO`, `FE_INEXACT`, `FE_INVALID`, `FE_OVERFLOW`, `FE_UNDERFLOW`) are sticky status bits; default IEEE behaviour is to deliver the special result and continue ✅[^7].

- **±0:** two encodings (0x0… and 0x8…) that compare equal; the sign survives division (`1/-0 = -Infinity`) and `copysign(1, -0.0) = -1` ✅[^6].
- **NaN:** compares unequal to everything including itself (`NaN === NaN` is false); detect it with `isnan`, `Number.isNaN` or `Object.is(NaN, NaN)` (true) ✅[^13] ✅[^6]. ECMAScript represents all IEEE NaNs as one NaN value ✅[^3]. Array search differs: `[NaN].includes(NaN)` is true but `[NaN].indexOf(NaN)` is −1 ✅[^6].
- **Subnormals** fill the gap between 0 and the smallest normal number with reduced precision (gradual underflow); halving the smallest subnormal 5e-324 gives 0 ✅[^6]. Goldberg covers denormalized numbers and gradual underflow ✅[^4].
- **Language differences:** Python raises `ValueError` for `math.sqrt(-1)` instead of returning NaN, and `min(nan, 1)` vs `min(1, nan)` give different answers (nan vs 1) because comparisons with NaN are false ✅[^6].

## 8. Decimal arithmetic as the alternative

When values are decimal by nature (money, prices), binary floats are the wrong tool. Python's `decimal` module represents decimal numbers exactly (`Decimal('0.1') + Decimal('0.2') = Decimal('0.3')`), follows the General Decimal Arithmetic Specification, and defaults to 28 significant digits with `ROUND_HALF_EVEN` ✅[^14] ✅[^6]. IEEE 754 also specifies fixed-width decimal interchange formats; Python's decimal context option `clamp=1` exists for compatibility with them ✅[^14].

## 9. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `0.1 + 0.2 !== 0.3` | Inexact decimal fractions (§3) | Compare with a tolerance (`math.isclose`) or use decimals |
| Totals off by a cent | Binary rounding of decimal amounts | Integers of cents, or decimal types |
| Large IDs corrupted in JSON/JS | Integers above 2⁵³ lose precision (§5) | Transmit as strings; `BigInt` |
| Sum depends on order | Rounding is not associative (§6) | `fsum`, compensated summation, sort by magnitude |
| Small difference of large numbers is noise | Cancellation (§6) | Reformulate algebraically; higher precision |
| NaN spreads through a computation | NaN propagates; comparisons false (§7) | Validate inputs; check `isnan` at boundaries |
| `x == 0` misses −0 handling | ±0 compare equal but differ in sign (§7) | Use `Object.is` / `copysign` when sign matters |
| `toFixed`/`round` "wrong" at .5 | Stored value below the half (§4) | Round decimal values with decimal arithmetic |

## References
- [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html) — Python Software Foundation, living. Backs: binary64 mapping on almost all platforms; 53-bit binary fraction model. [^1]
- [Built-in Functions](https://docs.python.org/3/library/functions.html) and [math](https://docs.python.org/3/library/math.html) — Python Software Foundation, living. Backs: `round()` ties toward even and the "not a bug" note; `math.fsum` accurate sum. [^2]
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: Number = IEEE 754-2019 binary64 values; single NaN; roundTiesToEven. [^3]
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) — David Goldberg, 1991 (Oracle reprint). Backs: catastrophic cancellation; denormalized numbers and gradual underflow. [^4]
- [Primitive type f64](https://doc.rust-lang.org/std/primitive.f64.html) — Rust project, living. Backs: `f64` is IEEE binary64. [^5]
- `linux/lab-setup.md` — the lab (Alpine 3.20, GCC 13.2.1 with `-frounding-math`, Python 3.12.13; Node 24.22.1 in `node:24.22.1-alpine`) where every encoding and result in this dive was produced on 2026-11-04. [^6]
- [fma](https://en.cppreference.com/w/c/numeric/math/fma), [FE_round](https://en.cppreference.com/w/c/numeric/fenv/FE_round), [FE_exceptions](https://en.cppreference.com/w/c/numeric/fenv/FE_exceptions) — cppreference.com, living. Backs: single rounding of FMA; the four rounding macros; the five exception flags. [^7]
- [Number.EPSILON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON) — MDN, living. Backs: difference between 1 and the next larger number. [^8]
- [Math.round](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round) — MDN, living. Backs: exact .5 rounds toward +∞. [^9]
- [Number.prototype.toFixed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed) — MDN, living. Backs: unexpected results because decimal fractions are not precise in floating point. [^10]
- [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) — MDN, living. Backs: safe integers between −(2⁵³ − 1) and 2⁵³ − 1. [^11]
- [What's New In Python 3.12](https://docs.python.org/3/whatsnew/3.12.html) — Python Software Foundation, 2023. Backs: `sum()` uses Neumaier summation for floats. [^12]
- [Object.is](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) — MDN, living. Backs: `Object.is(NaN, NaN)` is true. [^13]
- [decimal — Decimal fixed-point and floating-point arithmetic](https://docs.python.org/3/library/decimal.html) — Python Software Foundation, living. Backs: exact decimal representation, General Decimal Arithmetic Specification, rounding options. [^14]
- [General Decimal Arithmetic](https://speleotrove.com/decimal/) — Mike Cowlishaw, living. Backs: further reading on decimal floating point.
- [IEEE 754 status notes](https://people.eecs.berkeley.edu/~wkahan/ieee754status/IEEE754.PDF) — William Kahan, 1997. Backs: further reading from the standard's principal architect.

## Related
- `javascript/` — how the language exposes Number, BigInt and Math.
- `algorithms/fundamentals/complexity-and-big-o.md`
- `performance/` — numeric performance (FMA, vectorization).
