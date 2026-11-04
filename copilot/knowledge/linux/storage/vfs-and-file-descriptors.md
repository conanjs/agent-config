---
schema: knowledge-doc/v1
type: concept
topic: linux/storage
status: verified
applies-to: ["Linux ≥ 4.x"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, vfs, inode, dentry, file-descriptor, open-file-description, hard-link, symlink, deleted-file, everything-is-a-file]
---

# VFS, inodes and file descriptors

## Summary
**TL;DR:** Linux separates a file's **name** (a directory entry, "dentry"), the file **itself** (an inode: metadata + pointers to data, but no name) and an **open** file (a kernel "file" object, also called an open file description, which holds the read/write offset). A process holds small integers — **file descriptors** — that point at open file descriptions. The **Virtual File System (VFS)** layer gives every filesystem (ext4, xfs, overlay, proc, sockets, pipes) this same shape, which is why "everything is a file".
**Use this when:** disk space does not come back after `rm`, a hard link or symlink behaves unexpectedly, two processes share an offset, you hit "Too many open files", or you read `/proc/<pid>/fd`.
**Not this doc:** how data reaches the disk durably → `storage/block-io-and-durability.md`; permissions on files → `fundamentals/users-and-permissions.md`.

## Problem
"I deleted the 50 GB log and the disk is still full" and "the child process overwrote the parent's output" are classic surprises. Both disappear once names, inodes, open file descriptions and descriptors are seen as four separate things.

## Mental model
**Analogy:** a library. The **catalog card** (dentry) maps a title to a shelf number; several cards can point to the same book (hard links). The **book** (inode) has a label with owner, size and dates, but no title printed in it. A **borrowing slip** (open file description) records which page a reader is on. Readers hold a **ticket number** (file descriptor) that refers to a slip; photocopying the ticket (`dup`, `fork`) gives two tickets for the same slip and the same page. A book is only pulped when no card points to it **and** no slip is out.

**Artifact:** a process's descriptor table, as symlinks in `/proc` (lab, Linux 6.17.8, 2026-11-04) ✅[^5]:
```console
$ exec 3>/tmp/fdtest; ls -l /proc/$$/fd
lrwx------ 1 root root 64 Nov  4 04:41 0 -> /dev/null        # stdin
l-wx------ 1 root root 64 Nov  4 04:41 1 -> pipe:[12862]     # stdout is a pipe (an inode with no name)
l-wx------ 1 root root 64 Nov  4 04:41 2 -> pipe:[12863]     # stderr
l-wx------ 1 root root 64 Nov  4 04:41 3 -> /tmp/fdtest      # the file we just opened for writing
```

## How it works
**5 actors:**
- **Process** — its job: name files and use descriptors, via `open`, `read`, `write`, `close`.
- **File descriptor table** (per process) — its job: map small integers to open file descriptions, via the lowest free number on each `open` ✅[^2].
- **Open file description** (kernel "file" object) — its job: hold the offset and status flags of one `open` call, via an entry in the system-wide table of open files ✅[^2] ✅[^1].
- **VFS objects (dentry, inode, superblock)** — its job: resolve names to inodes and dispatch to the right filesystem, via the dentry cache and each filesystem's operations ✅[^1].
- **Concrete filesystem (ext4, xfs, overlay, proc, …)** — its job: store or generate the data, via the operations it registers with the VFS ✅[^1].

```
process A fd table          system-wide open files           VFS                         filesystem
 0 ─┐                       ┌──────────────────────┐         dentry "app.log" ──┐
 1 ─┼─────────────────────► │ file: offset=4096    │ ──────► dentry cache       │
 3 ─┘ (dup'd: fd 1 and 3    │ flags=O_WRONLY|O_APPEND│                          ▼
       share this slip)     └──────────────────────┘                 inode 1918249 ── ext4 blocks on disk
process B (forked child)            ▲                                  ▲   (nlink=2: two names)
 1 ─────────────────────────────────┘ same slip, same offset          │
process C (separate open)   ┌──────────────────────┐                  │
 4 ───────────────────────► │ file: offset=0       │ ─────────────────┘ same inode, own offset
                            └──────────────────────┘
```

1. **Path lookup (VFS):** for `open("/var/log/app.log")`, the VFS walks the path through the dentry cache, which "provides a very fast look-up mechanism to translate a pathname into a specific dentry"; missing pieces are loaded by calling each parent directory inode's `lookup()` ✅[^1].
2. **Inode:** "An inode object represents an object within the filesystem" — regular file, directory, FIFO, device ✅[^1]. It holds type, mode, link count, owner, size and timestamps, but **not** a name ✅[^3].
3. **Open file description:** `open()` "creates a new open file description, an entry in the system-wide table of open files"; it "records the file offset and the file status flags" ✅[^2]. The VFS calls this the file object: "a file opened by a process" ✅[^1].
4. **Descriptor:** the returned number is "the lowest-numbered file descriptor not currently open for the process" ✅[^2]. 0, 1 and 2 are stdin, stdout and stderr by convention.
5. **Sharing:** `dup()` and `fork()` copy descriptors that refer to the **same** open file description, so they share offset and flags; a second `open()` of the same file creates a new description with its own offset ✅[^2].
6. **Close-on-exec:** `O_CLOEXEC` marks a descriptor to be closed automatically on `execve` ✅[^2].
7. **Lifetime:** a deleted file's inode and data live on while any open file description refers to it; the VFS file object keeps its dentry and inode in use while open ✅[^1].

**Hard link vs symbolic link** (lab, 2026-11-04) ✅[^5]:
```console
$ echo a > /tmp/a; ln /tmp/a /tmp/b; ln -s /tmp/a /tmp/c
$ stat -c '%n inode=%i links=%h type=%F' /tmp/a /tmp/b /tmp/c
/tmp/a inode=1918249 links=2 type=regular file     # two names …
/tmp/b inode=1918249 links=2 type=regular file     # … one inode
/tmp/c inode=1918250 links=1 type=symbolic link    # its own inode holding the text "/tmp/a"
```

## Worked example
"I deleted the log but the disk is still full" (lab, 2026-11-04) ✅[^5]:
```console
$ exec 4>/tmp/big; head -c 1048576 /dev/zero >&4; rm /tmp/big
$ ls -l /proc/$$/fd/4
l-wx------ 1 root root 64 Nov  4 04:41 /proc/1/fd/4 -> /tmp/big (deleted)
```
1. `rm` removed the only **name** (link count → 0).
2. The shell still holds fd 4 → open file description → inode, so the kernel keeps the inode and its 1 MiB of data.
3. Space returns only when fd 4 is closed (`exec 4>&-`) or the process exits.

Real-world version: a log daemon keeps writing to a rotated-away file. Find it with `ls -l /proc/*/fd 2>/dev/null | grep deleted` (or `lsof +L1`), then restart or signal the writer to reopen its logs (the reopen signal is application-specific; check the daemon's documentation).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `rm` of a file still open | Space not freed until last close | Inode kept while referenced ✅[^1] |
| Hard link across filesystems | `EXDEV` error | An inode number is only unique within one filesystem ✅[^3] |
| Symlink target deleted | Dangling link; `open` fails with `ENOENT` | The symlink only stores a path ✅[^5] (lab: `cat` on a dangling link → "No such file or directory") |
| Parent and forked child both write to inherited stdout | Output interleaves; offsets shared | Same open file description ✅[^2] |
| "Too many open files" (`EMFILE`) | `open`/`socket`/`accept` fail | Per-process descriptor limit (`ulimit -n`, `RLIMIT_NOFILE`) ✅[^5] (lab: with `ulimit -n 16`, `open` failed with errno 24) |
| Renaming a file another process has open | Process keeps writing to the same inode | Names and open files are separate ✅[^1] |
| `ls -l /proc/<pid>/fd` shows `socket:[N]` or `pipe:[N]` | Normal | Sockets and pipes are inodes without names ✅[^5] |

## Takeaways
- Space from a deleted-but-open file comes back only when the last descriptor closes; find holders with `/proc/*/fd` or `lsof +L1`.
- Open with `O_CLOEXEC` so children do not inherit descriptors they should not have. [rule-candidate]
- Use `rename()` of a temp file over the old name for atomic replacement; readers holding the old file keep a consistent copy.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Overview of the Linux Virtual File System](https://docs.kernel.org/filesystems/vfs.html) — Linux kernel documentation, living. Backs: superblock, inode, dentry and file objects; dcache lookup; `lookup()`; open files keep dentry and inode in use. [^1]
- [open(2)](https://man7.org/linux/man-pages/man2/open.2.html) — Linux man-pages project, living. Backs: open file description vs descriptor, offset and flags, sharing via `dup`/`fork`, `O_CLOEXEC`, lowest free number. [^2]
- [inode(7)](https://man7.org/linux/man-pages/man7/inode.7.html) — Linux man-pages project, living. Backs: inode metadata without a filename; inode numbers unique per filesystem. [^3]
- [link(2)](https://man7.org/linux/man-pages/man2/link.2.html) — Linux man-pages project, living. Backs: further reading on hard links and `EXDEV`.
- `linux/lab-setup.md` — the lab where the fd table, hard/symbolic links and deleted-but-open file were captured on 2026-11-04. [^5]

## Related
- `linux/storage/block-io-and-durability.md` — from page cache to disk.
- `linux/processes/process-lifecycle.md` — what descriptors a child inherits.
- `linux/containers/overlayfs-and-image-layers.md` — a filesystem built on top of other filesystems through the VFS.
