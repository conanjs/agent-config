---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["Node.js 24.22.1 on macOS (Darwin 25.1.0), tested 2026-11-13"]
last-verified: 2026-11-13
last-updated: 2026-11-14
tags: [fs, rename, symlink, atomic, installer]
---

# Swapping a directory symlink in one step with `fs.renameSync`

## Summary
**TL;DR:** On macOS, `fs.renameSync(newLink, oldLink)` replaces an existing symbolic link to a folder with another symbolic link in one step: afterwards `oldLink` points at the new target and `newLink` is gone ✅[^probe] It renames the link itself and never touches the folders the links point at ✅[^probe][^node]
**Use this when:** an installer must switch a link from one version folder to another so that no reader ever finds the link missing.
**Not this doc:** Windows behaviour (not tested here); Node.js worker and runtime limits → [js-runtime index](index.md).

## Scope
Node.js `fs.renameSync` used on symbolic links, measured on one Mac. An atomic swap is like changing a signpost by bolting the new sign over the old one in one move, instead of removing the old sign first: a traveller always sees a sign. Example: `current → v1` becomes `current → v2` with no moment where `current` does not exist.

## Catalog

| Item | Fact | Evidence |
|---|---|---|
| Swap | Create `tmp → v2` beside `current → v1`, then `fs.renameSync("tmp", "current")`: `readlink current` gives `v2`, `current` is still a symbolic link, `tmp` no longer exists | ✅[^probe] |
| What `rename` acts on | The link entry, not the folder it points at | ✅[^probe][^node] |

## Lookup notes
- **Windows is not covered:** not tested here. Plan for remove-then-create there until a Windows run shows otherwise. What the Node docs and libuv source say about links, junctions and `rename` on Windows, and the five checks the Windows runner (spec 022 T085, job `installer (windows)`) must still make, are in [windows-home-links-and-modes.md](windows-home-links-and-modes.md).
- Reproduce: `mkdir a b && ln -s a l && ln -s b t && node -e 'const fs=require("fs");fs.renameSync("t","l");console.log(fs.readlinkSync("l"))'` prints `b`.

## Takeaways
- Switch a version link by renaming a temporary link over it, never by deleting and re-creating it (measured on macOS only). [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 4 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-13

## References
- Local measurement, 2026-11-13 — Node.js v24.22.1 on macOS (Darwin 25.1.0); command in Lookup notes. Also run by the devops role for spec 022 (decision DR-202). Backs: Swap, What `rename` acts on. [^probe]
- [Node.js `fs.rename`](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsrenameoldpath-newpath-callback) — Node.js project, living. Backs: rename acts on the path given, replacing an existing `newPath`. [^node]

## Related
- [js-runtime index](index.md)
- [windows-home-links-and-modes.md](windows-home-links-and-modes.md)
