---
schema: knowledge-doc/v1
type: concept
topic: windows/fundamentals
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+", "x64 and Arm64"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, architecture, kernel-mode, user-mode, ntoskrnl, executive, object-manager, drivers, hal, ntdll]
---

# Windows architecture: user mode, kernel mode and the executive

## Summary
**TL;DR:** Windows splits code into **user mode** (applications, services, subsystem DLLs; each process has a private virtual address space and handle table) and **kernel mode** (the NT kernel image `ntoskrnl.exe` with its *executive* managers, drivers and the hardware abstraction layer; all sharing one address space, so a driver bug crashes the whole system — the "blue screen"). Almost everything the executive manages — files, processes, threads, registry keys, events — is an **object** reached through a **handle**. Applications call documented Win32 APIs; those DLLs call `ntdll.dll`, which enters the kernel.
**Use this when:** you need the base map of Windows internals, compare Windows with Linux, read a stop-error or driver issue, or wonder why "everything is an object" matters for handles and security.
**Not this doc:** boot order → `fundamentals/boot-process.md`; processes and handles in depth → `processes/processes-threads-and-handles.md`.

## Problem
Windows behaviour that surprises Linux-trained engineers — handle leaks, file locking by other processes, "access denied" from a security descriptor, a driver that blue-screens the machine — follows directly from the object/handle model and the kernel-mode trust boundary. Without the map, these look arbitrary.

## Mental model
**Analogy:** a government building. Citizens (user-mode processes) each have a private office and a numbered claim-ticket book (handle table). Behind the counter, departments (executive managers: objects, memory, processes, I/O, security, configuration) share one big open-plan floor (kernel address space). A contractor (driver) admitted to that floor can knock over anyone's desk. Every request goes through a reception clerk (`ntdll.dll` → system call) and every resource is a filed object with an access list.

**Artifact:** the layers on a running system, top to bottom (component names from Microsoft documentation; file names are the standard ones):
```text
USER MODE   app.exe ── kernel32.dll / kernelbase.dll / user32.dll (Win32 API) ── ntdll.dll (native API, system call stubs)
            services.exe, lsass.exe, csrss.exe, svchost.exe … (system processes and services)
──────────────────────────── system call boundary ─────────────────────────────
KERNEL MODE ntoskrnl.exe: executive (Object Mgr, Memory Mgr, Process/Thread Mgr, I/O Mgr, Security Reference Monitor,
            Configuration Mgr = registry, PnP, Power) + kernel (scheduling, interrupts, synchronization)
            drivers (*.sys)   win32k.sys (windowing/graphics)   hal.dll (hardware abstraction layer)
```

## How it works
**4 actors:**
- **User-mode process** — its job: run application code in a private virtual address space with a private handle table ✅[^1].
- **Subsystem DLLs and `ntdll.dll`** — its job: reach the native system services (`Nt*` routines) through system calls ✅[^5].
- **Executive and kernel in `ntoskrnl.exe`** — its job: manage objects, memory, processes, I/O, security and the registry, via kernel-mode managers ✅[^2] ✅[^6] ✅[^7].
- **Drivers** — its job: talk to hardware and implement file systems and filters, via I/O request packets from the I/O manager ✅[^3].

1. **Modes:** the processor switches between user mode and kernel mode depending on the code it runs; applications run in user mode, core OS components in kernel mode; some drivers can run in user mode ✅[^1].
2. **User-mode isolation:** each process gets a private virtual address space and handle table, so one application cannot modify another's data and a crash stays inside that process; user code cannot access addresses reserved for the OS ✅[^1].
3. **Kernel mode is shared:** all kernel-mode code shares one virtual address space; a driver writing to a wrong address can corrupt the OS or another driver, and "If a kernel-mode driver crashes, it causes the entire operating system to crash" ✅[^1].
4. **Objects and handles:** files, devices, synchronization primitives and registry keys are objects in kernel mode, each with a header (name, type, location) and a type-specific body, managed by the object manager ✅[^2]. Applications cannot touch object data directly; they obtain a **handle**, an entry in an internal per-process table pointing at the resource ✅[^4].
5. **I/O:** requests to drivers are packaged as **IRPs** and sent with `IoCallDriver` down a stack of device objects (filter → function → physical); some complete before reaching the bottom ✅[^3].

**Windows vs Linux at the same layer:**

| Concept | Windows | Linux |
|---|---|---|
| Kernel image | `ntoskrnl.exe` + `hal.dll` + drivers (`.sys`) | `vmlinuz` + modules (`.ko`) |
| System call gateway | Native system services reached by system calls ✅[^5] | libc wrappers → `syscall` |
| Resource reference | Handle → object (any kernel object) | File descriptor → open file (files, sockets, pipes) |
| Name space | Object Manager namespace (e.g. `\Device`), not on disk ✅[^8] | VFS tree `/` |
| Configuration store | Registry (Configuration Manager) | Files in `/etc`, `/proc/sys` |
| Fatal kernel error | Stop error ("blue screen") | Kernel panic / oops |

## Worked example
Opening a file, as layers (call names are the documented APIs; the internal path is summarized):

| Step | Layer | What happens |
|---|---|---|
| 1 | App | `CreateFileW(L"C:\\data\\report.txt", GENERIC_READ, …)` |
| 2 | Win32 DLL → `ntdll.dll` | Calls the native service (`NtCreateFile`) via a system call ✅[^5] |
| 3 | Object Manager | Parses the name to a device object for the volume ✅[^2] ✅[^8] |
| 4 | Security Reference Monitor | Compares the caller's access token with the file's DACL (see `security/tokens-acls-and-uac.md`) |
| 5 | I/O Manager → NTFS driver → volume/disk drivers | IRP sent down the device stack ✅[^3] |
| 6 | Object Manager | Creates a file object, puts a handle in the process's handle table, returns it ✅[^4] |
| 7 | App | Uses the handle with `ReadFile`; `CloseHandle` releases it |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Buggy third-party driver | Stop error for the whole machine | Shared kernel address space ✅[^1] |
| App crash | Only that process dies | Private address space ✅[^1] |
| Leaking handles | Handle count grows until resources run out; objects stay alive | An object remains in memory as long as at least one handle exists ✅[^9] |
| File "in use by another process" | Delete/rename blocked | Sharing modes are enforced per open (see `storage/ntfs-and-io.md`) |
| User-mode drivers (UMDF) | Runs in a driver host process, outside kernel mode | Some drivers run in user mode ✅[^1] ✅[^10] |

## Takeaways
- Treat kernel-mode drivers as part of the OS's reliability: fewer and signed third-party drivers mean fewer stop errors.
- Close every handle you open; leaks keep kernel objects alive.
- When mapping Linux knowledge: handle ≈ file descriptor, but for every kernel object type.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [User Mode and Kernel Mode](https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/user-mode-and-kernel-mode) — Microsoft Learn, living. Backs: modes, private address spaces and handle tables, shared kernel address space, driver crash brings down the OS, user-mode drivers. [^1]
- [Windows Kernel-Mode Object Manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-object-manager) — Microsoft Learn, living. Backs: objects in kernel mode, header and body, object manager role. [^2]
- [I/O Request Packets](https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/i-o-request-packets) — Microsoft Learn, living. Backs: IRPs, `IoCallDriver`, device stacks. [^3]
- [Handles and Objects](https://learn.microsoft.com/en-us/windows/win32/sysinfo/handles-and-objects) — Microsoft Learn, living. Backs: objects represent resources, handles as table entries. [^4]
- [Overview of Windows Components](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/overview-of-windows-components) — Microsoft Learn, living. Backs: further reading, the component diagram.
- No Windows lab was available when this doc was written (macOS host); the layer diagram and examples are illustrative, built from the cited documentation.
- [Using Nt and Zw Versions of the Native System Services Routines](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/using-nt-and-zw-versions-of-the-native-system-services-routines) — Microsoft Learn, living. Backs: native system services (`Nt*`/`Zw*`); user-mode applications reach them through system calls. [^5]
- [Windows Kernel-Mode Memory Manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-memory-manager) — Microsoft Learn, living. Backs: memory manager as a kernel-mode component. [^6]
- [Windows Kernel-Mode Configuration Manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-configuration-manager) — Microsoft Learn, living. Backs: the configuration manager component and the registry. [^7]
- [Object Directories](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/object-directories) — Microsoft Learn, living. Backs: object directories such as `\Device` exist only inside the object manager. [^8]
- [Kernel Objects](https://learn.microsoft.com/en-us/windows/win32/sysinfo/kernel-objects) — Microsoft Learn, living. Backs: an object remains in memory as long as at least one handle exists. [^9]
- [Overview of the UMDF](https://learn.microsoft.com/en-us/windows-hardware/drivers/wdf/overview-of-the-umdf) — Microsoft Learn, living. Backs: a driver host process loads user-mode drivers. [^10]

## Related
- `linux/fundamentals/kernel-and-system-calls.md` — the Linux counterpart.
- `windows/processes/processes-threads-and-handles.md` — processes, threads, handles and jobs.
