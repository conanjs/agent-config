---
schema: knowledge-doc/v1
type: concept
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.x with cgroup v2 (unified hierarchy)"]
derived-from: [linux/containers/container-from-primitives-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, cgroups, cgroup-v2, memory-max, cpu-max, cpu-weight, pids-max, io-max, resource-limits, systemd-slices]
---

# Control groups v2 (cgroups)

## Summary
**TL;DR:** A cgroup is a directory under `/sys/fs/cgroup` that holds a set of processes; files in it set and report resource use for the whole group. cgroup v2 has **one tree** for all controllers. A parent enables controllers for its children by writing `+cpu +memory …` to `cgroup.subtree_control`, and (outside the root) only a cgroup **without processes of its own** may do so. The common files: `cpu.max` (hard CPU time quota), `cpu.weight` (share under contention, default 100), `memory.max` (hard limit → OOM kill), `memory.high` (soft limit → throttling), `pids.max` (fork limit), `io.max`. systemd, Docker and Kubernetes are all front ends that write these files.
**Use this when:** you set or read container limits at the kernel level, see `EBUSY` writing `subtree_control`, need to find which cgroup a process is in, or want the exact meaning of a limit before tuning it.
**Not this doc:** how CPU quota throttling feels at runtime → `kubernetes/cpu-limits-and-throttling.md`; OOM victim selection → `memory/oom-killer.md`.

## Problem
Limits are configured in many places (Docker flags, Kubernetes specs, systemd units) but enforced in one: the cgroup files. When a limit misbehaves, you need to read those files directly and know their exact semantics, including rules like "no internal processes" that make manual setup fail.

## Mental model
**Analogy:** a company budget tree. The company (root cgroup) splits its money into departments (child cgroups); each department can split again. A department either has staff directly **or** sub-departments with their own budgets, not both (no internal processes). Each budget line is a file: "CPU: 50 ms per 100 ms", "memory: 64 MiB", "at most 32 people".

**Artifact:** a container's cgroup, seen from inside a Docker container (lab, Linux 6.17.8, 2026-11-04) ✅[^3]:
```console
$ cat /proc/self/cgroup
0::/                                   # v2 has one line: "0::<path>"; the cgroup namespace shows "/"
$ cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max
max 100000                             # no CPU quota: "max" µs per 100 000 µs period
max                                    # no memory limit
$ ls /sys/fs/cgroup | head -12
cgroup.controllers
cgroup.events
cgroup.freeze
cgroup.kill
cgroup.max.depth
cgroup.max.descendants
cgroup.procs
cgroup.stat
cgroup.subtree_control
cgroup.threads
cgroup.type
cpu.idle
```

## How it works
**4 actors:**
- **Manager (systemd, a container runtime, kubelet, or you with `mkdir`/`echo`)** — its job: create cgroups and write limits, via the cgroup filesystem.
- **cgroup filesystem** — its job: expose the tree and the controller files, via `/sys/fs/cgroup` ✅[^1].
- **Controllers (cpu, memory, pids, io, cpuset, …)** — its job: enforce their resource, via hooks in the scheduler, memory manager, fork path and block layer ✅[^1].
- **Processes** — its job: run; they inherit their parent's cgroup at `fork` and are moved by writing their PID to `cgroup.procs` ✅[^1]; a forked child starts in its parent's cgroup (lab: child of a process in `/inh` showed `0::/inh`) ✅[^3].

```
/sys/fs/cgroup                       (root: controllers listed in cgroup.controllers)
├── cgroup.subtree_control  "+cpu +memory +pids"   ← enables these for children
├── system.slice/            (systemd services)
│   └── nginx.service/       cgroup.procs: 812 813
├── init/                    (lab: where existing processes were moved)
└── box/                     memory.max=67108864  cpu.max="50000 100000"  pids.max=32
     └── cgroup.procs        ← echo <pid> > here moves a whole process (all its threads)
```

1. **Single tree:** unlike v1, v2 uses a single hierarchy for all controllers ✅[^1].
2. **Enabling controllers:** a cgroup's `cgroup.subtree_control` selects which controllers its children get; only cgroups that "don't contain any processes can have domain controllers enabled" there, the root being exempt ✅[^1]. In the lab, violating this returned `write error: Resource busy` (`EBUSY`) ✅[^3].
3. **Membership:** writing a PID to `cgroup.procs` moves that process; one process per `write`; writing any thread's ID moves all its threads ✅[^1].
4. **Enforcement:** each controller applies its files to the group as a whole, every process and thread inside counted together.

**The files you will use** ✅[^1] ✅[^2]:

| File | Format / default | Effect |
|---|---|---|
| `cpu.max` | `"<quota µs> <period µs>"`, default `max 100000` | Hard ceiling: the group's threads are throttled once the quota for the period is used |
| `cpu.weight` | 1–10000, default 100 | Share of CPU under contention, relative to siblings |
| `cpu.stat` | counters | `usage_usec`, `nr_periods`, `nr_throttled`, `throttled_usec` |
| `memory.max` | bytes or `max` | Hard limit; if usage cannot be reduced, the OOM killer runs in the cgroup |
| `memory.high` | bytes or `max` | Soft limit: throttling and reclaim pressure, no OOM kill |
| `memory.events` | counters | `low`, `high`, `max`, `oom`, `oom_kill`, `oom_group_kill` |
| `memory.current` / `memory.peak` | bytes | Current and highest usage |
| `pids.max` | number or `max` | `fork`/`clone` beyond it fails with `EAGAIN` |
| `io.max` | per device | Bandwidth / IOPS limits |
| `cgroup.kill` | write `1` | Kill every process in the cgroup |

## Worked example
Three limits tested in the lab, each in a fresh cgroup (Linux 6.17.8, 2026-11-04) ✅[^3]:

**CPU quota at 20%:**
```console
# mkdir /sys/fs/cgroup/cpudemo; echo "20000 100000" > /sys/fs/cgroup/cpudemo/cpu.max
# sh -c 'echo $$ > /sys/fs/cgroup/cpudemo/cgroup.procs; timeout 2 sh -c "while :; do :; done"'
# grep -E 'usage_usec|nr_periods|nr_throttled|throttled_usec' /sys/fs/cgroup/cpudemo/cpu.stat
usage_usec 413351        # 0.41 s of CPU in ~2.1 s of wall time ≈ 20%
nr_periods 21
nr_throttled 20          # throttled in 20 of 21 periods: a busy loop always hits the quota
throttled_usec 1602360
```

**Process limit of 3:**
```console
# mkdir /sys/fs/cgroup/pdemo; echo 3 > /sys/fs/cgroup/pdemo/pids.max
# sh -c 'echo $$ > /sys/fs/cgroup/pdemo/cgroup.procs; for i in 1 2 3 4; do sleep 1 & done; wait'
sh: can't fork: Resource temporarily unavailable      # EAGAIN
# cat /sys/fs/cgroup/pdemo/pids.events
max 1
```

**Memory limit of 50 MiB:** the process was OOM-killed (exit 137), `memory.events` showed `oom_kill 1` and `memory.peak` was exactly 52428800; the full run is in `memory/oom-killer.md`.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Enabling controllers in a cgroup that has processes | `EBUSY` | No internal process rule ✅[^1] ✅[^3] |
| `cpu.max` set, machine idle | Still throttled at the quota | `cpu.max` is a ceiling, not a share ✅[^2] |
| `cpu.weight` only, machine idle | Group may use all idle CPU | Weights matter only under contention ✅[^1] |
| Fork bomb in a container with `pids.max` | Contained; forks fail with `EAGAIN` | ✅[^1] |
| Host on cgroup v1 (`/sys/fs/cgroup/memory/…` directories) | Different files (`memory.limit_in_bytes`, `cpu.cfs_quota_us`) | v1 has one hierarchy per controller ✅[^1] |
| Tool reads host CPU count inside a limited container | Over-sizes thread pools | The quota is only in `cpu.max` ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `cpu.max` (quota) | Hard, predictable ceiling | Throttling latency for bursty or many-threaded work |
| `cpu.weight` only | Uses idle CPU, no throttling | No upper bound |
| `memory.max` only | Hard protection for neighbours | Sudden OOM kills |
| `memory.high` + `memory.max` | Early slowdown before the kill | More tuning |

## Takeaways
- Read limits from the cgroup files (`cat /proc/<pid>/cgroup`, then the files in that directory) rather than trusting the orchestrator's view.
- Prefer weights for sharing and quotas only where a hard ceiling is required.
- Set `pids.max` on every untrusted workload to contain fork bombs. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: single hierarchy, `subtree_control`, no internal process rule, `cgroup.procs` migration, `cpu.weight` default and range, `memory.max`/`memory.high`/`memory.events`, `pids.max` `EAGAIN`, `cpu.max` default. [^1]
- [CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html) — Linux kernel documentation, living. Backs: quota/period semantics and throttling. [^2]
- `linux/lab-setup.md` — the lab where the cgroup files, `EBUSY`, CPU throttling and `pids.max` runs were captured on 2026-11-04. [^3]
- `linux/containers/container-from-primitives-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `kubernetes/cpu-limits-and-throttling.md` — CPU quota in Kubernetes terms, measured.
- `linux/memory/oom-killer.md` — the memory controller's OOM path.
- `linux/system-management/systemd-services.md` — systemd slices and per-service cgroups.
