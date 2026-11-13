---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["yaml 2.9.1 (npm), Node.js 24.22.1 and 22.23.4, tested 2026-11-13"]
last-verified: 2026-11-13
last-updated: 2026-11-13
tags: [yaml, parser, comments, config-files, installer]
---

# Editing a YAML file without losing its comments: the `yaml` package

## Summary
**TL;DR:** The npm package `yaml` 2.9.1 can load a YAML file, change one value and write it back with the comments kept ✅[^probe] It does not keep the exact spacing: two spaces before an inline comment became one ✅[^probe] The package has the ISC license and no dependencies ✅[^pkg]
**Use this when:** a tool must rewrite a file a person also edits by hand (for example a component list), and losing their comments would be a surprise.
**Not this doc:** Node.js runtime limits → [js-runtime index](index.md).

## Scope
Comment-preserving edits with `yaml`'s document API. A round trip is like a mail sorter that opens a letter, changes one address line and reseals it: the notes in the margin stay, but the handwriting spacing may change. Example: setting `source: git` to `source: path` keeps `# V edits this` and `# knowledge`.

## Catalog

| Item | Fact | Evidence |
|---|---|---|
| Comments | `parseDocument(text)`, `doc.setIn(path, value)`, `doc.toString()`: full-line and inline comments are kept | ✅[^probe] |
| Spacing | `- name: kb  # knowledge` is written back as `- name: kb # knowledge` | ✅[^probe] |
| Node versions | Imports and round-trips on Node.js 24.22.2 and 22.23.4 (tech-stack role) and 24.22.1 (this check); Node.js 18 not tested | ✅[^probe] |
| Package | ISC license; no `dependencies` field in its `package.json` | ✅[^pkg] |

## Lookup notes
- The check imported `browser/dist/index.js` from the package folder, set one value and printed the document.
- A diff after a tool rewrite can show spacing changes on lines nobody meant to change; normalise spacing once, or accept it.

## Takeaways
- Use `yaml`'s document API, not parse-then-stringify of plain objects, when a person's comments must survive a rewrite. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-13

## References
- Local measurement, 2026-11-13 — `yaml` 2.9.1 from the worktree's pnpm store, Node.js v24.22.1 on macOS; also run by the tech-stack role for spec 022 on Node.js 24.22.2 and 22.23.4 (decision DR-102). Backs: Comments, Spacing, Node versions. [^probe]
- `yaml` 2.9.1 `package.json` (npm package `yaml`, by Eemeli Aro) — read 2026-11-13. Backs: license, no dependencies. [^pkg]

## Related
- [js-runtime index](index.md)
