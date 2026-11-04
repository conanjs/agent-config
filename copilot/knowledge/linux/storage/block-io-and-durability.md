---
schema: knowledge-doc/v1
type: concept
topic: linux/storage
status: verified
applies-to: ["Linux ≥ 5.0 (blk-mq only)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, block-layer, blk-mq, io-scheduler, fsync, fdatasync, durability, iostat, write-cache]
---

# Block I/O path and write durability

## Summary
**TL;DR:** A `write()` normally stops in the page cache; it is **not** on disk when the call returns. Data travels later: page cache → filesystem → **block layer** (blk-mq: per-CPU software queues → hardware dispatch queues → driver) → device, and even then may sit in the device's own volatile write cache. `fsync(fd)` forces data **and** metadata through all of these, including a device cache flush; a newly created file also needs an `fsync` on its **directory** so the name survives a crash.
**Use this when:** you need data to survive power loss (databases, queues, config writes), you read `iostat -x`, you choose an I/O scheduler, or you see writes that are fast until they are not.
**Not this doc:** dirty-page thresholds and writeback timing → `memory/page-cache-and-reclaim.md`; names, inodes and descriptors → `storage/vfs-and-file-descriptors.md`.

## Problem
Applications report "saved" and lose data on a crash, or write a new config file that is empty after reboot. The cause is the gap between "the kernel accepted my bytes" and "the bytes are on stable storage", plus the separate durability of the directory entry.

## Mental model
**Analogy:** sending a parcel. Handing it to the reception desk (`write` → page cache) is not delivery. The courier picks parcels up in batches (writeback), sorts them at a depot (block layer queues), loads the truck (driver), and the warehouse may still park it on the loading dock (device write cache) before shelving it. `fsync` is "wait here until the warehouse signs that it is on the shelf". And if the parcel is a new tenant's mail, the building directory (the parent directory) must be updated and signed too.

**Artifact:** the safe "write a new file" sequence as system calls:
```c
int fd = open("config.json.tmp", O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
write(fd, buf, len);
fsync(fd);                                  /* 1. data + inode metadata on stable storage   */
close(fd);
rename("config.json.tmp", "config.json");   /* 2. atomic switch of the name                  */
int dfd = open(".", O_RDONLY | O_DIRECTORY);
fsync(dfd);                                 /* 3. the directory entry itself is now durable  */
close(dfd);
```

## How it works
**5 actors:**
- **Application** — its job: write and request durability, via `write`, `fsync`, `fdatasync`.
- **Page cache + filesystem (ext4, xfs, …)** — its job: hold dirty pages and turn file offsets into block addresses and journal entries, via writeback.
- **Block layer (blk-mq)** — its job: queue, merge and dispatch block requests, via per-CPU software staging queues and hardware dispatch queues ✅[^2].
- **Device driver** — its job: send requests to the hardware, via a tag per in-flight request ✅[^2].
- **Storage device** — its job: persist data, possibly after buffering in a volatile write cache ✅[^1].

```
write() ──► page cache (dirty) ──(writeback or fsync)──► filesystem: blocks + journal
                                                             │ bio requests
                                                             ▼
                          block layer: software staging queue (per CPU)  ← merge / I/O scheduler
                                                             │
                                          hardware dispatch queue(s) ── tag per request
                                                             │
                                                         driver (NVMe, virtio, SCSI…)
                                                             │  ══ leaves the kernel ══
                                                             ▼
                                         device write cache ──(flush / FUA)──► stable media
```

1. **`write` (application → page cache):** data is copied into the page cache and marked dirty; the call returns — a successful `write` "does not make any guarantee" that data is on disk ✅[^6].
2. **Writeback (kernel, later):** flusher threads or memory pressure send dirty pages to the filesystem (timing in `memory/page-cache-and-reclaim.md`).
3. **Block layer:** blk-mq exists because on fast SSD/NVMe devices "the bottleneck of the stack had moved from the storage device to the operating system"; it spreads submissions across per-CPU software queues with their own locks, merges adjacent requests, and feeds hardware dispatch queues ✅[^2].
4. **I/O scheduler:** pluggable at runtime through sysfs; it reorders requests only within a software queue; `none` does no reordering ✅[^2]. The lab VM offers `[none] mq-deadline kyber` for its virtio disks ✅[^4].
5. **Driver and tags:** each request gets an integer tag up to the queue depth; the driver returns it on completion ✅[^2].
6. **`fsync` (application → all layers):** writes the file's modified data and metadata to the device, "includes writing through or flushing a disk cache if present", and blocks until the device reports completion ✅[^1].
7. **Directory durability:** "Calling fsync() does not necessarily ensure that the entry in the directory containing the file has also reached disk" — `fsync` a descriptor of the directory too ✅[^1].
8. **`fdatasync`:** like `fsync` but skips metadata not needed to read the data back (e.g. timestamps); a size change is still flushed ✅[^1].

## Worked example
Reading `iostat -xz 1` for one disk during a slow period (illustrative numbers):

| Field | Value | Meaning |
|---|---|---|
| `w/s` | 2 400 | Write requests completed per second |
| `wkB/s` | 9 600 | ≈ 4 KiB per write: small, random writes |
| `aqu-sz` | 18 | Average queue size: requests waiting or in service |
| `w_await` | 7.5 ms | Average time per write, queue + service |
| `%util` | 100 | Device busy all the time |

USE-method reading: utilization = `%util`, saturation = queue size > 1 with high await ✅[^3]. Here the disk is saturated by small writes. Typical causes: an application calling `fsync` after every small record, or a database with a tiny batch size. Options: batch writes per `fsync` (group commit), use `fdatasync`, or faster storage. Note that `%util` "does not reflect" the limits of devices that serve requests in parallel (NVMe, RAID) ✅[^7].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Crash after `write`, no `fsync` | Recent data lost | It was only in the page cache ✅[^6] |
| New file `fsync`'d, directory not | After a crash the file may not exist | Directory entry not durable ✅[^1] |
| Device with a volatile write cache and old kernel/filesystem | `fsync` may not flush the device cache | Some systems do not flush disk caches; disable the cache in that case ✅[^1] |
| `fsync` returns an error (`EIO`) | An error occurred during synchronization ✅[^1] | Treat as possible data loss; do not assume a retry fixes it |
| Overlay or network filesystem | Durability depends on the lower/remote filesystem | NFS is unsuitable as an overlay upper layer ✅[^5] |
| NVMe with `none` scheduler | Lowest overhead; no reordering | The device has many deep queues ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `fsync` per record | Each record durable on return | Throughput bounded by flush latency |
| Group commit (one `fsync` per batch) | High throughput, bounded loss window = 0 for acknowledged batches | Higher latency per record |
| `O_DIRECT` | Bypasses page cache; predictable memory | Alignment rules; you manage caching; still needs flushes for durability ✅[^8] |
| Rely on writeback only | Fastest | Dirty data becomes eligible for writeout after 30 s and flushers wake every 5 s, so roughly the last 30–35 s are at risk ✅[^9] |

## Takeaways
- To make a new file durable: write to a temp file, `fsync` it, `rename`, then `fsync` the directory. [rule-candidate]
- Acknowledge "saved" to users only after `fsync`/`fdatasync` returned success.
- Read disk health with utilization **and** saturation (queue size, await), not `%util` alone.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 21 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html) — Linux man-pages project, living. Backs: what `fsync` flushes including the disk cache, blocking, directory entry caveat, `fdatasync` difference, old systems not flushing caches. [^1]
- [Multi-Queue Block IO Queueing Mechanism (blk-mq)](https://docs.kernel.org/block/blk-mq.html) — Linux kernel documentation, living. Backs: why blk-mq, software staging and hardware dispatch queues, merging, schedulers pluggable via sysfs, `none`, tags. [^2]
- [The USE Method: Linux Performance Checklist](https://www.brendangregg.com/USEmethod/use-linux.html) — Brendan Gregg, living. Backs: storage utilization `%util`, saturation queue size > 1 and high await. [^3]
- `linux/lab-setup.md` — the lab where the available schedulers (`[none] mq-deadline kyber`) were read on 2026-11-04. [^4]
- [Overlay Filesystem](https://docs.kernel.org/filesystems/overlayfs.html) — Linux kernel documentation, living. Backs: NFS unsuitable as upper layer. [^5]
- [write(2)](https://man7.org/linux/man-pages/man2/write.2.html) — Linux man-pages project, living. Backs: a successful `write` does not guarantee the data has been committed to disk. [^6]
- [iostat(1)](https://man7.org/linux/man-pages/man1/iostat.1.html) — sysstat via Linux man-pages, living. Backs: for devices serving requests in parallel, `%util` does not reflect their performance limits. [^7]
- [open(2)](https://man7.org/linux/man-pages/man2/open.2.html) — Linux man-pages project, living. Backs: `O_DIRECT` alignment restrictions and that it does not by itself guarantee data and metadata are synced (use `O_SYNC` too). [^8]
- [Documentation for /proc/sys/vm/](https://docs.kernel.org/admin-guide/sysctl/vm.html) — Linux kernel documentation, living. Backs: `dirty_expire_centisecs`, `dirty_writeback_centisecs`, `drop_caches`. [^9]

## Related
- `linux/memory/page-cache-and-reclaim.md` — dirty thresholds and writeback timing.
- `linux/storage/vfs-and-file-descriptors.md` — names, inodes and `rename`.
- `linux/system-management/performance-triage.md` — disk checks in a triage run.
