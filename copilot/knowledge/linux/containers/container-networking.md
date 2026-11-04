---
schema: knowledge-doc/v1
type: concept
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.x", "Docker bridge networking", "CNI bridge-style plugins"]
derived-from: [linux/containers/container-from-primitives-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, container-networking, network-namespace, veth, bridge, nat, masquerade, port-publishing, cni]
---

# Container networking: veth, bridges and NAT

## Summary
**TL;DR:** A container starts with its own **network namespace**, which contains only a loopback that is down. To connect it, the runtime creates a **veth pair** (a virtual cable), moves one end into the container (named `eth0`), plugs the other end into a host **bridge** (a virtual switch, e.g. `docker0`), gives the container an IP on the bridge's subnet with the bridge as default gateway, turns on IP forwarding, and adds **NAT** rules: MASQUERADE (source NAT) so the container can reach the outside, DNAT so a published host port reaches the container.
**Use this when:** a container has no network or no DNS, port publishing does not work, two containers cannot reach each other, or you want to understand what Docker's bridge driver or a bridge-type CNI plugin does underneath.
**Not this doc:** NAT and hook details → `networking/netfilter-and-nat.md`; the packet path inside one stack → `networking/packet-path.md`.

## Problem
Container networking looks like magic until something fails: "works on the host, not in the container", "port published but connection refused", "containers on the same host cannot talk". Each failure maps to one missing piece: namespace, veth, bridge, route, forwarding or a NAT rule.

## Mental model
**Analogy:** each container is a flat with no phone line. The runtime runs a cable (veth) from the flat to the building's switchboard (bridge). The switchboard has its own number (gateway IP). Outgoing calls go through the building's main line, which shows the building's number to the outside (MASQUERADE). A public extension number on the building's main line forwards to one flat (DNAT, "publish port").

**Artifact:** the empty starting point and the wired result (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
$ unshare --net ip -br link                       # brand-new network namespace
lo               DOWN           00:00:00:00:00:00 <LOOPBACK>
$ ip -n c1 -br addr                                # after wiring (see Worked example)
lo               UNKNOWN        127.0.0.1/8 ::1/128
veth-c@if8       UP             10.10.0.2/24 fe80::6c2f:6ff:fea6:20a6/64   # "@if8": peer is ifindex 8 on the host
```

## How it works
**5 actors:**
- **Network namespace** — its job: give the container its own interfaces, routes and firewall, via `CLONE_NEWNET` ✅[^1].
- **veth pair** — its job: connect two namespaces, via two linked devices where a packet sent into one end comes out of the other ✅[^2].
- **Bridge** — its job: switch frames between all attached veth ends and act as the gateway, via a Linux bridge device with an IP.
- **Host routing + forwarding** — its job: route between the bridge and the uplink, via `ip_forward = 1` (default 0) ✅[^3].
- **Netfilter NAT** — its job: rewrite addresses at the edge, via MASQUERADE in postrouting and DNAT in prerouting ✅[^5].

```
   container c1 (netns)                    host (root netns)                          outside
 ┌───────────────────────┐        ┌──────────────────────────────────────────┐
 │ eth0 / veth-c         │ veth   │ veth-h ──┐                               │
 │ 10.10.0.2/24          │════════│          ├─ br0 10.10.0.1/24 ── routing ─┼─ uplink ─► internet
 │ default via 10.10.0.1 │ cable  │ (other   │                     ip_forward│   (src NAT: MASQUERADE)
 └───────────────────────┘        │  veths) ─┘                               │
                                  │ prerouting DNAT :8080 → 10.10.0.2:80  ◄──┼── client
                                  └──────────────────────────────────────────┘
```

1. **Runtime (host):** creates the namespace; inside it only `lo` exists, and it is down ✅[^4].
2. **Runtime (host):** creates a veth pair and moves one end into the namespace (`ip link add … type veth peer name … netns …` or `ip link set … netns …`) ✅[^2].
3. **Runtime (host):** attaches the host end to the bridge and brings it up.
4. **Runtime (inside the namespace):** assigns the IP, brings up `eth0` and `lo`, adds `default via <bridge IP>`.
5. **Runtime (host):** enables forwarding and adds MASQUERADE for the subnet leaving through anything other than the bridge.
6. **Runtime (host), per published port:** adds a DNAT rule from the host port to the container IP and port.
7. **Runtime (rootfs):** writes `/etc/resolv.conf` (and `/etc/hosts`) into the container so names resolve — in the lab Docker bind-mounted its own `/etc/resolv.conf`, `/etc/hosts` and `/etc/hostname` into the container ✅[^4].

Containers on the same bridge reach each other directly at layer 2 through the bridge, with no NAT ✅[^4] (lab: nginx in one container logged the other container's own IP as the client).

## Worked example
The full wiring for one "container" namespace `c1`, run in the lab (Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
# ip netns add c1
# ip link add br0 type bridge && ip addr add 10.10.0.1/24 dev br0 && ip link set br0 up
# ip link add veth-h type veth peer name veth-c
# ip link set veth-c netns c1 && ip link set veth-h master br0 up
# ip -n c1 addr add 10.10.0.2/24 dev veth-c
# ip -n c1 link set veth-c up && ip -n c1 link set lo up
# ip -n c1 route add default via 10.10.0.1
# echo 1 > /proc/sys/net/ipv4/ip_forward
# iptables -t nat -A POSTROUTING -s 10.10.0.0/24 ! -o br0 -j MASQUERADE
# ping -c1 -W1 10.10.0.2 | tail -1                    # host → container through the bridge
1 packets transmitted, 1 packets received, 0% packet loss
# ip netns exec c1 ping -c1 -W2 1.1.1.1 | tail -1     # container → internet through NAT
1 packets transmitted, 1 packets received, 0% packet loss
```

Troubleshooting order when a container has no network:

| Check | Command | Healthy result |
|---|---|---|
| Interface up with an IP | `nsenter -t <pid> -n ip addr` | `eth0` UP, address in the bridge subnet |
| Default route | `nsenter -t <pid> -n ip route` | `default via <bridge IP>` |
| Host side attached | `ip link show master <bridge>` | the veth listed, UP |
| Forwarding | `sysctl net.ipv4.ip_forward` | `= 1` |
| NAT rule | `nft list ruleset` or `iptables -t nat -S` | MASQUERADE for the subnet |
| DNS | `cat /etc/resolv.conf` inside | a reachable nameserver |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `--network host` | No new namespace; container uses the host's interfaces and ports | No `CLONE_NEWNET` ✅[^1] ✅[^6] |
| `--network none` | Only `lo` | New namespace, never wired ✅[^4] |
| `ip_forward = 0` | Container reaches the bridge IP, nothing beyond | Forwarding disabled ✅[^3] |
| Published port tested via `localhost` on the host | May not match the prerouting DNAT | Local traffic takes output, not prerouting ✅[^5] |
| Peer of a veth unknown | Find it with `ethtool -S <dev>` (`peer_ifindex`) or the `@ifN` suffix | ✅[^2] ✅[^4] |
| One veth end goes down | The whole pair is down | Pair link state is shared ✅[^2] |
| Pods in Kubernetes | Same pieces per pod (one netns shared by the pod's containers), wired by a CNI plugin; cross-node traffic needs routing or an overlay | ✅[^7] |

## Takeaways
- Debug container networking from the host with `nsenter -t <pid> -n`, walking: interface → route → bridge → forwarding → NAT → DNS.
- Published ports are DNAT rules; test them from another machine, not only from the host.
- Containers on one bridge talk directly; across hosts something else (routing, an overlay network) is needed.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) — Linux man-pages project, living. Backs: network namespaces isolate devices, stacks and ports. [^1]
- [veth(4)](https://man7.org/linux/man-pages/man4/veth.4.html) — Linux man-pages project, living. Backs: pairs, moving ends between namespaces, shared link state, `peer_ifindex`. [^2]
- [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html) — Linux kernel documentation, living. Backs: `ip_forward` default 0. [^3]
- `linux/lab-setup.md` — the lab where the empty namespace, the wiring commands and the pings were captured on 2026-11-04. [^4]
- [Netfilter hooks](https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks) — nftables project wiki, living. Backs: DNAT in prerouting, SNAT in postrouting, local traffic through output. [^5]
- `linux/containers/container-from-primitives-deep-dive.md` — the deep dive this doc was distilled from.
- [Host network driver](https://docs.docker.com/engine/network/drivers/host/) — Docker, living. Backs: with host networking the container shares the host's network stack. [^6]
- [Services, Load Balancing, and Networking](https://kubernetes.io/docs/concepts/services-networking/) — Kubernetes project, living. Backs: one network namespace per pod; CNI plugins implement the pod network. [^7]

## Related
- `linux/networking/netfilter-and-nat.md` — the NAT rules in detail.
- `linux/networking/packet-path.md` — the stack each namespace has.
- `linux/containers/namespaces.md` — network namespaces among the others.
