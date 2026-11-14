---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["Node.js 24 (docs read at v24.22.x) and libuv v1.x source (1.53.1 on the branch read, 1.52.1 bundled in Node 24.22.1); behaviour on Windows not yet run", "macOS side measured on Node 24.22.1, 2026-11-14"]
last-verified: 2026-11-14
last-updated: 2026-11-14
tags: [windows, os-homedir, userprofile, symlink, junction, rename, chmod, installer]
---

# Windows: home folder, links, rename and read-only files in Node.js

## Summary
**TL;DR:** The Node 24 docs and the libuv source say that on Windows `os.homedir()` reads `USERPROFILE` first ✅[^os][^uv]; `fs.symlink` takes a type (`dir`, `file`, `junction`) that matters only on Windows, and a junction needs an absolute directory target ✅[^fs]; `fs.rename` raises an error when `newPath` is a directory ✅[^fs]; and `fs.chmod` on Windows can only set or clear the write permission, which libuv maps to the read-only attribute ✅[^fs][^uv]. None of this was run on Windows yet; the checks are listed in Lookup notes.
**Use this when:** a tool must work under a private home on a Windows runner, create links there, swap a link in place, or make a file read-only.
**Not this doc:** the same swap measured on macOS → [atomic-symlink-swap.md](atomic-symlink-swap.md).

## Scope
Four behaviours of Node.js 24 (`os`, `fs`) on Windows, read from the Node 24 docs and the libuv source, plus the macOS counterpart measured on Node 24.22.1 (2026-11-14). A junction is a folder-to-folder link that Windows lets any user create, unlike a symbolic link, which may need a privilege or Developer Mode (this privilege rule is a Windows fact not read from a source here; see Lookup notes). Example: the `USERPROFILE` setting in a test run points Node's `os.homedir()` at the throwaway home.

## Catalog

| Item | What the source says | macOS counterpart (measured) | Evidence |
|---|---|---|---|
| `os.homedir()` on Windows | "uses the `USERPROFILE` environment variable if defined. Otherwise it uses the path to the profile directory of the current user." libuv `uv_os_homedir` calls `uv_os_getenv("USERPROFILE")` first and, only when that is not set, `uv_os_get_passwd` (`GetUserProfileDirectoryW`) | `HOME=/tmp/h1 USERPROFILE=/tmp/u1` gives `/tmp/h1`; with `HOME` unset and `USERPROFILE=/tmp/u1` it gives the passwd home `/Users/vinh.doq`, so `USERPROFILE` is ignored on POSIX | ✅[^os][^uv][^probe] |
| `os.homedir()` on POSIX | Uses `$HOME` if defined, else looks up the effective user | Same two runs above | ✅[^os][^probe] |
| `fs.symlink(target, path, type)` | `type` is "only used on Windows" and is `'dir'`, `'file'` or `'junction'`; `null` autodetects and uses `'file'` when `target` does not exist | Ignored on POSIX | ✅[^fs] |
| Junction | "require the destination path to be absolute"; `target` is normalized to absolute; "can only point to directories". libuv creates it with its own junction routine instead of `CreateSymbolicLinkW` | Not applicable | ✅[^fs][^uv] |
| Directory symbolic link | libuv calls `CreateSymbolicLinkW` with `SYMBOLIC_LINK_FLAG_DIRECTORY` for type `dir`, plus the unprivileged-create flag, and retries without it when the system rejects the flag | Plain `ln -s` | ✅[^uv] |
| `fs.rename(old, new)` | "In the case that `newPath` already exists, it will be overwritten. If there is a directory at `newPath`, an error will be raised instead." libuv's Windows rename calls `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` | link over link: replaced, target became `d2`; link over a real directory: `EISDIR`; a directory over a link: `ENOTDIR` | ✅[^fs][^uv][^probe] |
| `fs.chmod` on Windows | "on Windows only the write permission can be changed, and the distinction among the permissions of group, owner, or others is not implemented" | `chmod 444` file: mode reads `444` and a write fails with `EACCES` | ✅[^fs][^probe] |
| libuv chmod on Windows | Reads the file's attributes; if the mode has `_S_IWRITE` it clears `FILE_ATTRIBUTE_READONLY`, otherwise sets it | Not applicable | ✅[^uv] |
| `mode` argument of `fs.mkdir` (also `fsPromises.mkdir`, `fs.mkdirSync`) | "Not supported on Windows" | — | ✅[^fs] |

## Lookup notes
- **Not run on Windows.** Every Windows row above is what the docs and source say. The first run that can confirm them is the `installer (windows)` job of `.github/workflows/installer.yml` (spec 022 T085): its step "Validate, and run the tool and installer scenarios" runs on a Windows runner with `HOME` and `USERPROFILE` both set to a throwaway folder. A short probe script run in that job, printing the results of the five checks below, would turn each row from "docs say" into "measured on Windows".
- **The five checks for the Windows runner:** (1) `USERPROFILE=<tmp>` and `HOME=<other>`: `os.homedir()` should print `<tmp>`; (2) `fs.symlinkSync` of a directory with type `dir` and with type `junction`: whether each succeeds without elevation, and what `fs.readlinkSync` and `fs.lstatSync(...).isSymbolicLink()` report for each; (3) `fs.renameSync(newLink, oldLink)` where both are directory links, once with symbolic links and once with junctions: replaced, or an error code; (4) `fs.renameSync` of a link over a real directory: expected to fail; (5) `fs.chmodSync(file, 0o444)`, then `fs.writeFileSync(file)`: expected to fail, and `fs.statSync(file).mode & 0o777` is expected to read the same for owner, group and others.
- **Rename over a directory link is the open question.** The docs say an error is raised when "there is a directory at `newPath`"; the page does not say whether a directory link counts as a directory on Windows, and `MOVEFILE_REPLACE_EXISTING` was read only as a flag name here, not from Microsoft's documentation of what it may replace. The installer design in [atomic-symlink-swap.md](atomic-symlink-swap.md) keeps remove-then-create as the Windows plan until check (3) passes.
- **Symbolic link privilege on Windows** (needing Developer Mode or elevation unless libuv's unprivileged flag works) is not backed by a source read here; check (2) measures it.
- Windows file modes read as the same value for owner, group and others, so a snapshot that records modes leaves them out on Windows (as `tests/support/tools.ts` does).

## Takeaways
- Set both `HOME` and `USERPROFILE` when a test needs a private home: Node reads `HOME` on macOS and Linux and `USERPROFILE` on Windows. [rule-candidate]
- Create directory links on Windows with an absolute target and the `junction` type when a symbolic link is not allowed; do not rely on renaming over a directory link there until the Windows run confirms it.
- Treat `chmod` on Windows as a read-only switch only; test "cannot be written" with the write failing, not with the mode digits.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-14

## References
- [Node.js 24 docs: `os.homedir()`](https://nodejs.org/docs/latest-v24.x/api/os.html#oshomedir) — Node.js project, living (read 2026-11-14). Backs: `os.homedir()` rows. [^os]
- [Node.js 24 docs: File system](https://nodejs.org/docs/latest-v24.x/api/fs.html) — Node.js project, living (read 2026-11-14 from the v24.x source `doc/api/fs.md`). Backs: `fs.symlink`, junction, `fs.rename`, `fs.chmod` and `mode` rows. [^fs]
- [libuv `src/win/util.c` and `src/win/fs.c`](https://github.com/libuv/libuv/tree/v1.x/src/win) — libuv project, v1.x branch read 2026-11-14 (`uv_os_homedir`; `fs__symlink`, rename with `MoveFileExW`, chmod with `FILE_ATTRIBUTE_READONLY`). Backs: the libuv statements. [^uv]
- Local measurement, 2026-11-14 — Node.js v24.22.1 on macOS 26.1 (Darwin 25.1.0, arm64): `os.homedir()` with `HOME` and `USERPROFILE` set or unset; `fs.renameSync` link over link, link over directory, directory over link; `chmod 444` then write. Backs: the macOS counterpart column. [^probe]

## Related
- [js-runtime index](index.md)
- [atomic-symlink-swap.md](atomic-symlink-swap.md)
- [node-type-stripping.md](node-type-stripping.md)
