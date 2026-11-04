---
schema: knowledge-doc/v1
type: reference
topic: windows
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+", "the docs under knowledge/windows/ as of 2026-11-04"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, learning-path, curriculum, roadmap, study-plan, internals]
---

# Windows internals learning path

## Summary
**TL;DR:** Six stages, each mapped to its Linux counterpart so knowledge transfers both ways: (1) architecture, boot, registry and services; (2) processes, threads, handles, jobs and scheduling; (3) memory and commit; (4) NTFS and I/O; (5) security tokens, ACLs, integrity and UAC; (6) networking, containers, WSL and diagnostics. Each stage lists docs, a hands-on exercise for a Windows machine or VM, and a self-check.
**Use this when:** you start learning Windows internals, especially coming from Linux, or want the next Windows doc to read.
**Not this doc:** the Linux path → `linux/learning-path.md`.

## Scope
Every v1 doc under `knowledge/windows/`, the legacy symlink note, and the Linux doc to compare at each stage. These docs were written without a Windows lab, so the exercises are for you to run on a Windows 10/11 machine or VM; record what you see in the matching doc.

## Catalog

### Stages

| # | Stage | Read | Compare with Linux | Exercise (on Windows) | Self-check: you can explain … |
|---|---|---|---|---|---|
| 1 | Architecture & startup | `fundamentals/architecture-and-kernel-mode.md` → `fundamentals/boot-process.md` → `fundamentals/registry-and-services.md` | `linux/fundamentals/kernel-and-system-calls.md`, `linux/fundamentals/boot-process.md`, `linux/system-management/systemd-services.md` | `bcdedit /enum`; `sc.exe qc` a service; find its key under `HKLM\SYSTEM\CurrentControlSet\Services` | … why a driver bug blue-screens the machine but an app crash does not, and which phase a given boot error belongs to |
| 2 | Processes & scheduling | `processes/processes-threads-and-handles.md` → `processes/scheduling-and-priorities.md` | `linux/processes/process-lifecycle.md`, `linux/processes/cpu-scheduling.md` | Process Explorer: watch handle counts; set a CPU-bound tool to High and observe UI responsiveness | … why Windows has no `fork`, how to kill a process tree, and what base priority 8 means |
| 3 | Memory | `memory/virtual-memory-and-commit.md` | `linux/memory/virtual-memory.md`, `linux/memory/oom-killer.md` | Task Manager → Memory: read Committed vs commit limit; Performance Monitor `\Memory\% Committed Bytes In Use` | … why Windows fails allocations where Linux would OOM-kill |
| 4 | Storage & I/O | `storage/ntfs-and-io.md` → legacy `symlinks-privilege.md` | `linux/storage/vfs-and-file-descriptors.md`, `linux/storage/ext4-and-lvm.md` | `echo x > f.txt:s` then `dir /r`; try deleting a file open in another program | … why "file in use" happens and what the MFT is |
| 5 | Security | `security/tokens-acls-and-uac.md` | `linux/fundamentals/users-and-permissions.md`, `linux/security/lsm-and-landlock.md` | `whoami /all` (non-elevated vs elevated); `icacls` on a folder; observe integrity levels in Process Explorer | … the ACE-order rule and why an admin gets "access denied" without elevation |
| 6 | Networking, containers, operations | `networking/windows-networking-and-wfp.md` → `containers/windows-containers-and-wsl.md` → `system-management/diagnostics-tools.md` | `linux/networking/netfilter-and-nat.md`, `linux/containers/container-from-primitives-deep-dive.md`, `linux/system-management/observability-tools.md` | `netsh wfp show state`; `docker run --isolation=hyperv …` vs process; record a WPR trace | … process vs Hyper-V isolation, and which tool replaces `strace` on Windows |

### Free, authoritative resources

| Resource | Why |
|---|---|
| [Win32 system services documentation](https://learn.microsoft.com/en-us/windows/win32/) | Processes, memory, security, file I/O, services, registry |
| [Windows driver documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/) | Kernel-mode architecture, IRPs, object manager |
| [Windows containers documentation](https://learn.microsoft.com/en-us/virtualization/windowscontainers/) | Isolation modes, images, networking |
| [Sysinternals](https://learn.microsoft.com/en-us/sysinternals/) | The standard diagnostic tool suite |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| Kernel debugging and crash dump analysis (WinDbg) | `system-management/` | Microsoft Learn "Debugging Tools for Windows" |
| Active Directory, Kerberos and Group Policy | new `identity/` subtopic | Microsoft Learn AD DS overview |
| PowerShell remoting, WMI/CIM | `system-management/` | Microsoft Learn PowerShell docs |
| ReFS, Storage Spaces, VSS snapshots | `storage/` | Microsoft Learn Windows Server storage |
| Hyper-V internals | new subtopic | Microsoft Learn Hyper-V architecture |
| Windows nodes in Kubernetes | `kubernetes/` + `windows/` | kubernetes.io "Windows containers in Kubernetes" |

## Lookup notes
- Every Windows doc says so where its examples are illustrative; promote a doc to `verified` only after running its examples and recording the output.
- Microsoft Learn pages are living; check the "Applies to" line on each page when a version matters.

## Takeaways
- Learn Windows and Linux side by side: each Windows doc names its Linux counterpart.
- Run each stage's exercise on a real Windows machine or VM and record the output in the doc.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: resources table.
- [Windows drivers documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/) — Microsoft Learn, living. Backs: resources table.
- [Windows containers documentation](https://learn.microsoft.com/en-us/virtualization/windowscontainers/) — Microsoft Learn, living. Backs: resources table.
- `linux/learning-path.md` — the parallel Linux path.

## Related
- `linux/learning-path.md` — Linux internals in the same stage order.
- `kubernetes/learning-path.md` — containers and orchestration.
