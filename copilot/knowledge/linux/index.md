---
schema: topic-index/v1
kind: topic
topic: linux
last-updated: 2026-11-04
---

# Linux operating system

How the Linux kernel and the user space around it work, from the system-call boundary up to containers: processes and scheduling, memory, files and storage, networking, containers built from kernel primitives, and running and observing a system. Every mechanism is explained with an analogy, a real artifact captured on Linux 6.17.8, the step-by-step mechanism and an edge-case table, with claims marked verified or unverified against kernel.org and man7.org. Start with `learning-path.md`. Not covered: Kubernetes-specific behaviour (see `kubernetes/`), Windows (see `windows/`), distribution package management, shell scripting.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Six stages from the kernel boundary to containers, with docs, a lab exercise and a self-check per stage, plus topics not covered yet | verified |
| [lab-setup.md](lab-setup.md) | how-to | A disposable privileged Alpine container on OrbStack/Docker as a Linux kernel lab; the source of every captured output | verified |

## Subtopics
| Subtopic | Summary |
|---|---|
| [fundamentals/](fundamentals/index.md) | System calls and the vDSO, the filesystem hierarchy and `/proc` `/sys` `/dev`, users, groups, permission checks and setuid, the boot relay from firmware to systemd, kernel modules and udev, KVM virtualization vs containers |
| [processes/](processes/index.md) | fork/exec/wait, zombies and orphans, process states, signals and graceful shutdown, EEVDF scheduling, nice, real-time policies, load average, IPC with pipes, UNIX sockets and shared memory |
| [memory/](memory/index.md) | Virtual memory, page tables, VSZ vs RSS, overcommit, huge pages; page cache, writeback, reclaim and swap; the OOM killer at system and cgroup scope |
| [storage/](storage/index.md) | VFS objects, inodes, open file descriptions and descriptors, deleted-but-open files; blk-mq, I/O schedulers and `fsync` durability; ext4 layout and journaling, LVM and device-mapper |
| [networking/](networking/index.md) | The packet path (NAPI, RSS/RPS, socket buffers), netfilter hooks, iptables/nftables, NAT and conntrack, TCP states, backlog and TIME-WAIT, epoll and io_uring event loops |
| [containers/](containers/index.md) | A container built by hand (deep dive), namespaces, cgroups v2, overlayfs layers, veth/bridge/NAT networking, capabilities, seccomp and user namespaces |
| [security/](security/index.md) | Linux Security Modules: SELinux, AppArmor, Yama, Landlock self-sandboxing, the BPF LSM |
| [system-management/](system-management/index.md) | systemd units, dependencies and resource control, an observability tool catalog by resource, a ten-minute triage procedure, eBPF tracing with bpftrace |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `kubernetes/` — container CPU and memory limits seen from Kubernetes, building on `linux/containers/`.
- `concurrency/` — threads and shared state from the language side.
