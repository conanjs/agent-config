---
schema: knowledge-doc/v1
type: concept
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.6 (all 8 namespace types)"]
derived-from: [linux/containers/container-from-primitives-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, namespaces, pid-namespace, mount-namespace, network-namespace, user-namespace, unshare, setns, nsenter]
---

# Linux namespaces

## Summary
**TL;DR:** A namespace wraps one kind of global resource so that processes inside it get their own private copy: their own PID numbers, mount table, network stack, hostname, IPC objects, user IDs, cgroup root or clocks. Linux has eight types. They are created with `clone`/`unshare`, joined with `setns` (what `nsenter` and `docker exec` use), identified by the inode in `/proc/<pid>/ns/<type>`, and destroyed when the last process leaves (unless something pins them). Namespaces control what a process can **see**, not how much it can **use** (that is cgroups).
**Use this when:** you need to explain container isolation, debug "why does `ps` show the host's processes", enter a container's network with `nsenter`, or reason about PID 1 or user-namespace (rootless) behaviour.
**Not this doc:** the whole container build with every mechanism → `containers/container-from-primitives-deep-dive.md`; resource limits → `containers/cgroups-v2.md`.

## Problem
"Containers are isolated" is vague. In practice you need to know exactly what is private (PIDs, hostname, interfaces) and what is shared (the kernel, the clock unless a time namespace is used, kernel keyrings), and why tools give misleading answers when a namespace is half set up.

## Mental model
**Analogy:** tinted glasses, one pair per resource. A process wearing "PID glasses" sees only its group's processes and numbers them from 1. "Network glasses" show a different set of interfaces. Each pair can be worn independently, so a process can share the host's network but have its own hostname. Everyone is still standing in the same room (one kernel).

**Artifact:** a process's namespace handles (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
$ ls -l /proc/self/ns
lrwxrwxrwx 1 root root 0 Nov  4 04:40 cgroup -> cgroup:[4026532636]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 ipc -> ipc:[4026532634]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 mnt -> mnt:[4026532632]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 net -> net:[4026532637]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 pid -> pid:[4026532635]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 pid_for_children -> pid:[4026532635]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 time -> time:[4026531834]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 time_for_children -> time:[4026531834]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 user -> user:[4026531837]
lrwxrwxrwx 1 root root 0 Nov  4 04:40 uts -> uts:[4026532633]
```
Same inode number = same namespace ✅[^1]. Here `time` and `user` have low numbers shared with the host (Docker did not create those), the other six are the container's own.

## How it works
**3 actors:**
- **Calling process** — its job: request new or existing namespaces, via `clone(2)` with `CLONE_NEW*` flags, `unshare(2)`, or `setns(2)` ✅[^1].
- **Kernel** — its job: give the process a new or shared instance of each resource, via per-namespace kernel objects referenced from the task ✅[^1].
- **Namespace handle files** — its job: identify and pin namespaces, via `/proc/<pid>/ns/*` symlinks that can be opened, bind-mounted and passed to `setns` ✅[^1].

**The eight types** ✅[^1]:

| Namespace | Flag | Isolates | `/proc/<pid>/ns` handle since |
|---|---|---|---|
| Mount | `CLONE_NEWNS` | Mount points (what `/` and every mount look like) | 3.8 |
| UTS | `CLONE_NEWUTS` | Hostname and NIS domain name | 3.0 |
| IPC | `CLONE_NEWIPC` | System V IPC, POSIX message queues | 3.0 |
| PID | `CLONE_NEWPID` | Process IDs | 3.8 |
| Network | `CLONE_NEWNET` | Network devices, stacks, ports, routing, firewall | 3.0 |
| User | `CLONE_NEWUSER` | User and group IDs, capabilities | 3.8 |
| Cgroup | `CLONE_NEWCGROUP` | The cgroup root a process sees | 4.6 |
| Time | `CLONE_NEWTIME` | Boot-time and monotonic clocks | 5.6 |

1. **Create:** `clone(CLONE_NEW…)` creates the namespace and puts the new child in it; `unshare(CLONE_NEW…)` moves the caller into new namespaces ✅[^1]. Creating namespaces generally needs `CAP_SYS_ADMIN`; user namespaces need no privilege since Linux 3.8 ✅[^1].
2. **PID is special:** the PID and time entries of the caller never change; `pid_for_children` shows where future children go ✅[^1]. That is why `unshare --pid` needs `--fork`.
3. **Join:** `setns(fd)` with a descriptor for a `/proc/<pid>/ns/<type>` file joins that existing namespace ✅[^1]. `nsenter -t <pid> -n` does exactly this ✅[^6].
4. **Teardown:** a namespace dies when its last process exits, unless pinned by an open handle or bind mount, a child PID/user namespace, a user namespace that owns other namespaces, or a proc/mqueue mount ✅[^1]. `ip netns add` works by bind-mounting a network namespace handle under `/run/netns` ✅[^7].

**PID namespace rules** ✅[^2]:
- Its first process is PID 1 and acts as init: orphans are re-parented to it.
- Processes inside can only send it signals it has a handler for; from the parent namespace, `SIGKILL` and `SIGSTOP` always get through.
- If it exits, every process in the namespace gets `SIGKILL`.
- A process has one PID per level of nesting (up to 32 levels) and can see only its own and descendant namespaces.
- `/proc` shows the PID namespace of whoever mounted it, so mount a new one inside.

**User namespace rules** ✅[^3]:
- `uid_map` lines are `inside-ID outside-ID length`, written once.
- The creator gets **all** capabilities inside, **none** in the parent namespace.
- Those capabilities only work on resources owned by that namespace; changing the clock, loading modules or creating devices still needs privilege in the initial namespace.
- Nesting is limited to 32 levels.

## Worked example
Four namespaces tried one at a time in the lab (Linux 6.17.8, 2026-11-04) ✅[^4]:

```console
$ unshare --pid --fork --mount-proc sh -c 'echo "inside pid=$$"; ps -o pid,ppid,comm'
inside pid=1
    PID    PPID COMMAND
      1       0 ps                  # only this namespace's processes are visible
$ unshare --uts sh -c 'hostname box1; hostname'; echo "outside: $(hostname)"
box1
outside: 38725a9503ba               # hostname change did not leak out
$ readlink /proc/self/ns/net; unshare --net readlink /proc/self/ns/net
net:[4026532637]
net:[4026532766]                    # a different network namespace …
$ unshare --net ip -br link
lo               DOWN           00:00:00:00:00:00 <LOOPBACK>   # … with only a loopback, down
$ unshare --user --map-root-user sh -c 'id; cat /proc/self/uid_map'
uid=0(root) gid=0(root) groups=0(root),65534(nobody)
         0          0          1    # inside UID 0 ↔ outside UID 0, range 1
```
In the last line the outside UID is 0 only because the lab runs as root; an unprivileged user running the same command would see `0 1000 1`, i.e. "root inside" = UID 1000 outside ✅[^4] (lab: as UID 1000, `uid_map` read `0 1000 1`).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `unshare --pid sh` without `--fork` | The shell stays in the old PID namespace; its first child becomes PID 1 | The caller's PID namespace never changes ✅[^1] |
| New PID namespace but host `/proc` | `ps` shows host processes | `/proc` reflects the mounter's namespace ✅[^2] |
| `unshare` inside a default Docker container | `Operation not permitted` | No `CAP_SYS_ADMIN`; seccomp blocks it ✅[^4] ✅[^5] |
| Container PID 1 exits | All its processes are killed | Namespace init exit → `SIGKILL` to all ✅[^2] |
| Network namespace with no processes left | Gone, unless pinned (e.g. `/run/netns/<name>`) | Teardown rules ✅[^1] |
| Root in a user namespace tries to load a kernel module | Denied | Global resources need initial-namespace privilege ✅[^3] |
| Kernel keyring, the kernel itself | Shared with the host | Not namespaced ✅[^5] |
| `/proc/sys` | Partly per namespace: `net.*` sysctls are per network namespace, `vm.*` is global | Lab: `somaxconn` set to 128 inside a new netns stayed 4096 outside; `vm.drop_caches` was writable from inside ✅[^4] |

## Takeaways
- Prove isolation by comparing `/proc/<pid>/ns/*` inodes between the host and the container.
- Debug inside a container's namespaces from the host with `nsenter -t <pid> -n -m -p` instead of installing tools in the image.
- Namespaces hide; they do not limit. Pair them with cgroups and privilege reduction.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 26 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) — Linux man-pages project, living. Backs: types, flags, handle versions, `clone`/`unshare`/`setns`, privileges, `pid_for_children`, identity by inode, teardown and pinning. [^1]
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) — Linux man-pages project, living. Backs: PID 1 duties and signal rules, kill-all on init exit, nesting, `/proc`. [^2]
- [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html) — Linux man-pages project, living. Backs: `uid_map` format, capabilities inside only, global resources, nesting limit. [^3]
- `linux/lab-setup.md` — the lab where every `unshare` run and the namespace handles were captured on 2026-11-04. [^4]
- [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) — Docker, living. Backs: `unshare` blocked by default; keyrings not namespaced. [^5]
- `linux/containers/container-from-primitives-deep-dive.md` — the deep dive this doc was distilled from.
- [nsenter(1)](https://man7.org/linux/man-pages/man1/nsenter.1.html) — util-linux via Linux man-pages, living. Backs: runs a program in the namespaces of another process. [^6]
- [ip-netns(8)](https://man7.org/linux/man-pages/man8/ip-netns.8.html) — iproute2 via Linux man-pages, living. Backs: named network namespaces are files under `/var/run/netns/NAME` that can be opened. [^7]

## Related
- `linux/containers/container-from-primitives-deep-dive.md` — namespaces combined with every other mechanism.
- `linux/processes/signals.md` — PID 1 and signals.
- `linux/containers/container-isolation.md` — user namespaces as a security boundary.
