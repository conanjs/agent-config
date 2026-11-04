---
schema: knowledge-doc/v1
type: concept
topic: windows/networking
status: verified
applies-to: ["Windows Vista / Server 2008 and later (WFP)", "Windows 10 / 11", "Windows Server 2016+"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, networking, wfp, windows-filtering-platform, firewall, winsock, tcpip, base-filtering-engine]
---

# Windows networking stack and the Windows Filtering Platform

## Summary
**TL;DR:** Applications reach the network through **Winsock**, which hands work to the kernel's TCP/IP stack (`tcpip.sys`). Packet filtering in the stack goes through the **Windows Filtering Platform (WFP)**: a set of hooks ("layers") in the network stack plus a **filter engine** that evaluates filters at each layer, can call out to driver code ("callouts"), and arbitrates between policy sources. The **Base Filtering Engine (BFE)** service accepts and manages filters. Windows Defender Firewall, IPsec and many third-party firewalls and VPNs are WFP clients — WFP plays the role netfilter plays on Linux.
**Use this when:** you debug blocked connections on Windows, wonder how the firewall and third-party security tools coexist, or map Linux netfilter knowledge to Windows.
**Not this doc:** the Linux equivalent → `linux/networking/netfilter-and-nat.md`; containers' networking on Windows → `containers/windows-containers-and-wsl.md`.

## Problem
A connection works with the firewall "off" but not "on", or works on one machine with a security agent installed differently — and no single rule list explains it, because several WFP clients (firewall, IPsec, VPN, antivirus) each add filters and the engine arbitrates between them.

## Mental model
**Analogy:** airport security with checkpoints at fixed places (layers): landside entry, gate, boarding. Several agencies (firewall, IPsec, VPN, antivirus) each post their own instructions at the checkpoints; a supervisor (filter engine) applies them and decides who wins when instructions conflict; some agencies send their own officer to inspect particular bags (callouts).

**Artifact:** commands that show the pieces (standard Windows tools; output omitted because no Windows machine was available):
```text
netsh wfp show state            :: dump WFP layers, filters, callouts and providers to wfpstate.xml
netsh wfp show filters          :: dump the current filters
Get-NetFirewallRule -Enabled True | Select-Object DisplayName,Direction,Action
Get-NetTCPConnection -State Listen
```

## How it works
**4 actors:**
- **Application** — its job: open sockets, via Winsock ✅[^3].
- **Network stack with WFP shims** — its job: expose hooks at many layers of the stack ✅[^1].
- **Filter engine (kernel and user mode)** — its job: evaluate filters at each layer over any data field, invoke callouts, and arbitrate between policy sources ✅[^1].
- **Base Filtering Engine (BFE) service** — its job: control WFP operation and accept filters and configuration ✅[^1].

1. **Platform:** WFP replaced the older Windows XP / Server 2003 filtering interfaces; it is "a set of hooks into the network stack and a filtering engine" ✅[^1].
2. **Filter engine:** a multi-layer filtering infrastructure hosted in both kernel and user mode; filters traffic at any layer over any field a shim provides ✅[^1].
3. **Callouts:** filters can invoke driver callouts during classification for deeper inspection or modification ✅[^1].
4. **Arbitration:** the engine decides priority between policy sources — e.g. an application that wants its traffic secured vs a local firewall that blocks such traffic ✅[^1].
5. **BFE:** the service that accepts filters and settings and controls the platform ✅[^1]. 

**WFP vs netfilter:**

| Topic | Windows | Linux |
|---|---|---|
| Hook framework | WFP layers | Netfilter hooks (prerouting, input, forward, output, postrouting) |
| Rule engine | Filter engine (+ BFE service) | nftables / iptables |
| Extensions | Callout drivers | Kernel modules, eBPF |
| Built-in firewall | Firewalls are built on WFP since Vista / Server 2008 ✅[^4] | nftables/iptables rules, firewalld/ufw front ends |
| Multiple policy owners | Engine arbitrates between providers ✅[^1] | Separate tables/chains by priority |

## Worked example
"App works with the firewall off, fails with it on":

| Step | Action | Looks for |
|---|---|---|
| 1 | `Get-NetFirewallRule -Enabled True` for the app's port and program | A block rule, or no allow rule for inbound traffic |
| 2 | `netsh wfp show state` | Filters from other providers (VPN, security agent) at the same layer |
| 3 | Enable firewall audit logging / WFP auditing | Which filter dropped the packet — "Audit Filtering Platform Packet Drop" events ✅[^5] |
| 4 | Fix | Add a narrow allow rule for the program and port, or adjust the third-party provider's policy |

Steps use standard tools; outputs were not captured (no Windows lab).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Two security products both filtering | Conflicts resolved by arbitration, possibly unexpectedly | Engine arbitrates between sources ✅[^1] |
| BFE service disabled | The platform's controlling service is gone | BFE controls WFP ✅[^1] |
| Inbound connection to a Windows container or WSL 2 service | Extra NAT/forwarding layer | WSL 2 uses NAT by default ✅[^2] |
| Callout driver bug | Affects classification of every matching packet | The engine invokes callouts during classification ✅[^1] |

## Takeaways
- On Windows, "the firewall" is one WFP provider among several; inspect WFP state when rules do not explain behaviour.
- Prefer narrow program+port allow rules over disabling the firewall.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [About Windows Filtering Platform](https://learn.microsoft.com/en-us/windows/win32/fwp/about-windows-filtering-platform) — Microsoft Learn, living. Backs: WFP purpose and replacement of older interfaces, hooks + filter engine, kernel/user hosting, any-layer filtering, callouts, arbitration, Base Filtering Engine. [^1]
- [Comparing WSL Versions](https://learn.microsoft.com/en-us/windows/wsl/compare-versions) — Microsoft Learn, living. Backs: WSL 2 NAT networking. [^2]
- [Windows Defender Firewall overview](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/) — Microsoft Learn, living. Backs: further reading on the built-in firewall.
- No Windows lab was available when this doc was written (macOS host); commands are listed without captured output.
- [Windows Sockets 2](https://learn.microsoft.com/en-us/windows/win32/winsock/windows-sockets-start-page-2) — Microsoft Learn, living. Backs: Winsock is the networking API for applications. [^3]
- [Windows Filtering Platform](https://learn.microsoft.com/en-us/windows/win32/fwp/windows-filtering-platform-start-page) — Microsoft Learn, living. Backs: since Vista / Server 2008 firewalls are built with WFP; the old firewall-hook drivers are gone. [^4]
- [Audit Filtering Platform Packet Drop](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/audit-filtering-platform-packet-drop) — Microsoft Learn, living. Backs: audit events when WFP drops packets. [^5]

## Related
- `linux/networking/netfilter-and-nat.md` — the Linux counterpart.
- `windows/system-management/diagnostics-tools.md` — network diagnostic tools.
