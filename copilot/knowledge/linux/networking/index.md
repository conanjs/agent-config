---
schema: topic-index/v1
kind: subtopic
topic: linux/networking
last-updated: 2026-11-04
---

# Networking

The path of a packet through the kernel (NAPI, RSS/RPS, routing, socket buffers), netfilter hooks with iptables/nftables, NAT and conntrack, the TCP state machine with Linux backlog and TIME-WAIT behaviour, and event-loop I/O with epoll and io_uring. Not covered: routing protocols, wireless.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [packet-path.md](packet-path.md) | concept | An incoming packet goes: NIC → ring buffer in RAM (DMA) → interrupt → **NAPI** poll in a software interrupt (softirq) → protocol layers (IP: netfilter hooks and a routing decision; then TCP/UDP) → the **socket's receive buffer** → the application's `recv()` | verified |
| [netfilter-and-nat.md](netfilter-and-nat.md) | concept | Netfilter is a set of **hooks** inside the kernel's network path (prerouting, input, forward, output, postrouting) | verified |
| [tcp-connection-lifecycle.md](tcp-connection-lifecycle.md) | concept | A TCP connection moves through the RFC 9293 states: three-way handshake (`SYN-SENT`/`SYN-RECEIVED` → `ESTABLISHED`), data, then a four-step close | verified |
| [io-multiplexing-epoll-io-uring.md](io-multiplexing-epoll-io-uring.md) | concept | A server with thousands of connections cannot block on each one | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
