---
schema: knowledge-doc/v1
type: concept
topic: linux/memory
status: verified
applies-to: ["Linux ≥ 5.x", "x86-64 and arm64 with 4 KiB base pages"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, virtual-memory, paging, page-table, tlb, page-fault, rss, vsz, overcommit, huge-pages]
---

# Virtual memory, paging and overcommit

## Summary
**TL;DR:** Every process sees its own private, huge address space of **virtual** addresses. The CPU translates each one to a physical page through **page tables** that the kernel fills in lazily: memory is only really allocated on the **first touch** (a page fault). This is why `VSZ` (what was reserved) is usually far larger than `RSS` (what is really in RAM), and why Linux can promise more memory than it has (**overcommit**) and must sometimes break that promise (the OOM killer).
**Use this when:** you compare VSZ/RSS/"memory used" numbers, read `/proc/<pid>/maps` or `/proc/meminfo`, see `malloc` succeed and the process die later, or tune `vm.overcommit_memory` or huge pages.
**Not this doc:** file caching and reclaim → `memory/page-cache-and-reclaim.md`; who gets killed when memory runs out → `memory/oom-killer.md`.

## Problem
"The process uses 4 GB" can mean four different numbers. Teams size containers on the wrong one, chase phantom leaks in VSZ, or are surprised when `malloc(10 GB)` succeeds on an 8 GB machine and the process is killed minutes later.

## Mental model
**Analogy:** a hotel with a huge printed room directory. Each guest (process) gets their own directory with numbers 1 to a billion (virtual addresses), but only some entries point to real rooms (physical pages). A room is only assigned when the guest first walks to that number (first touch). The front desk (kernel) keeps a lookup book per guest (page table), and the doorman keeps a small cheat sheet of recent lookups (TLB).

**Artifact:** the start of a process's memory map (lab, Linux 6.17.8, arm64, 2026-11-04) ✅[^5]:
```
aaaab5790000-aaaab588e000 r-xp 00000000 00:5c 1915001   /usr/bin/coreutils   # code: read + execute
aaaab5895000-aaaab58a0000 r--p 00105000 00:5c 1915001   /usr/bin/coreutils   # read-only data
aaaab58a0000-aaaab58a4000 rw-p 00110000 00:5c 1915001   /usr/bin/coreutils   # writable data
aaaae9f90000-aaaae9f91000 rw-p 00000000 00:00 0         [heap]               # anonymous (no file)
ffff8e796000-ffff8e7e3000 r-xp 00000000 00:5c 1914961   /lib/libskarnet.so…  # a shared library
```
Columns: virtual address range · permissions (`p` = private, copy-on-write) · offset in the file · device · inode · backing file. Rows with inode `0` and no file are **anonymous** memory.

## How it works
**4 actors:**
- **Process** — its job: use virtual addresses, via ordinary loads and stores; reserve ranges via `mmap`/`brk` (what `malloc` calls).
- **CPU memory-management unit (MMU)** — its job: translate virtual to physical addresses, via the page tables and its TLB cache ✅[^1].
- **Kernel memory manager** — its job: build page tables, handle page faults, allocate and reclaim physical pages, via its fault handler and allocators ✅[^1].
- **Physical RAM (and swap)** — its job: hold the page frames, via page-sized blocks whose size is architecture-specific ✅[^1] (4096 bytes in the lab ✅[^5]).

```
process: load from 0xaaaae9f90010
   │
   ▼
MMU: TLB hit? ── yes ─► physical address → RAM
   │ no
   ▼
walk page tables (multi-level: each level indexed by a slice of the address)
   │
   ├─ entry present ─► fill TLB → RAM
   └─ entry missing / not allowed ─► PAGE FAULT → kernel
                                       ├─ valid range, first touch → allocate zeroed page, map it, retry
                                       ├─ file-backed range → read page from page cache/disk, map, retry
                                       ├─ swapped out → read back from swap, map, retry
                                       └─ invalid address / wrong permission → SIGSEGV
```

1. **Reserve (process → kernel):** `mmap` or `brk` reserves a **range** of virtual addresses. No physical memory is used yet ✅[^5] (lab: a 512 MiB anonymous `mmap` raised RSS by only 256 KiB; touching 256 MiB raised it by ≈ 256 MiB).
2. **First touch (CPU):** the MMU walks the hierarchical page tables; the top-level table's address lives in a CPU register and each level uses a slice of the virtual address ✅[^1].
3. **Page fault (CPU → kernel):** no mapping yet, so the kernel's fault handler runs. For anonymous memory, a first read can map a shared zero-filled page; the first write allocates a real page ✅[^1].
4. **File-backed pages:** for mapped files (code, libraries), the page comes from the page cache, which reads from disk if needed ✅[^1].
5. **TLB:** translations are cached in the TLB, a scarce CPU cache; workloads with large working sets suffer from TLB misses ✅[^1].
6. **Huge pages:** higher page-table levels can map large pages directly (2 MiB and 1 GiB on x86), reducing TLB pressure — explicitly with `hugetlbfs`, or automatically with Transparent HugePages (THP) ✅[^1]. The THP mode lives in `/sys/kernel/mm/transparent_hugepage/enabled`: `always`, `madvise` (only regions marked with `madvise(MADV_HUGEPAGE)`) or `never` ✅[^4]; the lab VM uses `madvise` ✅[^5].

**The numbers people confuse:**

| Name | Where | Means |
|---|---|---|
| VSZ / `VmSize` | `ps`, `/proc/<pid>/status` | All reserved virtual address space, touched or not |
| RSS / `VmRSS` | `ps`, `top`, `/proc/<pid>/status` | Pages of this process currently in RAM, including shared library pages also counted in other processes |
| `AnonPages` | `/proc/meminfo` | Non-file-backed pages mapped into user page tables, system-wide ✅[^3] |
| `Committed_AS` | `/proc/meminfo` | All memory processes have allocated, even if not yet touched ✅[^3] |
| `MemAvailable` | `/proc/meminfo` | Estimate of memory available for new work without swapping ✅[^3] |

**Overcommit:** because reserving is cheap and touching is what costs, the kernel can allow total reservations beyond RAM + swap. `vm.overcommit_memory` ✅[^2] ✅[^6]:

| Mode | Name | Behaviour |
|---|---|---|
| `0` (default) | Heuristic | Refuses obvious overcommits, allows some |
| `1` | Always | Every allocation succeeds until memory really runs out |
| `2` | Never (strict) | Total commit may not exceed swap + `overcommit_ratio`% of RAM (default 50%); allocations fail instead of processes being killed later |

In mode 2 the limit is `CommitLimit` = (RAM pages − hugetlb pages) × `overcommit_ratio` / 100 + swap pages ✅[^3].

## Worked example
Lab process (`grep` reading its own status, Linux 6.17.8, 2026-11-04) ✅[^5]:
```
VmSize:	    1720 kB      # reserved virtual address space
VmRSS:	     944 kB      # actually resident in RAM
VmSwap:	       0 kB
```
Only 55% of what `grep` reserved is resident. Runtimes that reserve large heaps up front show a larger gap for the same reason.

System view in the same lab ✅[^5]:
```
MemTotal:        8186988 kB
MemFree:         7343616 kB
MemAvailable:    7648992 kB    # more than MemFree: page cache can be reclaimed
Cached:           465740 kB
AnonPages:        136096 kB
CommitLimit:    13329048 kB    # = 50% of RAM + 9 GB swap (only enforced in mode 2)
Committed_AS:     624456 kB
```
Check: 0.5 × 8 186 988 + 9 235 556 = 13 329 050 kB, which matches `CommitLimit` to within rounding ✅[^3] ✅[^5]. The VM in the lab sets `overcommit_memory` to `1` (not the kernel default `0`), so the limit is not enforced there ✅[^5].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `malloc(10 GB)` on an 8 GB machine, mode 0 or 1 | May succeed; the process dies later when touching pages | Reservation is not allocation; OOM killer at touch time ✅[^2] |
| Same in mode 2 | `malloc` returns `NULL` (`ENOMEM`) | Commit limit enforced ✅[^2] |
| Access to unmapped address | `SIGSEGV` | No valid mapping ✅[^5] (lab: reading address 8 killed Python with exit 139 = 128 + 11 `SIGSEGV`) |
| After `fork`, child writes to memory | Page copied on that first write | Copy-on-write ✅[^7] |
| THP `always` with a sparse heap | Higher memory use (a whole 2 MiB page for one touched byte) | THP trade-off ✅[^4] |
| THP defrag on allocation | Latency spikes from reclaim and compaction | Synchronous compaction ✅[^4] |
| Reading RSS of many processes and summing | Over-counts shared libraries | RSS counts shared pages in every process ✅[^8] (lab: one process showed `Rss: 860 kB`, `Pss: 532 kB`) ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Overcommit on (mode 0/1) | Sparse and fork-heavy programs work; better RAM use | Failure arrives as an OOM kill, not an error |
| Strict overcommit (mode 2) | Allocation failures are errors you can handle | Needs swap or wastes RAM; fork of large processes can fail |
| Huge pages | Fewer TLB misses and faults | Memory waste, allocation latency |

## Takeaways
- Size containers and alerts on RSS / working set, never on VSZ.
- Expect memory failures as OOM kills (not `malloc` errors) under the default overcommit; design for restarts.
- Use `MemAvailable`, not `MemFree`, to judge free memory.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 32 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Concepts overview (memory management)](https://docs.kernel.org/admin-guide/mm/concepts.html) — Linux kernel documentation, living. Backs: virtual memory, hierarchical page tables, architecture-specific page size, anonymous memory and zero page, page cache, TLB, huge pages, hugetlbfs and THP. [^1]
- [Overcommit Accounting](https://docs.kernel.org/mm/overcommit-accounting.html) — Linux kernel documentation, living. Backs: overcommit modes 0/1/2 and the 50% default ratio. [^2]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: `MemAvailable`, `AnonPages`, `Committed_AS`, `CommitLimit` formula. [^3]
- [Transparent Hugepage Support](https://docs.kernel.org/admin-guide/mm/transhuge.html) — Linux kernel documentation, living. Backs: THP modes, memory waste, defrag latency. [^4]
- `linux/lab-setup.md` — the lab where `/proc/self/maps`, `status`, `meminfo`, page size, THP mode and overcommit setting were captured on 2026-11-04. [^5]
- [Documentation for /proc/sys/vm/](https://docs.kernel.org/admin-guide/sysctl/vm.html) — Linux kernel documentation, living. Backs: `overcommit_memory` default 0. [^6]
- [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) — Linux man-pages project, living. Backs: copy-on-write after fork. [^7]
- [proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) — Linux man-pages project, living. Backs: `Pss`, the process's proportional share of a mapping. [^8]

## Related
- `linux/memory/page-cache-and-reclaim.md` — what happens to file pages and when memory gets tight.
- `linux/memory/oom-killer.md` — how a victim is picked when the promise breaks.
- `kubernetes/memory-limits-and-oom-kill.md` — the same mechanics under a container memory limit.
