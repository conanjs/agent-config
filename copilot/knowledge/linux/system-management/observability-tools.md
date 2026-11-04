---
schema: knowledge-doc/v1
type: reference
topic: linux/system-management
status: verified
applies-to: ["Linux ≥ 5.x", "procps-ng, sysstat, iproute2, util-linux, strace"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, observability, use-method, proc, vmstat, iostat, mpstat, pidstat, ss, strace, perf, bpftrace]
---

# Linux observability tools by resource

## Summary
**TL;DR:** A lookup table of which command or `/proc`/`/sys` file answers which question, organized by resource (CPU, memory, network, storage) and by the USE method's utilization, saturation and errors, plus process-level views, network detail and tracing tools.
**Use this when:** you know what you want to measure but not which tool or file shows it.
**Not this doc:** the order to run them in during an incident → `system-management/performance-triage.md`.

## Scope
Which command or file answers which question, grouped by resource and by the USE method's three questions: **U**tilization (how busy), **S**aturation (how much extra work is queued), **E**rrors ✅[^1]. Tools are from procps-ng, sysstat, iproute2, util-linux, strace and the kernel's `/proc`/`/sys` files. Column meanings for `/proc` files come from the kernel docs ✅[^3]. Runs on any current distribution; `perf` and `bpftrace` need extra packages and privileges.

## Catalog

### USE checklist ✅[^2]

| Resource | Utilization | Saturation | Errors |
|---|---|---|---|
| CPU | `mpstat -P ALL 1` (per CPU), `vmstat 1` (`us`+`sy`+`st`), `pidstat 1` (`%CPU` per process) | `vmstat 1` `r` vs CPU count (on Linux `r` includes running threads), `sar -q` (`runq-sz`), `perf sched latency` | `perf` CPU error events, where supported |
| Memory | `free -m`, `vmstat 1` (`free`), `sar -r` | `vmstat 1` `si`/`so` (swap in/out), `sar -B` (page scanning), `dmesg \| grep -i killed` (OOM) | `dmesg` for hardware errors |
| Network | `sar -n DEV 1` (rx/tx KB/s vs link speed), `ip -s link` | `netstat -s` / `nstat` (retransmits), `sar -n EDEV` (drops), `/proc/net/dev` drop column | `ip -s link` errors, `sar -n EDEV` `rxerr/s` `txerr/s` |
| Storage | `iostat -xz 1` (`%util`), `pidstat -d 1` | `iostat -xz 1` (`aqu-sz` > 1, high `await`) | `/sys/block/<dev>/device/ioerr_cnt`, `smartctl`, `dmesg` |

### Process-level views

| Question | Command / file | Notes |
|---|---|---|
| What is running, by CPU or memory | `top`, `htop`, `ps -eo pid,ppid,stat,%cpu,%mem,rss,comm --sort=-%cpu` | `STAT` letters: R, S, D, Z, T ✅[^3] |
| One process's state, memory, threads, capabilities, signals | `/proc/<pid>/status` | `VmRSS`, `Threads`, `CapEff`, `SigCgt`, `Seccomp` ✅[^4] |
| Its memory map | `/proc/<pid>/maps`, `/proc/<pid>/smaps_rollup` | `smaps_rollup` gives PSS (shared pages divided fairly) ✅[^7] |
| Its open files and sockets | `ls -l /proc/<pid>/fd`, `lsof -p <pid>` | Shows `(deleted)` files still holding space |
| Its namespaces and cgroup | `ls -l /proc/<pid>/ns`, `cat /proc/<pid>/cgroup` | Compare inode numbers between processes |
| Its system calls | `strace -f -p <pid>`, `strace -c <cmd>` | Uses ptrace; slows the target |
| Kernel stack of a stuck (`D`) task | `cat /proc/<pid>/stack` (root) | Shows where in the kernel it waits ✅[^8] |
| Process tree | `ps -ejH`, `pstree -p` | Who is whose parent (zombies, orphans) |

### System-wide files

| File | Holds |
|---|---|
| `/proc/loadavg` | 1/5/15-minute load (runnable + `D`), runnable/total entities, last PID ✅[^5] |
| `/proc/meminfo` | `MemTotal`, `MemAvailable`, `Cached`, `Dirty`, `AnonPages`, `Committed_AS`, `CommitLimit` ✅[^3] |
| `/proc/pressure/{cpu,memory,io}` | Pressure stall information (share of time tasks waited on the resource), if the kernel has PSI enabled ✅[^9] (absent on the lab kernel ✅[^6]) |
| `/proc/net/dev`, `/proc/net/snmp` | Per-interface and per-protocol counters |
| `/sys/fs/cgroup/<path>/{cpu.stat,memory.events,memory.current,pids.current}` | Per-cgroup usage, throttling, OOM events |
| `/proc/sys/...` | Tunables (`sysctl -a` lists them) |

### Network detail

| Question | Command |
|---|---|
| Sockets, states, queues | `ss -tanp` (TCP), `ss -uanp` (UDP), `ss -ltn` (listeners: `Recv-Q` = queued, `Send-Q` = backlog limit) |
| Per-socket memory and TCP internals | `ss -tim` |
| Addresses, links, routes | `ip -br addr`, `ip -s link`, `ip route`, `ip -n <netns> …` |
| Firewall / NAT state | `nft list ruleset`, `iptables -t nat -S`, `conntrack -L` |
| Packets on the wire | `tcpdump -ni <dev> port 443` |

### Tracing and profiling

| Tool | Answers | Cost |
|---|---|---|
| `strace` | Which system calls, with arguments, results and time | High per call (ptrace) |
| `perf top`, `perf record -g` + `perf report` | Where CPU time goes, including kernel functions | Low to moderate (sampling) |
| `perf stat` | Hardware counters: cycles, instructions, cache misses | Low |
| `bpftrace`, BCC tools (`execsnoop`, `opensnoop`, `biolatency`, `tcpretrans`) | Custom kernel/user tracing with eBPF | Needs privilege and BPF support (see `linux/system-management/ebpf-tracing.md`) |

## Lookup notes
- `vmstat`'s first line is an average since boot; read from the second line on ✅[^10].
- Load average counts `D`-state tasks, so it is not a CPU-only metric ✅[^5].
- `%util` near 100 does not prove saturation on devices that serve requests in parallel (NVMe, RAID); check `aqu-sz` and `await` ✅[^11].
- Inside a container, `/proc/meminfo` and `nproc` may show the **host's** totals; the container's limits are in its cgroup files ✅[^6] (lab: with `--memory=256m --cpus=2`, `MemTotal` showed the VM's 8 GB and `nproc` 8, while `memory.max` was 268435456).
- `vmstat`/`mpstat`/`iostat`/`pidstat`/`sar` come from the sysstat and procps packages; minimal images lack them, so run them from the host or a debug container with `nsenter`.

## Takeaways
- For every resource, check utilization, saturation and errors, not utilization alone.
- Inside containers, read limits from the cgroup files; `nproc` and `/proc/meminfo` may show the host.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [The USE Method](https://www.brendangregg.com/usemethod.html) — Brendan Gregg, living. Backs: utilization, saturation, errors definitions. [^1]
- [The USE Method: Linux Performance Checklist](https://www.brendangregg.com/USEmethod/use-linux.html) — Brendan Gregg, living. Backs: the per-resource tool table, `vmstat r` includes running threads. [^2]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: state letters, `/proc/meminfo` fields. [^3]
- [proc_pid_status(5)](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html) — Linux man-pages project, living. Backs: `/proc/<pid>/status` fields. [^4]
- [proc_loadavg(5)](https://man7.org/linux/man-pages/man5/proc_loadavg.5.html) — Linux man-pages project, living. Backs: load average fields. [^5]
- `linux/lab-setup.md` — the lab where `/proc/pressure` was found absent (Linux 6.17.8, OrbStack, 2026-11-04). [^6]
- [perf wiki](https://perfwiki.github.io/main/) — perf project, living. Backs: further reading on `perf`.
- [bpftrace](https://github.com/bpftrace/bpftrace) — bpftrace project, living. Backs: further reading on eBPF tracing.
- [proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) — Linux man-pages project, living. Backs: `Pss`, the process's proportional share of a mapping. [^7]
- [proc_pid_stack(5)](https://man7.org/linux/man-pages/man5/proc_pid_stack.5.html) — Linux man-pages project, living. Backs: symbolic trace of the function calls in the task's kernel stack. [^8]
- [PSI - Pressure Stall Information](https://docs.kernel.org/accounting/psi.html) — Linux kernel documentation, living. Backs: the "some"/"full" lines are shares of time tasks were stalled on a resource. [^9]
- [vmstat(8)](https://man7.org/linux/man-pages/man8/vmstat.8.html) — procps via Linux man-pages, living. Backs: the first report gives averages since the last reboot. [^10]
- [iostat(1)](https://man7.org/linux/man-pages/man1/iostat.1.html) — sysstat via Linux man-pages, living. Backs: for devices serving requests in parallel, `%util` does not reflect their performance limits. [^11]

## Related
- `linux/system-management/performance-triage.md` — these tools in a fixed order for an incident.
- `linux/fundamentals/filesystem-hierarchy.md` — what `/proc` and `/sys` are.
