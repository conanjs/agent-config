---
schema: knowledge-doc/v1
type: concept
topic: linux/storage
status: verified
applies-to: ["Linux ≥ 5.x", "ext4", "LVM2 with device-mapper"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, ext4, journaling, extents, block-groups, lvm, device-mapper, loop-device, inodes]
---

# On-disk filesystems and volumes: ext4, LVM and device-mapper

## Summary
**TL;DR:** Below the VFS sits a real filesystem that lays files out on a block device. **ext4** splits the device into block groups, keeps a fixed number of inodes (decided at `mkfs`), maps file data with **extents** (start block + length), and protects metadata with a **journal**: in the default `data=ordered` mode, file data is written before the metadata that points to it is committed, at most every 5 seconds. Under the filesystem, **LVM** turns disks into a pool (volume group) and carves resizable **logical volumes**, each implemented by the kernel's **device-mapper** as a table of mappings ("these sectors live at that offset on that disk").
**Use this when:** you create or resize filesystems and volumes, see "No space left on device" with free space (inodes exhausted), choose journaling modes, read `lsblk`/`dmsetup` output, or want to know what a loop device is.
**Not this doc:** VFS objects and descriptors → `storage/vfs-and-file-descriptors.md`; `fsync` and the block layer → `storage/block-io-and-durability.md`.

## Problem
Teams format a volume with defaults and later run out of **inodes** on a disk full of small files; or grow a cloud disk and do not know the three layers (partition/PV, LV, filesystem) that each need resizing; or switch to `data=writeback` for speed without knowing it can expose garbage in recently written files after a crash.

## Mental model
**Analogy:** a warehouse. LVM is the landlord who joins several buildings (disks) into one estate (volume group) and rents out floors of any size (logical volumes) that can be extended later. ext4 is the tenant's shelving system on one floor: aisles (block groups), a card index of a fixed size (inode table), and for each item a note "shelves 9217–9240" (an extent). The journal is the foreman's logbook, written first, so that a power cut never leaves the card index half-updated.

**Artifact:** a fresh 200 MB ext4 on a loop device, and a file's extent (lab, Linux 6.17.8, 2026-11-04) ✅[^5]:
```text
$ tune2fs -l /dev/loop0
Filesystem features:  has_journal ext_attr resize_inode dir_index orphan_file filetype extent 64bit flex_bg ... metadata_csum
Inode count:          51200          # fixed at mkfs time
Block size:           1024
Inode size:           256
Journal inode:        8
$ debugfs -R "stat /f" /dev/loop0
Inode: 13   Type: regular    Mode:  0644   Flags: 0x80000      # 0x80000 = uses extents
EXTENTS:
(0):9217                                                       # logical block 0 → physical block 9217
```

## How it works
**4 actors:**
- **Block device** — its job: provide numbered sectors, via a disk, partition, loop device (a file pretending to be a disk) or a device-mapper device.
- **device-mapper** — its job: build virtual block devices from mapping tables, via targets such as `linear`, `striped`, `crypt`, `thin`, `snapshot`, `raid` ✅[^3].
- **LVM2 tools** — its job: manage physical volumes, volume groups and logical volumes and load the device-mapper tables, via `pvcreate`/`vgcreate`/`lvcreate`/`lvextend` ✅[^4].
- **ext4** — its job: store files and metadata on the block device, via block groups, inodes, extents and the jbd2 journal ✅[^1] ✅[^2].

```
 files ── VFS ── ext4: block groups │ inode table │ extents │ journal
                         │
                  /dev/vg0/data  (logical volume)
                         │ device-mapper table: "0 204800 linear 7:0 2048"
                  volume group vg0 = PV /dev/loop0 (+ more PVs)
                         │
                  /dev/loop0 → backing file /tmp/pv.img (or a real disk /dev/nvme0n1p3)
```

**ext4:**
1. **Block groups:** the filesystem is split into groups and the allocator tries to keep a file's blocks in one group; a group holds 8 × (block size in bytes) blocks — 32 768 blocks = 128 MiB with 4 KiB blocks ✅[^1].
2. **Inodes:** a fixed inode table per group; the count is set at `mkfs` (51 200 for 200 MB in the lab) ✅[^5]. When they run out, file creation fails even with free blocks ✅[^5] (lab: `mkfs.ext4 -N 64` → file 61 failed with "No space left on device" while `df -h` showed 1% used).
3. **Extents:** data is mapped as runs of contiguous blocks, which "reduces metadata overhead" compared with per-block maps ✅[^2].
4. **Delayed allocation:** on by default; blocks are chosen only when data is written out, giving better placement ✅[^2].
5. **Journal modes** ✅[^2]:

| `data=` | What is journaled | Crash behaviour | Speed |
|---|---|---|---|
| `ordered` (default) | Metadata; data written before its metadata commits | No stale data exposed | Slightly slower than writeback |
| `writeback` | Metadata only, no ordering | Recently written files may show incorrect data | Fastest |
| `journal` | Data and metadata | Safest | Slowest; deprecated, removal planned for 2028 |

6. **Commit interval:** `commit=5` by default, so up to ~5 s of metadata changes can be lost on power loss, but the filesystem stays consistent ✅[^2]. **Barriers** are on by default so journal commits are ordered on disk ✅[^2].

**LVM / device-mapper:**
1. LV data is placed on PVs "according to algorithms implemented by Device Mapper (DM) in the kernel" ✅[^4].
2. Space is allocated in **physical extents**; in the lab a 100 MiB LV used 25 extents and a `+50M` extension was rounded up to 52 MiB, i.e. 4 MiB extents ✅[^5].
3. LVs appear as `/dev/<VG>/<LV>` symlinks; `/dev/mapper` nodes are for internal use ✅[^4].
4. Each LV is a device-mapper table line: `start length target args` (lab: `vg0-data: 0 204800 linear 7:0 2048` = 204 800 sectors mapped linearly to device 7:0 starting at sector 2048) ✅[^5] ✅[^3].

## Worked example
Grow an ext4 data volume by 50 MiB on LVM (lab run, 2026-11-04) ✅[^5]:
```console
# lvs --noheadings -o lv_name,vg_name,lv_size,lv_path
  data vg0 100.00m /dev/vg0/data
# lvextend -L +50M vg0/data
  Rounding size to boundary between physical extents: 52.00 MiB.
  Size of logical volume vg0/data changed from 100.00 MiB (25 extents) to 152.00 MiB (38 extents).
```
The three layers to resize on a real server, bottom-up:

| Layer | Command | Online? |
|---|---|---|
| Disk / partition (if the cloud disk grew) | `growpart /dev/nvme0n1 3` then `pvresize /dev/nvme0n1p3` | Depends on the platform |
| Logical volume | `lvextend -L +50G vg0/data` (add `-r` to also grow the filesystem) | Yes |
| Filesystem | `resize2fs /dev/vg0/data` (ext4) or `xfs_growfs /mount` (xfs) | Growing: yes ✅[^6] (lab: ext4 grew from 89 M to 126 M while mounted; xfs grew from 102 400 to 179 200 blocks) ✅[^5] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Millions of tiny files | "No space left on device" while `df -h` shows space; `df -i` shows 100% | Inode table full ✅[^5] |
| `data=writeback` and a crash | Recent files may contain old disk data | No data ordering ✅[^2] |
| Power cut | Last ~5 s of metadata lost, filesystem consistent | Commit interval ✅[^2] |
| Shrinking ext4 | ext4: only unmounted ("On-line shrinking not supported"); xfs: `xfs_growfs -D` smaller failed with EINVAL (only an experimental shrink of unused space exists) | ✅[^6] ✅[^5] |
| Encrypted disk | A `crypt` target between LV and disk (LUKS) | device-mapper target ✅[^3] |

## Takeaways
- Pick `mkfs` inode density for the workload (`-i`/`-N`) when storing many small files; monitor `df -i`.
- Keep `data=ordered`; get speed from hardware and batching, not from weaker journaling.
- Resize bottom-up: partition → PV → LV → filesystem (`lvextend -r` does the last two).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 27 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [ext4 Data Structures and Algorithms: Overview](https://docs.kernel.org/filesystems/ext4/overview.html) — Linux kernel documentation, living. Backs: block groups, group size formula, allocator locality. [^1]
- [ext4 General Information](https://docs.kernel.org/admin-guide/ext4.html) — Linux kernel documentation, living. Backs: `data=` modes, journal deprecation, delalloc, `commit=5`, barriers, extents. [^2]
- [Device Mapper](https://docs.kernel.org/admin-guide/device-mapper/index.html) — Linux kernel documentation, living. Backs: target list (linear, striped, crypt, thin, snapshot, raid, verity). [^3]
- [lvm(8)](https://man7.org/linux/man-pages/man8/lvm.8.html) — LVM2 project via Linux man-pages, living. Backs: PV/VG/LV, device-mapper placement, `/dev/VG/LV` paths. [^4]
- `linux/lab-setup.md` — the lab where the ext4 features, inode count, extent, LVM table and extent rounding were captured on 2026-11-04 (privileged container with the VM's `/dev` mounted). [^5]
- [resize2fs(8)](https://man7.org/linux/man-pages/man8/resize2fs.8.html) — e2fsprogs via Linux man-pages, living. Backs: shrink or enlarge unmounted ext4; expand only when mounted. [^6]

## Related
- `linux/storage/block-io-and-durability.md` — the I/O path under the filesystem.
- `linux/fundamentals/kernel-modules-and-udev.md` — how `/dev/vg0/data` and `/dev/disk/by-uuid` names appear.
