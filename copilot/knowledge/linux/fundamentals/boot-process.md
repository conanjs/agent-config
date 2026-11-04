---
schema: knowledge-doc/v1
type: concept
topic: linux/fundamentals
status: verified
applies-to: ["Linux ≥ 5.x", "systemd-based distributions (Debian, Ubuntu, Fedora, RHEL, Arch)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, boot, firmware, uefi, grub, initramfs, pid-1, systemd, targets]
---

# The Linux boot process

## Summary
**TL;DR:** Booting is a relay race with five runners: **firmware** (UEFI/BIOS) finds a **boot loader** (GRUB, systemd-boot), the boot loader loads the **kernel** and an **initramfs** into memory, the kernel unpacks the initramfs and runs its `/init` as process 1, and that early init finds the real root filesystem and switches to it, where **systemd** (PID 1) starts all services by walking a chain of targets.
**Use this when:** a machine does not boot, you need to change kernel parameters, you are confused by "initramfs" / "initrd" / "switch root", or you want to know why PID 1 is special.
**Not this doc:** how systemd units and services work after boot → `system-management/systemd-services.md`.

## Problem
"It hangs at boot" can mean five different stages, each with different tools and logs. Without knowing which runner holds the baton, people rebuild the wrong thing (reinstall GRUB when the initramfs lacks a disk driver, or edit `/etc/fstab` when the kernel never found the disk).

## Mental model
**Analogy:** a relay race. Each runner only knows how to find and wake the next runner, then hands over the baton and leaves the track. The firmware never knows about Linux; GRUB never knows about services; the kernel does not know your web server exists.

**Artifact:** a typical GRUB entry, which is exactly the baton the boot loader passes to the kernel (paths and UUID are examples):
```
linux   /vmlinuz-6.8.0-45-generic root=UUID=3f1c...e9 ro quiet splash
initrd  /initrd.img-6.8.0-45-generic
```
- `linux /vmlinuz-…` — the compressed kernel image to load.
- `root=UUID=…` — a **kernel command-line parameter**: which filesystem becomes `/`.
- `ro` — mount it read-only first (it is remounted read-write later).
- `initrd /initrd.img-…` — the initramfs archive to load next to the kernel. The file is still called "initrd" for historical reasons.

## How it works
**5 actors:**
- **Firmware (UEFI or legacy BIOS)** — its job: minimal hardware setup and starting a boot loader, via the boot entries stored in the machine's non-volatile memory ✅[^1].
- **Boot loader (GRUB, systemd-boot)** — its job: load the kernel and the initramfs into memory, via its config file and menu ✅[^1].
- **Kernel** — its job: initialize hardware, memory and the scheduler, then unpack the initramfs and start `/init`, via its built-in early boot code ✅[^2].
- **Early init in the initramfs (often systemd in "initrd mode")** — its job: find and mount the real root filesystem, then switch to it, via the drivers and tools packed in the archive ✅[^1] ✅[^2].
- **systemd as PID 1 on the real root** — its job: start every service in dependency order, via unit files and targets ✅[^1].

```
power on
  │
  ▼
[Firmware UEFI/BIOS] ─ picks boot entry ─► [Boot loader GRUB]
                                             │ loads into RAM:
                                             │   vmlinuz (kernel) + initrd.img (initramfs cpio)
                                             ▼
                                         [Kernel]
                                             │ unpack initramfs into rootfs (RAM)
                                             │ run /init as PID 1
                                             ▼
                                   [initramfs: systemd, initrd.target]
                                             │ load disk/LVM/crypt drivers
                                             │ mount real root at /sysroot
                                             │ switch root (pivot_root) → /sysroot
                                             ▼
                                   [systemd PID 1 on real root]
       sysinit.target ─► basic.target ─► multi-user.target ─► graphical.target
                                             (default.target points at one of the last two)
```

1. **Firmware:** does minimal hardware setup and hands control to the boot loader ✅[^1].
2. **Boot loader:** loads the kernel and the initramfs into memory and passes the kernel command line ✅[^1].
3. **Kernel:** every kernel contains a `rootfs`, an in-memory filesystem that is always present. It unpacks the initramfs (a gzip-compressed `cpio` archive) into it ✅[^2]. If the archive contains `/init`, the kernel runs it as **PID 1**; if not, it falls back to older code that mounts the root partition named on the command line and runs `/sbin/init` from it ✅[^2].
4. **Early init (initramfs):** systemd notices it is in an initramfs by the file `/etc/initrd-release` and uses `initrd.target` as its goal ✅[^1]. When the root device appears, it is mounted at `/sysroot`; `/sysroot/etc/fstab` is read for `/usr` and other early mounts; then `initrd-switch-root.service` switches root to `/sysroot` ✅[^1]. The underlying mechanism is: change directory into the new root, `pivot_root(".", ".")`, then lazily unmount the old one ✅[^2].
5. **systemd on the real root:** reaches `sysinit.target` (local filesystems, swap, udev, sysctl), then `basic.target` (sockets, paths, timers), then starts services and reaches `multi-user.target`, then `graphical.target` if there is a display manager. `default.target` is normally an alias for one of those last two ✅[^1].

**Why PID 1 is special:** if a process's parent dies, the orphaned child is adopted by PID 1 (or the nearest "subreaper"), which must collect its exit status ✅[^3]. If PID 1 itself exits, the kernel panics with "Attempted to kill init!" ✅[^5]. Inside a PID namespace (a container), the namespace's PID 1 plays the same role, and when it exits the kernel kills every other process in that namespace ✅[^4].

## Worked example
A server stops at an `(initramfs)` emergency shell after a disk controller change. Walking the relay:

| Stage | Evidence | Verdict |
|---|---|---|
| Firmware → GRUB | The GRUB menu appeared | Passed |
| GRUB → kernel | Kernel messages scrolled | Passed |
| Kernel → initramfs `/init` | An `(initramfs)` prompt exists, so `/init` ran | Passed |
| initramfs → real root | "Gave up waiting for root device", `ls /dev/disk/by-uuid` does not list the UUID from `root=` | **Failed here** |

The initramfs has no driver for the new controller, so the root disk never appears. Fix: boot the old kernel or a rescue image, then rebuild the initramfs with the driver included (`update-initramfs -u` on Debian/Ubuntu, `dracut -f` on Fedora/RHEL) ✅[^6] ✅[^7]. GRUB and `/etc/fstab` were never the problem.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| No `/init` in the initramfs | Kernel mounts `root=` itself and runs `/sbin/init` | Legacy fallback path ✅[^2] |
| Old-style `initrd` image (a filesystem image) | Kernel mounts it as a RAM disk; its program `/initrd` returns to the kernel | The pre-initramfs mechanism; both are still accepted ✅[^2] |
| Root filesystem encrypted (LUKS) | The initramfs asks for the passphrase before switch root | Only the initramfs has the tools before `/` exists ✅[^8] (`cryptsetup.target` is part of the initrd boot chain) |
| A unit fails during `sysinit.target` | Boot may drop to an emergency shell | Later targets depend on `sysinit.target` ✅[^1] |
| Container start | None of steps 1–4 happen | A container shares the already-booted host kernel; its "PID 1" is just the first process in a new PID namespace ✅[^4] |

## Takeaways
- Locate the failing runner first: firmware menu, boot loader menu, kernel messages, `(initramfs)` prompt, or a systemd emergency shell.
- Kernel parameters (`root=`, `init=`, `ro`) are passed by the boot loader; `cat /proc/cmdline` shows the ones the running kernel got.
- A process you run as PID 1 in a container must reap children and handle signals, because PID 1 has special duties.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [bootup(7)](https://man7.org/linux/man-pages/man7/bootup.7.html) — systemd project via Linux man-pages, living. Backs: firmware → boot loader → kernel → initrd stages, `initrd.target`, `/sysroot`, switch root, target chain. [^1]
- [Ramfs, rootfs and initramfs](https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html) — Linux kernel documentation, living. Backs: rootfs, initramfs as cpio archive, `/init` as PID 1, fallback, `pivot_root` sequence, initrd vs initramfs. [^2]
- [wait(2)](https://man7.org/linux/man-pages/man2/wait.2.html) — Linux man-pages project, living. Backs: orphans adopted by init or a subreaper. [^3]
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) — Linux man-pages project, living. Backs: namespace PID 1 duties; its exit kills the namespace. [^4]
- [The kernel's command-line parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html) — Linux kernel documentation, living. Backs: further reading, every `root=` / `init=` style parameter.
- [kernel/exit.c](https://github.com/torvalds/linux/blob/master/kernel/exit.c) — Linux kernel source, read 2026-11-04. Backs: `panic("Attempted to kill init! …")` when PID 1 exits. [^5]
- [update-initramfs(8)](https://manpages.debian.org/bookworm/initramfs-tools/update-initramfs.8.en.html) — Debian, living. Backs: `update-initramfs -u` updates an existing initramfs. [^6]
- [dracut(8)](https://man7.org/linux/man-pages/man8/dracut.8.html) — dracut project via Linux man-pages, living. Backs: generates initramfs images. [^7]
- [bootup(7)](https://man7.org/linux/man-pages/man7/bootup.7.html) — systemd project via Linux man-pages, living. Backs: `cryptsetup-pre.target` / `cryptsetup.target` in the initrd boot chain. [^8]

## Related
- `linux/system-management/systemd-services.md` — units, targets and services after boot.
- `linux/processes/process-lifecycle.md` — orphans, reaping and why PID 1 matters.
- `linux/containers/namespaces.md` — PID 1 inside a container.
