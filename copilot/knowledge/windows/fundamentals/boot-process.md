---
schema: knowledge-doc/v1
type: concept
topic: windows/fundamentals
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+", "UEFI and legacy BIOS"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, boot, uefi, bootmgr, winload, ntoskrnl, smss, bcd, startup-repair]
---

# The Windows boot process

## Summary
**TL;DR:** Windows boots in four phases: **PreBoot** (firmware POST, find a system disk), **Windows Boot Manager** (`bootmgfw.efi` on UEFI, `bootmgr` on BIOS, reading the Boot Configuration Data store), **OS Loader** (`winload.efi`/`winload.exe` loads boot-start drivers and the kernel), and **NT OS Kernel** (`ntoskrnl.exe` loads the SYSTEM registry hive and `BOOT_START` drivers, then hands over to the Session Manager `smss.exe`, which starts the rest). Each phase fails with its own symptoms and tools.
**Use this when:** a Windows machine does not start, you need to know which file or phase is involved, or you compare with the Linux boot chain.
**Not this doc:** services started after boot → `fundamentals/registry-and-services.md`.

## Problem
"Windows won't boot" spans a dead disk, a missing boot manager, a corrupt BCD store, a bad boot driver (`INACCESSIBLE_BOOT_DEVICE`) or a faulty service. Fixes differ completely by phase, and applying the wrong one (rebuilding the BCD for a driver problem) wastes hours.

## Mental model
**Analogy:** the same relay race as Linux, with Windows-named runners: firmware → Boot Manager (reads the race plan, the BCD) → OS Loader (packs the kernel and its essential drivers) → kernel → Session Manager, which wakes every other runner.

**Artifact:** the phase table, with the file for each firmware type ✅[^1]:
```text
Phase  Process                BIOS-based computer                 UEFI-based computer
1      PreBoot                MBR/PBR (bootstrap code)            UEFI firmware
2      Windows Boot Manager   %SystemDrive%\bootmgr               \EFI\Microsoft\Boot\bootmgfw.efi
3      Windows OS Loader      %SystemRoot%\system32\winload.exe   %SystemRoot%\system32\winload.efi
4      Windows NT OS Kernel   %SystemRoot%\system32\ntoskrnl.exe
```

## How it works
**5 actors:**
- **Firmware (UEFI or BIOS)** — its job: power-on self test, load settings, find a valid system disk, start the Boot Manager ✅[^1].
- **Windows Boot Manager** — its job: find and start the Windows loader on the boot partition, using the Boot Configuration Data ✅[^1].
- **Windows OS Loader** — its job: load the kernel's required drivers and start the kernel ✅[^1].
- **NT kernel (`ntoskrnl.exe`)** — its job: load the SYSTEM hive and `BOOT_START` drivers, then pass control to `smss.exe` ✅[^1].
- **Session Manager (`smss.exe`)** — its job: initialize the system session and start remaining devices and drivers ✅[^1].

1. **PreBoot:** firmware runs POST; on BIOS it loads the MBR, which starts the Boot Manager; on UEFI it starts the Boot Manager EFI application directly ✅[^1].
2. **Boot Manager:** reads the BCD store and starts `winload` ✅[^1] (`bcdedit` edits the BCD).
3. **OS Loader:** loads boot drivers and the kernel ✅[^1].
4. **Kernel:** loads the SYSTEM registry hive into memory and starts `BOOT_START` drivers ✅[^1].
5. **Session Manager:** initializes the session and starts drivers not marked `BOOT_START` ✅[^1]. Later in startup the Service Control Manager, itself started at boot, starts auto-start services (see `fundamentals/registry-and-services.md`).

## Worked example
Mapping symptoms to the phase (from Microsoft's troubleshooting guide) ✅[^1]:

| Symptom | Phase | First tools |
|---|---|---|
| No disk activity, NumLock light does not toggle | 1 PreBoot (hardware) | Hardware checks |
| Black screen with a blinking cursor; "BCD missing or corrupted", "Bootmgr missing", "Operating system missing" | 2 Boot Manager / loader | Startup Repair; `bootrec /fixmbr`, `/fixboot`, `/scanos`, `/rebuildbcd` |
| "Unable to boot due to system hive missing or corrupted" | Loader/kernel | Restore the hive from a restore point |
| Stop error after the logo (e.g. `0x7B INACCESSIBLE_BOOT_DEVICE`), spinning dots, black screen | 4 Kernel | Safe Mode, clean boot (`msconfig`), check boot drivers and filter drivers, `sfc /scannow /offbootdir=…`, `chkdsk /f /r` |

Since Windows 10 version 1803, the registry is no longer backed up automatically to `RegBack`; Microsoft recommends system restore points for hive recovery ✅[^1].

**Windows vs Linux boot:**

| Step | Windows | Linux |
|---|---|---|
| Boot manager | `bootmgfw.efi` + BCD store | GRUB / systemd-boot + config file |
| Loader | `winload.efi` | Boot loader loads kernel + initramfs |
| Early drivers | `BOOT_START` drivers loaded by the loader | Drivers in the initramfs |
| First user-space process | `smss.exe` | `/init` → systemd (PID 1) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Storage controller driver not `BOOT_START` after hardware change | `INACCESSIBLE_BOOT_DEVICE` | Kernel cannot reach the boot disk ✅[^1] ✅[^2] |
| Boot loop into recovery | Repeats recovery options | `bcdedit /set {default} recoveryenabled no` breaks the loop ✅[^1] |
| Pending update leaves the system unbootable | Stop errors at startup | `DISM /image:C:\ /cleanup-image /revertpendingactions` from WinRE ✅[^1] |
| Faulty third-party service | Hangs late in startup | Clean boot with selective startup ✅[^1] |

## Takeaways
- Identify the phase from the symptom before running repair commands.
- Keep restore points enabled: registry hives are no longer auto-backed up to `RegBack`.
- Treat boot-start drivers (storage, encryption, filters) as the riskiest changes.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Windows startup issues troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting) — Microsoft Learn, 2026. Backs: the four phases and their files, what each phase does, symptoms per phase, bootrec/bcdedit/DISM/SFC/chkdsk commands, RegBack change in 1803. [^1]
- No Windows lab was available when this doc was written (macOS host); all facts come from the cited documentation.
- [Bug Check 0x7B: INACCESSIBLE_BOOT_DEVICE](https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x7b--inaccessible-boot-device) — Microsoft Learn, living. Backs: the OS lost access to the system partition during startup. [^2]

## Related
- `linux/fundamentals/boot-process.md` — the Linux boot relay.
- `windows/fundamentals/registry-and-services.md` — the SYSTEM hive and services.
