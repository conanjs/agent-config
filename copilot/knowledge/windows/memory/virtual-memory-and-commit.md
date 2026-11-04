---
schema: knowledge-doc/v1
type: concept
topic: windows/memory
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+", "64-bit"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, virtual-memory, commit-charge, commit-limit, page-file, working-set, page-fault, reserved, committed]
---

# Windows virtual memory: reserve, commit, working set and the page file

## Summary
**TL;DR:** Each process has a private virtual address space whose pages are **free**, **reserved** (address range held, no storage) or **committed** (storage *promised* from RAM + page files). Commit is charged against a system-wide **commit limit = physical RAM + all page files**; when the total **commit charge** reaches it, allocations fail — Windows does not overcommit like Linux. Physical pages are only provided on first touch; the pages currently in RAM for a process are its **working set**. A page fault is **soft** if the page is already in memory somewhere, **hard** if it must be read from the page file or a mapped file.
**Use this when:** you read Task Manager's "Committed" numbers, size page files, see out-of-memory errors with free RAM, or compare Windows and Linux memory accounting.
**Not this doc:** Linux overcommit and the OOM killer → `linux/memory/virtual-memory.md`, `linux/memory/oom-killer.md`.

## Problem
"Low memory" warnings on a machine with plenty of free RAM, servers deliberately run without a page file that then fail allocations, and confusion between "private bytes", "working set" and "commit" all come from not knowing that Windows accounts for *commitments*, not just resident pages.

## Mental model
**Analogy:** a bank that never lends money it does not have. Reserving is drawing a property boundary (no money involved). Committing is a loan the bank guarantees, counted against its total funds (RAM + page files) — even if you have not spent it yet. When the guarantees reach the total, the bank refuses new loans, rather than lending more and calling some in later (which is what Linux overcommit does).

**Artifact:** the three page states ✅[^1]:

| State | Accessible? | Storage | Example API |
|---|---|---|---|
| Free | No (access violation) | None | `VirtualFree` returns pages here |
| Reserved | No | None; range blocked for other allocations | `VirtualAlloc(MEM_RESERVE)` |
| Committed | Yes (per protection constants) | Charged to RAM + paging files; physical page provided on first read/write | `VirtualAlloc(MEM_COMMIT)`, `GlobalAlloc`, `LocalAlloc` |

## How it works
**4 actors:**
- **Process** — its job: reserve, commit and touch memory, via `VirtualAlloc`, heaps, mapped files.
- **Memory manager** — its job: translate addresses with per-process page tables, resolve page faults, manage working sets and the commit charge ✅[^2] ✅[^3].
- **Page file(s)** — its job: back modified pages removed from RAM and extend the commit limit; also back crash dumps ✅[^4].
- **Physical RAM** — its job: hold working-set pages and cached (transition) pages ✅[^3].

1. **Private address space:** a per-process page table translates every virtual address ✅[^2].
2. **Commit accounting:** committing charges the system commit charge; the system commit limit is the sum of physical memory and all page files ✅[^4]. If the charge reaches the limit, "the system and processes might not get committed memory", causing freezes, crashes and other malfunctions ✅[^4].
3. **Demand paging:** a committed page gets a physical page only on first access ✅[^1].
4. **Working set:** the set of a process's pageable pages currently resident in RAM; touching a pageable page not in it causes a page fault ✅[^3].
5. **Soft vs hard faults:** soft when the page is in another process's working set, in transition (removed from working sets but still cached), or a first-touch demand-zero page; hard when it must be read from the backing store (page file or mapped file) ✅[^3].
6. **Trimming:** the memory manager removes pages from working sets to free memory; pages removed from all working sets become **transition** pages, kept cached until reused; dirty ones are written to their backing store first ✅[^3].
7. **Page file growth:** system-managed page files grow up to 3× RAM or 4 GB (whichever is larger, at most 1/8 of the volume) when commit charge reaches 90% of the limit, if disk space allows ✅[^4].

**Windows vs Linux accounting:**

| Question | Windows | Linux (default) |
|---|---|---|
| Is a commit a promise? | Yes — charged against RAM + page files | No — heuristic overcommit (mode 0) |
| What fails when memory runs out? | Allocation/commit fails | Process killed later by the OOM killer |
| "Resident" metric | Working set | RSS |
| Cached file pages after use | Transition / standby pages | Page cache |
| Per-process limit knob | Working-set min/max, job object limits | cgroup `memory.max` |

## Worked example
A server with 16 GB RAM and a system-managed page file (illustrative numbers):

| Quantity | Value | Meaning |
|---|---|---|
| Commit limit | 16 GB + 4 GB page file = 20 GB | Total promises allowed ✅[^4] |
| Commit charge | 18 GB | Promised, not necessarily touched |
| `% Committed Bytes In Use` counter | 90% | `\Memory\Committed Bytes` ÷ `\Memory\Commit Limit` ✅[^4] |
| Working sets in use | 11 GB | Actually resident |
| Next | System-managed page file may grow (90% threshold) | ✅[^4] |

Removing the page file to "save disk" would cut the limit to 16 GB: commits beyond that fail even though 5 GB of RAM is untouched. Microsoft also notes some server roles (domain controllers, DFS-R, certificate servers) require a page file ✅[^4].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Free RAM but "out of memory" errors | Commit limit reached | Promises, not usage, are limited ✅[^4] |
| No page file | Commit limit = RAM; no full crash dumps | Page files extend commit and back dumps ✅[^4] |
| Reading a reserved page | Access violation | Reserved pages are inaccessible ✅[^1] |
| AWE / large-page allocations | Not in the working set; never page-fault | Non-pageable ✅[^3] |
| `EmptyWorkingSet` "memory cleaners" | Pages move to transition; soft faults when touched again | Trimming ✅[^3] |

## Takeaways
- Watch commit charge vs commit limit, not just free RAM. [rule-candidate]
- Keep a page file (system-managed is fine) unless you have measured that the commit charge never needs it and you do not need crash dumps.
- Reserve large address ranges cheaply and commit in pieces when you need sparse, growable buffers.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Page State](https://learn.microsoft.com/en-us/windows/win32/memory/page-state) — Microsoft Learn, living. Backs: free/reserved/committed, charging against RAM + paging files, first-access loading, APIs. [^1]
- [Virtual Address Space](https://learn.microsoft.com/en-us/windows/win32/memory/virtual-address-space) — Microsoft Learn, living. Backs: private per-process address space, per-process page tables. [^2]
- [Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set) — Microsoft Learn, living. Backs: working set definition, page faults, hard vs soft faults, trimming, transition pages, AWE/large pages. [^3]
- [Introduction to the page file](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/introduction-to-the-page-file) — Microsoft Learn, 2026. Backs: page file roles, commit limit = RAM + page files, failure at the limit, counters, system-managed growth rule, roles that need a page file. [^4]
- No Windows lab was available when this doc was written (macOS host); the worked example is illustrative.

## Related
- `linux/memory/virtual-memory.md` — overcommit and VSZ/RSS on Linux.
- `windows/system-management/diagnostics-tools.md` — counters to watch.
