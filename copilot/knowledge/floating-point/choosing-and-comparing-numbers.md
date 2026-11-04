---
schema: knowledge-doc/v1
type: how-to
topic: floating-point
status: verified
applies-to: ["Python 3.12", "JavaScript (Node 24)", "any language with IEEE doubles and a decimal or big-integer type"]
derived-from: [floating-point/ieee-754-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [floating-point, comparison, tolerance, isclose, money, decimal, bigint, safe-integer]
---

# Choose a numeric representation and compare floats safely

## Summary
**TL;DR:** Decide the representation from the data: **binary doubles** for measurements and science, **integers of the smallest unit or decimal types** for money and other exact decimal quantities, **big integers or strings** for IDs beyond 2⁵³. Never compare computed doubles with `==`; use a **relative tolerance**, plus an **absolute tolerance** when values can be near zero.
**Use this when:** you design a schema or API with numeric fields, write equality checks on computed values, or handle money, counters or large IDs in JavaScript.
**Not this doc:** why doubles are inexact → `floating-point/rounding-and-error.md`.

## Goal & prerequisites
**End state:** every numeric field has a representation chosen for its meaning, and float comparisons use explicit tolerances.

**Needs:** knowledge of each field's meaning (measurement, money, count, identifier), the languages that will read it (JavaScript loses integers above 2⁵³ − 1), and a decimal or big-integer type where needed (Python `decimal`, JavaScript `BigInt`).

## Steps
1. **Classify each numeric field.**

   | Kind | Representation |
   |---|---|
   | Measurement, ratio, statistic | binary64 (`float`, `Number`) |
   | Money, tax rates, prices | Integer of the minor unit (cents) or a decimal type; Python `Decimal('0.1') + Decimal('0.2')` is exactly `0.3` ✅[^1] ✅[^2] |
   | Integer counter below 2⁵³ | Integer (exact in a double too) |
   | Identifier or integer that may exceed 2⁵³ − 1 | String in JSON, `BigInt`/int64 in code — JavaScript `Number(9007199254740993n)` becomes …992 ✅[^1] ✅[^3] |
2. **Construct decimals from strings, not floats.** `Decimal(0.1)` captures the binary value 0.1000000000000000055511151231257827…; `Decimal('0.1')` is exact ✅[^1].
3. **Pick a rounding rule explicitly for money.** Python's decimal default context is 28 digits with `ROUND_HALF_EVEN`; other rules (e.g. `ROUND_HALF_UP`) are available ✅[^2] ✅[^1].
4. **Compare computed doubles with tolerances.** In Python, `math.isclose(a, b, rel_tol=1e-9, abs_tol=0.0)`: `rel_tol` is relative to the larger magnitude, default 1e-09 (about 9 decimal digits); `abs_tol` defaults to 0 ✅[^4].
5. **Add an absolute tolerance near zero.** A pure relative test can never call a tiny value "close" to 0: `isclose(1e-20, 0)` is False; with `abs_tol=1e-12` it is True ✅[^1].
6. **In JavaScript, write the same check explicitly:** `Math.abs(a - b) <= Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), absTol)`. `Number.EPSILON` is only the gap above 1 ✅[^5], too strict as a general tolerance for values far from 1.
7. **Format for humans at the edge:** round only when displaying; keep full precision internally.

## Verify
| Check | Expected result (lab, 2026-11-04) ✅[^1] |
|---|---|
| `0.1 + 0.2 == 0.3` | False (Python), `false` (JavaScript) |
| `math.isclose(0.1 + 0.2, 0.3)` | True |
| `math.isclose(1e-20, 0.0)` / with `abs_tol=1e-12` | False / True |
| `Decimal('0.1') + Decimal('0.2')` | `Decimal('0.3')` |
| `Number.isSafeInteger(2**53)` | `false` |
| `(2n**64n).toString()` | `"18446744073709551616"` |

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Totals off by 0.01 | Money stored as doubles | Cents as integers or decimal type |
| IDs change after JSON round trip in a browser | Integers above 2⁵³ − 1 parsed as `Number` | Send IDs as strings ✅[^3] |
| Tolerance check fails for values near 0 | Only relative tolerance | Add `abs_tol` ✅[^4] |
| Tolerance check passes for clearly different large values | `abs_tol` too big for the magnitude | Use relative tolerance as the main test |
| `Decimal` result has binary noise | Built from a float | Build from strings ✅[^1] |

## Takeaways
- Represent money as integer minor units or decimals, never binary doubles. [rule-candidate]
- Compare computed floats with a relative tolerance plus an absolute tolerance near zero. [rule-candidate]
- Transmit integers that may exceed 2⁵³ − 1 as strings in JSON.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (Python 3.12.13, Node 24.22.1) where every check in Verify ran on 2026-11-04. [^1]
- [decimal — Decimal fixed-point and floating-point arithmetic](https://docs.python.org/3/library/decimal.html) — Python Software Foundation, living. Backs: exact decimal representation; rounding options. [^2]
- [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) — MDN, living. Backs: safe integer range. [^3]
- [math.isclose](https://docs.python.org/3/library/math.html#math.isclose) — Python Software Foundation, living. Backs: `rel_tol` meaning and default 1e-09; `abs_tol` default 0. [^4]
- [Number.EPSILON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON) — MDN, living. Backs: gap between 1 and the next number. [^5]
- `floating-point/ieee-754-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `floating-point/rounding-and-error.md`
- `javascript/` — Number, BigInt and Math in JavaScript.
