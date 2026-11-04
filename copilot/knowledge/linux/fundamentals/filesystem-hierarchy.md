---
schema: knowledge-doc/v1
type: reference
topic: linux/fundamentals
status: verified
applies-to: ["FHS 3.0 (2015)", "Linux distributions following hier(7)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, fhs, directories, proc, sys, dev, etc, var]
---

# Linux filesystem hierarchy

## Summary
**TL;DR:** Linux has one tree rooted at `/`. Each top-level directory has a fixed job defined by the Filesystem Hierarchy Standard (FHS 3.0): configuration in `/etc`, changing data in `/var`, programs in `/usr`, and three **virtual** filesystems (`/proc`, `/sys`, `/dev`) that are windows into the kernel, not data on disk.
**Use this when:** you need to know where a file belongs or where to look for config, logs, state, devices or kernel information.
**Not this doc:** how path lookup and inodes work → `storage/vfs-and-file-descriptors.md`; Unix permissions → `fundamentals/users-and-permissions.md`.

## Scope
Top-level directories and the most-used subdirectories, as described by hier(7), which follows FHS version 3.0 (published 2015-03-19) ✅[^1]. Virtual filesystem details come from the kernel's proc documentation ✅[^2]. Distribution-specific layouts (for example a merged `/usr` where `/bin` is a link to `/usr/bin`) are noted in Lookup notes.

## Catalog

### Top-level directories ✅[^1]

| Path | Holds | Example |
|---|---|---|
| `/bin` | Essential commands needed in single-user mode, boot and repair | `/bin/sh`, `/bin/ls` |
| `/boot` | Static boot loader files: kernel, initramfs | `/boot/vmlinuz-6.8.0`, `/boot/grub/grub.cfg` |
| `/dev` | Device files that represent devices | `/dev/sda`, `/dev/null`, `/dev/tty` |
| `/etc` | Machine-local configuration | `/etc/fstab`, `/etc/passwd`, `/etc/ssh/sshd_config` |
| `/home` | Users' home directories | `/home/alice` |
| `/lib` | Shared libraries needed to boot and run the commands in `/bin` and `/sbin` | `/lib/ld-musl-aarch64.so.1` |
| `/media` | Mount points for removable media | `/media/usb` |
| `/mnt` | A temporary mount point | `/mnt` |
| `/opt` | Add-on application packages | `/opt/google/chrome` |
| `/proc` | Mount point of the proc virtual filesystem: processes and kernel state | `/proc/1/status`, `/proc/meminfo` |
| `/root` | The root user's home directory | `/root/.bashrc` |
| `/run` | Runtime information since boot (PID files, sockets) | `/run/systemd`, `/run/docker.sock` |
| `/sbin` | System administration commands for booting and repair | `/sbin/ip`, `/sbin/init` |
| `/srv` | Site-specific data this system serves | `/srv/www` |
| `/sys` | Mount point of sysfs: kernel objects in a structured form | `/sys/fs/cgroup`, `/sys/class/net` |
| `/tmp` | Temporary files that may be deleted without notice | `/tmp/xyz` |
| `/usr` | Shareable, read-only data: most programs and libraries | `/usr/bin/python3` |
| `/var` | Files whose size changes: logs, spools, caches, state | `/var/log`, `/var/lib` |

### Important subdirectories ✅[^1]

| Path | Holds |
|---|---|
| `/usr/bin` | Primary directory for user programs |
| `/usr/lib` | Libraries, and executables not run directly |
| `/usr/local` | Software installed locally by the administrator (not by the package manager) |
| `/var/log` | Log files |
| `/var/lib` | Variable state of programs (package databases, container storage such as `/var/lib/docker`) |
| `/var/cache` | Cached data that can be regenerated |
| `/var/tmp` | Temporary files kept longer than `/tmp` |

### Virtual filesystems: windows into the kernel

| Path | Filesystem | What reading it does | Example files |
|---|---|---|---|
| `/proc` | `proc` | The kernel generates text on each read about processes and the system ✅[^2] | `/proc/<pid>/status`, `/proc/<pid>/fd/`, `/proc/<pid>/maps`, `/proc/meminfo`, `/proc/loadavg`, `/proc/sys/` (tunable kernel parameters, "sysctls") |
| `/sys` | `sysfs` | One file per kernel object attribute, more structured than `/proc` ✅[^1] | `/sys/fs/cgroup/` (cgroup v2 tree), `/sys/block/sda/queue/scheduler`, `/sys/kernel/mm/transparent_hugepage/enabled` |
| `/dev` | `devtmpfs` (usually) | Each file is an entry point to a driver | `/dev/null`, `/dev/zero`, `/dev/urandom`, `/dev/sda` |

### Real values seen in a lab container ✅[^3]

| Command | Output (Linux 6.17.8, 2026-11-04) |
|---|---|
| `getconf PAGESIZE` | `4096` |
| `cat /proc/loadavg` | `0.11 0.03 0.01 1/280 40` |
| `cat /proc/sys/net/core/somaxconn` | `4096` |
| `mount \| grep ' / '` | `overlay on / type overlay (rw,relatime,lowerdir=…,upperdir=…,workdir=…)` |

## Lookup notes
- **Merged `/usr`:** many current distributions make `/bin`, `/sbin` and `/lib` symbolic links into `/usr`, so `/bin/ls` and `/usr/bin/ls` are the same file — lab: Ubuntu 24.04 has `/bin -> usr/bin`, `/sbin -> usr/sbin`, `/lib -> usr/lib`, while Alpine 3.20 keeps a real `/bin` directory ✅[^3].
- **`/proc/sys` vs `sysctl`:** `sysctl net.core.somaxconn` reads `/proc/sys/net/core/somaxconn`; the dots map to slashes ✅[^3] (lab: `sysctl net.core.somaxconn` and `cat /proc/sys/net/core/somaxconn` both read 4096).
- **Nothing in `/proc` or `/sys` uses disk space**; file sizes there are often shown as 0 even when reading returns text.
- **Inside a container**, `/` is usually an overlay mount and `/proc` shows only the container's processes (it is mounted from inside its PID namespace) → `containers/namespaces.md`.

## Takeaways
- Look for configuration in `/etc`, logs and state in `/var`, runtime sockets and PID files in `/run`, kernel state in `/proc` and `/sys`.
- Treat `/proc` and `/sys` as live views generated on read, not as files on disk.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [hier(7)](https://man7.org/linux/man-pages/man7/hier.7.html) — Linux man-pages project, living. Backs: every directory row, FHS 3.0 version and date, `/sys` as structured kernel information. [^1]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: `/proc` content and the files listed. [^2]
- `linux/lab-setup.md` — the lab where the "real values" table was captured on 2026-11-04. [^3]
- [Filesystem Hierarchy Standard 3.0](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html) — Linux Foundation, 2015. Backs: the standard itself (further reading).

## Related
- `linux/storage/vfs-and-file-descriptors.md` — how a path like `/etc/fstab` is resolved.
- `linux/system-management/observability-tools.md` — which `/proc` and `/sys` files each tool reads.
