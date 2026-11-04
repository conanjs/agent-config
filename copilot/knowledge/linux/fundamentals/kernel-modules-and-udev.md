---
schema: knowledge-doc/v1
type: concept
topic: linux/fundamentals
status: verified
applies-to: ["Linux ≥ 5.x", "kmod", "systemd-udevd"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, kernel-modules, modprobe, depmod, udev, devtmpfs, device-nodes, major-minor, uevent]
---

# Kernel modules, device nodes and udev

## Summary
**TL;DR:** Drivers and many kernel features can be built in or loaded at runtime as **modules** (`.ko` files under `/lib/modules/$(uname -r)`). `modprobe` loads a module plus its dependencies (computed by `depmod`). A device is reached through a **device node** in `/dev` identified by a **major:minor** number pair (major = which driver, minor = which instance). The kernel announces every device change as a **uevent**; **udev** (`systemd-udevd`) reacts by applying rules: setting permissions, creating stable names such as `/dev/disk/by-uuid/…`, and running helpers.
**Use this when:** a device or driver is missing, a disk name changed between boots, you write a udev rule, you read `lsmod`/`/proc/devices`, or a container needs access to a device.
**Not this doc:** filesystems on those devices → `storage/ext4-and-lvm.md`; the boot sequence that loads early drivers → `fundamentals/boot-process.md`.

## Problem
"It worked until reboot" problems often live here: `/dev/sdb` became `/dev/sdc`, a module is blacklisted, the initramfs lacks a driver, or a udev rule does not fire. Without the module → device node → uevent → udev chain, these look random.

## Mental model
**Analogy:** a building with plug-in appliances. Modules are appliances you can plug in or remove (`modprobe`, `modprobe -r`); some are wired in permanently (built-in). Each socket on the wall has a number pair (major:minor). When an appliance is plugged in, the building announces it on the intercom (uevent); the caretaker (udev) hears it, puts a name label on the socket ("printer in room 3") and sets who may use it.

**Artifact:** device nodes and their numbers (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```text
crw-rw-rw- 1 root root   1, 3  /dev/null        # c = character device, major 1 ("mem"), minor 3
crw-rw-rw- 1 root root   1, 5  /dev/zero        # same driver, minor 5
brw------- 1 root root 254, 0  /dev/vda         # b = block device, major 254, minor 0
$ cat /sys/class/block/vda/dev
254:0
$ head -3 /proc/devices
Character devices:
  1 mem
  2 pty
```

## How it works
**5 actors:**
- **Kernel module (`.ko`)** — its job: add a driver or feature to the running kernel, via `init_module`/`finit_module` ✅[^5].
- **kmod tools (`modprobe`, `depmod`, `lsmod`)** — its job: find modules and dependencies, via `/lib/modules/$(uname -r)` and `modules.dep.bin` ✅[^1].
- **Kernel driver core + devtmpfs** — its job: register devices, create basic nodes in `/dev`, and emit uevents ✅[^6].
- **udev (`systemd-udevd`)** — its job: apply rules to device events, via rules files in `/usr/lib/udev/rules.d`, `/usr/local/lib/udev/rules.d`, `/run/udev/rules.d`, `/etc/udev/rules.d` ✅[^2].
- **Consumers (mount, systemd, libudev subscribers)** — its job: act on the result, via the udev database ✅[^2].

```
hardware appears (or modprobe loads a driver)
   │
   ▼
driver binds ─► kernel registers device (major:minor, /sys/devices/...) ─► node in /dev (devtmpfs)
   │
   └─► uevent "add" ─► systemd-udevd
                          │ match rules (lexical order; /etc overrides /usr/lib)
                          ├─ set owner/group/mode on the node
                          ├─ create symlinks: /dev/disk/by-uuid/…, /dev/disk/by-id/…
                          ├─ rename network interfaces (eth0 → enp3s0)
                          └─ run short helper programs
                          ▼
                       udev database → libudev subscribers (systemd .device units, mounts)
```

1. **Loading:** `modprobe <name>` reads `modules.dep.bin` (made by `depmod`), loads dependencies first, then the module; `-r` removes it and unused dependencies ✅[^1]. Symbol resolution and parameter checks are done by the kernel, so failures may show only in `dmesg` ✅[^1].
2. **Options and blacklists:** configured in `modprobe.d` files (`options`, `blacklist`, `install`) or on the kernel command line as `<module>.<option>=value` ✅[^1].
3. **Device registration:** the driver registers the device; `/sys/class/block/vda/dev` shows its numbers ✅[^4].
4. **udev rules:** matched against the event; can create symlinks, set permissions, rename interfaces, and run programs; results are stored and published through libudev ✅[^2].

**Built-in vs module:** whether a feature is a module is a kernel build choice. The lab kernel has `CONFIG_MODULES=y` but no `/lib/modules` directory and an empty `lsmod`: every driver it needs is built in, which is common for VM kernels ✅[^4].

## Worked example
A data disk mounts at the wrong place after adding a second disk.

| Step | Observation | Meaning |
|---|---|---|
| Before | `/etc/fstab`: `/dev/sdb1 /data ext4 defaults 0 2` | Mounted by kernel name |
| Add disk | The new disk is probed first and becomes `sdb`; old one becomes `sdc` | The order device nodes are added is arbitrary ✅[^7] |
| Boot | `/data` mounts the wrong disk or fails | fstab pointed at a name, not an identity |
| Fix | `blkid /dev/sdc1` → `UUID=3f1c…`; fstab: `UUID=3f1c… /data ext4 defaults 0 2` | udev's stable names / filesystem UUIDs do not depend on order |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Driver needed for the root disk is a module missing from the initramfs | Boot stops in the initramfs | See `fundamentals/boot-process.md` |
| Module blacklisted | `modprobe` will not auto-load it | `blacklist` in `modprobe.d` ✅[^1] |
| Container needs a device | Must be passed explicitly (`--device /dev/fuse`) and allowed by the device cgroup | `--device` / `--device-cgroup-rule` ✅[^8]; lab: `/dev/fuse` absent by default, present with `--device /dev/fuse` ✅[^4] |
| Container tries `modprobe` | Fails | Loading modules needs host privilege (`CAP_SYS_MODULE`) ✅[^3] |
| Secure Boot / lockdown kernels | Unsigned modules refused | `CONFIG_MODULE_SIG_FORCE` disallows unsigned modules ✅[^9] |
| Rule in `/etc/udev/rules.d` with the same file name as a vendor rule | Replaces the vendor rule | `/etc` has priority ✅[^2] |

## Takeaways
- Refer to disks by UUID, label or `/dev/disk/by-id`, never by `/dev/sdX`. [rule-candidate]
- Check `dmesg` when `modprobe` fails; the kernel reports the real reason there.
- Put local udev rules and module options in `/etc`, not in vendor directories.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [modprobe(8)](https://man7.org/linux/man-pages/man8/modprobe.8.html) — kmod project via Linux man-pages, living. Backs: module path, `modules.dep.bin`/depmod, dependency loading and removal, kernel-side checks, configuration commands, command-line options. [^1]
- [udev(7)](https://man7.org/linux/man-pages/man7/udev.7.html) — systemd project via Linux man-pages, living. Backs: uevent handling, rule directories and priority, rule actions, udev database and libudev. [^2]
- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) — Linux man-pages project, living. Backs: module loading needs `CAP_SYS_MODULE`. [^3]
- `linux/lab-setup.md` — the lab where device nodes, `/proc/devices`, `/sys/class/block/vda/dev`, the kernel config and empty `lsmod` were read on 2026-11-04. [^4]
- [init_module(2)](https://man7.org/linux/man-pages/man2/init_module.2.html) — Linux man-pages project, living. Backs: `init_module` / `finit_module` load a kernel module. [^5]
- [drivers/base/Kconfig: DEVTMPFS](https://github.com/torvalds/linux/blob/master/drivers/base/Kconfig) — Linux kernel source, read 2026-11-04. Backs: devtmpfs holds device nodes with their default names and permissions, maintained by the driver core. [^6]
- [Persistent block device naming](https://wiki.archlinux.org/title/Persistent_block_device_naming) — ArchWiki, living. Backs: the order in which `/dev/sdX` / `/dev/nvmeXnY` nodes are added is arbitrary and can change between boots. [^7]
- [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) — Docker, living. Backs: `--device`, `--device-cgroup-rule`, `--init` (forwards signals, reaps processes), `--shm-size`, `--security-opt no-new-privileges`. [^8]
- [Kernel module signing facility](https://docs.kernel.org/admin-guide/module-signing.html) — Linux kernel documentation, living. Backs: `CONFIG_MODULE_SIG_FORCE` refuses unsigned modules. [^9]

## Related
- `linux/fundamentals/boot-process.md` — drivers in the initramfs.
- `linux/storage/ext4-and-lvm.md` — what gets created on the block devices.
