---
schema: topic-index/v1
kind: subtopic
topic: linux/processes
last-updated: 2026-11-04
---

# Processes

How processes are created, replaced, reaped and stopped (fork, exec, wait, zombies, signals, exit codes), how the scheduler shares CPUs (EEVDF, nice, real-time policies, load average), and how local processes communicate (pipes, UNIX sockets, shared memory). Not covered: cgroup CPU limits (see `containers/` and `kubernetes/`).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [process-lifecycle.md](process-lifecycle.md) | concept | A new program starts in two steps: **fork** copies the current process (cheaply, with copy-on-write memory), then **execve** replaces the copy's program with a new one while keeping its PID and open files | verified |
| [signals.md](signals.md) | concept | A signal is a small numbered notification the kernel delivers to a process: "stop", "reload", "your child died", "you touched bad memory" | verified |
| [cpu-scheduling.md](cpu-scheduling.md) | concept | The scheduler decides which runnable thread runs on each CPU and for how long | verified |
| [ipc-pipes-sockets-shm.md](ipc-pipes-sockets-shm.md) | concept | Processes on one machine talk through kernel objects that look like files | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
