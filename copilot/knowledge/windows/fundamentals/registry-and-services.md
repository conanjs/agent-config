---
schema: knowledge-doc/v1
type: concept
topic: windows/fundamentals
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, registry, hives, hklm, hkcu, services, scm, service-control-manager, svchost, localsystem]
---

# The registry and Windows services

## Summary
**TL;DR:** The **registry** is Windows' hierarchical configuration database: keys, subkeys and values, grouped into **hives**, each backed by files (most in `%SystemRoot%\System32\Config`, user hives in `Ntuser.dat`) loaded at boot or logon. **Services** are background programs managed by the **Service Control Manager (SCM)**, which starts at boot, keeps the database of installed services under `HKLM\SYSTEM\CurrentControlSet\Services`, starts auto-start services (and their dependencies) in load-order groups, starts demand-start services on request, and relays control requests (stop, pause). A service runs as `LocalSystem` unless an account is configured.
**Use this when:** you change system configuration, debug a service that will not start, compare with systemd, or need to know where settings physically live.
**Not this doc:** boot phases → `fundamentals/boot-process.md`; permissions on keys and services → `security/tokens-acls-and-uac.md`.

## Problem
Services fail at boot because a dependency is missing; configuration "disappears" because it was written per-user (HKCU) instead of per-machine (HKLM); a corrupt SYSTEM hive stops the machine from booting. All three come from the hive and SCM model.

## Mental model
**Analogy:** the registry is a filing cabinet with a few big drawers (hives); the machine's drawers (`HKLM\SYSTEM`, `SOFTWARE`, `SAM`, `SECURITY`) are always in; each user's drawer (`Ntuser.dat`) is put in when they log on. The SCM is a building's facilities manager with a staff list (the Services key): it starts the early shift in a fixed order at opening time, calls others in when asked, and passes messages ("stop now") to staff.

**Artifact:** the standard hives and their files ✅[^1]:

| Hive | Supporting files |
|---|---|
| `HKEY_LOCAL_MACHINE\SYSTEM` | System, System.alt, System.log, System.sav |
| `HKEY_LOCAL_MACHINE\SOFTWARE` | Software, Software.log, Software.sav |
| `HKEY_LOCAL_MACHINE\SAM` | Sam, Sam.log, Sam.sav |
| `HKEY_LOCAL_MACHINE\SECURITY` | Security, Security.log, Security.sav |
| `HKEY_USERS\.DEFAULT` | Default, Default.log, Default.sav |
| `HKEY_CURRENT_USER` | Ntuser.dat, Ntuser.dat.log |
| `HKEY_CURRENT_CONFIG` | System, System.alt, System.log, System.sav |

File extensions: none = full hive copy; `.log` = transaction log of changes; `.alt` = backup of the critical System hive; `.sav` = backup copy ✅[^1].

## How it works
**4 actors:**
- **Configuration Manager (kernel)** — its job: load hives and serve registry reads/writes ✅[^6].
- **Hive files** — its job: persist registry data with transaction logs ✅[^1].
- **Service Control Manager** — its job: maintain the service database, start/stop services, track status, relay control requests; it is an RPC server, so services can be managed remotely ✅[^2].
- **Service programs** — its job: run as `.exe` services (alone or sharing a process) or `.sys` driver services ✅[^3].

**Registry:**
1. A hive is a logical group of keys, subkeys and values with supporting files loaded when the OS starts or a user logs in ✅[^1].
2. Each user who logs on gets a user profile hive (settings, desktop, environment, network connections, printers) under `HKEY_USERS` ✅[^1].
3. Changes are recorded in `.log` transaction files alongside the hive ✅[^1].

**Services** ✅[^3] ✅[^4]:

| Field in `HKLM\SYSTEM\CurrentControlSet\Services\<name>` | Meaning |
|---|---|
| Service type | Own process or shared process (for drivers: kernel or file system driver) |
| Start type | Auto-start at boot, demand-start on request, or disabled (drivers also have boot/system start) ✅[^7] |
| Image path | `.exe` for services, `.sys` for drivers |
| Dependencies | Services that must start first, load-ordering group, tag within the group |
| Account | Runs as this account; `LocalSystem` if none is given |

At boot, the SCM starts all auto-start services and the services they depend on — even demand-start ones ✅[^4]. Order comes from the group list in `HKLM\System\CurrentControlSet\Control\ServiceGroupOrder`, the tag order in `…\Control\GroupOrderList`, and each service's dependencies ✅[^4].

## Worked example
A web application service fails at boot with "dependency service failed to start":

| Step | Check (PowerShell / `sc.exe`) | Meaning |
|---|---|---|
| 1 | `Get-Service MyApp \| Select Status,StartType` | `Stopped`, `Automatic` |
| 2 | `sc.exe qc MyApp` | Shows `DEPENDENCIES : MSSQLSERVER`, `SERVICE_START_NAME : LocalSystem` |
| 3 | `Get-Service MSSQLSERVER` | `Disabled` — the dependency cannot start |
| 4 | Fix | Re-enable the dependency or remove the stale dependency in the service config |

Commands are standard Windows tools; outputs are illustrative (output shapes not captured: no Windows machine was available).

**Comparison with systemd:**

| Concept | Windows | systemd (Linux) |
|---|---|---|
| Manager | Service Control Manager ✅[^2] | systemd (PID 1) |
| Definition | Registry key under `…\Services` | Unit file in `/etc/systemd/system` |
| Ordering | Groups, tags, dependencies | `After=`/`Before=`, `Wants=`/`Requires=` |
| Default identity | `LocalSystem` | `root` unless `User=` |
| Logs | Event Log (System, Application) | journald |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Auto-start service depends on a demand-start one | The dependency is started automatically | ✅[^4] |
| Service with no account configured | Runs as `LocalSystem` (very high privilege) | Default ✅[^3] |
| Setting written to HKCU by an installer running as admin | Only that admin sees it | Per-user hive ✅[^1] |
| Corrupt SYSTEM hive | Boot fails | The kernel loads it early (see `fundamentals/boot-process.md`) |
| Registry `RegBack` folder empty on new Windows | Expected since 1803 | Not auto-backed up ✅[^5] |

## Takeaways
- Store machine-wide settings under HKLM and per-user settings under HKCU, deliberately.
- Run services under a dedicated low-privilege account (virtual or managed service account) instead of `LocalSystem`. [rule-candidate]
- When a service fails at boot, read its dependencies first (`sc.exe qc`).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Registry Hives](https://learn.microsoft.com/en-us/windows/win32/sysinfo/registry-hives) — Microsoft Learn, living. Backs: hive definition, user profile hives, file locations, extensions, hive→file table. [^1]
- [Service Control Manager](https://learn.microsoft.com/en-us/windows/win32/services/service-control-manager) — Microsoft Learn, living. Backs: started at boot, RPC server, SCM tasks. [^2]
- [Database of Installed Services](https://learn.microsoft.com/en-us/windows/win32/services/database-of-installed-services) — Microsoft Learn, living. Backs: registry location and service fields, LocalSystem default. [^3]
- [Automatically Starting Services](https://learn.microsoft.com/en-us/windows/win32/services/automatically-starting-services) — Microsoft Learn, living. Backs: auto-start with dependencies, load order registry keys. [^4]
- [Windows startup issues troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting) — Microsoft Learn, 2026. Backs: RegBack no longer populated since 1803. [^5]
- No Windows lab was available when this doc was written (macOS host); examples are illustrative.
- [Windows Kernel-Mode Configuration Manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-configuration-manager) — Microsoft Learn, living. Backs: the configuration manager component and the registry. [^6]
- [CreateServiceW](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-createservicew) — Microsoft Learn, living. Backs: start types including `SERVICE_BOOT_START` (system loader) and `SERVICE_SYSTEM_START` (IoInitSystem). [^7]

## Related
- `linux/system-management/systemd-services.md` — the Linux counterpart.
- `windows/system-management/diagnostics-tools.md` — Event Log and service troubleshooting tools.
