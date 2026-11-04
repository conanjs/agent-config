---
schema: knowledge-doc/v1
type: concept
topic: linux/fundamentals
status: verified
applies-to: ["Linux ≥ 5.x", "x86-64 and arm64"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, kernel, user-space, system-call, syscall, vdso, strace, privilege]
---

# Kernel space, user space and system calls

## Summary
**TL;DR:** A Linux program never touches hardware, files or the network itself. It asks the kernel through a **system call**: a special CPU instruction that switches from the unprivileged user mode into the privileged kernel mode, runs kernel code, and returns a number. Every `open`, `read`, `write`, `fork` and `connect` is one of these requests, and `strace` shows them.
**Use this when:** you need the base mental model for everything else in Linux (processes, memory, files, containers), you are reading `strace` output, or you wonder why some calls are "expensive" and others (like reading the clock) are not.
**Not this doc:** how processes are created → `processes/process-lifecycle.md`; how files are found → `storage/vfs-and-file-descriptors.md`.

## Problem
Programs look like they "open a file" or "send a packet", but the code in your process has no right to do either. Without the user/kernel split you cannot read `strace`, understand `EPERM` / `ENOENT` errors, see why a container is "just a process", or reason about the cost of crossing into the kernel.

## Mental model
**Analogy:** a bank. Customers (programs) stand in the public hall (user space). The vault, the ledgers and the cash machines (hardware, files, network) are behind the counter (kernel space). A customer cannot walk behind the counter; they fill in a numbered form (system call number + arguments) and hand it through the window. The clerk (kernel) checks the customer's ID (credentials, capabilities), does the work, and hands back a receipt (a return value, or `-1` and an error code).

**Artifact:** the system calls `cat /tmp/f` makes, captured with `strace` (measured 2026-11-04, Linux 6.17.8, arm64, Alpine 3.20 container) ✅[^5]:
```console
$ strace -e trace=openat,read,write,close cat /tmp/f
openat(AT_FDCWD, "/tmp/f", O_RDONLY|O_LARGEFILE) = 3    # "please open this file" → file descriptor 3
read(3, "hi\n", 262144)           = 3                    # "give me up to 256 KiB from fd 3" → 3 bytes
write(1, "hi\n", 3)               = 3                    # "write 3 bytes to fd 1 (stdout)"
read(3, "", 262144)               = 0                    # 0 bytes = end of file
close(3)                          = 0
```
Each line is one trip through the "window": the call name, its arguments, and after `=` the kernel's answer.

## How it works
**3 actors:**
- **Application code** — its job: decide what to do, via ordinary functions (`fopen`, `printf`, `socket`).
- **C library (glibc or musl)** — its job: turn a function call into a system call, via a small wrapper that loads registers and executes the trap instruction.
- **Kernel** — its job: check permissions and do the privileged work, via the system-call table that maps a number to a kernel function.

```
 USER MODE (unprivileged)                         KERNEL MODE (privileged)
 ┌───────────────────────────┐                    ┌──────────────────────────────┐
 │ app: fd = open("/tmp/f")  │                    │                              │
 │   │                       │                    │                              │
 │   ▼                       │   trap instruction │ syscall table[nr] → do_open  │
 │ libc wrapper:             │ ── syscall/svc ───►│   check credentials          │
 │   nr → register           │                    │   path lookup (VFS)          │
 │   args → registers        │                    │   allocate fd 3              │
 │   ◄── return value ───────│◄── return to user ─│   result in return register  │
 │ errno = -ret if failed    │                    │                              │
 └───────────────────────────┘                    └──────────────────────────────┘
```

1. **Application (user mode):** calls a library function such as `open()`. Nothing privileged has happened yet.
2. **C library (user mode):** puts the system-call number and up to six arguments into registers. On x86-64 the number goes in `eax` and the instruction is `syscall`; on arm64 the number goes in `w8` and the instruction is `svc #0` ✅[^1].
3. **CPU → kernel (mode switch):** the trap instruction raises the privilege level and jumps to the kernel's entry point. This is the boundary: from here on, kernel code runs on behalf of the process, using the process's credentials.
4. **Kernel (kernel mode):** looks the number up in the system-call table, validates every pointer and argument (user memory is never trusted), checks permissions, and does the work.
5. **Kernel → C library (mode switch back):** the result goes in the return register (`rax` on x86-64, `x0` on arm64) ✅[^1].
6. **C library (user mode):** on failure the wrapper returns `-1` and stores the error number in `errno` ✅[^1]; your code sees, for example, `ENOENT` ("No such file or directory").

**The fast path that skips the kernel: the vDSO.** Some calls are so frequent that the trip itself dominates their cost. The kernel maps a small shared library, the **vDSO**, into every process; it exposes functions such as `__vdso_clock_gettime` and `__vdso_gettimeofday`, which read time data the kernel keeps in memory that processes can read, so the "system call" becomes a normal function call ✅[^2]. The C library uses it for you, and the kernel tells each program where it is through the auxiliary vector entry `AT_SYSINFO_EHDR` ✅[^2].

**What lives on which side:**

| User space | Kernel space |
|---|---|
| Your program, shells, the C library, `systemd` and every daemon | Process scheduler, memory manager, filesystems (VFS), network stack, device drivers, cgroups, namespaces, security modules |
| Runs with restricted CPU privilege; a bad pointer kills only this process (`SIGSEGV`) | Runs with full privilege; a bug can crash the whole machine ("kernel panic") |
| Talks to the kernel through system calls, `/proc`, `/sys`, and device files | Exposes state through `/proc` and `/sys` ✅[^3] |

## Worked example
Count every system call `ls /` makes, with `strace -c` (measured 2026-11-04, same lab as above) ✅[^5]:

```console
$ strace -c ls / > /dev/null
% time     seconds  usecs/call     calls    errors syscall
  0.00    0.000000           0         7         1 openat
  0.00    0.000000           0         8           close
  0.00    0.000000           0         2           getdents64
  0.00    0.000000           0         5           read
  0.00    0.000000           0         5           fstat
  0.00    0.000000           0         1           execve
  ...
```

Reading it:
- `execve` = 1: the shell's child replaced itself with the `ls` program (see `processes/process-lifecycle.md`).
- `openat` 7 calls, 1 error: the dynamic loader and `ls` tried to open 7 files; one did not exist (an `ENOENT`), which is normal probing, not a bug.
- `getdents64` = 2: "get directory entries", the call that actually lists `/`. The second call returned 0 entries, which means "end of directory".
- Everything else is setup: memory (`brk`, `mmap`), terminal checks (`ioctl`), file status (`fstat`).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| A call fails | Returns `-1`, `errno` set (e.g. `EACCES`, `ENOENT`, `EPERM`) | The kernel returns an error code; the wrapper translates it ✅[^1] |
| `strace` slows the program a lot | Each traced call stops the process for the tracer | Lab: 200 000 `getppid` calls took 0.025 s plain and 0.94 s under `strace` (≈ 37× slower) ✅[^5] |
| `clock_gettime` does not show in `strace` | It ran in the vDSO, never entered the kernel | vDSO functions are plain user-space code ✅[^2] |
| Same binary, different kernel version | A missing call returns `ENOSYS` | Lab: `syscall(99999)` returned −1 with errno 38 `ENOSYS` ("Function not implemented") ✅[^5] |
| Process inside a container | Same system calls, same kernel | A container is a process with namespaces and cgroups; see `containers/namespaces.md` |
| Blocked by seccomp | Call returns `EPERM` or the process is killed | A seccomp filter runs before the call ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Many small `read`/`write` calls | Simple code | One mode switch per call; slow for tiny buffers |
| Buffered I/O (`stdio`, larger buffers) | Fewer system calls (see the 256 KiB `read` above) | Data sits in user memory until flushed |
| Memory-mapped files (`mmap`) | No copy per access after the mapping | Page faults instead; harder error handling |

## Takeaways
- Every privileged action is a system call; `strace -f -e trace=<set> <cmd>` shows them with their results, and `strace -c` gives a summary.
- An error from a system call (`-1` + `errno`) comes from the kernel's checks; read the errno name before guessing.
- A container uses the host kernel's system calls; there is no "container kernel".

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [syscall(2)](https://man7.org/linux/man-pages/man2/syscall.2.html) — Linux man-pages project, living. Backs: instruction and registers per architecture, `-1` + `errno` convention. [^1]
- [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html) — Linux man-pages project, living. Backs: what the vDSO is, exported time functions, `AT_SYSINFO_EHDR`. [^2]
- [hier(7)](https://man7.org/linux/man-pages/man7/hier.7.html) — Linux man-pages project, living. Backs: `/proc` and `/sys` expose kernel information. [^3]
- [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html) — Linux man-pages project, living. Backs: filters run before a call and can return an errno or kill. [^4]
- `linux/lab-setup.md` — the lab (OrbStack, Linux 6.17.8, arm64, Alpine 3.20) where the `strace` output was captured on 2026-11-04. [^5]
- [syscalls(2)](https://man7.org/linux/man-pages/man2/syscalls.2.html) — Linux man-pages project, living. Backs: further reading, the list of all system calls.

## Related
- `linux/processes/process-lifecycle.md` — `fork`, `execve`, `wait`: the system calls that make processes.
- `linux/storage/vfs-and-file-descriptors.md` — what `openat` and fd 3 really are.
- `linux/containers/container-isolation.md` — seccomp filters on system calls.
