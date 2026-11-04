---
schema: knowledge-doc/v1
type: concept
topic: linux/processes
status: verified
applies-to: ["Linux ≥ 4.9"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, ipc, pipe, fifo, unix-socket, shared-memory, scm-rights, sigpipe]
---

# Inter-process communication: pipes, UNIX sockets and shared memory

## Summary
**TL;DR:** Processes on one machine talk through kernel objects that look like files. A **pipe** is a one-way byte stream with a 64 KiB buffer (writes of up to 4096 bytes are atomic); a **FIFO** is a pipe with a name. A **UNIX domain socket** is two-way, can keep message boundaries, can be named by a path or an abstract name, and can even pass **open file descriptors** and verified credentials to another process. **Shared memory** (`/dev/shm`, `mmap`) is the fastest — no copy at all — but needs separate synchronization.
**Use this when:** you choose how two local processes should communicate, debug a pipeline that hangs or dies with `SIGPIPE`, wonder how a container runtime or `docker.sock` works, or see `pipe:[N]` / `socket:[N]` in `/proc/<pid>/fd`.
**Not this doc:** signals as notifications → `processes/signals.md`; TCP sockets → `networking/tcp-connection-lifecycle.md`.

## Problem
A shell pipeline stalls forever, a log shipper dies silently with exit 141, a daemon exposes a socket anyone can connect to, or two processes corrupt each other's interleaved writes. Each comes from a specific rule of a specific IPC mechanism.

## Mental model
**Analogy:** three ways to pass things between neighbours. A **pipe** is a pneumatic tube in one direction with a small buffer: if nobody empties the far end, the sender has to wait; if the receiver leaves, the sender is told off loudly (`SIGPIPE`). A **UNIX socket** is a two-way hatch in the shared wall that can also pass physical keys (file descriptors). **Shared memory** is a shared whiteboard: instant, but both must agree who writes when.

**Artifact:** the objects as a process sees them (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```text
pipe fds 3 4 pipe:[20806]          # os.pipe(): read end 3, write end 4, one pipe inode
unix pair socket:[20810]           # socketpair(AF_UNIX): an unnamed UNIX socket
pipe capacity 65536                # fcntl(F_GETPIPE_SZ)
shm ['demo']                       # POSIX shared memory object = a file in /dev/shm
/proc/sys/fs/pipe-max-size: 1048576
```

## How it works
**3 actors:**
- **Writer process** — its job: put data in, via `write`/`send`/stores to mapped memory.
- **Kernel IPC object** — its job: buffer, order and wake up, via a pipe buffer, a socket queue, or shared pages (no buffering) ✅[^1] ✅[^2].
- **Reader process** — its job: take data out, via `read`/`recv`/loads from mapped memory.

| Mechanism | Direction | Boundaries | Named? | Extra | Notes |
|---|---|---|---|---|---|
| Pipe (`pipe()`, `\|` in a shell) | One-way | Byte stream | No | — | Default capacity 65 536 bytes since 2.6.11; `F_SETPIPE_SZ` changes it up to `pipe-max-size` (1 MiB) ✅[^1] |
| FIFO (`mkfifo`) | One-way | Byte stream | Path in the filesystem | — | Behaves exactly like a pipe once opened ✅[^1] |
| UNIX socket `SOCK_STREAM` | Two-way | Byte stream | Path, abstract name, or unnamed | FD passing, credentials | Same API as TCP sockets ✅[^2] |
| UNIX socket `SOCK_DGRAM` / `SOCK_SEQPACKET` | Two-way | Messages kept | same | same | Datagrams are reliable on UNIX sockets ✅[^2] |
| POSIX shared memory (`shm_open` + `mmap`) | Both | None (raw memory) | Name under `/dev/shm` | — | No copy; needs locks, futexes or semaphores ✅[^3] ✅[^4] |

**Pipe rules** ✅[^1]:
1. Reading an empty pipe blocks until data arrives; when every write end is closed, `read` returns 0 (end of file).
2. Writing when every read end is closed raises `SIGPIPE`; if that is ignored, `write` fails with `EPIPE`.
3. Writes of up to `PIPE_BUF` (4096 bytes on Linux) are atomic: concurrent writers never interleave inside them; larger writes may interleave.
4. A full pipe blocks the writer (or `EAGAIN` with `O_NONBLOCK`).

**UNIX socket extras** ✅[^2]:
- **Pathname** sockets are files: creating one needs write+search on the directory; connecting needs write permission on the socket file — that is how `/var/run/docker.sock` access is controlled by its group ✅[^2]; the Docker daemon behind it has root privileges ✅[^6].
- **Abstract** names (first byte of `sun_path` is `\0`) live outside the filesystem; "Socket permissions have no meaning for abstract sockets".
- **`SCM_RIGHTS`** sends open descriptors: the receiver gets the same open file description under a new number (up to 253 per message).
- **`SCM_CREDENTIALS`** sends PID/UID/GID that the kernel validates.

## Worked example
Why `yes | head -1` ends instead of running forever:

| Step | `yes` (writer) | `head` (reader) |
|---|---|---|
| 1 | Fills the pipe buffer with `y\n` until 65 536 bytes, then blocks ✅[^1] | Reads, prints one line |
| 2 | — | Exits, closing the only read end |
| 3 | Next `write` → `SIGPIPE` (default action: terminate) ✅[^1] ✅[^5] | — |
| 4 | Shell reports exit status 141 = 128 + 13 | — |

Nothing went wrong: `SIGPIPE` is how a pipeline tells upstream producers to stop. A long-running daemon instead ignores `SIGPIPE` and handles `EPIPE`.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Child keeps a copy of the pipe's write end | Reader never sees EOF; pipeline hangs | EOF needs **all** write ends closed ✅[^1]; use `O_CLOEXEC` |
| Several processes write 10 KB records to one pipe | Records can interleave | Only ≤ 4096-byte writes are atomic ✅[^1] |
| Stale socket file after a crash | `bind` fails with "Address in use" | Pathname socket files must be unlinked ✅[^2] |
| Abstract socket inside a network namespace | Only visible within that namespace | Abstract names are per network namespace ✅[^4] (lab: `connect` to the same abstract name from a new netns → "Connection refused") |
| Shared memory without locking | Torn reads, lost updates | No synchronization is provided ✅[^3] |
| `/dev/shm` full | `shm_open`/`mmap` writes fail | A size-limited tmpfs; Docker sets it with `--shm-size` ✅[^7] (lab engine showed 3.9 G–4.0 G) ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Pipe | Simplest, automatic EOF, shell support | One-way, related processes only (unless FIFO) |
| UNIX socket | Two-way, messages, FD passing, credentials | More setup; file permissions to manage |
| Shared memory | Fastest, zero copy | You build synchronization and lifetime handling |
| TCP on loopback | Same code works across hosts | Slower; no credential or FD passing |

## Takeaways
- Close every unused pipe end (and open with `O_CLOEXEC`) or readers wait forever. [rule-candidate]
- Protect pathname sockets with directory and file permissions; check peer credentials (`SO_PEERCRED`) before trusting a client.
- Daemons ignore `SIGPIPE` and handle `EPIPE`; command-line filters let `SIGPIPE` end them.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 23 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [pipe(7)](https://man7.org/linux/man-pages/man7/pipe.7.html) — Linux man-pages project, living. Backs: capacity and `F_SETPIPE_SZ`, `pipe-max-size`, `PIPE_BUF` atomicity, blocking and EOF, `SIGPIPE`/`EPIPE`, FIFOs. [^1]
- [unix(7)](https://man7.org/linux/man-pages/man7/unix.7.html) — Linux man-pages project, living. Backs: socket types, pathname/abstract/unnamed addresses, permissions, `SCM_RIGHTS`, `SCM_CREDENTIALS`. [^2]
- [shm_overview(7)](https://man7.org/linux/man-pages/man7/shm_overview.7.html) — Linux man-pages project, living. Backs: POSIX shared memory objects, `/dev/shm`, synchronization is the caller's job. [^3]
- `linux/lab-setup.md` — the lab where the pipe, socketpair, pipe capacity and `/dev/shm` object were captured on 2026-11-04. [^4]
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) — Linux man-pages project, living. Backs: `SIGPIPE` is 13 with default action Term. [^5]
- [Docker Engine security](https://docs.docker.com/engine/security/) — Docker, living. Backs: the daemon requires root privileges; only trusted users should control it. [^6]
- [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) — Docker, living. Backs: `--device`, `--device-cgroup-rule`, `--init` (forwards signals, reaps processes), `--shm-size`, `--security-opt no-new-privileges`. [^7]

## Related
- `linux/networking/io-multiplexing-epoll-io-uring.md` — waiting on many pipes and sockets at once.
- `linux/storage/vfs-and-file-descriptors.md` — pipes and sockets as inodes and descriptors.
- `linux/processes/signals.md` — `SIGPIPE` and exit codes.
