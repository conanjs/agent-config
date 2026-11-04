---
schema: topic-index/v1
kind: subtopic
topic: windows/networking
last-updated: 2026-11-04
---

# Windows networking

The Windows Filtering Platform — layers, filter engine, callouts, arbitration and the Base Filtering Engine — compared with Linux netfilter. Not covered: SMB, DNS client, Hyper-V virtual switch internals.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [windows-networking-and-wfp.md](windows-networking-and-wfp.md) | concept | Applications reach the network through **Winsock**, which hands work to the kernel's TCP/IP stack (`tcpip.sys`) | verified |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.

## Related
- `windows/learning-path.md` — where this subtopic sits in the learning order.
- `linux/` — the Linux counterpart of each Windows mechanism.
