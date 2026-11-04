---
schema: knowledge-doc/v1
type: reference
topic: linux
status: verified
applies-to: ["Linux ≥ 5.x", "the docs under knowledge/linux/ as of 2026-11-04"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, learning-path, curriculum, roadmap, study-plan]
---

# Linux learning path: from basics to kernel mechanisms

## Summary
**TL;DR:** Six stages, each built on the one before: (1) the kernel/user boundary, the file tree and permissions; (2) processes, signals and scheduling; (3) memory; (4) files and storage; (5) networking; (6) containers, which reuse everything before. Systems management and triage run alongside from stage 2 on. Each stage lists the docs to read, one lab exercise, and a self-check question you should be able to answer before moving on.
**Use this when:** you start learning Linux internals, plan a study schedule, or want to know which doc to read next.
**Not this doc:** the lab itself → `linux/lab-setup.md`.

## Scope
Covers every doc in `knowledge/linux/` and the Kubernetes docs that build on it. Order follows dependencies: a stage only uses ideas from earlier stages. Topics this knowledge base does not cover yet are listed at the end. External resources are free and official.

## Catalog

### Stages

| # | Stage | Read (in order) | Lab exercise (`linux/lab-setup.md`) | Self-check: you can explain … |
|---|---|---|---|---|
| 1 | Foundations | `fundamentals/kernel-and-system-calls.md` → `fundamentals/filesystem-hierarchy.md` → `fundamentals/users-and-permissions.md` → `fundamentals/boot-process.md` → `fundamentals/kernel-modules-and-udev.md` | `strace -c ls /`; `namei -l` on a path; `setpriv --bounding-set=-chown chown …` | … every line of `strace cat file`, and why the owner of a `0040` file cannot read it |
| 2 | Processes | `processes/process-lifecycle.md` → `processes/signals.md` → `processes/cpu-scheduling.md` → `processes/ipc-pipes-sockets-shm.md` | Create a zombie; read `/proc/<pid>/status`; compare exit codes of `kill -TERM` vs `kill -9`; `nice -n 10` | … why a container's PID 1 must reap, what exit 137 means, and why load 8 on 4 CPUs is not proof of CPU saturation |
| 3 | Memory | `memory/virtual-memory.md` → `memory/page-cache-and-reclaim.md` → `memory/oom-killer.md` | Read `/proc/self/maps`; watch `Cached` grow while reading a file; OOM-kill a process in a 50 MiB cgroup | … VSZ vs RSS, why `free` is low on a healthy box, and the two scopes of the OOM killer |
| 4 | Files & storage | `storage/vfs-and-file-descriptors.md` → `storage/block-io-and-durability.md` → `storage/ext4-and-lvm.md` | Hard link vs symlink with `stat`; delete an open file and find it in `/proc/<pid>/fd` | … why disk space does not return after `rm`, and the five calls that make a new file crash-safe |
| 5 | Networking | `networking/packet-path.md` → `networking/netfilter-and-nat.md` → `networking/tcp-connection-lifecycle.md` → `networking/io-multiplexing-epoll-io-uring.md` | Two namespaces + veth + bridge + MASQUERADE; produce `FIN-WAIT-2`/`CLOSE-WAIT` with a short Python script and `ss -tan` | … where DNAT and SNAT happen, and what a growing `CLOSE-WAIT` count says about your code |
| 6 | Containers & isolation | `containers/container-from-primitives-deep-dive.md` → `containers/namespaces.md` → `containers/cgroups-v2.md` → `containers/overlayfs-and-image-layers.md` → `containers/container-networking.md` → `containers/container-isolation.md` → `security/lsm-and-landlock.md` → `fundamentals/kvm-virtualization.md` | Build a container by hand (deep dive §3) | … "a container is just a process" with `/proc/<pid>/ns` inodes, cgroup files, the overlay upper dir, and `CapEff` as evidence |
| ↔ | Operating a system (from stage 2) | `system-management/systemd-services.md` → `system-management/observability-tools.md` → `system-management/performance-triage.md` → `system-management/ebpf-tracing.md` | Run the triage steps against a CPU-limited container (`--cpus=2`, 3 busy threads) | … how to tell "CPU saturated" from "CPU quota throttled" in under ten minutes |
| → | Next: orchestration | `kubernetes/cpu-limits-and-throttling.md` → `kubernetes/memory-limits-and-oom-kill.md` → `kubernetes/container-cpu-memory-limits-deep-dive.md` | Compare `limits.cpu: 1` with `cpu.max` inside a pod | … what `500m` becomes in the kernel |

### Free, authoritative resources per stage

| Stage | Resource | Why |
|---|---|---|
| All | [Linux man-pages](https://man7.org/linux/man-pages/) | The reference for every system call (section 2), file format (5) and overview (7) cited in these docs |
| All | [The Linux kernel documentation](https://docs.kernel.org/) | Kernel-side truth: admin guides, memory, scheduler, networking, filesystems |
| 1 | [The Linux Command Line](https://linuxcommand.org/tlcl.php) (William Shotts, free book) | Shell and everyday commands, if they are new |
| 2, 5 | [man-pages overview pages](https://man7.org/linux/man-pages/dir_section_7.html) (`signal(7)`, `sched(7)`, `tcp(7)`, `namespaces(7)`, `capabilities(7)`) | Mechanism summaries by the man-pages maintainers |
| ↔ | [Brendan Gregg's Linux performance page](https://www.brendangregg.com/linuxperf.html) | Tool maps, USE method, flame graphs |
| 6 | [OCI runtime specification](https://github.com/opencontainers/runtime-spec) | What runc/crun must do with a bundle |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| xfs and btrfs internals, software RAID (md) | `storage/` | `docs.kernel.org/filesystems/`, `docs.kernel.org/admin-guide/md.html` |
| Audit subsystem, IMA/EVM integrity, kernel lockdown | `security/` | `docs.kernel.org/admin-guide/LSM/` |
| XDP and tc programs, eBPF networking (Cilium-style) | `networking/` | `docs.kernel.org/bpf/` |
| Time: clocks, NTP, `timerfd`, time namespaces | `fundamentals/` | `man7.org/linux/man-pages/man7/time.7.html` |
| Threads and futexes, NPTL | `processes/` | `man7.org/linux/man-pages/man7/futex.7.html` |
| Shell scripting, package management | outside internals | distribution docs |

## Lookup notes
- Docs marked `draft` in the topic indexes still carry some claims marked as unverified (the warning sign); treat those as hypotheses until checked.
- All captured outputs come from one kernel (6.17.8) on arm64; numbers such as namespace inodes, PIDs and memory sizes differ on your machine, and some sysctls in the lab VM differ from kernel defaults (each doc says which).

## Takeaways
- Follow the stages in order; each stage only uses ideas from the earlier ones.
- Do the lab exercise and answer the self-check before moving to the next stage.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Linux man-pages project](https://man7.org/linux/man-pages/) — Michael Kerrisk et al., living. Backs: the reference set for stages 1–6.
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: kernel-side references for every stage.
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: the operations stage resources.
- [OCI Runtime Specification](https://github.com/opencontainers/runtime-spec) — Open Container Initiative, living. Backs: stage 6 resources.
- [The Linux Command Line](https://linuxcommand.org/tlcl.php) — William Shotts, living. Backs: stage 1 resources.
- `linux/lab-setup.md` — the lab every exercise runs in.

## Related
- `linux/lab-setup.md` — set up the lab before stage 1.
- `kubernetes/` — the next layer up after stage 6.
