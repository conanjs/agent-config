---
schema: topic-index/v1
kind: subtopic
topic: linux/system-management
last-updated: 2026-11-04
---

# System management and observability

Running a Linux system: systemd units, dependencies and per-service cgroups; the observability tool catalog by resource (USE method); a ten-minute triage procedure; and eBPF tracing with bpftrace. Not covered: configuration management, logging pipelines.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [systemd-services.md](systemd-services.md) | concept | systemd (PID 1 on most distributions) manages everything as **units**: services, sockets, timers, mounts, targets, slices and more | verified |
| [observability-tools.md](observability-tools.md) | reference | A lookup table of which command or `/proc`/`/sys` file answers which question, organized by resource (CPU, memory, network, storage) and by the USE method's utilization, saturation and errors, plus process-level views, network detail and tracing tools | verified |
| [performance-triage.md](performance-triage.md) | how-to | Run a fixed sequence of read-only commands that walks every resource with the USE method (utilization, saturation, errors): load and kernel messages first, then CPU (system-wide, per CPU, per process), memory, disk, network, and finally the cgroup limits of the container involved | verified |
| [ebpf-tracing.md](ebpf-tracing.md) | concept | eBPF lets you load small programs into the running kernel and attach them to events — a system call, a tracepoint, a kernel function (kprobe), a network packet (XDP, tc), a cgroup hook or an LSM hook | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
