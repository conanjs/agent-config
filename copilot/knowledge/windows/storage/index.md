---
schema: topic-index/v1
kind: subtopic
topic: windows/storage
last-updated: 2026-11-04
---

# Windows storage and I/O

NTFS: the Master File Table, transaction log and self-healing, ACLs, alternate data streams, sharing modes; and the I/O manager's IRPs through driver stacks. Not covered: ReFS, Storage Spaces, VSS.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [ntfs-and-io.md](ntfs-and-io.md) | concept | NTFS keeps everything about every file — size, timestamps, permissions and even small file contents — in entries of the **Master File Table (MFT)**, at least one entry per file (the MFT itself included) | verified |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.

## Related
- `windows/learning-path.md` — where this subtopic sits in the learning order.
- `linux/` — the Linux counterpart of each Windows mechanism.
