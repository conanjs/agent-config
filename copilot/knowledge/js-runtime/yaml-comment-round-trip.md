---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["yaml 2.9.1 (npm), Node.js 24.22.1 and 22.23.4, tested 2026-11-13"]
last-verified: 2026-11-14
last-updated: 2026-11-14
tags: [yaml, parser, comments, config-files, installer]
---

# Editing a YAML file without losing its comments: the `yaml` package

## Summary
**TL;DR:** The npm package `yaml` 2.9.1 can load a YAML file, change one value and write it back with the comments kept ✅[^probe] It does not keep the exact spacing: two spaces before an inline comment became one ✅[^probe] The package has the ISC license and no dependencies ✅[^pkg] For untrusted files it has no size limit option and its alias limit belongs to `toJS`, not to parsing ✅[^src]
**Use this when:** a tool must rewrite a file a person also edits by hand (for example a component list), and losing their comments would be a surprise.
**Not this doc:** Node.js runtime limits → [js-runtime index](index.md).

## Scope
Comment-preserving edits with `yaml`'s document API, and the option names that limit what a parsed file may contain (tags, aliases, size, depth). A round trip is like a mail sorter that opens a letter, changes one address line and reseals it: the notes in the margin stay, but the handwriting spacing may change. Example: setting `source: git` to `source: path` keeps `# V edits this` and `# knowledge`.

## Catalog

| Item | Fact | Evidence |
|---|---|---|
| Comments | `parseDocument(text)`, `doc.setIn(path, value)`, `doc.toString()`: full-line and inline comments are kept | ✅[^probe] |
| Spacing | `- name: kb  # knowledge` is written back as `- name: kb # knowledge` | ✅[^probe] |
| Node versions | Imports and round-trips on Node.js 24.22.2 and 22.23.4 (tech-stack role) and 24.22.1 (this check); Node.js 18 not tested | ✅[^probe] |
| Package | ISC license; no `dependencies` field in its `package.json` | ✅[^pkg] |
| Size limit | No option for a maximum text size exists; a caller must check the length before `parseDocument` | ✅[^src] |
| Alias limit | `maxAliasCount` is a `toJS` option (default 100, `0` refuses every alias, `-1` turns the check off), not a parse option; the limit is checked only when `toJS` runs, so editing with the document API and `toString()` never triggers it. A scalar anchor used N times needs a limit of N+1 | ✅[^probe2] |
| Tags | `customTags` defaults to `null`. `resolveKnownTags` defaults to `true`, so `!!binary` becomes a `Buffer` with no warning; with `false`, `!!binary`, `!!set` and an unknown tag such as `!foo` give warning `TAG_RESOLVE_FAILED` in `doc.warnings` (not `doc.errors`) and are read as ordinary values. `schema: 'failsafe'` still resolved `!!binary` to a `Buffer` | ✅[^probe2] |
| Errors by default | A duplicate key is error `DUPLICATE_KEY`; a second document is error `MULTIPLE_DOCS` (not with `logLevel: 'silent'`: the check is skipped and the second document is dropped without an error; `'error'` keeps it); `<<` stays a plain key (`merge` defaults to `false` for YAML 1.2) | ✅[^probe2] |
| Depth | No depth option; a stack overflow while composing is caught and reported as error `RESOURCE_EXHAUSTION` (1 000 nested `[` already gave it) | ✅[^probe2] |
| Duplicate-key cost | The `uniqueKeys` check grows faster than linearly with key count: a flat mapping of 20 000 keys (169 KB) took 1.08 s with `uniqueKeys: true` and 0.11 s with `false`; 38 000 keys (331 KB) took 4.16 s and 0.18 s. A byte cap alone does not bound parse time | ✅[^probe3] |
| Error flood | 100 000 nested `[` gave `RESOURCE_EXHAUSTION` followed by several hundred `BAD_INDENT` errors and a `MISSING_CHAR`; a caller that prints every error should cap the count | ✅[^probe3] |

## Lookup notes
- The check imported `browser/dist/index.js` from the package folder, set one value and printed the document.
- A diff after a tool rewrite can show spacing changes on lines nobody meant to change; normalise spacing once, or accept it.

## Takeaways
- Use `yaml`'s document API, not parse-then-stringify of plain objects, when a person's comments must survive a rewrite. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-14

## References
- Local measurement, 2026-11-13 — `yaml` 2.9.1 from the worktree's pnpm store, Node.js v24.22.1 on macOS; also run by the tech-stack role for spec 022 on Node.js 24.22.2 and 22.23.4 (decision DR-102). Backs: Comments, Spacing, Node versions. [^probe]
- `yaml` 2.9.1 `package.json` (npm package `yaml`, by Eemeli Aro) — read 2026-11-13. Backs: license, no dependencies. [^pkg]

- `yaml` 2.9.1 `dist/options.d.ts` and `dist/compose/compose-node.js` (npm package `yaml`) — read 2026-11-13. Backs: size limit (no such option), where `maxAliasCount` is declared, the depth handling. [^src]
- Local measurement, 2026-11-13 — `parseDocument` and `toJS` on small inputs (an alias used 1 to 3 times at limits 0 to 100, `!foo`, `!!binary`, `!!set`, duplicate keys, two documents, a merge key, nested brackets), `yaml` 2.9.1, Node.js v24.22.1 on macOS. Backs: Alias limit, Tags, Errors by default, Depth. [^probe2]
- Local measurement, 2026-11-14 — `parseDocument` then `toJS` on flat mappings of 20 000 and 38 000 numeric keys with `uniqueKeys` true and false, and on 100 000 `[`, `yaml` 2.9.1 from the worktree pnpm store, Node.js v24.22.1 on macOS; the engineering role of spec 022 measured the same trend (T054). Backs: Duplicate-key cost, Error flood. [^probe3]

## Related
- [js-runtime index](index.md)
