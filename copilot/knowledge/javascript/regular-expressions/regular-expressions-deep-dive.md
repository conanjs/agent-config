---
schema: deep-dive/v1
topic: javascript/regular-expressions
status: verified
applies-to: ["ECMAScript 2025 (flags d, g, i, m, s, u, v, y; RegExp.escape)", "Node.js 24 (V8)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, regexp, regular-expressions, flags, unicode, groups, lookahead, lookbehind, backtracking, redos, replace, lastindex, sticky]
---

# Regular expressions in JavaScript, end to end

## Summary
**TL;DR:** A regular expression is a small pattern language compiled into a `RegExp` object and run by a **backtracking** matcher: it tries each start position, follows the pattern left to right, and on failure goes back to the last choice point. That model explains greedy versus lazy quantifiers, why `/\d+(?!px)/` matches `"1"` in `"12px"`, and why some patterns take exponential time on hostile input (ReDoS). JavaScript adds its own traps: `\w` and `\b` are ASCII-only, `.` and `{n}` count UTF-16 code units unless the `u`/`v` flag is set, and a `g` or `y` regex is **stateful** through `lastIndex`.
**Use this when:** you write, review or debug a regex in JavaScript; choose between `test`, `exec`, `match`, `matchAll`, `replace` and `search`; need Unicode-correct matching; or must make a pattern safe against catastrophic backtracking.
**Depth:** creation and escaping; every flag; character classes, Unicode properties and set operations; quantifiers and greed; groups, named groups, backreferences; anchors, boundaries, lookaround; the matching and backtracking mechanics; catastrophic backtracking measured and fixed; the method catalogue with `lastIndex` state; `replace` patterns; dynamic patterns and `RegExp.escape`; worked parsers (dates, INI files); a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1.

## 1. Creating a regex

| Form | Example | Note | Lab |
|---|---|---|---|
| Literal | `/\d+/` | Compiled once when the script loads | ✅[^2] |
| Constructor | `new RegExp('\\d+')` | The pattern is a **string**, so backslashes must be doubled; `new RegExp('\d+')` is the pattern `d+` and fails to match `"a1"` | ✅[^2] |
| Dynamic text in a pattern | `new RegExp(RegExp.escape(userText))` | `RegExp.escape` (ES2025) exists in Node 24; it even escapes a leading letter (`'a.b*c'` → `\x61\.b\*c`) so the result is safe in any position | ✅[^2] ✅[^3] |
| Manual escaping (older engines) | `text.replace(/[\\[.+*?(){|^$]/g, '\\$&')` | Escapes the special characters, as the book does | ✅[^2] ✅[^1] |

## 2. Flags

| Flag | Name | Effect | Lab |
|---|---|---|---|
| `g` | global | Find all matches; makes `exec`/`test` stateful via `lastIndex` | ✅[^2] |
| `i` | ignore case | Case-insensitive | — |
| `m` | multiline | `^`/`$` match at line starts/ends: `'a\nb'.match(/^b$/m)` finds `b`, without `m` → `null` | ✅[^2] |
| `s` | dotAll | `.` also matches newlines (`/a.b/s` matches `"a\nb"`) | ✅[^2] |
| `u` | unicode | Code-point semantics, `\p{…}` property escapes, stricter syntax | ✅[^2] |
| `v` | unicodeSets | `u` plus set operations in classes (`[\p{L}--[a-z]]`) and string properties | ✅[^2] |
| `y` | sticky | Match only exactly at `lastIndex` (`/\d/y.exec('a1')` → `null`) | ✅[^2] |
| `d` | hasIndices | Adds `indices` (start/end pairs) for the match and each group | ✅[^2] |

`/x/dgimsuy.flags` returns them in canonical order: `"dgimsuy"` ✅[^2] ✅[^4].

## 3. What can be matched

### 3.1 Characters, classes, Unicode

| Construct | Matches | Trap | Lab |
|---|---|---|---|
| `\d`, `\w`, `\s` | Digit, word character, whitespace | `\w` is **ASCII only**: `/^\w+$/` rejects `"café"` | ✅[^2] |
| `\p{L}` (with `u` or `v`) | Any letter in any script (`"café"`, `"Ελλάδα"`) | Needs the flag | ✅[^2] |
| `.` | Any character except line terminators | Use `s` for newlines | ✅[^2] |
| `[…]`, `[^…]` | Character set / negated set | `-` defines ranges | ✅[^5] |
| `[\p{L}--[a-z]]` (with `v`) | Letters except ASCII lowercase: `"é"` yes, `"e"` no | `v` flag only | ✅[^2] |

**Code units versus code points.** Without `u`, an emoji counts as two units: `/^.$/` fails on `"🍎"` and `/🍎{3}/` repeats only the *second* half of the emoji, so it fails on three apples; with `u` both work; `(?:🍎){3}` also works because the group holds the full pair ✅[^2] ✅[^1].

### 3.2 Quantifiers and greed

| Quantifier | Meaning |
|---|---|
| `+`, `*`, `?`, `{n}`, `{n,}`, `{n,m}` | One or more, zero or more, optional, exactly n, n or more, n to m |
| Add `?` (e.g. `+?`) | **Lazy**: as few as possible |

Greedy `/<.+>/` on `"<a><b>"` takes `"<a><b>"`; lazy `/<.+?>/` takes `"<a>"` ✅[^2]. The book's bug example: stripping comments from `1 /* a */+/* b */ 1` with greedy `/\/\*[^]*\*\//g` deletes `+` too (`"1  1"`); the lazy version gives `"1 + 1"` ✅[^2] ✅[^1]. (`[^]` is a set that matches any character, including newlines.)

### 3.3 Groups and references

| Construct | Effect | Lab |
|---|---|---|
| `( … )` | Capturing group: `m[1]`, `m[2]` … | ✅[^2] |
| `(?<name> … )` | Named group: `m.groups.name` | ✅[^2] |
| `(?: … )` | Groups without capturing (`/(?:ab)+(c)/` returns 2 elements) | ✅[^2] |
| `\1`, `\k<name>` | Backreference: the same text again (matching quotes: `(['"]).*?\1`) | ✅[^2] |

### 3.4 Positions: anchors, boundaries, lookaround

| Construct | Matches | Lab |
|---|---|---|
| `^`, `$` | Start/end of input (of each line with `m`) | ✅[^2] |
| `\b`, `\B` | Word boundary / non-boundary — ASCII word characters only; `\bcat\b` is not found in `"concatenate"` | ✅[^2] |
| `X(?=Y)`, `X(?!Y)` | X followed / not followed by Y: `\d+(?=EUR)` → `"200"` | ✅[^2] |
| `(?<=Y)X`, `(?<!Y)X` | X preceded / not preceded by Y: `(?<=€)\d` → `"7"` | ✅[^2] |
| Alternation `a\|b` | Either branch, tried left to right | ✅[^2] |

**Lookaround trap:** `/\d+(?!px)/.exec('12px 34')` returns `"1"`, not `"34"`: after `\d+` grabs `12` and the lookahead fails, backtracking gives back the `2`, and `1` followed by `2` is "not followed by px" ✅[^2]. Write `\d+(?![\dp])` or anchor the number.

## 4. How matching works

1. The engine tries the pattern at position 0, then 1, then 2 … ✅[^1].
2. At each choice — a quantifier deciding how many to take, an alternation picking a branch — it remembers the alternatives.
3. On a mismatch it **backtracks** to the most recent choice and tries the next alternative ✅[^1] ✅[^5].
4. The first complete match wins; it is the leftmost match, and among those the one the choice order reaches first (not necessarily the longest).

**Analogy:** a maze walker who marks every fork; at a dead end they return to the last fork and try the next path.

## 5. Catastrophic backtracking (ReDoS) — measured

When a pattern can split the same text in many ways and the overall match then fails, the engine tries every split. Nested quantifiers like `(a+)+` are the classic case ✅[^6] ✅[^7].

| Input: `"a" × n + "!"` | `/^(a+)+$/` time (ms) |
|---|---|
| n = 16 | 2 |
| n = 18 | 2 |
| n = 20 | 6 |
| n = 22 | 25 |
| n = 24 | 99 |

✅[^2] Each two extra characters roughly quadruple the time (2ⁿ growth); a few more characters make it seconds, then minutes. The equivalent linear pattern `/^a+$/` took 0 ms on the 24-character input ✅[^2].

**Fixes:**
1. **Remove ambiguity:** rewrite so each character can be matched only one way (`/^a+$/`).
2. **Emulate an atomic group** — JavaScript has no possessive quantifiers (`\d++` is `SyntaxError: Nothing to repeat`) — with a lookahead plus backreference: `/^(?:(?=(a+))\1)+$/` rejected the same input in 0 ms and still matches `"aaaa"` ✅[^2] ✅[^6].
3. **Bound the input length** before matching untrusted text, and avoid regex for nested structures (use a parser) ✅[^7].

## 6. The method catalogue and `lastIndex` state

| Call | Returns | With `g` | Lab |
|---|---|---|---|
| `re.test(s)` | `true`/`false` | **Stateful**: with the same regex object, `test('a')` returned `true, false, true` | ✅[^2] |
| `re.exec(s)` | Match array (`[0]`, groups, `index`, `input`, `groups`) or `null` | Advances `lastIndex`; loop to get all matches | ✅[^2] |
| `s.match(re)` | Like `exec` | Array of all matched strings, **without** groups (`["1","22","333"]`) | ✅[^2] |
| `s.matchAll(re)` | Iterator of full match objects | **Requires** `g` (`TypeError` otherwise) | ✅[^2] |
| `s.search(re)` | Index of first match or −1 (`'  word'.search(/\S/)` → 2) | Ignores `g` | ✅[^2] |
| `s.replace(re, x)` | New string | Without `g`, first match only (`'aa'` → `'ba'`) | ✅[^2] |
| `s.replaceAll(re, x)` | New string | **Requires** `g` (`TypeError` otherwise) | ✅[^2] |
| `s.split(re)` | Array | Used for line splitting: `split(/\r?\n/)` | ✅[^2] |

✅[^4]

**Rule:** never reuse a `g`/`y` regex across unrelated `test`/`exec` calls without resetting `lastIndex = 0`; or keep `g` off when you only test ✅[^1] ✅[^4].

## 7. `replace` patterns

| Replacement | Meaning | Example (lab) |
|---|---|---|
| `$1`, `$2` … | Group text | `'Liskov, Barbara'` → `'Barbara Liskov'` via `/(\w+), (\w+)/g`, `'$2 $1'` ✅[^2] |
| `$<name>` | Named group | `'2026-11-04'` → `'04/11/2026'` ✅[^2] |
| `$&` | Whole match | used by manual escaping (§1) |
| Function | Called per match with match and groups; returns the replacement | `'the cia and fbi'` → `'the CIA and FBI'` ✅[^2] |

## 8. Worked examples

**Parsing a date** with groups: `/(\d{1,2})-(\d{1,2})-(\d{4})/` on `"1-30-2003"` → `Date.UTC(2003, 0, 30)` → `2003-01-30` (months are 0-based) ✅[^2] ✅[^1].

**Parsing an INI file** line by line ✅[^2] ✅[^1]:

| Line pattern | Action |
|---|---|
| `^(\w+)=(.*)$` | Store `key = value` in the current section |
| `^\[(.*)\]$` | Start a new section object |
| `^\s*(;\|$)` | Comment or blank line: skip |
| anything else | Throw an error |

The lab parsed a sample with two top-level keys and sections `larry` and `davaeorn` into `{searchengine, spitefulness, larry: {fullname}, davaeorn: {fullname}}` ✅[^2].

## 9. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `new RegExp('\d')` never matches digits | Backslash consumed by the string literal | `'\\d'` or a literal `/\d/` |
| Accented or non-Latin words rejected | `\w`/`\b` are ASCII-only | `\p{L}` with `u`/`v` |
| Emoji counted twice, `{n}` wrong | Code units without `u` | Add `u` (or `v`) |
| `test()` alternates true/false | `g` flag keeps `lastIndex` | Drop `g`, or reset `lastIndex` |
| `matchAll`/`replaceAll` throws | Regex lacks `g` | Add `g` |
| Greedy match swallows too much | `.+`/`[^]*` are greedy | Lazy `+?`, or a negated class |
| `(?!…)` lookahead "fails" | Backtracking shortened the preceding match | Exclude the continuation characters too |
| Server hangs on certain input | Catastrophic backtracking | Remove ambiguity, lookahead atomic trick, input limits |
| User text breaks the pattern | Special characters not escaped | `RegExp.escape` |

## 10. How this deep dive was built
- **Primary narrative:** Eloquent JavaScript (4th edition) chapter 9, "Regular Expressions", read from the author's repository, including its exercises.
- **Reconciled with:** javascript.info's regular-expressions part (17 lessons, from the private mirror), MDN's regex guide and `RegExp` reference, and OWASP's ReDoS page.
- **Verified:** every ✅[^2] row ran in `node:24.22.1-alpine` on 2026-11-04 (lab files `regex.mjs`, `regex2.mjs`); backtracking times are single runs on an Apple M2 host and show growth, not absolute speed.

## References
- [Eloquent JavaScript, ch. 9 "Regular Expressions"](https://eloquentjavascript.net/09_regexp.html) — Marijn Haverbeke, 4th ed., text CC BY-NC 3.0, code MIT. Backs: creation, escaping, matching mechanics, backtracking, greed, `lastIndex`, date and INI examples, code units. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] behaviour ran on 2026-11-04. [^2]
- [RegExp.escape()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape) — MDN, living. Backs: escaping dynamic text, including leading characters. [^3]
- [RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) — MDN, living. Backs: flags, methods, `lastIndex` behaviour. [^4]
- [Regular expressions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) — MDN, living. Backs: classes, groups, assertions, backtracking terminology. [^5]
- [Catastrophic backtracking](https://javascript.info/regexp-catastrophic-backtracking) — javascript.info, living. Backs: why nested quantifiers explode; lookahead emulation of atomic groups. [^6]
- [Regular expression Denial of Service (ReDoS)](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) — OWASP, living. Backs: evil patterns and mitigations. [^7]
- [Regular expressions](https://javascript.info/regular-expressions) — javascript.info, living. Background: the 17-lesson regex part used for reconciliation.

## Related
- `javascript/data-types/numbers-and-strings.md` — string methods and Unicode length.
- `javascript/misc/bigint-unicode-and-weakrefs.md` — surrogate pairs and normalization.
