---
schema: knowledge-doc/v1
type: concept
topic: algorithms/data-structures
status: verified
applies-to: ["CPython dict/set", "Java HashMap", "hash tables in general"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, hash-table, hashing, collisions, load-factor, open-addressing, chaining, dict]
---

# Hash tables: hashing, collisions and load factor

## Summary
**TL;DR:** A hash table maps each key to an array position computed by a **hash function**, so lookup, insert and delete are O(1) on average. Two keys landing on the same position is a **collision**; tables resolve it by **chaining** (a list per bucket) or **open addressing** (probe other slots — CPython's dict does this). Performance depends on keeping the table partly empty (the **load factor**; Java's default is 0.75) and on a hash function that spreads keys. A bad hash makes everything collide: in the lab, building a 2 000-key dict took 2.1 ms with a good hash and 79 ms with a constant hash.
**Use this when:** you design keys for maps and sets, implement `__hash__`/`hashCode`, see a map getting slow as it grows, or choose between hash and ordered structures.
**Not this doc:** ordered structures (trees, B-trees) → `data-structures/trees-heaps-and-b-trees.md`.

## Problem
Hash maps are the default "fast" structure, so their failure modes surprise people: custom key types with poor or inconsistent hash/equality, attacker-chosen keys that collide, and memory blow-ups from keeping the load factor low.

## Mental model
**Analogy:** a cloakroom with numbered hooks. The attendant computes a hook number from your ticket (the hash). Usually your coat is on that hook (O(1)). If two tickets map to the same hook, the attendant must check neighbouring hooks (open addressing) or a little rack hanging from that hook (chaining). If every ticket maps to hook 1, finding a coat means searching the whole pile.

**Artifact:** the lab test of good vs constant hashes (Python 3.12.13, 2026-11-04) ✅[^4]:
```python
class Bad:
    def __init__(s, v): s.v = v
    def __hash__(s): return 1          # every key collides
    def __eq__(s, o): return s.v == o.v
class Good(Bad):
    def __hash__(s): return hash(s.v)
```
```text
Good: build dict of 2000 keys      2.1 ms
Bad:  build dict of 2000 keys     79.3 ms     # ~38x slower; grows quadratically with n
```

## How it works
**3 actors:**
- **Hash function** — its job: map a key to an integer, the same for equal keys.
- **Bucket array** — its job: store entries at `hash mod size`.
- **Collision resolution** — its job: find another place for colliding keys, by chaining or open addressing ✅[^1].

1. **Map to a position:** keys are mapped to array positions by the hash function; more than one key mapping to the same position is a collision ✅[^1].
2. **Resolve collisions:** schemes divide into chaining and open addressing ✅[^1]. CPython's dict uses open addressing — "Open addressing is preferred over chaining since the link overhead for chaining would be substantial" — with the initial probe at hash mod table size ✅[^2].
3. **Lookup:** compute the hash, go to the slot, compare keys with equality until found or an empty slot ends the probe.
4. **Load factor and resize:** as the table fills, probes get longer. Java's `HashMap` resizes (roughly doubling buckets) when entries exceed capacity × load factor; "the default load factor (.75) offers a good tradeoff between time and space costs" ✅[^3]. Resizing is amortized O(1) per insert (see `fundamentals/amortized-analysis.md`).
5. **Cost:** constant-time `get` and `put` "assuming the hash function disperses the elements properly among the buckets" ✅[^3].

## Worked example
Why the `Bad` class is quadratic: inserting the k-th key compares it with all k − 1 earlier keys that share hash 1, so n inserts cost about n²/2 equality checks — 2 000 keys ≈ 2 million comparisons. Doubling to 4 000 keys would cost about 4× as much. With `Good`, each insert lands on its own slot almost always, so the total is linear ✅[^4].

The same mechanism is a denial-of-service risk when attackers choose keys (e.g. request parameters) that collide; language runtimes therefore randomize string hashing per process ✅[^5].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Mutable object used as key, then mutated | Lookup fails; entry "lost" | Its hash changed after insertion |
| `__eq__` defined without matching `__hash__` | Equal objects land in different slots | Equal keys must have equal hashes |
| Iteration order | Insertion order in CPython dicts, unordered in Java `HashMap` | CPython dicts preserve insertion order ✅[^6]; `HashMap` makes no ordering guarantee ✅[^3] |
| Range queries ("all keys between a and b") | Full scan | Hash order has no relation to key order; use a tree |
| Constant hash (lab) | 38× slower at 2 000 keys | All keys collide ✅[^4] |

## Takeaways
- Hash only immutable data, and keep `hash`/`equals` consistent. [rule-candidate]
- Use a hash map for exact-key lookups and an ordered structure for ranges and sorted iteration.
- Pre-size maps when the entry count is known to avoid repeated resizes.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [hash table](https://xlinux.nist.gov/dads/HTML/hashtab.html) — NIST Dictionary of Algorithms and Data Structures, living. Backs: keys mapped to positions by hash functions, collisions, chaining vs open addressing. [^1]
- [Objects/dictobject.c](https://github.com/python/cpython/blob/main/Objects/dictobject.c) — CPython project, read 2026-11-04. Backs: open addressing preferred over chaining; initial probe = hash mod table size. [^2]
- [java.util.HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) — Oracle, Java SE 21. Backs: default load factor 0.75, resize behaviour, constant-time operations given good dispersion. [^3]
- `linux/lab-setup.md` — the lab where the good-vs-constant hash test ran on 2026-11-04 (Python 3.12.13). [^4]
- [PYTHONHASHSEED](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONHASHSEED) — Python Software Foundation, living. Backs: hash randomization of str and bytes. [^5]
- [Built-in Types: Mapping Types — dict](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict) — Python Software Foundation, living. Backs: dictionaries preserve insertion order. [^6]

## Related
- `algorithms/data-structures/trees-heaps-and-b-trees.md` — ordered alternatives.
- `algorithms/fundamentals/amortized-analysis.md` — resizing cost.
