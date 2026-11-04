---
schema: knowledge-doc/v1
type: concept
topic: linux/networking
status: verified
applies-to: ["Linux ≥ 5.10 (epoll and io_uring)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, epoll, io-uring, select, poll, non-blocking-io, event-loop, edge-triggered, c10k]
---

# I/O multiplexing: epoll and io_uring

## Summary
**TL;DR:** A server with thousands of connections cannot block on each one. **epoll** lets one thread register many file descriptors once (the interest list) and then sleep until the kernel puts some of them on a **ready list**; it is the engine behind Node.js (libuv), nginx, Go's netpoller and most event loops. Level-triggered mode (default) keeps reporting a ready descriptor; edge-triggered mode reports only changes, so you must read until `EAGAIN`. **io_uring** goes further: requests and completions travel through two ring buffers shared with the kernel, so many operations need one system call — or none.
**Use this when:** you build or tune an event-loop server, debug a loop that stalls (edge-triggered misuse) or burns CPU (busy polling), compare blocking threads with async I/O, or evaluate io_uring.
**Not this doc:** what happens to packets before they reach a socket → `networking/packet-path.md`.

## Problem
One thread per connection wastes memory and context switches at high concurrency; `select`/`poll` re-scan every descriptor on every call. Event loops fix this with epoll, but its edge-triggered mode has a classic trap: read only part of the data and the loop never wakes up for that socket again.

## Mental model
**Analogy:** a restaurant pager system. Instead of a waiter standing at every table (a thread per connection), tables are registered once at the front desk (`epoll_ctl`), and the waiter sleeps until a pager buzzes (`epoll_wait`) with the list of tables that need attention. **io_uring** is an order slip conveyor: you put many slips on the belt (submission queue) and pick up finished plates from another belt (completion queue), without walking to the kitchen for each.

**Artifact:** an epoll instance is itself a descriptor (lab, Linux 6.17.8, 2026-11-04) ✅[^3]:
```text
epoll fd -> anon_inode:[eventpoll]                          # an inode with no file behind it
events [(4, 1)]                                             # fd 4 ready, mask 1 = EPOLLIN
tfd:        4 events:       19 data:     ffff00000004 ...   # /proc/self/fdinfo: the interest list entry
```

## How it works
**3 actors:**
- **Application event loop** — its job: register descriptors and handle ready ones, via `epoll_create1`, `epoll_ctl`, `epoll_wait` ✅[^1].
- **epoll instance (kernel)** — its job: keep the interest list and fill the ready list as I/O happens, via callbacks from the watched files ✅[^1].
- **Watched descriptors** — its job: signal readiness, via sockets, pipes, timers (`timerfd`), `eventfd`.

```
setup:   epfd = epoll_create1()
         epoll_ctl(epfd, ADD, listen_fd, EPOLLIN)          ── interest list
loop:    n = epoll_wait(epfd, events, 64, timeout)          ── sleeps until ready list non-empty
           for each event:
             listen_fd ready → accept() new fd → epoll_ctl(ADD, fd, EPOLLIN | EPOLLET)
             client fd ready → read() until EAGAIN → handle → write()
kernel:  packet arrives on socket fd ─► socket wakes epoll ─► fd appended to ready list ─► epoll_wait returns
```

1. **Create:** `epoll_create1()` returns a descriptor for a new instance ✅[^1].
2. **Register once:** `epoll_ctl(ADD/MOD/DEL)` maintains the interest list ✅[^1].
3. **Wait:** `epoll_wait()` returns entries from the ready list, blocking if it is empty ✅[^1]. Its cost depends on the number of ready descriptors, which is why epoll "scales well to large numbers of watched file descriptors" ✅[^1].
4. **Level-triggered (default):** a descriptor is reported as long as it stays ready — same semantics as a faster `poll` ✅[^1].
5. **Edge-triggered (`EPOLLET`):** reported only when readiness changes; use non-blocking descriptors and keep reading/writing until `EAGAIN`. "You must consider it ready until the next (nonblocking) read/write yields EAGAIN" ✅[^1].
6. **`EPOLLONESHOT`:** disables the descriptor after one event until re-armed with `EPOLL_CTL_MOD` — useful when several threads share one epoll ✅[^1].

**io_uring** ✅[^2]:
1. `io_uring_setup()` creates a submission queue (SQ) and a completion queue (CQ), mapped into the process with `mmap`.
2. The application writes **SQEs** (submission queue entries: "read 4 KiB from fd 7 at offset X") at the SQ tail.
3. One `io_uring_enter()` submits many SQEs and can wait for completions.
4. The kernel posts one **CQE** per request with `res` = the equivalent system call's result (or a negative errno) and the caller's `user_data` tag. Completions may arrive in any order unless linked.
5. With **SQPOLL**, a kernel thread polls the SQ, so the application submits without any system call.

## Worked example
A proxy with 10 000 mostly idle connections, 50 active per millisecond:

| Approach | Per wake-up cost | Threads |
|---|---|---|
| `poll()` over 10 000 fds | The whole fd array is passed on every call | 1 |
| Thread per connection, blocking `read` | One stack and one blocked thread per connection | 10 000 |
| epoll | Returns only the ~50 ready fds ✅[^1] | 1 per core |
| io_uring | Batch of reads submitted and completed through rings, ~1 syscall per batch ✅[^2] | 1 per core |

The edge-triggered trap in numbers: 64 KiB arrive on a socket, the handler reads 16 KiB and returns to `epoll_wait`. No new data arrives, so there is no new edge, and 48 KiB sit unread until the client sends more — the connection appears hung. Reading in a loop until `EAGAIN` fixes it ✅[^1].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Edge-triggered with blocking sockets | Loop blocks inside `read` | Must use non-blocking fds ✅[^1] |
| Same fd registered by several threads, no `EPOLLONESHOT` | Several threads woken for one event | Each `epoll_wait` may report it ✅[^1] |
| Many watches per user | `epoll_ctl` fails with `ENOSPC` | `max_user_watches` limit ✅[^1] ✅[^5] |
| Regular files in epoll | Not supported: `EPERM` ✅[^5] (lab: registering `/etc/hostname` → errno 1) ✅[^3] | Use io_uring or a thread pool for disk I/O |
| io_uring disabled by policy | `io_uring_setup` fails | `kernel.io_uring_disabled` sysctl (0 in the lab) ✅[^3]; Docker's default seccomp profile blocks io_uring calls ✅[^4] |
| SQPOLL with buffers freed early | Corrupted I/O | Pointers in an SQE must stay valid until completion ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Blocking threads | Simple code | Memory and switching at high concurrency |
| epoll event loop | Scales to many sockets, mature | Callback/async code; no async regular-file I/O |
| io_uring | Fewer syscalls, true async files, batching | Newer API, security restrictions in containers |

## Takeaways
- With `EPOLLET`, always drain non-blocking descriptors until `EAGAIN`. [rule-candidate]
- Never run blocking work (disk reads, CPU-heavy code) on an event-loop thread; hand it to a pool.
- Check that io_uring is allowed (seccomp, `io_uring_disabled`) before depending on it in containers.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 23 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html) — Linux man-pages project, living. Backs: API, interest and ready lists, level vs edge triggering, `EAGAIN` rule, `EPOLLONESHOT`, scalability, `max_user_watches`. [^1]
- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html) — Linux man-pages project, living. Backs: SQ/CQ rings, SQE/CQE, `io_uring_enter`, `res` and `user_data`, ordering, SQPOLL. [^2]
- `linux/lab-setup.md` — the lab where the epoll descriptor, its fdinfo and `io_uring_disabled = 0` were captured on 2026-11-04. [^3]
- [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) — Docker, living. Backs: default profile blocks io_uring calls. [^4]
- [epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html) — Linux man-pages project, living. Backs: `ENOSPC` when `max_user_watches` is reached; `EPERM` when the file does not support epoll. [^5]

## Related
- `linux/networking/tcp-connection-lifecycle.md` — the sockets an event loop serves.
- `concurrency/blocking-in-async-runtimes.md` — blocking work inside event loops, language side.
- `linux/processes/ipc-pipes-sockets-shm.md` — pipes and UNIX sockets watched by the same loop.
