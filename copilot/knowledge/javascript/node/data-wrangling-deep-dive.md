---
schema: deep-dive/v1
topic: javascript/node
status: verified
applies-to: ["Node.js 24 (node:stream, node:readline, node:zlib)", "ECMAScript 2025 (Object.groupBy, Intl)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, nodejs, data-wrangling, streams, backpressure, pipeline, csv, rfc-4180, ndjson, readline, gzip, intl, memory]
---

# Data wrangling with Node.js, end to end

## Summary
**TL;DR:** Data wrangling — acquiring, parsing, cleaning, transforming, aggregating and writing data — in Node.js is mostly a question of **streaming versus loading**, **parsing correctly** and **converting types deliberately**. Reading a whole file into memory is simple but costs many times the file size: an 11.6 MB CSV peaked at 175 MB of process memory read whole, versus 68 MB streamed line by line, in the same time. CSV is not "split on commas": quoted fields may contain commas, quotes and newlines (RFC 4180). Streams compose with `pipeline`, which propagates errors and honours **backpressure** (a writer saying "slow down").
**Use this when:** you process files, logs, exports or API dumps with Node; choose between `readFile` and streams; parse CSV or JSON Lines; or convert messy numbers and dates; or read data-wrangling books and want a verified, open-source companion.
**Depth:** the wrangling pipeline; memory and time of whole-file versus streaming measured; RFC 4180 CSV rules and the failures of naive splitting; JSON Lines; number and date conversion traps; `Intl` formatting; grouping and aggregation; Node streams (readable, writable, transform), backpressure observed, `pipeline` with error propagation, gzip; web streams; a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1.

## 1. The pipeline

| Stage | Node tools |
|---|---|
| Acquire | `fs.createReadStream`, `fetch` (returns web streams), `readline` |
| Parse | `JSON.parse`, a CSV parser, `split` for JSON Lines |
| Clean / convert | `Number`, `Date`, `String.prototype.normalize`, validation |
| Transform / aggregate | `map`/`filter`, `Object.groupBy`/`Map.groupBy`, `reduce` |
| Output | `fs.createWriteStream`, `zlib`, `Intl` formatting |

✅[^1]

## 2. Load whole or stream? — measured

600 000-row generated CSV (11.6 MB), summing an amount per city ✅[^2]:

| Approach | Time | Peak process memory (max RSS) |
|---|---|---|
| `readFileSync` + `split('\n')` + loop | 209 ms | **175 MB** |
| `createReadStream` + `readline` + `for await` | 209 ms | **68 MB** |

Both produced the same sum. The whole-file version holds the text, the array of lines and per-line arrays at once — about 15× the file size here — and grows with the file; the streaming version stays roughly constant ✅[^2] ✅[^3]. Rule of thumb: stream anything that may exceed a small fraction of available memory, or whose size you do not control.

## 3. CSV correctly (RFC 4180)

RFC 4180 rules ✅[^4]: fields separated by commas, records by CRLF; a field may be enclosed in double quotes, and then it may contain commas, line breaks and quotes written as `""`.

| Input | Naive `split(',')` | Quote-aware parser | Lab |
|---|---|---|---|
| `1000,Paris,0.3,"said ""hi"", then left"` | 5 fields (wrong) | 4 fields; note = `said "hi", then left` | ✅[^2] |
| `a,"x⏎y"⏎b,z` (newline inside quotes) | 3 "lines" | 2 records | ✅[^2] |

So line-by-line readers are only safe when you know fields never contain newlines; otherwise use a streaming CSV parser that tracks quote state across chunks ✅[^4].

**JSON Lines (NDJSON)** — one JSON value per line — streams naturally: split on newlines, skip blanks, `JSON.parse` each: `[1, 2, 3]` from a sample with an empty line ✅[^2] ✅[^5].

## 4. Converting types

| Input | Conversion | Result | Lesson |
|---|---|---|---|
| `' 1.5 '` | `Number` | 1.5 | Whitespace is trimmed |
| `'1,5'` (decimal comma) | `Number` / `parseFloat` | `NaN` / **1** | `parseFloat` silently truncates; normalize locale formats first |
| `''` | `Number` | **0** | Empty cells become 0 — check before converting |
| `'2026-11-04'` | `new Date` | `2026-11-04T00:00:00.000Z` | Date-only ISO strings are UTC |
| `'2026-11-04T10:00'` | `new Date` | local time (UTC in the lab container) | Date-time without `Z` uses the machine's zone |

✅[^2] ✅[^6]. Background: `javascript/fundamentals/syntax-variables-and-types.md` and `javascript/data-types/destructuring-dates-and-json.md`.

**Output formatting** with `Intl`: `$1,234.50` (en-US currency), `1.234,5` (de-DE), `1 Jan 1970` (en-GB medium date) ✅[^2] ✅[^7].

**Aggregation:** `Object.groupBy(records, r => r.city)` then `reduce` per group → `{Paris: 5, Lima: 5}` ✅[^2].

## 5. Streams

| Type | Role |
|---|---|
| Readable | Source of chunks (file, socket, `Readable.from(iterable)`) |
| Writable | Sink (file, socket) |
| Transform | Both: rewrites chunks (parse, filter, uppercase, compress) |

✅[^3]

### 5.1 Backpressure, observed

A writable with `highWaterMark` 4 bytes and a slow consumer: four 1-byte `write()` calls returned `true, true, true, false`; then the `'drain'` event signalled that writing could resume ✅[^2] ✅[^8]. Ignoring `false` makes Node buffer unboundedly in memory; respect it, or let `pipeline` do so ✅[^8].

### 5.2 `pipeline`

`await pipeline(source, transform, createGzip(), createWriteStream(file))` wires streams with backpressure and closes all of them when one fails ✅[^3]. Lab: an uppercase transform plus gzip round-tripped to `HELLO STREAM`; a transform that failed with `bad row` made `pipeline` reject with that error ✅[^2]. Gzipping the generated CSV through a stream gave a compressed size of 0.179 of the original ✅[^2].

### 5.3 Web streams

Node 24 also has the browser's streams (`ReadableStream`) and `Response`, so `fetch` bodies and browser-style code work unchanged; `Readable.fromWeb`/`toWeb` convert between the two models ✅[^2] ✅[^3].

## 6. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| Process runs out of memory on big inputs | Whole-file load (~15× file size here) | Stream with `readline` or a streaming parser |
| Columns shift on some rows | Commas inside quoted CSV fields | RFC 4180-aware parser |
| A record splits across two lines | Newline inside a quoted field | Parser that keeps quote state across chunks |
| Totals slightly low | `parseFloat('1,5')` → 1 | Normalize decimal commas; validate with `Number` and reject `NaN` |
| Blank cells counted as 0 | `Number('')` is 0 | Check for empty strings first |
| Dates shifted by hours | Date-time strings without `Z` read in local zone | Include offsets; store UTC |
| Memory climbs while writing output | `write()` return value ignored | Wait for `'drain'`, or use `pipeline` |
| Error leaves files open or half-written | Manual `.pipe()` chains do not propagate errors | `stream/promises` `pipeline` |

## 7. How this deep dive was built
- **Sources:** Node.js documentation (`stream`, `readline`, backpressure guide), RFC 4180, the JSON Lines format page, MDN (`Date`, `Intl`). It covers the subjects of data-wrangling-with-JavaScript books from these open sources only.
- **Verified:** `node:24.22.1-alpine` on 2026-11-04 (lab files `dw/gen.mjs`, `dw/whole.mjs`, `dw/stream.mjs`, `dw/misc.mjs`); memory is `process.resourceUsage().maxRSS` from single runs.

## References
- [Node.js: Reading files](https://nodejs.org/en/learn/manipulating-files/reading-files-with-nodejs) — Node.js project, living. Backs: whole-file reads load everything into memory; streams for large files. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] result was produced on 2026-11-04. [^2]
- [Stream](https://nodejs.org/api/stream.html) — Node.js documentation, v24. Backs: stream types, `pipeline`, web-stream interop. [^3]
- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180) — IETF, 2005. Backs: quoting, embedded commas, line breaks and quotes. [^4]
- [JSON Lines](https://jsonlines.org/) — jsonlines.org, living. Backs: one JSON value per line. [^5]
- [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) — MDN, living. Backs: date-only forms are UTC, date-time forms are local. [^6]
- [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) — MDN, living. Backs: locale-aware number and date formatting. [^7]
- [Backpressuring in streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams) — Node.js project, living. Backs: `write()` returning `false`, `'drain'`, buffering when ignored. [^8]

## Related
- `javascript/node/node-services-deep-dive.md`
- `javascript/data-types/destructuring-dates-and-json.md`
- `floating-point/choosing-and-comparing-numbers.md` — money and precision during aggregation.
