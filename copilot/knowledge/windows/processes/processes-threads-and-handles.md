---
schema: knowledge-doc/v1
type: concept
topic: windows/processes
status: verified
applies-to: ["Windows 8 / Server 2012 and later (nested jobs)", "Win32 API"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, process, thread, handle, job-object, createprocess, thread-pool, fiber, iocp]
---

# Windows processes, threads, handles and job objects

## Summary
**TL;DR:** A Windows **process** is a container of resources — virtual address space, code, open **handles** to kernel objects, a security context (access token), a process ID, environment, priority class and working-set limits — with at least one **thread**; threads are what the scheduler runs. Unlike Unix, there is no `fork`: `CreateProcess` creates a new process from an executable in one step. Groups of processes are managed as a unit with **job objects** (limits, accounting, kill-all), which also underpin Windows containers.
**Use this when:** you port Unix process code, debug handle leaks, need to kill a process tree reliably, limit a group of processes, or compare Windows and Linux process models.
**Not this doc:** scheduling priorities → `processes/scheduling-and-priorities.md`; tokens and access checks → `security/tokens-acls-and-uac.md`.

## Problem
Unix habits break on Windows: there is no fork-then-exec, child processes do not die with their parent, handles leak like file descriptors but for every object type, and "kill the whole tree" needs a job object. Each follows from the Windows process model.

## Mental model
**Analogy:** a process is a rented workshop: floor space (address space), tools on loan with numbered tags (handles), a security badge (access token) and at least one worker (thread). New workshops are rented from a catalogue blueprint (`CreateProcess` + an `.exe`), not by cloning an existing workshop. A job object is a company account several workshops are billed to, with spending limits and a "close all" button.

**Artifact:** what a process and a thread contain, per Microsoft's definitions ✅[^1]:
```text
Process: virtual address space · executable code · open handles to system objects · security context
         · unique process identifier · environment variables · priority class
         · minimum and maximum working set sizes · at least one thread (the primary thread)
Thread:  exception handlers · scheduling priority · thread local storage · unique thread identifier
         · saved context (registers, kernel stack, thread environment block, user stack) · optional own security context (impersonation)
```

## How it works
**4 actors:**
- **Creating process** — its job: start a program, via `CreateProcess` (executable path, command line, inherit handles?, creation flags, priority class) ✅[^6].
- **Process and thread manager (kernel)** — its job: create the process object, its address space and primary thread.
- **Object manager / handle table** — its job: give each process private handles to objects ✅[^2].
- **Job object** — its job: group processes and apply limits and operations to all of them ✅[^3].

1. **Creation:** a new process starts with one thread, the primary thread, which can create more ✅[^1]. Its priority class defaults to normal (with an exception for idle/below-normal parents) ✅[^4].
2. **Threads share the process:** all threads share the address space and resources; each keeps its own priority, TLS, ID and context ✅[^1]. Windows uses preemptive multitasking; a multiprocessor runs as many threads at once as it has processors ✅[^1].
3. **Handles:** objects (files, threads, events…) are only reachable through handles — entries in an internal table holding the resource's address and type ✅[^2].
4. **Jobs:** a job is a namable, securable, sharable object; operations on it (working-set and priority limits, terminate all) affect every associated process ✅[^3]. Once assigned, a process cannot leave its job; since Windows 8 / Server 2012 jobs can nest ✅[^3].
5. **Higher-level concurrency:** thread pools (worker threads for async callbacks, timers, waits and I/O), fibers (manually scheduled, inside a thread), user-mode scheduling ✅[^1]; I/O completion ports give an efficient threading model for many concurrent asynchronous I/O requests ✅[^5].

**Windows vs Linux:**

| Topic | Windows | Linux |
|---|---|---|
| New program | `CreateProcess(exe, …)` in one call | `fork()` + `execve()` |
| Parent dies | Children keep running ✅[^7] | Orphans re-parented to PID 1 / subreaper |
| Reference to resources | Handle (any object type) | File descriptor (files, sockets, pipes…) |
| Group control | Job object | cgroup (+ process group/session) |
| Exit status | `GetExitCodeProcess` on a process handle ✅[^8] | `wait()` / zombie until reaped |
| Async I/O engine | I/O completion ports | epoll / io_uring |

## Worked example
Running a build tool that spawns compilers, and making sure everything dies on cancel:

| Step | Call | Effect |
|---|---|---|
| 1 | `CreateJobObject` | New job, no processes yet ✅[^3] |
| 2 | `SetInformationJobObject(…JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE…)` | Kill all when the last job handle closes ✅[^9] |
| 3 | `CreateProcess(…CREATE_SUSPENDED…)` then `AssignProcessToJobObject` | Tool joins the job before running; association cannot be broken ✅[^3] |
| 4 | Resume the main thread | Tool runs; compilers it spawns join the job by default ✅[^3] |
| 5 | Cancel → `TerminateJobObject` (or close the job handle) | Every process in the tree ends ✅[^3] |

Without a job, terminating the parent leaves compiler processes running.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Killing a parent with Task Manager "End task" | Children may survive | Terminating a process does not terminate its children ✅[^7] |
| Handle count of a process keeps rising | Handle leak; kernel objects stay alive | Objects referenced by handles ✅[^2] ✅[^10] |
| Process already in a job on old Windows (before 8) | Cannot join a second job | No nesting before Windows 8 ✅[^3] |
| Porting `fork()` code | No equivalent | Use `CreateProcess` or threads |
| Many concurrent sockets/files | One thread per request scales poorly | Use IOCP or the thread pool ✅[^5] |

## Takeaways
- Use job objects to own process trees you start (build tools, test runners, sandboxes). [rule-candidate]
- Close handles deterministically; watch the handle count in Task Manager or Process Explorer for leaks.
- Use the thread pool or I/O completion ports for high-concurrency I/O instead of a thread per request.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [About Processes and Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads) — Microsoft Learn, living. Backs: process and thread contents, primary thread, shared resources, preemptive multitasking, thread pools, fibers, UMS. [^1]
- [Handles and Objects](https://learn.microsoft.com/en-us/windows/win32/sysinfo/handles-and-objects) — Microsoft Learn, living. Backs: objects only via handles, handle table entries. [^2]
- [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) — Microsoft Learn, living. Backs: job semantics, limits, terminate all, permanent association, nesting since Windows 8. [^3]
- [Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities) — Microsoft Learn, living. Backs: default priority class and inheritance exception. [^4]
- [I/O Completion Ports](https://learn.microsoft.com/en-us/windows/win32/fileio/i-o-completion-ports) — Microsoft Learn, living. Backs: efficient threading model for many async I/O requests. [^5]
- No Windows lab was available when this doc was written (macOS host); the worked example is illustrative.
- [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw) — Microsoft Learn, living. Backs: parameters including application name, command line, `bInheritHandles`, `dwCreationFlags`. [^6]
- [Terminating a Process](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process) — Microsoft Learn, living. Backs: terminating a process does not terminate its child processes. [^7]
- [GetExitCodeProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getexitcodeprocess) — Microsoft Learn, living. Backs: retrieves the termination status through a process handle. [^8]
- [JOBOBJECT_BASIC_LIMIT_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) — Microsoft Learn, living. Backs: `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` terminates all job processes when the last job handle closes. [^9]
- [Kernel Objects](https://learn.microsoft.com/en-us/windows/win32/sysinfo/kernel-objects) — Microsoft Learn, living. Backs: an object remains in memory as long as at least one handle exists. [^10]

## Related
- `linux/processes/process-lifecycle.md` — fork/exec/wait on Linux.
- `windows/containers/windows-containers-and-wsl.md` — jobs and silos in containers.
