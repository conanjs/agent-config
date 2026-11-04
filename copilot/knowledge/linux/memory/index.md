---
schema: topic-index/v1
kind: subtopic
topic: linux/memory
last-updated: 2026-11-04
---

# Memory management

Virtual memory, paging, overcommit and huge pages; the page cache, dirty writeback, reclaim and swap; and the OOM killer at system and cgroup scope. Not covered: allocator internals (slab, buddy).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [virtual-memory.md](virtual-memory.md) | concept | Every process sees its own private, huge address space of **virtual** addresses | verified |
| [page-cache-and-reclaim.md](page-cache-and-reclaim.md) | concept | Linux uses free RAM as a **page cache** for file data, so "free" memory looks low on a healthy machine | verified |
| [oom-killer.md](oom-killer.md) | concept | When memory is exhausted and reclaim cannot free enough, the kernel picks one process and kills it with `SIGKILL` (exit code 137) so the system keeps running | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
