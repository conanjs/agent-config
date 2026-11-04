---
schema: topic-index/v1
kind: subtopic
topic: windows/memory
last-updated: 2026-11-04
---

# Windows memory management

Reserved vs committed pages, the system commit limit (RAM + page files), working sets, soft and hard page faults, transition pages and page file sizing. Not covered: the memory compression store, NUMA.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [virtual-memory-and-commit.md](virtual-memory-and-commit.md) | concept | Each process has a private virtual address space whose pages are **free**, **reserved** (address range held, no storage) or **committed** (storage *promised* from RAM + page files) | verified |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.

## Related
- `windows/learning-path.md` — where this subtopic sits in the learning order.
- `linux/` — the Linux counterpart of each Windows mechanism.
