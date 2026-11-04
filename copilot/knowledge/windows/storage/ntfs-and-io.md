---
schema: knowledge-doc/v1
type: concept
topic: windows/storage
status: verified
applies-to: ["Windows 10 1709+ / Windows Server 2019+ (NTFS limits)", "NTFS"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, ntfs, mft, alternate-data-streams, journaling, acl, irp, sharing-mode, file-locking]
---

# NTFS and the Windows I/O path

## Summary
**TL;DR:** NTFS keeps everything about every file — size, timestamps, permissions and even small file contents — in entries of the **Master File Table (MFT)**, at least one entry per file (the MFT itself included). It uses a transaction **log** to restore consistency after a crash, remaps bad clusters, self-heals minor corruption online, and carries **ACLs** for per-file security. A file can hold several named **data streams**. I/O reaches NTFS as **IRPs** sent down a stack of drivers, and Windows enforces **sharing modes** per open, which is why "file in use" blocks deletes and renames.
**Use this when:** you debug "file is in use", disk space or MFT growth, port file code from Linux, wonder about `file.txt:stream` names, or compare NTFS with ext4.
**Not this doc:** ACL evaluation → `security/tokens-acls-and-uac.md`; Linux filesystems → `linux/storage/ext4-and-lvm.md`.

## Problem
Linux-trained code assumes you can delete or rename a file another process has open; on Windows that often fails. Disk space puzzles (MFT that never shrinks, hidden data in streams) and "why is NTFS consistent after a crash but my file is not" are also NTFS-specific.

## Mental model
**Analogy:** NTFS is a library whose card catalogue (MFT) is itself a book on the shelves: every item has at least one card, and tiny items are glued directly onto their card. The librarian writes every catalogue change in a logbook first (transaction log), so a power cut never leaves the catalogue half-edited. Each book can have extra hidden pages (alternate streams). Borrowers declare, when they take a book, whether others may read, write or throw it away while they have it (sharing mode).

**Artifact:** an alternate data stream and a sharing violation, as seen from a command prompt (standard syntax; outputs illustrative):
```text
C:\> echo secret > report.txt:notes          :: write a named stream on report.txt
C:\> dir /r report.txt                        :: /r lists streams
               0 report.txt
               9 report.txt:notes:$DATA
C:\> del locked.log
The process cannot access the file because it is being used by another process.
```

## How it works
**4 actors:**
- **Application** — its job: open files with a desired access and a sharing mode, via `CreateFile`.
- **I/O manager** — its job: package requests as IRPs and send them down the device stack ✅[^4].
- **NTFS driver** — its job: map names to MFT entries, enforce ACLs and sharing, log metadata changes ✅[^1] ✅[^2].
- **Volume and disk drivers** — its job: perform the block I/O lower in the stack ✅[^4].

1. **MFT:** at least one entry per file, including the MFT itself; all file information is stored in MFT entries or in space they describe ✅[^2]. Deleted files' entries are reused, but the MFT does not shrink; NTFS reserves an **MFT zone** to keep it contiguous ✅[^2].
2. **Reliability:** a transaction-based log file and checkpoints let NTFS restore consistency at the next start after a failure; bad sectors are remapped; self-healing NTFS repairs minor corruption online ✅[^1]. The documented goal is file-system consistency; it is not a promise about the contents of a file an application was half-way through writing.
3. **Security:** per-file and per-folder ACLs, BitLocker integration, encryption, quotas ✅[^1].
4. **Streams:** a stream is a sequence of bytes; a file can have several, each with its own size, compression, encryption and sparseness; sharing modes and opportunistic locks are kept per stream; deleting a file checks delete access on all open streams ✅[^3].
5. **Limits:** volumes up to 8 PB on Windows Server 2019+ / Windows 10 1709+ (256 TB before), depending on cluster size ✅[^1].
6. **I/O path:** an IRP goes first to the top device object of the stack (e.g. a filter such as antivirus), then down to the file system and volume drivers; some IRPs complete before reaching the bottom ✅[^4].

**NTFS vs ext4:**

| Topic | NTFS | ext4 |
|---|---|---|
| Per-file metadata | MFT entry (small files stored inside it) | Inode (inline data optional) |
| Crash consistency | Transaction log for metadata | jbd2 journal, `data=ordered` |
| Permissions | ACLs (allow/deny entries) | Mode bits (+ POSIX ACLs) |
| Extra data | Alternate data streams | Extended attributes |
| Open file deletion | Blocked unless opened with `FILE_SHARE_DELETE` ✅[^3] ✅[^5] | Allowed; data freed at last close |

## Worked example
Log rotation that works on Linux fails on Windows:

| Step | Linux | Windows |
|---|---|---|
| 1 | App holds `app.log` open | App holds `app.log` open without `FILE_SHARE_DELETE` |
| 2 | Rotator renames `app.log` → `app.log.1` | Rename/delete fails: "being used by another process" — delete access covers rename, so without `FILE_SHARE_DELETE` it fails ✅[^5] |
| 3 | App keeps writing to the renamed file (same inode) | — |
| Fix | — | App opens with `FILE_SHARE_DELETE`, or the app itself rotates (close, rename, reopen) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Delete a file with a stream opened by another process without `FILE_SHARE_DELETE` | Delete access denied | Delete checks all open streams ✅[^3] |
| Antivirus filter driver slow | Every file I/O slows | Filter drivers in the stack see each IRP on its way down ✅[^4] |
| Millions of small files, then deleted | MFT stays large | MFT never shrinks ✅[^2] |
| Data hidden in a stream | `dir` hides it; `dir /r` shows it | Streams are separate ✅[^6] |
| Volume with oversized cluster on older Windows | `STATUS_UNRECOGNIZED_VOLUME` | Cluster size limit per version ✅[^1] |

## Takeaways
- Open files with the most permissive sharing mode your code can tolerate (`FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE` for logs). [rule-candidate]
- Do not assume Unix delete-while-open semantics in cross-platform code.
- Count file-system filter drivers (antivirus, backup, encryption) when diagnosing slow I/O.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [NTFS overview](https://learn.microsoft.com/en-us/windows-server/storage/file-server/ntfs-overview) — Microsoft Learn, living. Backs: transaction log recovery, bad-cluster remapping, self-healing NTFS, ACLs, BitLocker, volume size limits, `STATUS_UNRECOGNIZED_VOLUME`. [^1]
- [Master File Table](https://learn.microsoft.com/en-us/windows/win32/fileio/master-file-table) — Microsoft Learn, living. Backs: entries per file, MFT includes itself, never shrinks, MFT zone. [^2]
- [File Streams](https://learn.microsoft.com/en-us/windows/win32/fileio/file-streams) — Microsoft Learn, living. Backs: streams, per-stream properties, per-stream sharing and oplocks, delete check across streams. [^3]
- [I/O Request Packets](https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/i-o-request-packets) — Microsoft Learn, living. Backs: IRPs and device stacks. [^4]
- No Windows lab was available when this doc was written (macOS host); command outputs are illustrative.
- [CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew) — Microsoft Learn, living. Backs: sharing modes; without `FILE_SHARE_DELETE` later delete-access opens fail; delete access covers delete and rename. [^5]
- [dir](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/dir) — Microsoft Learn, living. Backs: `/r` displays alternate data streams. [^6]

## Related
- `linux/storage/vfs-and-file-descriptors.md` — delete-while-open on Linux.
- `windows/security/tokens-acls-and-uac.md` — how NTFS ACLs are evaluated.
