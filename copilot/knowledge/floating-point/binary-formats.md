---
schema: knowledge-doc/v1
type: reference
topic: floating-point
status: verified
applies-to: ["IEEE 754 binary16/32/64", "C float.h, Python float, JavaScript Number"]
derived-from: [floating-point/ieee-754-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [floating-point, ieee-754, binary64, binary32, binary16, encoding, epsilon, limits]
---

# IEEE 754 binary formats and their limits

## Summary
**TL;DR:** Field widths, precision, epsilon and range for half (binary16), single (binary32) and double (binary64) precision, the encoding rules for each class of value, and the named constants each language exposes — all measured in the lab.
**Use this when:** you need an exact limit (max finite value, smallest subnormal, safe integer range, epsilon) or want to decode a hex bit pattern.
**Not this doc:** why the formats behave as they do → `floating-point/ieee-754-deep-dive.md`.

## Scope
Binary interchange formats of IEEE 754 as implemented by C (`<float.h>`), Python (`struct`, `sys.float_info`) and JavaScript (`Number`). Values measured with GCC 13.2.1, Python 3.12.13 and Node 24.22.1 on 2026-11-04 ✅[^1].

## Catalog

### Format parameters ✅[^1]

| Format | Bits | Sign / exponent / fraction | Bias | Precision (bits, incl. implicit 1) | Epsilon | Max finite | Min normal | Min subnormal |
|---|---|---|---|---|---|---|---|---|
| binary16 | 16 | 1 / 5 / 10 | 15 | 11 | 2⁻¹⁰ = 9.765625e-04 | 65504 | 6.103515625e-05 | 5.960464477539063e-08 |
| binary32 | 32 | 1 / 8 / 23 | 127 | 24 | 2⁻²³ ≈ 1.19e-07 | ≈ 3.4028235e+38 | 2⁻¹²⁶ ≈ 1.18e-38 | 2⁻¹⁴⁹ ≈ 1.4e-45 |
| binary64 | 64 | 1 / 11 / 52 | 1023 | 53 | 2⁻⁵² ≈ 2.220446049250313e-16 | 1.7976931348623157e+308 | 2.2250738585072014e-308 | 5e-324 |

### Encoding classes (binary64) ✅[^1]

| Exponent field | Fraction field | Meaning | Example (hex) |
|---|---|---|---|
| All zeros | Zero | ±0 | `0x0000000000000000`, `0x8000000000000000` |
| All zeros | Non-zero | Subnormal: (−1)^s × 0.f × 2⁻¹⁰²² | `0x0000000000000001` = 5e-324 |
| 1 … 2046 | Any | Normal: (−1)^s × 1.f × 2^(e − 1023) | `0x3ff0000000000000` = 1.0 |
| All ones | Zero | ±∞ | `0x7ff0000000000000` |
| All ones | Non-zero | NaN (quiet NaN has the top fraction bit set) | `0x7ff8000000000000` |

### Named constants

| Quantity | C | Python | JavaScript |
|---|---|---|---|
| Epsilon (binary64) | `DBL_EPSILON` = `0x1p-52` ✅[^1] | `sys.float_info.epsilon` ✅[^1] | `Number.EPSILON` ✅[^2] |
| Max finite | `DBL_MAX` | `sys.float_info.max` | `Number.MAX_VALUE` = 1.7976931348623157e+308 ✅[^1] |
| Min normal | `DBL_MIN` = `0x1p-1022` ✅[^1] | `sys.float_info.min` | — |
| Min subnormal | `DBL_TRUE_MIN` = `0x1p-1074` ✅[^1] | `math.ulp(0.0)` | `Number.MIN_VALUE` = 5e-324 ✅[^1] |
| Max safe integer | — | — | `Number.MAX_SAFE_INTEGER` = 2⁵³ − 1 = 9007199254740991 ✅[^3] ✅[^1] |
| Significand digits | `DBL_MANT_DIG` = 53, `FLT_MANT_DIG` = 24 ✅[^1] | `sys.float_info.mant_dig` = 53 ✅[^1] | — |

### Common values decoded ✅[^1]

| Value | binary64 hex | binary32 hex | Stored value |
|---|---|---|---|
| 0.1 | `0x3fb999999999999a` | `0x3dcccccd` | 0.1000000000000000055511151231257827… / 0.10000000149011612 |
| 1.0 | `0x3ff0000000000000` | — | exact |
| −2.0 | `0xc000000000000000` | — | exact |
| 0.1 in binary16 | `0x2e66` | — | 0.0999755859375 |

## Lookup notes
- JavaScript `Number.MIN_VALUE` is the smallest **subnormal**, not the most negative number.
- binary32 range values are derived from the field widths; the lab measured its epsilon (`FLT_EPSILON = 0x1p-23`), digits and the stored value of 0.1f ✅[^1].
- Packing 70000 into binary16 raised `OverflowError` in Python: binary16's range ends at 65504 ✅[^1].
- `float(repr(x)) == x` held for 100 000 random doubles: Python's `repr` prints the shortest string that round-trips ✅[^1].

## Takeaways
- Decode suspicious values by their hex pattern: exponent all ones means ∞ or NaN, all zeros means 0 or subnormal.
- Use `Number.MAX_SAFE_INTEGER` (2⁵³ − 1) as the hard limit for integer IDs carried in JavaScript numbers. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (GCC 13.2.1, Python 3.12.13, Node 24.22.1) where all encodings, limits and constants were measured on 2026-11-04. [^1]
- [Number.EPSILON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON) — MDN, living. Backs: definition of `Number.EPSILON`. [^2]
- [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) — MDN, living. Backs: safe integer range. [^3]
- `floating-point/ieee-754-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `floating-point/ieee-754-deep-dive.md`
- `floating-point/special-values-and-exceptions.md`
