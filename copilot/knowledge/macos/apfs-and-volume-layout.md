---
schema: knowledge-doc/v1
type: concept
topic: macos
status: verified
applies-to: ["macOS 11 or later on APFS (examples captured on macOS 26.1, Apple silicon)"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, apfs, signed-system-volume, firmlinks, synthetic-conf, case-insensitive, clonefile, snapshots, time-machine, xattr]
---

# APFS and the macOS volume layout

## Summary
**TL;DR:** A Mac's disk holds one **APFS container** (APFS = Apple File System) that several **volumes** share space in. `/` is a read-only, cryptographically sealed **snapshot** of the System volume; everything you can write lives on the separate **Data** volume at `/System/Volumes/Data`, and **firmlinks** make folders such as `/Users`, `/Applications` and `/usr/local` look as if they were on `/`. New folders at `/` (for example `/nix`) need `/etc/synthetic.conf`. The default volume format ignores case but keeps it, which trips up Git; `cp -c` makes instant copy-on-write clones.
**Use this when:** you wonder why `/` is read-only or why `df` lists many volumes with the same size, need a root-level mount point, fight a Git rename that only changes letter case, or want to see snapshots and clones.
**Not this doc:** why system folders refuse writes even from root (SIP) → `sip-and-app-sandbox.md`; Linux filesystems and volumes → `linux/storage/ext4-and-lvm.md`.

## Problem
`sudo mkdir /nix` fails with "Read-only file system" on a brand-new Mac. `df -h` shows ten lines that all report the same 460 GiB size. A teammate on Linux renames `readme.md` to `README.md`, and on the Mac Git reports no change. `cp -c` copies a 200 MiB file in 6 ms and uses no extra space. Each surprise has the same root: the macOS volume layout on APFS.

## Mental model
**Analogy:** the container is a warehouse with one shared pool of floor space; each volume is a tenant who takes floor space only as needed. The System tenant's shelves are shrink-wrapped and stamped by the manufacturer (sealed); the Data tenant's shelves are open. Firmlinks are corridors painted to look like part of the System floor but leading into the Data tenant's rooms. `synthetic.conf` is a request to paint a new door on the shrink-wrap at the next opening (boot).

**Artifact:** the container on this Mac (shortened from `diskutil apfs list`, macOS 26.1) ✅[^10]:
```
Physical disk0s2 (494.4 GB)
└── APFS Container disk3   — 50.1% used, free space shared by all volumes
    ├── disk3s1  System   "Macintosh HD"         Sealed: Yes   (not mounted itself)
    │   └── disk3s1s1  snapshot, Sealed: Yes  → mounted at /
    ├── disk3s5  Data     "Macintosh HD - Data"  → /System/Volumes/Data
    ├── disk3s2  Preboot  → /System/Volumes/Preboot
    ├── disk3s3  Recovery (not mounted)
    └── disk3s6  VM (swap) → /System/Volumes/VM
```
Every volume name ends in `(Case-insensitive)` in the same output ✅[^10].

## How it works
**5 actors:**
- **APFS container** — its job: own a partition and hand out space to its volumes on demand ✅[^1] ✅[^2].
- **System volume (Signed System Volume, SSV)** — its job: hold macOS itself, read-only and sealed by a hash tree whose root hash (the seal) covers every byte ✅[^3].
- **Data volume** — its job: hold users, apps you install and everything writable ✅[^4].
- **Firmlinks** — their job: one-to-one links from a directory on the System volume to a directory on the Data volume, created by the installer ✅[^5].
- **`apfs.util` at boot** — its job: read `/etc/synthetic.conf` and create the virtual root entries it lists ✅[^6].

**Layout, step by step:**
1. All volumes in a container share free space; that is why `df -h` shows the same `Avail` (230Gi here) for `/`, `/System/Volumes/Data`, `/System/Volumes/VM` and others ✅[^1] ✅[^10].
2. The read-only system volume came in macOS 10.15; cryptographic signing (the SSV) in macOS 11 ✅[^3]. `mount` shows `/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)` — a snapshot (`s1s1`) of the System volume ✅[^10].
3. Data is hashed as it is read; if the seal does not match at startup, the Mac stops booting and asks to reinstall macOS ✅[^3].
4. Your files are on "Macintosh HD - Data"; Finder shows both volumes as one "Macintosh HD" ✅[^4]. The Data volume is mounted at `/System/Volumes/Data` ✅[^6] ✅[^10].
5. Firmlinks join the two. The list on this Mac is in `/usr/share/firmlinks` and includes `/Applications`, `/Library`, `/Users`, `/Volumes`, `/opt`, `/private` and `/usr/local` ✅[^10]. `/Users` and `/System/Volumes/Data/Users` show the same inode number (18333), so they are the same directory ✅[^10].
6. New entries at `/` cannot be created physically; `synthetic.conf` lists virtual empty directories (one column) or symlinks (two columns, tab-separated), created by the kernel early in boot ✅[^6]. Entries can only be removed by editing the file and rebooting ✅[^6]. This Mac has no `/etc/synthetic.conf` ✅[^10].

**Case-insensitive but case-preserving:** the default APFS format keeps the letters you typed but treats `Readme` and `README` as one name; "APFS (Case-sensitive)" is a separate format you choose when creating a volume ✅[^2] ✅[^10]. Git probes this when it creates a repository and sets `core.ignoreCase = true` ✅[^8] ✅[^10].

**Clones and snapshots:**
- A **clone** is a copy that shares the original's data blocks until one side changes them (copy-on-write) ✅[^1]. `cp -c` asks for one through `clonefile(2)`, and falls back to a normal copy if the file system cannot clone ✅[^7].
- A **snapshot** is a frozen image of a volume at one moment; `/` itself is one (`disk3s1s1`, mounted read-only) ✅[^10], and the SSV uses APFS snapshots so an old system version can be restored if an update fails ✅[^3]. **Time Machine local snapshots** are taken about every hour and kept 24 hours, plus one before each macOS update ✅[^9]. `tmutil listlocalsnapshots /` lists them ✅[^8].

**Extended attributes and resource forks:** an extended attribute (xattr) is named metadata stored next to a file but apart from its contents ✅[^8]. The old Mac "resource fork" shows up as the xattr `com.apple.ResourceFork`: writing 8 bytes to `f/..namedfork/rsrc` left the file size at 5 bytes and added that attribute ✅[^10]. `ls -l` marks files with xattrs by `@` ✅[^10].

**Linux comparison:**

| macOS (APFS) | Closest Linux idea | Where it is explained |
|---|---|---|
| Container with volumes sharing free space | LVM volume group with logical volumes | `linux/storage/ext4-and-lvm.md` |
| Sealed read-only `/` plus a writable Data volume | Read-only root images with a separate writable partition | — |
| Firmlinks into `/System/Volumes/Data` | Bind mounts | `linux/fundamentals/filesystem-hierarchy.md` |

## Worked example
A clone, a full copy and a case-only rename, run on 2026-11-05 in `/tmp` on macOS 26.1 ✅[^10]:
```console
$ dd if=/dev/zero of=big bs=1m count=200          # 200 MiB file
$ df -k /tmp | awk 'NR==2{print $3}'               # used KiB
207013836
$ cp -c big big-clone; df -k /tmp | awk 'NR==2{print $3}'
207013836                                         # clone: no new blocks
$ time cp big big-copy                             # 0.066 s
$ time cp -c big big-clone2                        # 0.006 s
$ df -k /tmp | awk 'NR==2{print $3}'
207218656                                         # +204 820 KiB: only the real copy used space

$ git init -q repo && cd repo && git config core.ignorecase
true
$ echo hi > readme.md && git add . && git commit -qm init
$ mv readme.md README.md && git status --short     # (empty: Git sees no change)
$ git mv readme.md README.md && git status --short
R  readme.md -> README.md
```
Reading: the clone and the original share blocks, so only `big-copy` cost disk space. A plain `mv` changes only the letter case, which a case-insensitive volume treats as the same name; `git mv` records the rename so it reaches case-sensitive Linux checkouts.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `sudo mkdir /nix` | "Read-only file system" | `/` is the sealed snapshot ✅[^6] ✅[^10] |
| Need `/nix` anyway | Add `nix` to `/etc/synthetic.conf`, reboot, mount a volume there | Virtual empty directory made at boot ✅[^6] |
| Writing inside a synthetic empty directory | Not allowed (mount something over it) | ✅[^6] |
| Summing `Avail` across volumes | Counts the same free space many times | Free space is shared ✅[^1] |
| Two files `Makefile` and `makefile` in a repo | Only one can exist in the checkout | Case-insensitive name lookup ✅[^2] ✅[^8] |
| `cp -c` to another volume or a non-APFS disk | Normal full copy | Fallback to `copyfile(2)` ✅[^7] |
| Editing a clone | Changed blocks are written elsewhere; the rest stays shared | Copy-on-write ✅[^1] |
| Deleting files does not free space at once | Local snapshots may still hold the blocks until thinned | Snapshots kept 24 h or until space is needed ✅[^9] |
| `tmutil listlocalsnapshots /` prints only the header | No local snapshots right now (this Mac, 2026-11-05) | ✅[^10] |
| Copying with a tool that ignores xattrs | Attributes such as `com.apple.ResourceFork` can be lost while contents look intact | xattrs live apart from the file's data ✅[^8] ✅[^10] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Default case-insensitive volume | Works with every Mac app | Case-only renames and case-clashing repos need care |
| Separate "APFS (Case-sensitive)" volume for code | Names differing only in case stay separate ✅[^2] | One more volume to create, mount and back up |
| `cp -c` / Finder duplicate | Instant, no extra space ✅[^1] | Not an independent copy: both files share the unchanged blocks ✅[^1] |

## Takeaways
- Rename for case with `git mv`, never with plain `mv`, on macOS. [rule-candidate]
- Create root-level mount points with `/etc/synthetic.conf`, never by trying to write to `/`.
- Read free space from one volume, not the sum of `df` lines.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 51 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [About Apple File System](https://developer.apple.com/documentation/foundation/about-apple-file-system) — Apple Developer Documentation, living. Backs: clones, copy-on-write, space sharing, shared free-space reporting. [^1]
- [File system formats available in Disk Utility on Mac](https://support.apple.com/guide/disk-utility/file-system-formats-dsku19ed921c/mac) — Apple Support, living. Backs: APFS default, case-sensitive variant, on-demand allocation in a container. [^2]
- [Signed system volume security](https://support.apple.com/guide/security/signed-system-volume-security-secd698747c9/web) — Apple Platform Security, living. Backs: seal, hash tree, snapshots, boot check, macOS 10.15/11. [^3]
- [About the read-only system volume in macOS Catalina or later](https://support.apple.com/en-us/101400) — Apple Support (archived), 2019. Backs: separate Data volume, both shown as Macintosh HD. [^4]
- [What's New in Apple File Systems (WWDC 2019, session 710)](https://developer.apple.com/videos/play/wwdc2019/710/) — Apple, 2019. Backs: firmlinks definition, one-to-one, created at install. [^5]
- `man synthetic.conf | col -b`, `man apfs.util | col -b` — man pages on macOS 26.1. Backs: read-only root, Data volume at `/System/Volumes/Data`, synthetic entries, reboot to remove. [^6]
- `man cp | col -b`, `man clonefile | col -b` — man pages on macOS 26.1. Backs: `cp -c`, fallback to `copyfile(2)`. [^7]
- `man tmutil | col -b`, `man xattr | col -b`, `man git-config | col -b` (core.ignoreCase) — man pages on macOS 26.1. Backs: `listlocalsnapshots`, extended attributes, Git's case probe. [^8]
- [About Time Machine local snapshots](https://support.apple.com/102154) — Apple Support, living. Backs: hourly, 24 h, before updates, kept until space is needed. [^9]
- Local test, 2026-11-05, macOS 26.1 (build 25B78), Apple silicon, read-only commands plus scratch files in `/tmp`: `diskutil apfs list`, `mount`, `df -h`, `ls -lO /`, `ls -lid /Users /System/Volumes/Data/Users`, `cat /usr/share/firmlinks`, `cat /etc/synthetic.conf` (absent), `tmutil listlocalsnapshots /`, `cp -c` vs `cp` of a 200 MiB file with `df -k`, a Git case-rename in a scratch repository (Git 2.50.1), `xattr` and `..namedfork/rsrc` on a scratch file. [^10]

## Related
- `macos/sip-and-app-sandbox.md` — why protected folders refuse writes even from root.
- `macos/homebrew.md` — Homebrew's prefix under `/opt/homebrew` (a firmlinked folder).
- `macos/gatekeeper-and-code-signing.md` — the quarantine extended attribute on downloads.
- `linux/storage/ext4-and-lvm.md` — Linux filesystems and LVM volumes.
- `linux/fundamentals/filesystem-hierarchy.md` — the Linux directory layout.
