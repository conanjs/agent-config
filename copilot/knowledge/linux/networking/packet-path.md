---
schema: knowledge-doc/v1
type: concept
topic: linux/networking
status: verified
applies-to: ["Linux ≥ 5.x"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, networking, napi, softirq, rss, rps, sk-buff, socket-buffer, routing, network-stack]
---

# Life of a packet through the Linux network stack

## Summary
**TL;DR:** An incoming packet goes: NIC → ring buffer in RAM (DMA) → interrupt → **NAPI** poll in a software interrupt (softirq) → protocol layers (IP: netfilter hooks and a routing decision; then TCP/UDP) → the **socket's receive buffer** → the application's `recv()`. Outgoing data goes the reverse way: `send()` copies into the socket's send buffer → TCP/IP → routing → netfilter → queueing discipline → driver → NIC. Each hop has a queue, and each queue can overflow and drop.
**Use this when:** you debug drops, latency or "connection refused" vs timeout, tune socket buffers or interrupt spreading, or need a map of where firewalls, routing and containers plug into the stack.
**Not this doc:** firewall and NAT rules → `networking/netfilter-and-nat.md`; TCP states and the listen backlog → `networking/tcp-connection-lifecycle.md`; container network wiring → `containers/container-networking.md`.

## Problem
"The network is slow" can mean a full NIC ring, a single CPU drowning in softirq work, a firewall rule, a full socket buffer, or an application that does not read fast enough. Without the path, each drop counter (`ip -s link`, `nstat`, `ss`) looks like noise.

## Mental model
**Analogy:** a post office sorting line. Trucks (the NIC) tip letters into a bin (ring buffer) and ring a bell (interrupt). A sorter (NAPI poll) comes, switches the bell off, and empties the bin in batches. Letters pass a security desk (netfilter), a router that decides "for this building or to forward" (routing), then go into the tenant's mailbox (socket receive buffer). Tenants who do not empty their mailbox (slow `recv()`) make letters pile up and eventually be refused.

**Artifact:** interface and socket views (lab, Linux 6.17.8, 2026-11-04) ✅[^6]:
```console
$ ip -n c1 -br addr
lo               UNKNOWN        127.0.0.1/8 ::1/128
veth-c@if8       UP             10.10.0.2/24 fe80::6c2f:6ff:fea6:20a6/64
$ ip -n c1 route
default via 10.10.0.1 dev veth-c
10.10.0.0/24 dev veth-c proto kernel scope link src 10.10.0.2
$ ss -tan
State      Recv-Q Send-Q Local Address:Port  Peer Address:Port
LISTEN     0      8          127.0.0.1:9000       0.0.0.0:*
CLOSE-WAIT 1      0          127.0.0.1:9000     127.0.0.1:40392   # Recv-Q 1: data/FIN not read by the app yet
```

## How it works
**6 actors:**
- **NIC (network interface card)** — its job: receive frames and write them into RAM, via DMA into receive ring buffers; with RSS, it hashes flows over several queues, each with its own interrupt ✅[^2].
- **Driver + NAPI** — its job: turn interrupts into batched polling, via `napi_schedule()` and a poll function with a packet budget ✅[^1].
- **Protocol stack (IP, TCP/UDP)** — its job: validate, route, filter and demultiplex packets to sockets, via the kernel's per-packet buffer structure (`sk_buff`) ✅[^7].
- **Netfilter** — its job: let firewall/NAT rules inspect packets at fixed hooks, via prerouting, input, forward, output and postrouting ✅[^3].
- **Socket** — its job: buffer data between the stack and the application, via receive and send buffers sized by `tcp_rmem` / `tcp_wmem` ✅[^4].
- **Application** — its job: read and write, via `recv`/`send` (or `read`/`write`) and `epoll`.

```
RECEIVE                                                             TRANSMIT
NIC ─DMA─► RX ring ─IRQ─► napi_schedule()                            app: send()
                           │ (IRQ masked)                              │ copy into socket send buffer
                           ▼ softirq: poll(budget)                     ▼
                  [ingress] prerouting ─► ROUTING DECISION            TCP: segment, window, retransmit
                                            │            │             ▼
                                     for this host   forward       IP: output ─► ROUTING ─► postrouting
                                            ▼            ▼                                │
                                          input       forward ─► postrouting ─┐           ▼
                                            │                                 └─► queueing discipline (qdisc)
                                            ▼                                             │
                                  TCP/UDP: find socket by 4-tuple                          ▼
                                            │                                     driver ─► TX ring ─► NIC
                                            ▼
                                  socket receive buffer ─► app: recv()
```

1. **NIC (hardware):** writes frames into a receive ring and raises an interrupt. With RSS, the NIC hashes header fields to pick one of several receive queues, so different flows land on different CPUs ✅[^2].
2. **Driver (interrupt → softirq):** the interrupt handler calls `napi_schedule()` and leaves the device interrupt masked until polling finishes ✅[^1].
3. **NAPI poll (softirq):** processes up to a **budget** of packets per call; if work remains it is polled again, otherwise `napi_complete_done()` re-enables interrupts ✅[^1]. Polling normally runs in softirq context; threaded NAPI moves it to kernel threads ✅[^1]. If the hardware has one queue, RPS can spread protocol processing to other CPUs in software ✅[^2].
4. **IP layer:** packets pass netfilter's prerouting hook, then a routing decision sends them to `input` (for this host) or `forward` (to another interface) ✅[^3]; nat PREROUTING alters packets "as soon as they come in", before routing ✅[^8].
5. **Transport layer:** TCP or UDP finds the socket by source and destination address and port, and appends data to its receive buffer. The default TCP receive buffer is 128 KiB (`tcp_rmem` middle value 131072), growing up to a memory-dependent maximum ✅[^4].
6. **Application:** `recv()` copies data out of the buffer. If the application reads too slowly, the buffer fills and TCP advertises a smaller window, slowing the sender ✅[^6] (lab: with the receiver never reading, its `Recv-Q` reached 112 640 bytes and the sender's `Send-Q` 2.5 MB, then `send` blocked).
7. **Transmit:** `send()` copies into the send buffer (default 16 KiB in `tcp_wmem`) ✅[^4]; TCP segments the data, IP routes it, it passes the `output` and `postrouting` hooks ✅[^3], then the queueing discipline and driver put it on the transmit ring. XPS picks the transmit queue from the sending CPU ✅[^2].

## Worked example
A two-namespace setup in the lab shows a packet's path from a "container" to the internet (Linux 6.17.8, 2026-11-04) ✅[^6]:
```console
# inside namespace c1
$ ip netns exec c1 ping -c1 1.1.1.1
64 bytes from 1.1.1.1: seq=0 ttl=46 time=47.061 ms
```
Path of the echo request:
1. **c1 stack:** routing table says `default via 10.10.0.1 dev veth-c` → send out `veth-c`.
2. **veth pair:** a frame sent into `veth-c` appears on its peer `veth-h` in the host namespace ✅[^5].
3. **Host bridge `br0`:** receives it; IP `10.10.0.1` is the gateway.
4. **Host routing:** destination is not local → `forward` (needs `ip_forward = 1`, default 0) ✅[^4].
5. **Host `postrouting`:** the `MASQUERADE` rule rewrites the source `10.10.0.2` to the host's address (NAT, see `networking/netfilter-and-nat.md`).
6. **Out of the host NIC → internet**, and the reply follows the reverse path, un-NAT'd by connection tracking.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| One CPU at 100% in `si` (softirq) while others idle | Throughput capped by one core | All flows on one RX queue; spread with RSS/RPS ✅[^2] |
| RX ring overflows | Counted as missed/dropped on the interface (`ip -s link`) | Buffer exhaustion is counted in `rx_missed_errors` ✅[^9] |
| `Recv-Q` growing on an established socket | Application is not reading | Data waits in the socket buffer ✅[^6] |
| Forwarding between namespaces does not work | Packets dropped at routing | `ip_forward` is 0 by default ✅[^4] |
| Busy polling enabled | Lower latency, more CPU | Apps poll before the interrupt fires ✅[^1] |
| "Connection refused" vs timeout | Refused = an RST came back (no listener); timeout = packets dropped silently (firewall, routing) | Lab: closed port → "Connection refused" at once; port behind an iptables `DROP` → "timed out" after 3 s ✅[^6] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Bigger socket buffers | Fills long fat pipes (high bandwidth × delay) | More memory per connection; more queueing delay |
| RSS/RPS across all CPUs | Parallel packet processing | Cache misses if the app runs on another CPU (RFS mitigates) ✅[^2] |
| Busy polling / threaded NAPI pinned | Lower, steadier latency | Burns a core ✅[^1] |

## Takeaways
- Walk the path when debugging: interface counters → softirq CPU → netfilter → routing → socket queues (`ss -tanm`) → application.
- A growing `Recv-Q` is an application problem; drops on the interface are a kernel/NIC capacity problem.
- Containers and Kubernetes networking are this same path with veth pairs, bridges and NAT added.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 29 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [NAPI](https://docs.kernel.org/networking/napi.html) — Linux kernel documentation, living. Backs: interrupt then poll, masked IRQ, budget, `napi_complete_done`, softirq context, threaded NAPI, busy polling. [^1]
- [Scaling in the Linux Networking Stack](https://docs.kernel.org/networking/scaling.html) — Linux kernel documentation, living. Backs: RSS, RPS, RFS, XPS. [^2]
- [Netfilter hooks](https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks) — nftables project wiki, living. Backs: hook order for local, forwarded and locally generated packets. [^3]
- [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html) — Linux kernel documentation, living. Backs: `tcp_rmem` / `tcp_wmem` defaults, `ip_forward` default 0. [^4]
- [veth(4)](https://man7.org/linux/man-pages/man4/veth.4.html) — Linux man-pages project, living. Backs: veth pairs connect namespaces. [^5]
- `linux/lab-setup.md` — the lab where the namespace, route, ping and `ss` output were captured on 2026-11-04. [^6]
- [struct sk_buff](https://docs.kernel.org/networking/skbuff.html) — Linux kernel documentation, living. Backs: `sk_buff` is the networking packet structure. [^7]
- [iptables(8)](https://man7.org/linux/man-pages/man8/iptables.8.html) — netfilter project via Linux man-pages, living. Backs: nat table PREROUTING alters packets as they come in, OUTPUT before routing, POSTROUTING as they are about to go out. [^8]
- [Interface statistics](https://docs.kernel.org/networking/statistics.html) — Linux kernel documentation, living. Backs: `rx_dropped` vs `rx_missed_errors` (drops from buffer exhaustion). [^9]

## Related
- `linux/networking/netfilter-and-nat.md` — what the hooks do with rules.
- `linux/networking/tcp-connection-lifecycle.md` — handshake, backlog and TIME-WAIT.
- `linux/containers/container-networking.md` — veth, bridge and NAT for containers.
