---
schema: knowledge-doc/v1
type: concept
topic: linux/memory
status: verified
applies-to: ["Linux ≥ 5.x", "cgroup v2"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, oom, oom-killer, oom-score, oom-score-adj, memory-cgroup, exit-137, memory-max, memory-high]
---

# The OOM killer: system-wide and cgroup

## Summary
**TL;DR:** When memory is exhausted and reclaim cannot free enough, the kernel picks one process and kills it with `SIGKILL` (exit code 137) so the system keeps running. There are two scopes: the **system-wide** OOM killer (the whole machine is out of memory) and the **cgroup** OOM killer (one cgroup hit its `memory.max`, even if the machine has plenty free). The victim is the task with the highest **badness score** (roughly its share of allowed memory, 0–1000), shifted by `oom_score_adj` (−1000…+1000; −1000 means "never kill").
**Use this when:** a process disappears with exit code 137 or `Killed`, `dmesg` shows "Out of memory", you set `oom_score_adj` for critical daemons, or you choose between `memory.max` and `memory.high`.
**Not this doc:** how Kubernetes reports and evicts → `kubernetes/memory-limits-and-oom-kill.md`; how memory gets tight in the first place → `memory/page-cache-and-reclaim.md`.

## Problem
OOM kills look like random crashes: no stack trace, no application log, just a dead process. People raise heap sizes (making it worse), or protect the wrong process, or do not realize a container was killed by its own cgroup limit while the node was half empty.

## Mental model
**Analogy:** a lifeboat that is too heavy. The captain (kernel) first throws out cargo that can be replaced (page cache, swap-out). If the boat still sinks, one passenger must go: the captain picks the one carrying the most weight (badness score), adjusted by a tag on each passenger saying "VIP, never" (−1000) or "volunteer first" (+1000). A container is a smaller boat inside the big one with its own weight limit; it can sink alone.

**Artifact:** a process's OOM score files (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
$ cat /proc/self/oom_score /proc/self/oom_score_adj
666          # current badness, already including the adjustment
0            # no adjustment
```

## How it works
**4 actors:**
- **Allocating task** — its job: ask for a page, via a page fault or a kernel allocation.
- **Reclaim** — its job: try to free memory first, via kswapd and direct reclaim ✅[^1].
- **OOM killer** — its job: pick and kill a victim when reclaim fails, via the badness score ✅[^1] ✅[^2].
- **Memory cgroup** — its job: apply a per-group limit and run the OOM killer inside that group only, via `memory.max` ✅[^3].

```
allocation needs a page
   │
   ▼
cgroup at memory.max? ─ yes ─► reclaim inside the cgroup ─ freed? ─ yes ─► allocate
   │ no                                               │ no
   ▼                                                  ▼
system free pages at min? ─ yes ─► global reclaim   cgroup OOM: kill highest-badness task IN THE CGROUP
   │ no               │ freed? ─ yes ─► allocate     (memory.events: oom++, oom_kill++)
   ▼                  │ no
allocate              ▼
                 system OOM: kill highest-badness task on the machine
                 (or panic if vm.panic_on_oom is set)
```

1. **Trigger:** memory is exhausted and reclaim cannot free enough ✅[^1]. In a cgroup: "If a cgroup's memory usage reaches this limit and can't be reduced, the OOM killer is invoked in the cgroup" ✅[^3].
2. **Scoring:** each task's badness is 0–1000, roughly the share of allowed memory it uses (RAM + swap): using all allowed memory = 1000, half = 500 ✅[^2].
3. **Adjustment:** `oom_score_adj` (−1000…+1000) is added; −1000 disables OOM killing for that task; the result shows in `/proc/<pid>/oom_score` ✅[^2].
4. **Kill:** the highest score gets `SIGKILL`, which cannot be handled ✅[^5]. The shell or runtime then reports exit 137 (128 + 9).
5. **Policy knobs:** `vm.oom_kill_allocating_task=1` kills the task that triggered the OOM instead of scanning; `vm.panic_on_oom=1/2` panics instead of killing; both default to 0 ✅[^6].
6. **Cgroup-only knobs:** `memory.high` throttles and applies reclaim pressure **without** OOM killing; `memory.oom.group` kills the whole cgroup as a unit; `memory.events` counts `oom` (limit hit and allocation about to fail) and `oom_kill` ✅[^3].

## Worked example
A cgroup limited to 50 MiB, no swap, then a Python process allocating 200 MiB (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
# mkdir /sys/fs/cgroup/demo
# echo 50M > /sys/fs/cgroup/demo/memory.max
# echo 0   > /sys/fs/cgroup/demo/memory.swap.max
# sh -c 'echo $$ > /sys/fs/cgroup/demo/cgroup.procs; exec python3 -c "b=bytearray(200*1024*1024)"'
Killed
# echo $?
137
# cat /sys/fs/cgroup/demo/memory.events
low 0
high 0
max 35            # times usage hit memory.max and reclaim was tried
oom 1             # limit hit and allocation about to fail
oom_kill 1        # one process killed
oom_group_kill 0
# cat /sys/fs/cgroup/demo/memory.peak
52428800          # exactly 50 MiB
```
The machine had gigabytes free; only the cgroup was out of memory. That is the usual shape of a container OOM kill.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Container killed, node has free memory | Cgroup OOM | `memory.max` reached in that cgroup ✅[^3] |
| `oom_score_adj = -1000` on every process | The OOM killer may find no victim | −1000 disables killing for a task ✅[^2]; the kernel then panics with "Out of memory and no killable processes..." ✅[^8] |
| Main process small, child large | The child is killed, the main process continues in a broken state | Victims are chosen per task by memory use ✅[^2]; `memory.oom.group` kills all ✅[^3] |
| `memory.high` set below `memory.max` | Process slows down under reclaim instead of dying first | High is a throttle, not a kill ✅[^3] |
| Overcommit mode 2 | Allocations fail with `ENOMEM` before an OOM kill is needed | Strict commit limit ✅[^7] |
| Logs show nothing from the app | Expected | `SIGKILL` cannot be caught ✅[^5]; check `dmesg` / `journalctl -k` for "Out of memory" ✅[^8] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Hard `memory.max` only | Hard isolation; neighbours protected | Sudden kills |
| `memory.high` below `memory.max` | Early slowdown warns before death | Throttled latency |
| `oom_score_adj` negative for core daemons (sshd, agents) | They survive pressure | Something else dies instead |
| `panic_on_oom` + auto-reboot | Clean state after OOM | The whole machine restarts |

## Takeaways
- On exit 137, check `memory.events` (cgroup) or kernel logs (system) before touching code.
- Give containers headroom above their peak working set; consider `memory.high` as an early-warning throttle. [rule-candidate]
- Protect only a few critical system processes with negative `oom_score_adj`; never set −1000 broadly.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Concepts overview (memory management)](https://docs.kernel.org/admin-guide/mm/concepts.html) — Linux kernel documentation, living. Backs: OOM killer is invoked when reclaim cannot free enough; reclaim first. [^1]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: badness 0–1000, `oom_score_adj` range and −1000, `oom_score` includes the adjustment. [^2]
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `memory.max` invokes the OOM killer in the cgroup, `memory.high` throttles, `memory.events` `oom` / `oom_kill`, `memory.oom.group`. [^3]
- `linux/lab-setup.md` — the lab where the OOM score files and the 50 MiB cgroup OOM kill were captured on 2026-11-04. [^4]
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages project, living. Backs: `SIGKILL` cannot be caught. [^5]
- [Documentation for /proc/sys/vm/](https://docs.kernel.org/admin-guide/sysctl/vm.html) — Linux kernel documentation, living. Backs: `oom_kill_allocating_task`, `panic_on_oom`. [^6]
- [Overcommit Accounting](https://docs.kernel.org/mm/overcommit-accounting.html) — Linux kernel documentation, living. Backs: mode 2 fails allocations instead. [^7]
- [mm/oom_kill.c](https://github.com/torvalds/linux/blob/master/mm/oom_kill.c) — Linux kernel source, read 2026-11-04. Backs: "Out of memory and no killable processes..." panic path; "Out of memory" kill messages. [^8]

## Related
- `kubernetes/memory-limits-and-oom-kill.md` — `OOMKilled`, working set and node-pressure eviction.
- `linux/containers/cgroups-v2.md` — the memory controller files.
- `linux/memory/virtual-memory.md` — overcommit, the reason OOM kills exist.
