---
schema: topic-index/v1
kind: subtopic
topic: linux/fundamentals
last-updated: 2026-11-04
---

# Linux fundamentals

The base layer: how programs ask the kernel for everything through system calls, the directory tree and the virtual `/proc` `/sys` `/dev` filesystems, users, groups and permission checks, how a machine boots to PID 1, kernel modules and udev device naming, and KVM virtualization compared with containers. Not covered: shell usage and package management.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [kernel-and-system-calls.md](kernel-and-system-calls.md) | concept | A Linux program never touches hardware, files or the network itself | verified |
| [filesystem-hierarchy.md](filesystem-hierarchy.md) | reference | Linux has one tree rooted at `/` | verified |
| [users-and-permissions.md](users-and-permissions.md) | concept | The kernel never sees user names, only numbers: every process carries user and group IDs (UID/GID), every file carries an owner UID, a group GID and 9 permission bits plus 3 special bits | verified |
| [boot-process.md](boot-process.md) | concept | Booting is a relay race with five runners: **firmware** (UEFI/BIOS) finds a **boot loader** (GRUB, systemd-boot), the boot loader loads the **kernel** and an **initramfs** into memory, the kernel unpacks the initramfs and runs its `/init` as process 1, and that early init finds the real root filesystem and switches to it, where **systemd** (PID 1) starts all services by walking a chain of targets | verified |
| [kernel-modules-and-udev.md](kernel-modules-and-udev.md) | concept | Drivers and many kernel features can be built in or loaded at runtime as **modules** (`.ko` files under `/lib/modules/$(uname -r)`) | verified |
| [kvm-virtualization.md](kvm-virtualization.md) | concept | KVM turns the Linux kernel into a hypervisor | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
