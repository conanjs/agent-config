---
schema: knowledge-doc/v1
type: concept
topic: linux/fundamentals
status: verified
applies-to: ["Linux ≥ 4.x"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, uid, gid, permissions, setuid, sticky-bit, capabilities, root]
---

# Users, groups and file permissions

## Summary
**TL;DR:** The kernel never sees user names, only numbers: every process carries user and group IDs (UID/GID), every file carries an owner UID, a group GID and 9 permission bits plus 3 special bits. On each access the kernel picks **one** set of three bits (owner, else group, else other) and checks it. "root" is not magic either: its power is split into **capabilities**, and a process has them when its UID is 0.
**Use this when:** you get `EACCES` / "Permission denied", you are reading `ls -l` output or `chmod 4755`, you need to understand setuid programs like `passwd`, or you wonder what "running as root in a container" really grants.
**Not this doc:** capability sets and container hardening → `containers/container-isolation.md`.

## Problem
Permissions look simple (`rwxr-xr-x`) but fail in surprising ways: a file with `rw-rw-rw-` you cannot open (a parent directory is missing `x`), an owner who has *fewer* rights than "other", or a root process that still gets `EPERM`.

## Mental model
**Analogy:** a building where every room door has three locks in a row, labelled "owner", "team" and "everyone". The guard looks at your badge, picks **exactly one** lock (owner if your badge number matches the room's owner, otherwise team if you belong to the room's team, otherwise everyone) and only tries that one. Getting to a room also means passing through every corridor door (directory) on the way, and each corridor needs its "pass through" right (`x`).

**Artifact:** one line of `ls -l`, parsed piece by piece:
```
-rwsr-xr-x 1 root root 59976 Feb  6  2024 /usr/bin/passwd
│└┬┘└┬┘└┬┘   └┬─┘ └┬─┘
│ │  │  │     │    └─ group GID 0 (name from /etc/group)
│ │  │  │     └────── owner UID 0 (name from /etc/passwd)
│ │  │  └─ other: r-x
│ │  └──── group: r-x
│ └─────── owner: rws  → "s" = execute + set-user-ID bit
└───────── file type: "-" regular file ("d" directory, "l" symlink, "c"/"b" device)
```
In octal this is `4755`: `4` = set-user-ID, `7` = rwx, `5` = r-x, `5` = r-x.

## How it works
**3 actors:**
- **Process** — its job: present credentials, via the UIDs, GIDs and supplementary groups the kernel stores for it ✅[^2].
- **Inode** — its job: hold the owner, group, mode bits and file type, via the metadata returned by `stat` ✅[^3].
- **Kernel permission check** — its job: compare the two on every path lookup and open, via the rules in path resolution ✅[^1].

**Credentials a process carries** ✅[^2]:

| ID | Used for |
|---|---|
| Real UID/GID | Who owns the process (who started it) |
| Effective UID/GID | Permission checks on most shared resources |
| Saved set-user-ID/GID | A copy of the effective ID when a setuid program started, so it can drop and regain privilege |
| Filesystem UID/GID (Linux-only) | File permission checks; normally equal to the effective IDs |
| Supplementary groups | Extra groups also checked against a file's group (up to 65 536 since Linux 2.6.4) |

**The check, step by step** ✅[^1]:
1. **Path walk:** for every directory in the path except the last component, the process needs **search** permission (`x`); otherwise the lookup fails with `EACCES`.
2. **Pick one set of bits:** if the process's filesystem UID equals the file's owner → owner bits; else if the file's group equals the process's GID or any supplementary group → group bits; else → other bits.
3. **Test the requested access** (`r`, `w`, `x`) against that one set only. There is no fallback to a more generous set.
4. **Capabilities may override:** `CAP_DAC_OVERRIDE` bypasses the checks, but grants execute only if at least one `x` bit is set anywhere on the file ✅[^1].

**What `r`, `w`, `x` mean on a directory** (a directory is a list of name → inode entries):

| Bit | On a file | On a directory |
|---|---|---|
| `r` | Read content | List the names in it |
| `w` | Change content | Create, delete or rename entries (also needs `x`) |
| `x` | Execute | Pass through it to reach anything inside |

**The three special bits** ✅[^3]:

| Bit (octal) | On an executable | On a directory |
|---|---|---|
| set-user-ID (`4000`) | The process runs with the file owner's effective UID | — |
| set-group-ID (`2000`) | The process runs with the file's group as effective GID | New files inherit the directory's group; new subdirectories get the bit too |
| sticky (`1000`) | — | Only the file's owner, the directory's owner or a privileged process may delete or rename files (this is why everyone can use `/tmp` safely) |

**How setuid works at exec time:** when `execve` runs a set-user-ID file, the effective UID becomes the file's owner and the saved set-user-ID copies it, while the real UID stays the caller's. The bits are ignored if `no_new_privs` is set, the filesystem is mounted `nosuid`, or the process is being traced; Linux also ignores them on scripts ✅[^4].

**Root and capabilities:** when a process with UID 0 runs `execve`, it gets every capability in its permitted and effective sets, minus those removed from its bounding set ✅[^5]. Remove a capability and even root fails. Measured in the lab: root with `CAP_CHOWN` dropped from its bounding set cannot `chown` (2026-11-04, Linux 6.17.8) ✅[^6]:
```console
# setpriv --bounding-set=-chown chown nobody /tmp/x
chown: changing ownership of '/tmp/x': Operation not permitted
```

## Worked example
User `alice` (UID 1000, groups `alice`=1000 and `dev`=1001) wants to read `/srv/app/config.yml`.

| Path part | Owner:group | Mode | Bits picked for alice | Needed | Result |
|---|---|---|---|---|---|
| `/srv` | root:root | `drwxr-xr-x` | other `r-x` | `x` | pass |
| `/srv/app` | root:dev | `drwxr-x---` | group `r-x` (alice is in `dev`) | `x` | pass |
| `config.yml` | alice:dev | `----r-----` (`0040`) | **owner `---`** (alice owns it) | `r` | **EACCES** |

Alice owns the file, so only the owner bits are checked, and they are empty. Group `dev` would have allowed reading, but the kernel never looks at the group bits once the owner matched ✅[^1]. Fix: `chmod 0440 config.yml` (or `u+r`).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| File is `rw-rw-rw-` but a parent directory lacks `x` for you | `EACCES` | Search permission needed on every directory ✅[^1] |
| Owner bits stricter than other bits | The owner gets less access than strangers | Only one set is checked ✅[^1] |
| Root runs a file with no `x` bits at all | Fails | `CAP_DAC_OVERRIDE` needs at least one `x` bit for execute ✅[^1] |
| setuid shell script | Runs with the caller's UID | Linux ignores setuid on scripts ✅[^4] |
| setuid binary on a `nosuid` mount | Runs with the caller's UID | The bit is ignored ✅[^4] |
| New file permissions | Requested mode minus the process `umask` (e.g. `0666 & ~022` = `0644`) | Lab: with `umask 022`, `touch` created a file with mode `644` ✅[^6] |
| Root inside a container | UID 0, but only a reduced capability set (14 in Docker's default) | The runtime drops capabilities; see `containers/container-isolation.md` ✅[^6] |

## Takeaways
- Debug `EACCES` by walking the path: check `x` on every directory, then find which **one** of owner/group/other applies to you (`namei -l <path>` prints every component's mode).
- Treat "root" as "has capabilities"; drop the capabilities a process does not need instead of relying on not being root.
- Avoid setuid binaries you write yourself; prefer a narrow capability (`setcap cap_net_bind_service+ep`) or a service manager.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [path_resolution(7)](https://man7.org/linux/man-pages/man7/path_resolution.7.html) — Linux man-pages project, living. Backs: search permission on directories, owner → group → other selection, `CAP_DAC_OVERRIDE` rules. [^1]
- [credentials(7)](https://man7.org/linux/man-pages/man7/credentials.7.html) — Linux man-pages project, living. Backs: real, effective, saved and filesystem IDs; supplementary groups limit. [^2]
- [inode(7)](https://man7.org/linux/man-pages/man7/inode.7.html) — Linux man-pages project, living. Backs: inode metadata, set-user-ID, set-group-ID and sticky bit meanings. [^3]
- [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) — Linux man-pages project, living. Backs: setuid at exec time, when the bits are ignored, scripts. [^4]
- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) — Linux man-pages project, living. Backs: UID 0 gains all capabilities at exec minus the bounding set. [^5]
- `linux/lab-setup.md` — the lab where the `setpriv` test and Docker's default capability mask were measured on 2026-11-04. [^6]

## Related
- `linux/containers/container-isolation.md` — capability sets, seccomp and what container root can do.
- `linux/storage/vfs-and-file-descriptors.md` — inodes, hard links and path lookup.
