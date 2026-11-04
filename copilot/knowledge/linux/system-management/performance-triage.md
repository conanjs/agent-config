---
schema: knowledge-doc/v1
type: how-to
topic: linux/system-management
status: verified
applies-to: ["Linux ≥ 5.x", "procps-ng", "sysstat ≥ 12"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, performance, triage, use-method, vmstat, mpstat, pidstat, iostat, incident, cgroups]
---

# Triage a slow Linux host or container in ten minutes

## Summary
**TL;DR:** Run a fixed sequence of read-only commands that walks every resource with the USE method (utilization, saturation, errors): load and kernel messages first, then CPU (system-wide, per CPU, per process), memory, disk, network, and finally the cgroup limits of the container involved. Each step either rules a resource out or points at the next doc to read.
**Use this when:** "the server/service is slow" and you need a first diagnosis before changing anything.
**Not this doc:** what each tool and file means in detail → `system-management/observability-tools.md`.

## Goal & prerequisites
**End state:** you can name the saturated or failing resource (CPU, CPU quota, memory, disk, network or none of them) with evidence from command output.

**Needs:**
- A shell on the host (or `nsenter` into the container's namespaces), root for some files.
- `procps-ng` (`uptime`, `vmstat`, `free`, `ps`), `sysstat` (`mpstat`, `pidstat`, `iostat`, `sar`), `iproute2` (`ip`, `ss`).
- Know the process or container you suspect, and its PID.

## Steps
1. **Load and recent kernel messages.**
   ```console
   $ uptime
   $ dmesg -T | tail -30          # or: journalctl -k -n 30
   ```
   Load counts runnable **and** `D`-state threads ✅[^2]; it is a damped average and lags behind a sudden change ✅[^3]. In `dmesg`, look for "Out of memory", "Killed process", I/O errors, "link down", "nf_conntrack: table full".

2. **CPU, system-wide.**
   ```console
   $ vmstat 1 5
   ```
   `r` larger than the CPU count = CPU saturation; `si`/`so` > 0 = swapping; `wa` high = waiting on I/O; `st` high = the hypervisor is taking CPU ✅[^1].

3. **CPU, per CPU.**
   ```console
   $ mpstat -P ALL 1 3
   ```
   One CPU at 100% (often in `%soft` or `%sys`) while others idle = a single-threaded or single-queue bottleneck ✅[^1].

4. **CPU, per process.**
   ```console
   $ pidstat 1 5
   ```
   `%CPU` per process; `%wait` = time runnable but not running (waiting for a CPU or a CPU quota) ✅[^7].

5. **Memory.**
   ```console
   $ free -m
   $ grep -E 'MemAvailable|Dirty|Committed_AS' /proc/meminfo
   ```
   Judge by `available`, not `free` ✅[^4]. Swap activity (step 2) plus low available = memory pressure.

6. **Disk.**
   ```console
   $ iostat -xz 1 3
   ```
   `%util` high **and** `aqu-sz` > 1 with high `r_await`/`w_await` = saturated device ✅[^1].

7. **Network.**
   ```console
   $ ip -s link
   $ ss -s
   $ ss -tan state close-wait | wc -l
   $ nstat -az | grep -Ei 'retrans|drop|overflow'
   ```
   Errors/drops on the interface, retransmits, listen overflows, or a growing `CLOSE-WAIT` count.

8. **The container's cgroup limits** (if the slow thing runs in a container).
   ```console
   $ cat /proc/<pid>/cgroup                              # → 0::/<path>
   $ cd /sys/fs/cgroup/<path>
   $ cat cpu.max cpu.stat memory.max memory.current memory.events pids.max
   ```
   `nr_throttled / nr_periods` near 100% = CPU quota is the limit; `memory.events` `oom_kill` > 0 = OOM kills; `memory.current` near `memory.max` = reclaim pressure inside the cgroup ✅[^5].

9. **Write down the verdict** with the line of output that proves it, then open the matching concept doc (see Troubleshooting).

## Verify
A run in the lab: three busy-loop threads in a container limited to 2 CPUs (`--cpus=2`) on an 8-CPU VM (Linux 6.17.8, 2026-11-04) ✅[^6]. Expected readings when the CPU **quota** is the bottleneck:

```console
$ vmstat 1 3
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 6  0      0 7680912    164 221868    0    0   273    71   78    0  0  0 100  0  0  0   # since-boot average: ignore
 3  0      0 7680912    164 221868    0    0     0     0 2179  210 25  0 75  0  0  0   # 3 runnable, host 75% idle
$ pidstat 1 1
      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command
        0         7   67.33    0.00    0.00   32.67   67.33     1  sh
        0         8   66.34    0.00    0.00   33.66   66.34     4  sh
        0         9   66.34    0.00    0.00   32.67   66.34     5  sh
$ grep -E 'nr_periods|nr_throttled' /sys/fs/cgroup/cpu.stat; cat /sys/fs/cgroup/cpu.max; nproc
nr_periods 51
nr_throttled 50            # throttled in 50 of 51 periods
200000 100000              # quota: 2 CPUs
8                          # nproc still reports the host's 8 CPUs
```
Reading: three threads share a 2-CPU budget, so each gets ≈ 67% and waits ≈ 33% — while the host is 75% idle. The verdict is "CPU quota", not "CPU". `nproc` showing 8 is the trap that makes apps start too many threads.

## Troubleshooting
| Symptom in the run | Likely cause | Next |
|---|---|---|
| High load, low CPU use, many `D` threads | Disk or NFS waits | `processes/cpu-scheduling.md` (load), `storage/block-io-and-durability.md` |
| `r` > CPUs, `us`+`sy` near 100% | CPU saturated | `processes/cpu-scheduling.md` |
| Host idle, process `%wait` high, `nr_throttled` high | cgroup CPU quota | `kubernetes/cpu-limits-and-throttling.md`, `containers/cgroups-v2.md` |
| One CPU at 100% `%soft` | Network interrupts on one queue | `networking/packet-path.md` |
| `si`/`so` > 0, `available` low | Memory pressure, swapping | `memory/page-cache-and-reclaim.md` |
| Exit 137, `oom_kill` in `memory.events` or "Killed process" in `dmesg` | OOM kill | `memory/oom-killer.md` |
| `%util` 100, `aqu-sz` high | Disk saturated | `storage/block-io-and-durability.md` |
| Retransmits, drops, listen overflows | Network or backlog | `networking/tcp-connection-lifecycle.md` |
| Growing `CLOSE-WAIT` | App does not close sockets | `networking/tcp-connection-lifecycle.md` |
| Nothing saturated | Lock contention or the app itself | profile with `perf` / `strace -c`; see `system-management/observability-tools.md` |

## Takeaways
- Run the same read-only sequence every time and write down the output line that proves the verdict.
- Check the container's cgroup files before concluding that a host resource is saturated.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [The USE Method: Linux Performance Checklist](https://www.brendangregg.com/USEmethod/use-linux.html) — Brendan Gregg, living. Backs: which column of `vmstat`, `mpstat`, `iostat` shows utilization and saturation. [^1]
- [proc_loadavg(5)](https://man7.org/linux/man-pages/man5/proc_loadavg.5.html) — Linux man-pages project, living. Backs: load counts `R` and `D`. [^2]
- [Linux Load Averages: Solving the Mystery](https://www.brendangregg.com/blog/2017-08-08/linux-load-averages.html) — Brendan Gregg, 2017. Backs: damped averages lag. [^3]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: `MemAvailable` is the estimate to use. [^4]
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `cpu.stat`, `memory.events` fields. [^5]
- `linux/lab-setup.md` — the lab where the Verify output was captured on 2026-11-04. [^6]
- [pidstat(1)](https://man7.org/linux/man-pages/man1/pidstat.1.html) — sysstat via Linux man-pages, living. Backs: `%wait`, the share of CPU time the task spent waiting to run. [^7]

## Related
- `linux/system-management/observability-tools.md` — the full tool catalog.
- `linux/learning-path.md` — where triage sits in the learning order.
