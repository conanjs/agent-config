---
schema: knowledge-doc/v1
type: concept
topic: linux/networking
status: verified
applies-to: ["Linux ≥ 5.x", "iptables ≥ 1.8 (nf_tables backend)", "nftables"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, netfilter, iptables, nftables, nat, snat, dnat, masquerade, conntrack, firewall]
---

# Netfilter, iptables/nftables, NAT and connection tracking

## Summary
**TL;DR:** Netfilter is a set of **hooks** inside the kernel's network path (prerouting, input, forward, output, postrouting). Firewall tools attach rule chains to those hooks: **iptables** (classic) and **nftables** (its successor); modern iptables is often just a front end writing nftables rules. **Connection tracking (conntrack)** remembers every flow, so a NAT rule is only evaluated for a connection's first packet and replies are translated back automatically. **DNAT** (prerouting) changes the destination — this is how "publish port 8080" works; **SNAT/MASQUERADE** (postrouting) changes the source — this is how containers reach the internet.
**Use this when:** you write or read firewall rules, debug Docker/Kubernetes port publishing or outbound access, see `nf_conntrack: table full` drops, or wonder whether a host uses iptables or nftables.
**Not this doc:** where hooks sit in the whole packet path → `networking/packet-path.md`; the container wiring that uses these rules → `containers/container-networking.md`.

## Problem
Docker, Kubernetes (kube-proxy in iptables mode), firewalld and ufw all write netfilter rules, often to the same tables. Rules seem to be ignored (wrong hook), replies get lost (NAT without conntrack in mind), or connections fail at scale (conntrack table full) — all hard to debug without the hook and conntrack model.

## Mental model
**Analogy:** checkpoints on a road network. Each checkpoint (hook) sits at a fixed junction: "entering town" (prerouting), "arriving at a house in town" (input), "passing through town" (forward), "leaving a house" (output), "leaving town" (postrouting). Guards (rule chains) at each checkpoint can stop cars, wave them on, or swap licence plates (NAT). A logbook (conntrack) remembers every trip, so a car with swapped plates gets its original plates back on the return trip without asking the guards again.

**Artifact:** an iptables NAT rule and the nftables rule it really became (lab, iptables v1.8.10, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
# iptables -t nat -A POSTROUTING -s 10.9.0.0/24 -j MASQUERADE
# iptables -V
iptables v1.8.10 (nf_tables)            # front end for the nf_tables kernel engine
# nft list ruleset
# Warning: table ip nat is managed by iptables-nft, do not touch!
table ip nat {
	chain POSTROUTING {
		type nat hook postrouting priority srcnat; policy accept;
		ip saddr 10.9.0.0/24 counter packets 0 bytes 0 xt target "MASQUERADE"
	}
}
```

## How it works
**4 actors:**
- **Netfilter hooks** — its job: call registered functions at fixed points of the packet path, via prerouting, input, forward, output, postrouting (plus per-interface ingress/egress) ✅[^1].
- **Connection tracking** — its job: record each flow and its state, via hooks at priority −200 in prerouting and output, confirmed last in input and postrouting ✅[^1].
- **Rule engine (nftables or iptables)** — its job: match packets and apply verdicts (accept, drop) or NAT, via chains attached to hooks at priorities (dstnat −100, filter 0, srcnat 100) ✅[^1].
- **Administrator / orchestrator** — its job: write rules, via `nft`, `iptables`, firewalld, Docker, kube-proxy.

```
                   packet for this host
 [ingress] ─► PREROUTING ─► routing ─────────────────► INPUT ─► local process
   (raw -300,               │                                         │
    conntrack -200,         │ not for this host                       │ reply / new
    dstnat -100: DNAT)      ▼                                         ▼
                          FORWARD (filter 0)                        OUTPUT (conntrack -200, filter 0)
                            │                                         │
                            └──────────────► POSTROUTING ◄────────────┘
                                             (srcnat 100: SNAT / MASQUERADE)
                                                  │
                                                  ▼ out of an interface
```

Hook order per packet type ✅[^1]:

| Packet | Hooks passed |
|---|---|
| Arriving for this host | ingress → prerouting → input |
| Forwarded through this host | ingress → prerouting → forward → postrouting |
| Generated locally | output → postrouting |

1. **Hook entry:** each registered chain runs in priority order: raw (−300) before conntrack (−200), mangle (−150), dstnat (−100), filter (0), srcnat (100) ✅[^1]. NAT chains must use a priority above −200 so conntrack has already run ✅[^1].
2. **Conntrack:** the first packet of a flow creates an entry; later packets match it. The entry is confirmed at the very end of input/postrouting (priority `INT_MAX`) ✅[^1].
3. **DNAT (prerouting, dstnat):** rewrites the destination before routing, so the routing decision sees the new address (that is why it must be in prerouting) ✅[^5].
4. **Filter (input/forward/output):** accept or drop.
5. **SNAT / MASQUERADE (postrouting, srcnat):** rewrites the source as the packet leaves; MASQUERADE uses the outgoing interface's current address ✅[^5] ✅[^6].
6. **Replies:** conntrack recognizes the reply direction and reverses the translation without consulting NAT rules again — SNAT/DNAT apply to "all future packets in this connection" ✅[^6].

**iptables vs nftables:** iptables uses fixed tables (`filter`, `nat`, `mangle`, `raw`) with built-in chains; nftables lets you create tables and chains and attach them to hooks with explicit `type … hook … priority` ✅[^1]. `iptables-nft` writes nftables rules into tables it manages, as the lab output shows ✅[^4].

## Worked example
"Publish container port 80 on host port 8080" and "let the container reach the internet", as plain rules (lab, 2026-11-04) ✅[^4]:
```console
# iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 10.10.0.2:80
# iptables -t nat -A POSTROUTING -s 10.10.0.0/24 ! -o br0 -j MASQUERADE
# iptables -t nat -L POSTROUTING -n -v
 pkts bytes target     prot opt in     out     source               destination
    1    84 MASQUERADE  0    --  *      !br0    10.10.0.0/24         0.0.0.0/0
```
A client `203.0.113.7:51000` connects to host `198.51.100.10:8080`:

| Step | Hook | Packet (src → dst) |
|---|---|---|
| 1 | prerouting, DNAT | `203.0.113.7:51000 → 198.51.100.10:8080` becomes `→ 10.10.0.2:80` |
| 2 | routing | `10.10.0.2` is reached via `br0` → forward |
| 3 | forward, postrouting | Delivered to the container; source unchanged |
| 4 | reply | `10.10.0.2:80 → 203.0.113.7:51000` |
| 5 | conntrack reverse NAT | Source rewritten back to `198.51.100.10:8080` |

The `MASQUERADE` counter (1 packet, 84 bytes) is the container's single outbound ping in the lab; 84 bytes = 20-byte IP header + 8-byte ICMP header + 56 bytes of data (lab: `ping` printed "56 data bytes") ✅[^4].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| DNAT rule placed in `output` only | Remote clients not translated | Remote packets pass prerouting, not output ✅[^1] |
| Testing a published port from the host itself | May fail even though remote clients work | Local traffic goes through output, not prerouting ✅[^1] |
| Conntrack table full | New connections dropped (kernel log: "table full, dropping packet") | Every flow needs an entry; limit `nf_conntrack_max` (327 680 in the lab VM) ✅[^4] ✅[^7] |
| Mixing `iptables-legacy` and nftables rules | Two rule sets both apply; confusing results | Separate engines hook the same points ✅[^4] (lab: a legacy `DROP` for 127.0.0.3 blocked ping although an nft `ACCEPT` existed) |
| Editing an iptables-nft managed table with `nft` | Warned against | "managed by iptables-nft, do not touch!" ✅[^4] |
| Forwarding disabled | Forward rules never see packets | `ip_forward` = 0 by default ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| nftables directly | One engine, sets and maps, atomic rule updates | Different syntax from older docs |
| iptables (nft backend) | Compatible with tools and docs | Less expressive; hidden translation |
| Large linear rule lists (iptables-mode kube-proxy) | Simple model | Per-Service chains grow with Services and endpoints (see `kubernetes/networking/services-and-kube-proxy.md`) |

## Takeaways
- Put DNAT in prerouting (and output for local clients), SNAT/MASQUERADE in postrouting, filtering in input/forward/output.
- Check `iptables -V`: "(nf_tables)" means `nft list ruleset` shows the real, complete state.
- Size `nf_conntrack_max` for high-connection hosts (NAT gateways, nodes running many pods).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 23 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Netfilter hooks](https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks) — nftables project wiki, living. Backs: hooks, per-packet order, ingress/egress, priorities (raw, conntrack, mangle, dstnat, filter, srcnat, confirm), NAT priority rule. [^1]
- [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html) — Linux kernel documentation, living. Backs: `ip_forward` default 0. [^2]
- [Quick reference: nftables in 10 minutes](https://wiki.nftables.org/wiki-nftables/index.php/Quick_reference-nftables_in_10_minutes) — nftables project wiki, living. Backs: further reading, nftables syntax.
- `linux/lab-setup.md` — the lab where the DNAT/MASQUERADE rules, counters, nft translation and `nf_conntrack_max` were captured on 2026-11-04. [^4]
- [iptables(8)](https://man7.org/linux/man-pages/man8/iptables.8.html) — netfilter project via Linux man-pages, living. Backs: nat table PREROUTING alters packets as they come in, OUTPUT before routing, POSTROUTING as they are about to go out. [^5]
- [iptables-extensions(8)](https://man7.org/linux/man-pages/man8/iptables-extensions.8.html) — netfilter project via Linux man-pages, living. Backs: SNAT/DNAT mangle all future packets of the connection; MASQUERADE maps to the IP address of the interface the packet is going out. [^6]
- [net/netfilter/nf_conntrack_core.c](https://github.com/torvalds/linux/blob/master/net/netfilter/nf_conntrack_core.c) — Linux kernel source, read 2026-11-04. Backs: the warning "nf_conntrack: table full, dropping packet". [^7]

## Related
- `linux/networking/packet-path.md` — the whole path around the hooks.
- `linux/containers/container-networking.md` — how runtimes wire veth, bridges and these NAT rules.
