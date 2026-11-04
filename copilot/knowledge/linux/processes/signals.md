---
schema: knowledge-doc/v1
type: concept
topic: linux/processes
status: verified
applies-to: ["Linux ≥ 4.x", "x86-64 and arm64 signal numbers"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, signals, sigterm, sigkill, graceful-shutdown, exit-code, pid-1]
---

# Signals and graceful shutdown

## Summary
**TL;DR:** A signal is a small numbered notification the kernel delivers to a process: "stop", "reload", "your child died", "you touched bad memory". Each signal has a **disposition**: the default action (terminate, dump core, ignore, stop, continue), a handler the program installed, or "ignore". `SIGKILL` (9) and `SIGSTOP` cannot be caught, blocked or ignored. Graceful shutdown means: handle `SIGTERM` (15), finish work, exit — before the sender's timeout sends `SIGKILL`.
**Use this when:** a service does not stop cleanly, a container takes 10 seconds to stop, you see exit code 143 or 137, `Ctrl-C` does nothing inside a container, or you write signal handlers.
**Not this doc:** process creation and reaping → `processes/process-lifecycle.md`.

## Problem
Most "it hangs on shutdown" and "it lost data on deploy" problems are signal problems: the app never receives `SIGTERM` (a shell wrapper swallowed it), ignores it (it is PID 1 in a container and installed no handler), or takes longer than the stop timeout and is killed mid-write.

## Mental model
**Analogy:** a phone with a few fixed ringtones. Each ringtone (signal number) has a factory behaviour (default action). The owner may assign their own action to most ringtones (install a handler) or mute them (ignore). Two ringtones — "you're fired" (`SIGKILL`) and "freeze" (`SIGSTOP`) — are hard-wired: the phone owner cannot change them.

**Artifact:** a process's signal masks in `/proc/<pid>/status` (lab, Linux 6.17.8, 2026-11-04) ✅[^3]:
```
SigBlk:	0000000000000000     # blocked: none
SigIgn:	0000000200000006     # ignored: bits 1,2 → signals 2 (SIGINT), 3 (SIGQUIT); bit 33 → a real-time signal
SigCgt:	0000000000000000     # caught (handler installed): none
```
Each field is a bit mask; bit *n−1* set means signal *n* is in that set ✅[^2]. Here the shell started `sleep` in the background, and background jobs ignore `SIGINT`/`SIGQUIT`.

## How it works
**3 actors:**
- **Sender** — its job: request delivery, via `kill(2)`, `tgkill(2)`, the terminal driver (`Ctrl-C` → `SIGINT`), or the kernel itself (a fault → `SIGSEGV`).
- **Kernel** — its job: mark the signal pending and deliver it, via the target's signal mask and dispositions ✅[^1].
- **Target process / thread** — its job: run the handler, or let the default action happen, via the disposition set with `sigaction(2)` ✅[^1].

```
sender: kill(pid, SIGTERM)
   │
   ▼
kernel: add SIGTERM to pending set ── blocked by every thread's mask? ──► stays pending
   │ (not blocked)
   ▼
pick a thread that does not block it (process-directed)
   │
   ├─ disposition = handler  → run handler on return to user mode → program decides
   ├─ disposition = ignore   → dropped
   └─ disposition = default  → Term / Core / Ign / Stop / Cont
```

1. **Generation:** the sender asks for a signal. Process-directed signals (`kill`) target the whole process; thread-directed ones target one thread (hardware faults such as `SIGSEGV`, or `tgkill`/`pthread_kill`) ✅[^1].
2. **Pending:** the signal is pending until delivered. Standard signals do not queue: several of the same kind while blocked collapse into one. Real-time signals (`SIGRTMIN`…`SIGRTMAX`) queue every instance ✅[^1].
3. **Masking:** each thread has its own mask of blocked signals; dispositions are shared by the whole process ✅[^1].
4. **Delivery:** the kernel delivers to a thread that does not block it and applies the disposition. `SIGKILL` and `SIGSTOP` always get their default action ✅[^1].
5. **Across `fork`:** the child inherits dispositions and mask, with an empty pending set. **Across `execve`:** handled signals reset to default, ignored ones stay ignored ✅[^1].

**Signals you meet most** (numbers for x86 and Arm) ✅[^1]:

| Signal | No. | Default | Typical sender and meaning |
|---|---|---|---|
| `SIGHUP` | 1 | Term | Terminal closed; many daemons treat it as "reload config" |
| `SIGINT` | 2 | Term | `Ctrl-C` in a terminal |
| `SIGQUIT` | 3 | Core | `Ctrl-\`; quit and dump core |
| `SIGKILL` | 9 | Term | Unconditional kill; also the OOM killer |
| `SIGSEGV` | 11 | Core | Invalid memory access |
| `SIGPIPE` | 13 | Term | Write to a pipe or socket whose reader has gone |
| `SIGTERM` | 15 | Term | Polite stop request (`kill`, `docker stop`, systemd, Kubernetes) |
| `SIGCHLD` | 17 | Ign | A child stopped or exited |
| `SIGSTOP` / `SIGCONT` | — | Stop / Cont | Pause and resume (cannot catch `SIGSTOP`) |

**PID 1 is different.** In a PID namespace, other processes can only send PID 1 signals for which it **installed a handler**; from an ancestor namespace, only `SIGKILL` and `SIGSTOP` are forced through ✅[^4]. So an app running as PID 1 in a container that never installed a `SIGTERM` handler ignores `docker stop`'s `SIGTERM`, and gets `SIGKILL` after the timeout ✅[^6] (lab: `docker stop` on `sleep` as PID 1 took 11 s and ended with exit 137) ✅[^3].

**Stop sequence of supervisors:** systemd sends `SIGTERM`, then `SIGKILL` if the service has not exited within `TimeoutStopSec=` ✅[^5]. Kubernetes and Docker follow the same TERM-then-KILL shape ✅[^6].

## Worked example
Lab run (Linux 6.17.8, 2026-11-04) ✅[^3]:
```console
$ sleep 30 & S=$!; kill -TERM $S; wait $S; echo "exit=$?"
exit=143                       # 128 + 15: terminated by SIGTERM (default action)
$ sleep 30 & S=$!; kill -9 $S;   wait $S; echo "exit9=$?"
Killed
exit9=137                      # 128 + 9: SIGKILL
```
`sleep` has no handlers, so `SIGTERM`'s default action (Term) applies. A server with a handler would instead stop accepting new work, finish in-flight requests, flush, close, and exit with `0`.

A graceful-shutdown timeline for a web service stopped by a supervisor with a 30 s timeout:

| t | Event |
|---|---|
| 0 s | Supervisor sends `SIGTERM` to the main process |
| 0 s | Handler sets "draining": readiness fails, listener closes, no new requests |
| 0–25 s | In-flight requests finish; queues flushed; DB pool closed |
| 25 s | Process exits with code 0 |
| (30 s) | Would have been `SIGKILL` (exit 137) if still running |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Container `CMD` is `sh -c "node app.js"` | `SIGTERM` goes to `sh`, not to node; node dies only at `SIGKILL` | The shell is PID 1 and may not forward signals ✅[^3] (lab: `sh -c 'sleep 300; true'` as PID 1 → `docker stop` took 10 s, exit 137) |
| App is PID 1 and has no `SIGTERM` handler | `SIGTERM` is ignored | PID 1 only receives handled signals from its own namespace ✅[^4] |
| Many `SIGCHLD` arrive while blocked | Handler runs once | Standard signals do not queue ✅[^1]; reap in a loop with `waitpid(-1, …, WNOHANG)` |
| Writing to a closed socket | Process dies with `SIGPIPE` | Default is Term ✅[^1]; servers usually ignore it and handle `EPIPE` |
| Handler calls `printf` or `malloc` | Possible deadlock or corruption | Only async-signal-safe functions are safe in handlers ✅[^1] |
| `kill -9` and data loss | No cleanup runs | `SIGKILL` cannot be caught ✅[^1] |

## Takeaways
- Every long-running service handles `SIGTERM`: stop accepting work, drain, exit within the supervisor's timeout. [rule-candidate]
- In containers, use the exec form (`CMD ["node","app.js"]`) or a tiny init so the app receives signals directly. [rule-candidate]
- In a signal handler, only set a flag or write to a pipe; do the real work in the main loop.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages project, living. Backs: dispositions, uncatchable signals, masks, process vs thread delivery, queueing, fork/exec behaviour, numbers and defaults, async-signal safety. [^1]
- [proc_pid_status(5)](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html) — Linux man-pages project, living. Backs: `SigBlk` / `SigIgn` / `SigCgt` masks. [^2]
- `linux/lab-setup.md` — the lab where the masks and exit codes were captured on 2026-11-04. [^3]
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) — Linux man-pages project, living. Backs: PID 1 only gets signals it handles; `SIGKILL`/`SIGSTOP` from ancestors. [^4]
- [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html) — systemd project via Linux man-pages, living. Backs: `SIGTERM` then `SIGKILL` after `TimeoutStopSec=`. [^5]
- [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) — Docker, living. Backs: SIGTERM to the main process, then SIGKILL after a grace period. [^6]

## Related
- `linux/processes/process-lifecycle.md` — exit status, zombies and reaping.
- `linux/system-management/systemd-services.md` — stop timeouts in service units.
- `kubernetes/memory-limits-and-oom-kill.md` — exit 137 from the OOM killer.
