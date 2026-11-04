---
schema: knowledge-doc/v1
type: reference
topic: windows/system-management
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+", "PowerShell 5.1 / 7"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, diagnostics, etw, event-log, performance-counters, sysinternals, process-explorer, wpr, powershell]
---

# Windows diagnostics tools by resource

## Summary
**TL;DR:** A lookup table of which Windows tool, counter or log answers which question — CPU, memory, disk, network, processes, services, boot — with the Linux tool that plays the same role. The deepest source is **ETW (Event Tracing for Windows)**, a kernel-level tracing facility with controllers, providers and consumers that most other tools build on.
**Use this when:** you know what you want to measure on Windows but not which tool shows it, or you translate a Linux troubleshooting habit to Windows.
**Not this doc:** what the numbers mean → the concept docs (`memory/virtual-memory-and-commit.md`, `processes/scheduling-and-priorities.md`).

## Scope
Built-in Windows tools, PowerShell cmdlets, performance counters and the free Sysinternals suite, for Windows 10/11 and Server 2016+. Claims about specific counters and ETW come from Microsoft Learn; No Windows lab was available to capture output.

## Catalog

### By resource (USE: utilization, saturation, errors)

| Resource | Utilization | Saturation | Errors | Linux equivalent |
|---|---|---|---|---|
| CPU | `Get-Counter '\Processor(*)\% Processor Time'` ✅[^5] | `Get-Counter -ListSet System` lists the system counters, including queue length ✅[^5] | System event log via `Get-WinEvent -LogName System` ✅[^6] | `mpstat`, `vmstat r` |
| Memory | `\Memory\Committed Bytes` vs `\Memory\Commit Limit`, `\Memory\% Committed Bytes In Use` ✅[^1] | Commit charge near the limit ✅[^1] | System event log via `Get-WinEvent` ✅[^6] | `free`, `vmstat si/so` |
| Disk | `Get-Counter -ListSet PhysicalDisk` lists the disk counters ✅[^5] | Same counter set (queue length, latency) ✅[^5] | System event log ✅[^6] | `iostat -x` |
| Network | `Get-Counter -ListSet 'Network Interface'` ✅[^5] | `Get-Counter -ListSet TCPv4` (retransmissions) ✅[^5] | System event log ✅[^6] | `sar -n DEV`, `nstat` |

### Processes, handles and files

| Question | Tool | Notes |
|---|---|---|
| Processes, CPU, memory, handles, threads | Task Manager (Details tab with Handles/Threads columns), `Get-Process` | sorting by handle count shows leaks |
| Process tree, open handles, DLLs, token | Sysinternals **Process Explorer** | Shows open handles and loaded DLLs per process ✅[^7]; Linux analogue: `pstree` + `lsof` |
| Every file/registry/process event live | Sysinternals **Process Monitor** | Real-time file system, registry and process/thread activity ✅[^8]; Linux analogue: system-wide `strace` |
| Which process holds a file | Resource Monitor → CPU → Associated Handles; Sysinternals `handle.exe` | Shows which programs have a file open ✅[^9]; Linux analogue: `lsof <file>` |
| What starts automatically | Sysinternals **Autoruns**, `Get-CimInstance Win32_StartupCommand` | Programs configured to run at boot or login ✅[^10]; Linux analogue: `systemctl list-unit-files` + cron |

### Services, logs and boot

| Question | Tool |
|---|---|
| Service state, start type, dependencies | `Get-Service`, `sc.exe qc <name>`, `services.msc` |
| System and application logs | Event Viewer; `Get-WinEvent -LogName System -MaxEvents 50` ✅[^6] |
| Boot phase failures | Startup Repair log `%windir%\System32\LogFiles\Srt\Srttrail.txt` ✅[^3] |
| Clean-boot to isolate a service | `msconfig` selective startup ✅[^3] |
| Registry inspection | `regedit`, `Get-ItemProperty HKLM:\…` |

### Tracing and profiling (ETW)

| Item | Role ✅[^2] |
|---|---|
| ETW | "an efficient kernel-level tracing facility" that logs kernel or application events to a file or real-time consumers |
| Controller | Defines log file size/location, starts and stops sessions, enables providers, manages buffers, reports lost events |
| Provider | Code instrumented with events; generates events when a controller enables it |
| Consumer | Reads events in real time or from a log file |
| Tools built on it | Windows Performance Recorder (`wpr`) to record and Windows Performance Analyzer (WPA) to analyse; `logman`, `tracerpt` ✅[^11] ✅[^12] |

### Linux habit → Windows tool

| Linux | Windows |
|---|---|
| `top` / `htop` | Task Manager, Process Explorer |
| `ps -ef` | `Get-Process`, `tasklist` |
| `strace` | Process Monitor (file/registry/process), ETW traces |
| `perf` / eBPF | WPR + WPA (ETW sampling and tracing) |
| `journalctl` | Event Viewer, `Get-WinEvent` |
| `ss -tanp` | `Get-NetTCPConnection`, `netstat -ano` |
| `systemctl status` | `Get-Service`, `sc.exe query` |
| `/proc/meminfo` | Performance counters (`\Memory\*`), Task Manager → Memory |

## Lookup notes
- Commit counters, not "free memory", show Windows memory pressure: `% Committed Bytes In Use` = `Committed Bytes` ÷ `Commit Limit` ✅[^1].
- ETW sessions can lose events when buffers fill; controllers report lost events and buffers ✅[^2].
- Sysinternals tools are downloads published by Microsoft ✅[^4].

## Takeaways
- Learn three tools first: Task Manager (overview), Process Explorer (per-process detail) and Process Monitor (live system activity).
- For performance work, record an ETW trace with WPR and analyse it in WPA instead of guessing from counters.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Introduction to the page file](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/introduction-to-the-page-file) — Microsoft Learn, 2026. Backs: commit counters and their ratio. [^1]
- [About Event Tracing](https://learn.microsoft.com/en-us/windows/win32/etw/about-event-tracing) — Microsoft Learn, living. Backs: ETW definition, controllers, providers, consumers, sessions, buffers and lost events. [^2]
- [Windows startup issues troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting) — Microsoft Learn, 2026. Backs: Startup Repair log path, msconfig selective startup. [^3]
- [Sysinternals](https://learn.microsoft.com/en-us/sysinternals/) — Microsoft Learn, living. Backs: the Sysinternals suite (Process Explorer, Process Monitor, Autoruns, Handle). [^4]
- No Windows lab was available when this doc was written (macOS host).
- [Get-Counter](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-counter) — Microsoft Learn, living. Backs: `\Processor(*)\% Processor Time` paths and `-ListSet` to list counter sets. [^5]
- [Get-WinEvent](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-winevent) — Microsoft Learn, living. Backs: `-LogName` and `-MaxEvents` parameters. [^6]
- [Process Explorer](https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer) — Microsoft Sysinternals, living. Backs: shows which handles and DLLs processes have opened or loaded, as a process tree. [^7]
- [Process Monitor](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon) — Microsoft Sysinternals, living. Backs: real-time file system, registry and process/thread activity. [^8]
- [Handle](https://learn.microsoft.com/en-us/sysinternals/downloads/handle) — Microsoft Sysinternals, living. Backs: shows which programs have a file open. [^9]
- [Autoruns](https://learn.microsoft.com/en-us/sysinternals/downloads/autoruns) — Microsoft Sysinternals, living. Backs: programs configured to run at boot or login. [^10]
- [Windows Performance Toolkit](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/) — Microsoft Learn, living. Backs: WPR records and WPA analyses ETW traces. [^11]
- [logman](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/logman) and [tracerpt](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tracerpt_1) — Microsoft Learn, living. Backs: command-line tools for trace sessions and trace reports. [^12]

## Related
- `linux/system-management/observability-tools.md` — the Linux catalog.
- `windows/memory/virtual-memory-and-commit.md` — what commit counters mean.
