---
schema: knowledge-doc/v1
type: concept
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.x", "Docker default security settings", "OCI runtimes (runc, crun)"]
derived-from: [linux/containers/container-from-primitives-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, container-security, capabilities, seccomp, no-new-privs, user-namespaces, rootless, privileged, lsm]
---

# Container isolation: capabilities, seccomp and user namespaces

## Summary
**TL;DR:** A container shares the host kernel, so its security depends on limiting what the process may ask that kernel to do. Three layers do most of the work: **capabilities** (root's power split into ~40 named privileges; Docker keeps 14 by default), **seccomp** (a BPF filter on system calls; Docker's default blocks about 44), and **no_new_privs** (setuid binaries cannot raise privilege). **User namespaces** add a fourth: "root" inside maps to an unprivileged UID outside. `--privileged` turns most of this off: all capabilities, no seccomp.
**Use this when:** you decide on `--cap-add`, `--privileged`, `securityContext`, rootless containers or custom seccomp profiles, or a container gets `Operation not permitted` for something that works on the host.
**Not this doc:** namespaces as isolation of *view* → `containers/namespaces.md`; file permission basics → `fundamentals/users-and-permissions.md`.

## Problem
"It's in a container, so it's safe" is wrong without these layers: a container with `CAP_SYS_ADMIN` and no seccomp can mount filesystems, create namespaces and reach much of the kernel's attack surface. The reverse problem is common too: teams reach for `--privileged` to fix one `EPERM`, granting everything instead of one capability.

## Mental model
**Analogy:** a hotel guest with a key card. Capabilities are the rooms the card opens (gym, pool, staff corridor) — root normally has a master card; containers get a card with most rooms removed. Seccomp is the list of services the front desk will even accept requests for. no_new_privs means "no swapping your card for a better one later". A user namespace makes the guest feel like the manager of their own floor while being an ordinary guest to the hotel.

**Artifact:** the same process status fields in a default and a privileged Docker container (lab, Linux 6.17.8, 2026-11-04) ✅[^5]:

| Field | Default container | `--privileged` |
|---|---|---|
| `CapEff` | `00000000a80425fb` | `000001ffffffffff` |
| `CapBnd` | `00000000a80425fb` | `000001ffffffffff` |
| `Seccomp` | `2` (filter mode) | `0` (disabled) |
| `Seccomp_filters` | `1` | `0` |
| `NoNewPrivs` | `0` | `0` |

`capsh --decode=00000000a80425fb` → `cap_chown, cap_dac_override, cap_fowner, cap_fsetid, cap_kill, cap_setgid, cap_setuid, cap_setpcap, cap_net_bind_service, cap_net_raw, cap_sys_chroot, cap_mknod, cap_audit_write, cap_setfcap` (14) ✅[^5]. `Seccomp` 0/1/2 = disabled / strict / filter ✅[^4].

## How it works
**4 actors:**
- **Runtime (runc, crun)** — its job: apply the security settings before `execve` of the user program, from the OCI config fields `process.capabilities`, `process.noNewPrivileges` and `linux.seccomp` ✅[^8].
- **Capability sets of each thread** — its job: decide which privileged operations pass, via the effective set checked by the kernel ✅[^1].
- **Seccomp filter** — its job: allow or reject each system call before it runs, via a BPF program that sees the call number, architecture and arguments ✅[^2].
- **User namespace** — its job: map UIDs and scope capabilities to the namespace's own resources, via `uid_map`/`gid_map` ✅[^3].

```
container process issues a system call
   │
   ▼
seccomp filter (BPF) ── KILL / TRAP / ERRNO(EPERM) / USER_NOTIF / TRACE / LOG ──► rejected
   │ ALLOW
   ▼
kernel permission checks
   ├─ needs a capability? → is it in the EFFECTIVE set? ── no ──► EPERM
   │                        (scoped to the user namespace that owns the resource)
   ├─ file DAC checks (UID/GID mode bits) ── fail ──► EACCES
   └─ LSM (AppArmor / SELinux) policy, if any ── deny ──► EACCES/EPERM
   ▼
operation runs
```

**Capability sets per thread** ✅[^1]:

| Set | Role |
|---|---|
| Permitted | Upper bound for effective; once dropped, cannot be regained without exec'ing a privileged file |
| Effective | What the kernel actually checks |
| Inheritable | Kept across `execve`, combined with the file's inheritable set |
| Bounding | Limits what can ever be gained at `execve` (per thread since 2.6.25) |
| Ambient | Kept across `execve` of unprivileged programs (since 4.3) |

A process with UID 0 gets all capabilities at `execve`, minus those removed from its bounding set ✅[^1] — that is how runtimes make "root in a container" weaker than host root.

**Capabilities that matter most** ✅[^1]:

| Capability | Allows | Why it is dangerous or needed |
|---|---|---|
| `CAP_SYS_ADMIN` | `mount`, `pivot_root`, `setns`, creating namespaces, `swapon`, `sethostname`, … | Overloaded, "the new root"; avoid granting |
| `CAP_NET_ADMIN` | Interfaces, routes, firewall rules | Needed by network tools/CNI; dangerous in app containers |
| `CAP_NET_RAW` | Raw and packet sockets (classic `ping`, sniffing) | Spoofing; often dropped in hardened setups |
| `CAP_NET_BIND_SERVICE` | Bind ports below 1024 | Safe, narrow way to serve on port 80 |
| `CAP_SYS_PTRACE` | Trace and read other processes' memory | Breaks process isolation |
| `CAP_DAC_OVERRIDE` | Bypass file permission checks | Reads files regardless of mode bits |

**Seccomp** ✅[^2]:
1. Mode `STRICT` allows only `read`, `write`, `_exit`, `sigreturn`; mode `FILTER` runs a BPF program per call.
2. Actions, most severe wins when several filters apply: `KILL_PROCESS`, `KILL_THREAD`, `TRAP`, `ERRNO`, `USER_NOTIF`, `TRACE`, `LOG`, `ALLOW`. An allow-list approach is recommended.
3. Installing a filter needs `CAP_SYS_ADMIN` or `no_new_privs`, so an unprivileged process cannot use a filter to trick a setuid program.
4. Filters are inherited by children and kept across `execve`.

Docker's default profile is an allow-list that blocks about 44 of 300+ calls with `EPERM`, including `mount`, `unshare`, `reboot`, `keyctl`, `bpf`, `perf_event_open`, `kexec_load`, `ptrace`, `io_uring` calls and namespace-creating `clone` ✅[^6].

**no_new_privs:** when set, `execve` ignores setuid/setgid bits and file capabilities ✅[^7]; Docker's `--security-opt no-new-privileges` sets it ✅[^9] (lab: `NoNewPrivs: 1` with the flag). The lab default container showed `NoNewPrivs: 0` ✅[^5].

**User namespaces (rootless):** the creator gets full capabilities **inside** and none in the parent; they only apply to resources the namespace owns; global actions (clock, modules, devices) still need host privilege ✅[^3]. So a process that is "root" inside holds no capabilities over host-owned resources ✅[^3].

## Worked example
Three operations, three different blockers (lab, Linux 6.17.8, 2026-11-04) ✅[^5]:

| Command in a default Docker container | Result | Blocked by |
|---|---|---|
| `unshare --pid --fork true` | `Operation not permitted` | Missing `CAP_SYS_ADMIN` and Docker's seccomp profile ✅[^6] |
| `ip link add x type dummy` | `RTNETLINK answers: Operation not permitted` | Missing `CAP_NET_ADMIN` ✅[^1] |
| `mount -t tmpfs t /mnt` | `permission denied` | Missing `CAP_SYS_ADMIN` ✅[^1] |

And a narrow drop on the host side: root with only `CAP_CHOWN` removed from its bounding set fails `chown` with `Operation not permitted` ✅[^5]; in the hand-built container of the deep dive, keeping only five capabilities (`CapEff 0x4e1`) made `ping` fail with "permission denied" while UDP DNS still worked ✅[^5].

Least-privilege fix instead of `--privileged` for a web server that must bind port 80:

| Instead of | Use |
|---|---|
| `--privileged` | `--cap-drop ALL --cap-add NET_BIND_SERVICE` |
| Running as root | `USER 10001` in the image, plus the capability if binding < 1024 |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `--privileged` | All capabilities, no seccomp; can mount host devices | Most layers disabled ✅[^5] |
| Mounting `/var/run/docker.sock` into a container | Full control of the host's Docker daemon | The daemon runs with root privileges; only trusted users should control it ✅[^10] |
| App needs one blocked call | Fails with `EPERM`, looks like a permission bug | Seccomp default action `ERRNO` ✅[^6] |
| `seccomp=unconfined` | No filter at all | Explicit opt-out ✅[^6] |
| Capability-dumb binary with file capabilities | Fails with `EPERM` if it does not get its full permitted set | Kernel safety check ✅[^1] |
| Kernel vulnerability reachable through an allowed call | Isolation broken despite all layers | All containers share the host kernel (see `linux/fundamentals/kvm-virtualization.md`) |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Default runtime profile | Broad compatibility, moderate protection | Still 14 capabilities, root UID |
| Drop all capabilities, add back one by one | Smallest privilege | Must know what the app needs |
| Rootless / user namespaces | Container root ≠ host root | Some features (certain mounts, low ports, some storage drivers) harder |
| Custom seccomp allow-list | Smallest kernel surface | Maintenance; breaks on new calls |

## Takeaways
- Never use `--privileged` to fix a single `EPERM`; add the one capability that operation needs. [rule-candidate]
- Run app containers as a non-root user with `--cap-drop ALL` plus only what is needed, and keep the default seccomp profile. [rule-candidate]
- Read `CapEff` and `Seccomp` in `/proc/1/status` inside a container to see its real privilege.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 28 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) — Linux man-pages project, living. Backs: the five sets, UID 0 at exec, the capabilities table, capability-dumb binaries. [^1]
- [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html) — Linux man-pages project, living. Backs: strict vs filter mode, actions and precedence, privilege requirement, inheritance, allow-list advice. [^2]
- [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html) — Linux man-pages project, living. Backs: capabilities inside only, scope to owned resources, global resources. [^3]
- [proc_pid_status(5)](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html) — Linux man-pages project, living. Backs: `Seccomp` 0/1/2 meanings, `NoNewPrivs`. [^4]
- `linux/lab-setup.md` — the lab where the default vs privileged fields, the decoded mask, the three blocked commands and the `chown`/`ping` tests were captured on 2026-11-04. [^5]
- [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) — Docker, living. Backs: default allow-list, ~44 blocked calls, `EPERM`, examples, `seccomp=unconfined`. [^6]
- [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) — Linux man-pages project, living. Backs: `no_new_privs` makes exec ignore setuid bits and file capabilities. [^7]
- `linux/containers/container-from-primitives-deep-dive.md` — the deep dive this doc was distilled from.
- [OCI Runtime Specification: config.md](https://github.com/opencontainers/runtime-spec/blob/main/config.md) — Open Container Initiative, living. Backs: `process.capabilities`, `process.noNewPrivileges`, `linux.seccomp`, `linux.namespaces`, `linux.resources` fields. [^8]
- [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) — Docker, living. Backs: `--device`, `--device-cgroup-rule`, `--init` (forwards signals, reaps processes), `--shm-size`, `--security-opt no-new-privileges`. [^9]
- [Docker Engine security](https://docs.docker.com/engine/security/) — Docker, living. Backs: the daemon requires root privileges; only trusted users should control it. [^10]

## Related
- `linux/fundamentals/users-and-permissions.md` — UIDs, mode bits, setuid.
- `linux/containers/namespaces.md` — user namespaces among the other types.
- `linux/fundamentals/kernel-and-system-calls.md` — the system calls seccomp filters.
