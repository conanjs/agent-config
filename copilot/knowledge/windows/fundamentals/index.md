---
schema: topic-index/v1
kind: subtopic
topic: windows/fundamentals
last-updated: 2026-11-04
---

# Windows fundamentals

The base map of Windows internals: user mode vs kernel mode, the executive and object manager, drivers and IRPs; the four boot phases from firmware to the Session Manager; and the registry with its hives plus the Service Control Manager. Not covered: kernel debugging, Hyper-V internals.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [architecture-and-kernel-mode.md](architecture-and-kernel-mode.md) | concept | Windows splits code into **user mode** (applications, services, subsystem DLLs; each process has a private virtual address space and handle table) and **kernel mode** (the NT kernel image `ntoskrnl.exe` with its *executive* managers, drivers and the hardware abstraction layer; all sharing one address space, so a driver bug crashes the whole system — the "blue screen") | verified |
| [boot-process.md](boot-process.md) | concept | Windows boots in four phases: **PreBoot** (firmware POST, find a system disk), **Windows Boot Manager** (`bootmgfw.efi` on UEFI, `bootmgr` on BIOS, reading the Boot Configuration Data store), **OS Loader** (`winload.efi`/`winload.exe` loads boot-start drivers and the kernel), and **NT OS Kernel** (`ntoskrnl.exe` loads the SYSTEM registry hive and `BOOT_START` drivers, then hands over to the Session Manager `smss.exe`, which starts the rest) | verified |
| [registry-and-services.md](registry-and-services.md) | concept | The **registry** is Windows' hierarchical configuration database: keys, subkeys and values, grouped into **hives**, each backed by files (most in `%SystemRoot%\System32\Config`, user hives in `Ntuser.dat`) loaded at boot or logon | verified |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.

## Related
- `windows/learning-path.md` — where this subtopic sits in the learning order.
- `linux/` — the Linux counterpart of each Windows mechanism.
