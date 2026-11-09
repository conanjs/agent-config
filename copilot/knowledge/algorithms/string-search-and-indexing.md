---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["Exact string search, prefix lookup and SQLite FTS5"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# String search and indexing by query contract

## Summary
**TL;DR:** Decide whether the query means substring, prefix, token or phrase before choosing an algorithm. Reusing a pattern and reusing a corpus justify different preprocessing.
**Use this when:** Building a log scanner, keyword detector, autocomplete service or document search feature.

## Scope
A substring scan is like looking for a sequence of letters on each page. A prefix trie is a branching directory organized by the start of each entry. A full-text index is closer to a book index that maps terms to pages. For example, searching for `red` as a substring finds `infrared`, while the token prefix `red*` finds `redo` and `redwood`.

## Catalog

| Query contract | Candidate | What to measure |
|---|---|---|
| One literal pattern in a text | Use the runtime's string-search primitive as a baseline. ✅ Knuth–Morris–Pratt (KMP) computes fallback positions from the pattern and searches in time proportional to text plus pattern length. [Original paper](https://epubs.siam.org/doi/abs/10.1137/0206024) | Throughput, repeated-prefix input, short versus long patterns, pattern preprocessing |
| Many literal patterns in the same stream | ✅ Aho–Corasick builds a trie with fallback links and output information. It shares work across patterns during the scan. Returning many overlapping matches adds output cost. [Original paper](https://cr.yp.to/bib/1975/aho.pdf) | Build latency, automaton memory, throughput, output volume |
| Dictionary keys starting with a prefix | Compare a sorted dictionary with a trie or a radix trie, which compresses paths with one child | Bytes per key, prefix result count, ordering, updates |
| Documents matching terms or phrases | ✅ A full-text index maps tokens to document occurrences. SQLite Full-Text Search 5 (FTS5) supports phrase and prefix queries and optional indexes for configured token-prefix lengths. [SQLite FTS5](https://www.sqlite.org/fts5.html) | Build time, indexing throughput, disk space, query latency, tokenization and ranking correctness |
| Arbitrary substrings across a repeatedly queried corpus | Compare a suffix-oriented index or a character n-gram index against direct scanning. Verify candidates if the index only supplies a filter. | Query mix, index size, update cost, short-pattern behavior and false candidates |

## Lookup notes
Specify the unit used for matching and offsets, such as bytes or Unicode code points. Decide whether overlapping matches are emitted, how empty patterns are treated, and which case and normalization rules apply. For stream scans, preserve state across chunk boundaries when a match may span chunks. A pattern detector that resets after every chunk can miss a match split as `er` followed by `ror`.

✅ The following SQLite statements were exercised locally on arm64 using Python 3.13.7 and SQLite 3.50.4 on 2026-11-07. The input rows have shape `(rowid, body)`. The match selects documents by token semantics and the projection returns only their `rowid` values.

```sql
CREATE VIRTUAL TABLE docs USING fts5(body, prefix='3');
INSERT INTO docs(rowid, body) VALUES
  (1, 'redo log'), (2, 'redwood tree'), (3, 'infrared camera');

SELECT rowid FROM docs WHERE docs MATCH 'red*' ORDER BY rowid;
SELECT rowid FROM docs WHERE docs MATCH 'red' ORDER BY rowid;
SELECT rowid FROM docs WHERE docs MATCH '"redo log"' ORDER BY rowid;
```

| Query | Output rows |
|---|---|
| `red*` | `(1)`, `(2)` |
| `red` | No rows |
| `"redo log"` | `(1)` |

The FTS5 prefix option adds an index for the configured length. Compare with an otherwise identical table without that option before attributing a speedup to it. The local check tested result semantics only. No search algorithms or index variants were timed.

## Takeaways
- Compare implementations under the same matching and output semantics.
- Record build and update costs alongside query latency when evaluating an index.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 4 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Fast Pattern Matching in Strings](https://epubs.siam.org/doi/abs/10.1137/0206024) — Knuth, Morris and Pratt, 1977. Backs the single-pattern bound.
- [Efficient String Matching: An Aid to Bibliographic Search](https://cr.yp.to/bib/1975/aho.pdf) — Aho and Corasick, 1975. Backs the multiple-pattern automaton.
- [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html) — SQLite, living. Backs the virtual table, prefix index and match syntax.
- Embedded SQL and result table — local semantics check.

## Related
- [Set intersection representations](set-intersection-representations.md)
- [Query and data-path performance](../performance/database-query-performance.md)
