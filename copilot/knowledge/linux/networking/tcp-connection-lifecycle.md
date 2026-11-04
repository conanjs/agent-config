---
schema: knowledge-doc/v1
type: concept
topic: linux/networking
status: verified
applies-to: ["Linux ≥ 5.4", "TCP per RFC 9293"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, tcp, handshake, listen-backlog, somaxconn, syn-cookies, time-wait, close-wait, ephemeral-ports]
---

# TCP connection lifecycle on Linux

## Summary
**TL;DR:** A TCP connection moves through the RFC 9293 states: three-way handshake (`SYN-SENT`/`SYN-RECEIVED` → `ESTABLISHED`), data, then a four-step close. On a Linux server, a connection that finished the handshake waits in the listener's **accept queue**, whose length is `listen(backlog)` capped by `net.core.somaxconn` (4096 since Linux 5.4). The side that closes **first** ends in `TIME-WAIT` (60 s on Linux); a pile of `CLOSE-WAIT` means **your** application received the peer's close but never called `close()`.
**Use this when:** you read `ss -tan`, see connection timeouts under load, thousands of `TIME-WAIT` or `CLOSE-WAIT` sockets, "cannot assign requested address" (ephemeral port exhaustion), or tune backlog sysctls.
**Not this doc:** the receive and transmit path below TCP → `networking/packet-path.md`.

## Problem
Most TCP "mysteries" in production are state questions: a listener whose backlog silently drops new connections, clients that run out of local ports because of `TIME-WAIT`, or a service leaking `CLOSE-WAIT` sockets until it hits its file-descriptor limit.

## Mental model
**Analogy:** a phone call with a receptionist. Ringing and answering is the handshake. Answered calls wait on hold (accept queue) until a worker picks them up (`accept()`); if the hold line is full, new callers hear nothing. Hanging up takes two "goodbye"s, one from each side. The person who said goodbye **first** waits a moment by the phone (`TIME-WAIT`) in case the other's last words were delayed. A person who heard "goodbye" but never hangs up stays on a dead line (`CLOSE-WAIT`).

**Artifact:** both ends of one closed loopback connection, three seconds after the client closed and the server did not (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
$ ss -tan
State      Recv-Q Send-Q Local Address:Port  Peer Address:Port
LISTEN     0      8          127.0.0.1:9000       0.0.0.0:*      # backlog 8 → Send-Q shows the limit
FIN-WAIT-2 0      0          127.0.0.1:40392    127.0.0.1:9000   # client closed first, waits for server's FIN
CLOSE-WAIT 1      0          127.0.0.1:9000     127.0.0.1:40392  # server got FIN (Recv-Q 1), app never closed
```

## How it works
**3 actors:**
- **Client application** — its job: start and end the connection, via `connect()` and `close()`.
- **Server application** — its job: accept and serve, via `listen()`, `accept()`, `recv()`/`send()`, `close()`.
- **Kernel TCP stack (on each host)** — its job: run the state machine, the SYN queue and the accept queue, via the socket layer.

```
 client                                   server kernel                       server app
 connect() ─SYN──────────────────────────► SYN queue (SYN-RECEIVED)
 SYN-SENT   ◄────────────────────SYN+ACK─
 ─ACK────────────────────────────────────► accept queue (ESTABLISHED) ──────► accept() returns fd
 ESTABLISHED  ═════════ data ══════════════════════════════════════════════  recv()/send()
 close() ─FIN────────────────────────────► CLOSE-WAIT  (recv() returns 0) ──► app must close()
 FIN-WAIT-1 ◄──────────────────────ACK─
 FIN-WAIT-2                                                          close() ◄┘
            ◄──────────────────────FIN─  LAST-ACK
 TIME-WAIT  ─ACK─────────────────────────► CLOSED
 (60 s on Linux) → CLOSED
```

1. **Handshake (kernels, network):** client `SYN` → server `SYN+ACK` → client `ACK`. Half-open requests are remembered per listener up to `tcp_max_syn_backlog`; if that overflows, SYN cookies (`tcp_syncookies`, default 1) let the server answer without storing state ✅[^2] ✅[^3].
2. **Accept queue (server kernel):** since Linux 2.2 the `backlog` argument of `listen()` sets "the queue length for completely established sockets waiting to be accepted" ✅[^2]. A larger value is silently capped to `somaxconn`, whose default is 4096 since Linux 5.4 (128 before) ✅[^2]; the lab shows 4096 ✅[^4].
3. **`accept()` (server app):** takes one connection off the queue and returns a new descriptor.
4. **Close, active side:** the side that calls `close()` first sends `FIN`, goes `FIN-WAIT-1` → `FIN-WAIT-2`, and after the peer's `FIN` ends in `TIME-WAIT` ✅[^1].
5. **Close, passive side:** receives `FIN` → `CLOSE-WAIT` ("waiting for the local user to close") → its own `close()` sends `FIN` → `LAST-ACK` → `CLOSED` ✅[^1].
6. **TIME-WAIT:** guards against a lost final `ACK` and stray delayed segments from the old connection ✅[^1]. RFC 9293 asks for 2 × MSL (4 minutes) ✅[^1]; Linux uses a fixed 60 s (`TCP_TIMEWAIT_LEN (60*HZ)`) ✅[^5].
7. **Orphans:** `tcp_fin_timeout` (60 s) is how long an orphaned connection stays in `FIN-WAIT-2`; it does **not** change `TIME-WAIT` ✅[^3].
8. **Ephemeral ports:** clients pick a local port from `ip_local_port_range`, default 32768–60999 ✅[^3] ✅[^4], so about 28 000 concurrent connections per (source IP, destination IP, destination port).

## Worked example
A load generator opens and closes 1 000 short HTTP connections per second to one backend `10.0.0.5:80`, and the **client** closes first.

| Quantity | Value |
|---|---|
| Ports in `ip_local_port_range` | 60999 − 32768 + 1 = 28 232 ✅[^3] |
| Time each closed connection stays in `TIME-WAIT` on the client | 60 s ✅[^5] |
| Ports tied up at steady state | 1 000/s × 60 s = 60 000 |
| Result | Ports run out after ~28 s: `connect()` fails with `EADDRNOTAVAIL` ("Cannot assign requested address") ✅[^4] (lab: with a 2-port range, the third `connect` failed with errno 99 "Address not available") |

Fixes, best first: reuse connections (HTTP keep-alive, connection pools); spread across more destination IPs/ports; widen `ip_local_port_range`; `tcp_tw_reuse` already defaults to `2` (loopback only), and the docs say it should not be changed without expert advice ✅[^3].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Accept queue full | New handshakes are dropped or not completed; clients see timeouts and retries, not refusals ✅[^4] (lab: `listen(1)`; two connects succeeded, the next four timed out) | Backlog limit reached ✅[^2] |
| `listen(fd, 65535)` | Effective backlog = `somaxconn` | Silently capped ✅[^2] |
| SYN flood | SYN cookies keep the server answering | Fallback when the SYN queue overflows ✅[^3] |
| Thousands of `CLOSE-WAIT` | Application leak: it never calls `close()` after `recv()` returned 0 | Passive side waits for the local close ✅[^1] |
| Thousands of `TIME-WAIT` on a server | Usually harmless (no port is consumed on the listening side) | Lab: three server-closed connections left `TIME-WAIT` entries on port 9300 while the listener kept accepting ✅[^4] |
| Idle connection dropped by a NAT/firewall | Next send fails or hangs | Keepalive default is 2 hours, longer than many idle timeouts ✅[^3] |

## Takeaways
- Pool and reuse connections instead of tuning `TIME-WAIT` away. [rule-candidate]
- `CLOSE-WAIT` growth is a bug in your code: close the socket when a read returns 0 or the peer reset. [rule-candidate]
- Size the listen backlog for bursts and remember the `somaxconn` cap; watch `ss -ltn` `Recv-Q` (current queue) vs `Send-Q` (limit).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [RFC 9293: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293.html) — IETF, 2022. Backs: state definitions, active closer enters `TIME-WAIT`, 2 × MSL, `CLOSE-WAIT` meaning. [^1]
- [listen(2)](https://man7.org/linux/man-pages/man2/listen.2.html) — Linux man-pages project, living. Backs: backlog = accept queue since 2.2, `tcp_max_syn_backlog` for incomplete, silent `somaxconn` cap, 4096 default since 5.4. [^2]
- [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html) — Linux kernel documentation, living. Backs: `tcp_fin_timeout` (FIN-WAIT-2 orphans), `tcp_tw_reuse` default 2, `ip_local_port_range`, `tcp_syncookies`, `tcp_max_syn_backlog`, keepalive 2 h. [^3]
- `linux/lab-setup.md` — the lab where the `ss` states, `somaxconn` and port range were captured on 2026-11-04. [^4]
- [`include/net/tcp.h`](https://github.com/torvalds/linux/blob/master/include/net/tcp.h) — Linux kernel source, master, read 2026-11-04. Backs: `TCP_TIMEWAIT_LEN (60*HZ)`. [^5]

## Related
- `linux/networking/packet-path.md` — the stack underneath TCP.
- `linux/storage/vfs-and-file-descriptors.md` — sockets are descriptors; `CLOSE-WAIT` leaks consume them.
