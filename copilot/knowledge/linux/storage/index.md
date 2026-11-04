---
schema: topic-index/v1
kind: subtopic
topic: linux/storage
last-updated: 2026-11-04
---

# Files and storage

The VFS object model (dentries, inodes, open file descriptions, descriptors), the block I/O path with what `fsync` really guarantees, and on-disk layout with ext4, LVM and device-mapper. Not covered: xfs and btrfs internals, RAID tuning.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [vfs-and-file-descriptors.md](vfs-and-file-descriptors.md) | concept | Linux separates a file's **name** (a directory entry, "dentry"), the file **itself** (an inode: metadata + pointers to data, but no name) and an **open** file (a kernel "file" object, also called an open file description, which holds the read/write offset) | verified |
| [block-io-and-durability.md](block-io-and-durability.md) | concept | A `write()` normally stops in the page cache; it is **not** on disk when the call returns | verified |
| [ext4-and-lvm.md](ext4-and-lvm.md) | concept | Below the VFS sits a real filesystem that lays files out on a block device | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
