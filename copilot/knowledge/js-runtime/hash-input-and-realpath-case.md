---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["Node.js 24.22.1 on macOS 26.1 (APFS, case-insensitive), tested 2026-11-16 and 2026-11-17"]
last-verified: 2026-11-17
last-updated: 2026-11-17
tags: [crypto, hash, unicode, realpath, case-insensitive, security]
---

# Two Node.js traps for security checks: hashing strings and resolving real paths

## Summary
**TL;DR:** `createHash('sha256').update(text)` gives the same hash for `'a\uD800'` and `'a\uDC00'`, two different strings that each hold a lone surrogate, while `JSON.stringify` keeps them apart ✅[^probe] Refuse strings that are not well formed (`String.prototype.isWellFormed()` returns `false` for both) before hashing anything a person approves ✅[^probe][^mdn] On a case-insensitive file system, `fs.realpathSync` keeps the case you typed, while `fs.realpathSync.native` returns the case stored on disk ✅[^probe]
Two different paths can also name one folder: on macOS 26 `realpathSync.native` keeps the `/System/Volumes/Data` prefix, so only the device and inode numbers show it is the same folder ✅[^probe2]
**Use this when:** a tool hashes text that someone approved (a consent record, a lock), or compares real paths to decide whether a path stays inside a folder.
**Not this doc:** how links and junctions behave on Windows → [windows-home-links-and-modes.md](windows-home-links-and-modes.md).

## Scope
A lone surrogate is half of a character pair that JavaScript strings can hold but UTF-8 cannot encode, so the hash function swaps it for the same replacement character. It is like two different signatures that both photocopy as the same smudge: the copy no longer tells them apart. Example: an approved command and a changed command can share one hash if the change sits inside a lone surrogate.

## Catalog

| Item | Fact | Evidence |
|---|---|---|
| Hash of lone surrogates | `sha256('a\uD800') === sha256('a\uDC00')` is `true` with `createHash().update(string)` | ✅[^probe] |
| JSON keeps them apart | `JSON.stringify('a\uD800') !== JSON.stringify('a\uDC00')` is `true` | ✅[^probe] |
| Detect them | `'a\uD800'.isWellFormed()` is `false` | ✅[^probe][^mdn] |
| Real path case | For a folder `Store` reached as `STORE`: `realpathSync` returns `STORE`, `realpathSync.native` returns `Store` | ✅[^probe] |
| Second path to one folder (macOS) | `/System/Volumes/Data/Users/<name>` and `/Users/<name>` have the same device and inode, and `realpathSync.native` returns each path unchanged, so comparing real-path text treats them as two folders; compare `fs.statSync(p, { bigint: true })` `dev` and `ino` instead | ✅[^probe2] |

## Lookup notes
- A containment check that compares the non-native real path with the stored root can wrongly refuse a link whose target differs only in case; the spec 022 security role saw a false refusal and no false acceptance.
- The swap to a replacement character happens because `update(string)` encodes as UTF-8 by default.

## Takeaways
- Before hashing text a person approved, refuse strings that are not well formed, and hash a canonical JSON form rather than a joined string. [rule-candidate]
- Use `fs.realpathSync.native` when comparing real paths for containment, and compare device and inode numbers when the question is "is this the same folder". [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-17

## References
- Local measurement, 2026-11-16 — `createHash('sha256').update()` on `'a\uD800'` and `'a\uDC00'`, `JSON.stringify` and `isWellFormed` on both, and `realpathSync` against `realpathSync.native` for a folder `Store` reached as `STORE`; Node.js v24.22.1 on macOS (APFS, case-insensitive). The spec 022 security role found both during the T130 review. Backs: the first four Catalog rows. [^probe]
- Local measurement, 2026-11-17 — `fs.statSync(home, { bigint: true })` against the same call on `/System/Volumes/Data` + home, and `realpathSync.native` of both; Node.js v24.22.1 on macOS 26.1 (APFS system and data volumes). The spec 022 security role found it during the T135 review. Backs: Second path to one folder. [^probe2]
- [MDN: String.prototype.isWellFormed()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/isWellFormed) — MDN, living. Backs: Detect them. [^mdn]

## Related
- [js-runtime index](index.md)
- [windows-home-links-and-modes.md](windows-home-links-and-modes.md)
