---
schema: knowledge-doc/v1
type: reference
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, destructuring, default-values, rest, date, timezone, json, stringify, parse, reviver, tojson]
---

# Destructuring, Date and JSON

## Summary
**TL;DR:** Lookup tables for three everyday tools: **destructuring** (unpack arrays by position and objects by name, with defaults, renames and rest), **`Date`** (0-based months, auto-correcting overflow, timestamps in milliseconds) and **JSON** (`JSON.stringify` drops functions, symbols and `undefined`, turns `NaN` into `null` and dates into ISO strings; `JSON.parse` is strict and takes a reviver). All results measured in Node 24 with the container time zone set to UTC.
**Use this when:** writing function parameters or swaps with destructuring, doing date arithmetic, or serializing data.
**Not this doc:** time-zone-aware calendars (the `Temporal` proposal, `Intl.DateTimeFormat`) are not covered.

## Scope
ECMAScript 2025 destructuring, `Date` and `JSON` as run in Node 24.22.1 (time zone UTC) on 2026-11-04 ✅[^1].

## Catalog

### Destructuring ✅[^1] ✅[^2]

| Code | Result |
|---|---|
| `const [a, , c = 'dc', ...rest] = [1, 2, undefined, 4, 5]` | `a=1`, `c='dc'` (default used for `undefined`), `rest=[4,5]` |
| `const {x: xx = 9, y, ...others} = {y: 2, z: 3, w: 4}` | `xx=9` (renamed + default), `y=2`, `others={z:3, w:4}` |
| `[p, q] = [q, p]` | swaps two variables |
| `const {n: {m}} = {n: {m: 'deep'}}` | `m='deep'` (nested pattern) |
| `function f({w = 10, h = 20} = {}) { return w * h }` | `f()` → 200, `f({w: 2})` → 40 |
| `const {a} = null` | `TypeError` |
| `({a} = obj)` without `let` | Needs the parentheses; a statement starting with `{` is a block |

### Date ✅[^1] ✅[^3]

| Code | Result | Rule |
|---|---|---|
| `new Date(2026, 10, 4).getMonth()` | `10` (November) | Months count from 0 |
| `new Date(2026, 0, 1).getDay()` | `4` (Thursday) | Days of week: 0 = Sunday |
| `new Date(2026, 1, 30)` | 2026-03-02 | Overflow auto-corrects |
| `new Date(2026, 11, 32)` | 2027-01-01 | Same |
| `d = new Date(2026, 0, 31); d.setMonth(1)` | month 2, date 3 (3 March) | 31 February rolls over |
| `new Date(0).getTime()` | `0` | Timestamps are milliseconds since 1970-01-01 UTC |
| `Date.parse('2026-11-04T00:00:00.000Z')` | `1793750400000` | ISO strings parse reliably |
| `new Date('2026-11-04T10:00:00Z').getUTCHours()` | `10` | `getUTC*` ignore the local zone |
| `isNaN(new Date('nonsense'))` | `true` | Invalid dates hold `NaN` |
| `typeof Date.now()` | `'number'` | Current timestamp without creating an object |
| `date2 - date1` | number of ms | Dates convert to timestamps with numeric hint |

### JSON ✅[^1] ✅[^4] ✅[^5]

| Code | Result | Rule |
|---|---|---|
| `JSON.stringify({a:1, u:undefined, f(){}, s:Symbol(), d:new Date(0), n:NaN})` | `{"a":1,"d":"1970-01-01T00:00:00.000Z","n":null}` | Functions, symbols, `undefined` dropped; `Date` uses `toJSON`; `NaN` → `null` |
| `JSON.stringify({room, title}, ['room'])` with `room.toJSON = () => 23` | `{"room":23}` | Array replacer whitelists keys; `toJSON` customizes |
| `JSON.stringify({a: 1}, null, 2)` | 3 lines | Third argument indents |
| Object with a reference to itself | `TypeError` | Circular structures cannot be serialized |
| `JSON.parse("{'a':1}")` | `SyntaxError` | JSON needs double quotes, no comments or trailing commas |
| `JSON.parse(text, (k, v) => k === 'd' ? new Date(v) : v)` | `d` is a `Date` | A reviver restores types |

## Lookup notes
- Defaults in destructuring apply only to `undefined`, not to `null` ✅[^2].
- `new Date('2026-11-04')` (date-only ISO) is parsed as UTC; `new Date(2026, 10, 4)` uses the local zone — the lab ran in UTC so both agree there ✅[^1] ✅[^3].
- For money and big IDs in JSON see `floating-point/choosing-and-comparing-numbers.md` ✅[^4].

## Takeaways
- Destructure an options object with defaults (`{a = 1, b = 2} = {}`) instead of positional optional parameters.
- Store and send dates as ISO 8601 UTC strings or timestamps; parse them back with a reviver. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab (time zone UTC) where every value in the catalog was produced on 2026-11-04. [^1]
- [Destructuring assignment](https://javascript.info/destructuring-assignment) — javascript.info, living. Backs: array and object patterns, defaults, rest, nested and parameter destructuring. [^2]
- [Date and time](https://javascript.info/date) — javascript.info, living. Backs: 0-based months, `getDay`, auto-correction, timestamps, `Date.parse`. [^3]
- [JSON methods, toJSON](https://javascript.info/json) — javascript.info, living. Backs: what `stringify` skips, replacer, space, `toJSON`, reviver, strict syntax. [^4]
- [JSON.stringify()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) — MDN, living. Backs: `NaN`/`Infinity` become `null`; circular references throw. [^5]

## Related
- `javascript/data-types/numbers-and-strings.md`
- `javascript/data-types/maps-sets-and-weak-collections.md`
