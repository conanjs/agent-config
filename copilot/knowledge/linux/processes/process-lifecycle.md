---
schema: knowledge-doc/v1
type: concept
topic: linux/processes
status: verified
applies-to: ["Linux ≥ 4.x", "glibc ≥ 2.3.3", "musl"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, process, fork, exec, wait, zombie, orphan, threads, clone, task-states]
---

# Process lifecycle: fork, exec, wait and exit

## Summary
**TL;DR:** A new program starts in two steps: **fork** copies the current process (cheaply, with copy-on-write memory), then **execve** replaces the copy's program with a new one while keeping its PID and open files. When a process exits, it stays as a **zombie** until its parent collects the exit status with **wait**; if the parent died first, PID 1 (or a "subreaper") adopts and reaps it. Threads are the same kind of kernel object as processes, created by `clone` with sharing flags.
**Use this when:** you see `Z` / `<defunct>` processes, a container's PID 1 accumulates zombies, you read `ps` states (`R`, `S`, `D`, `Z`, `T`), exit codes like 137 or 143 confuse you, or you need to know what a child inherits.
**Not this doc:** signals and exit codes in depth → `processes/signals.md`; how the CPU is shared → `processes/cpu-scheduling.md`.

## Problem
Shell commands, web servers, container runtimes and CI runners all create processes. Misunderstanding the lifecycle produces real bugs: zombie build-up in containers whose PID 1 does not reap, file descriptors leaking into child programs, deadlocks after forking a multithreaded program, and "process stuck in D state that `kill -9` cannot remove".

## Mental model
**Analogy:** a photocopier and a form. `fork` photocopies the whole filled-in form (the process) — same answers, same attachments (open files) — and gives the copy a new number (PID). `execve` erases the copy's answers and writes a different program on it, but keeps the number and the attachments. When the work is done, the form goes into the parent's in-tray (zombie) until the parent signs it off (`wait`); if the parent has left the company, the head office (PID 1) signs it.

**Artifact:** a real zombie, created and observed in the lab (Linux 6.17.8, 2026-11-04) ✅[^6]:
```console
$ sh -c 'sleep 0.1 & exec sleep 2' &     # parent becomes "sleep 2", which never calls wait()
$ ps -o pid,ppid,stat,comm --ppid $!
    PID    PPID STAT COMMAND
     21      19 Z    sleep                # child exited, parent never reaped it
```

## How it works
**4 actors:**
- **Parent process** — its job: create a child and later collect its status, via `fork()`/`clone()` and `wait()`/`waitpid()`.
- **Child process** — its job: run the new program, via `execve()`, and report a status, via `exit()`.
- **Kernel** — its job: copy or share the task's resources and keep the zombie record, via the process table.
- **PID 1 or a subreaper** — its job: adopt and reap orphans, via `wait()` ✅[^3].

```
 parent (PID 100)
   │ fork()  ── kernel copies task; memory pages shared copy-on-write
   ├──────────────► child (PID 101) — returns 0 here
   │ returns 101         │ execve("/usr/bin/ls", argv, envp)
   │                     │   same PID 101, same fds (unless close-on-exec)
   │                     │   new code, data, heap, stack
   │                     ▼
   │                  exit(0) ─► state Z (zombie): kernel keeps PID + status + usage
   │ waitpid(101) ◄────────────── status collected
   │                  zombie removed, PID 101 free
   ▼
 if parent dies first: child re-parented to PID 1 / subreaper, which reaps it
```

1. **Parent → kernel (`fork`):** the kernel creates a new task. Memory is not copied up front: under Linux "fork() is implemented using copy-on-write pages", so the main cost is copying page tables and a task structure ✅[^1]. Since glibc 2.3.3, `fork()` is a wrapper around the `clone` system call with only `SIGCHLD` as flags ✅[^1].
2. **Kernel → both:** `fork` returns twice — the child's PID in the parent, `0` in the child ✅[^1].
3. **What the child gets:** copies of all file descriptors, which point at the **same** open file descriptions (shared offsets and flags); a copy of memory; the same signal dispositions and mask ✅[^1] ✅[^5]. **What it does not get:** pending signals, timers, memory locks, record locks, resource-usage counters (reset to 0) ✅[^1]. Only the calling thread is copied; in a multithreaded parent the child may only call async-signal-safe functions until `execve` ✅[^1].
4. **Child → kernel (`execve`):** code, data, heap and stack are replaced; the PID, the real UID/GID and every open descriptor not marked close-on-exec are kept; caught signal handlers reset to default; every other thread is destroyed ✅[^2]. On success `execve` does not return ✅[^2]. A file that starts with `#!` makes the kernel run the named interpreter with the script path as an argument ✅[^2].
5. **Child exits:** it becomes a zombie; the kernel keeps only its PID, termination status and resource usage ✅[^3].
6. **Parent → kernel (`wait`):** collects the status; the zombie disappears. `WEXITSTATUS` gives the low 8 bits of the exit code, `WTERMSIG` the signal number if it was killed ✅[^3].
7. **Parent dies first:** its children are adopted by PID 1 or the nearest subreaper (`prctl(PR_SET_CHILD_SUBREAPER)`), which reaps them ✅[^3]. If a parent sets `SIGCHLD` to `SIG_IGN`, its children never become zombies ✅[^3].

**Process states in `ps` / `/proc/<pid>/status`** ✅[^4]:

| State | Meaning | Typical cause |
|---|---|---|
| `R` | Running or runnable (waiting for a CPU) | Doing CPU work |
| `S` | Sleeping, interruptible | Waiting for input, a timer, a socket |
| `D` | Sleeping, uninterruptible | Waiting inside the kernel, often on disk or NFS I/O; signals wait until it returns |
| `T` | Stopped or traced | `Ctrl-Z` (`SIGTSTP`), `SIGSTOP`, a debugger |
| `Z` | Zombie | Exited, not yet reaped |

**Threads are tasks too.** On Linux, a thread is a task created with `clone` flags that share memory, file table and signal handlers with its creator; `ps -L` or `/proc/<pid>/task/` lists them ✅[^10] (lab: a Python process with 3 extra threads had 4 entries in `/proc/<pid>/task/` and 4 `LWP` rows in `ps -L`) ✅[^6]. This is why `/proc/loadavg` counts "kernel scheduling entities (processes, threads)" ✅[^7].

## Worked example
Running `ls` from bash, as the process tree showed in the lab ✅[^6]:

```console
$ bash -c 'echo bash=$$; sleep 1 & ps -o pid,ppid,stat,comm -H'
bash=23
    PID    PPID STAT COMMAND
      1       0 Ss   bash          # container PID 1
     23       1 S      bash        # our shell, waiting
     24      23 R        bash      # forked child, about to exec "sleep"
     25      23 R        ps        # forked child that already exec'd "ps"
```

PID 24 still shows `bash` because the screenshot caught it between `fork` and `execve`: it is a copy of the shell that has not replaced its program yet. PID 25 already finished `execve`, so its command name is `ps`. Both have parent 23, which will `wait` for them.

Exit codes measured on the same lab ✅[^6]:

| How `sleep 30` ended | `$?` in the shell | Decoding |
|---|---|---|
| Normal exit | `0` | `WEXITSTATUS` = 0 |
| `kill -TERM` | `143` | Shell convention 128 + 15 (`SIGTERM`) |
| `kill -9` | `137` | 128 + 9 (`SIGKILL`); also what an OOM kill looks like |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Container whose PID 1 is your app and it never calls `wait` | Zombies pile up until PIDs run out | Orphans are re-parented to the namespace's PID 1 ✅[^3] ✅[^8] |
| `kill -9` on a process in `D` state | It stays until the kernel operation returns | Uninterruptible sleep does not take signals ✅[^6] (lab: `dd` reading a suspended device-mapper device stayed `D` after `kill -9`, and vanished once the device was resumed) |
| Child inherits a socket or secret file it should not | Leaks across `execve` | Descriptors survive exec unless `O_CLOEXEC` / `FD_CLOEXEC` ✅[^2] |
| Fork in a multithreaded program, then call `malloc` in the child | Possible deadlock | A lock held by another (not copied) thread stays locked ✅[^1] |
| Parent and child write to the same inherited file | Writes interleave, offset shared | Same open file description ✅[^1] |
| `fork` fails with `EAGAIN` | No child created | Out of PIDs, `RLIMIT_NPROC`, or a cgroup `pids.max` limit ✅[^9] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `fork` + `execve` | Flexible: the child can change fds, user, namespaces before exec | Copies page tables of a large parent |
| `posix_spawn` / `vfork`-style spawning | Faster for big parents | Less room to customize the child ✅[^11] |
| Tiny init (`tini`, `docker run --init`) as container PID 1 | Reaps zombies, forwards signals | One more process in the image ✅[^12] (lab: `docker stop` took 0 s with `--init`, 11 s without) ✅[^6] |

## Takeaways
- Every process you start must be reaped by its parent; in a container, run an init that reaps (or make your PID 1 do it). [rule-candidate]
- Open files with close-on-exec (`O_CLOEXEC`) by default so children do not inherit them. [rule-candidate]
- Read exit code 137 as "killed by `SIGKILL`" (often OOM) and 143 as "`SIGTERM`".

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 32 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) — Linux man-pages project, living. Backs: copy-on-write, return values, inherited and non-inherited attributes, threads, glibc wrapper over `clone`. [^1]
- [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) — Linux man-pages project, living. Backs: what is replaced, preserved and reset; close-on-exec; shebang; no return on success. [^2]
- [wait(2)](https://man7.org/linux/man-pages/man2/wait.2.html) — Linux man-pages project, living. Backs: zombie definition and contents, re-parenting, subreaper, `SIG_IGN`, `WEXITSTATUS` / `WTERMSIG`. [^3]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: process state letters. [^4]
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages project, living. Backs: child inherits dispositions and mask, empty pending set. [^5]
- `linux/lab-setup.md` — the lab where the zombie, process tree and exit codes were captured on 2026-11-04 (Linux 6.17.8). [^6]
- [proc_loadavg(5)](https://man7.org/linux/man-pages/man5/proc_loadavg.5.html) — Linux man-pages project, living. Backs: scheduling entities include threads. [^7]
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) — Linux man-pages project, living. Backs: orphans go to the namespace's init. [^8]
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: `pids.max` makes fork fail with `EAGAIN`. [^9]
- [clone(2)](https://man7.org/linux/man-pages/man2/clone.2.html) — Linux man-pages project, living. Backs: `CLONE_THREAD`, `CLONE_VM`, `CLONE_FILES`, `CLONE_SIGHAND` sharing flags. [^10]
- [posix_spawn(3)](https://man7.org/linux/man-pages/man3/posix_spawn.3.html) — Linux man-pages project, living. Backs: glibc implements it with `clone(2)` using `CLONE_VM` and `CLONE_VFORK`. [^11]
- [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) — Docker, living. Backs: `--device`, `--device-cgroup-rule`, `--init` (forwards signals, reaps processes), `--shm-size`, `--security-opt no-new-privileges`. [^12]

## Related
- `linux/processes/signals.md` — how processes are told to stop, and exit codes.
- `linux/processes/cpu-scheduling.md` — what happens to an `R` task.
- `linux/containers/namespaces.md` — PID 1 in a container.
