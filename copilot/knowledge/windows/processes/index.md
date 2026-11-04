---
schema: topic-index/v1
kind: subtopic
topic: windows/processes
last-updated: 2026-11-04
---

# Windows processes and scheduling

Processes, threads, handles and job objects (and why there is no fork), and the 0–31 priority scheduler with priority classes, base and dynamic priorities and boosts. Not covered: fibers and user-mode scheduling in depth.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [processes-threads-and-handles.md](processes-threads-and-handles.md) | concept | A Windows **process** is a container of resources — virtual address space, code, open **handles** to kernel objects, a security context (access token), a process ID, environment, priority class and working-set limits — with at least one **thread**; threads are what the scheduler runs | verified |
| [scheduling-and-priorities.md](scheduling-and-priorities.md) | concept | Windows schedules **threads**, not processes, by a priority from 0 to 31 (0 is reserved for the zero-page thread) | verified |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.

## Related
- `windows/learning-path.md` — where this subtopic sits in the learning order.
- `linux/` — the Linux counterpart of each Windows mechanism.
