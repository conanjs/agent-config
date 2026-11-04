---
schema: knowledge-doc/v1
type: concept
topic: linux/security
status: verified
applies-to: ["Linux ≥ 5.13 (Landlock)", "SELinux and AppArmor distributions"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, lsm, selinux, apparmor, landlock, yama, mandatory-access-control, sandboxing]
---

# Linux Security Modules: SELinux, AppArmor, Landlock and friends

## Summary
**TL;DR:** Beyond Unix permissions (discretionary access control) and capabilities, the kernel calls **Linux Security Module (LSM)** hooks at security-relevant points (opening files, executing programs, connecting sockets, ptrace…). Modules attached to those hooks can deny the operation even for root. **Major** modules enforce a full mandatory access control policy written by administrators: **SELinux** (labels on every subject and object) or **AppArmor** (per-program path-based profiles). **Minor** modules stack alongside: **Yama** (ptrace limits), **Landlock** (unprivileged self-sandboxing), **BPF LSM** (policies written in eBPF). The `capability` module is always present.
**Use this when:** an action fails with "Permission denied" although file modes and capabilities allow it, you write AppArmor/SELinux policy for a service or container, or you want an application to sandbox itself.
**Not this doc:** Unix permissions → `fundamentals/users-and-permissions.md`; capabilities and seccomp in containers → `containers/container-isolation.md`.

## Problem
A service on a RHEL-family host cannot read a file it clearly owns; a container cannot write to a bind mount; `strace` attaching to a process fails as root. The cause is an LSM decision, logged in the audit log, not in the application's error message — so people "fix" it by disabling SELinux or AppArmor entirely.

## Mental model
**Analogy:** Unix permissions are the lock on each door, which the owner controls (discretionary). An LSM is building security with its own rule book that the tenants cannot change (mandatory): even the owner of an office cannot carry certain boxes out if the rule book says no. Landlock is different: a tenant voluntarily handcuffs themself ("from now on I only enter rooms A and B"), and cannot take the cuffs off.

**Artifact:** the active modules of the lab kernel (Linux 6.17.8, 2026-11-04) ✅[^4]:
```text
# mount -t securityfs none /sys/kernel/security
# cat /sys/kernel/security/lsm
capability,landlock,yama,bpf          # checks run in this order; no major MAC module on this VM
```

## How it works
**4 actors:**
- **Process** — its job: request an operation, via a system call.
- **Kernel subsystem (VFS, network, ptrace, exec)** — its job: perform DAC (mode bits) and capability checks, then call the LSM hooks — modules are consulted at hook points; capability is always first in the stack ✅[^1].
- **LSM stack** — its job: let each active module allow or deny, in the order listed in `/sys/kernel/security/lsm` ✅[^1].
- **Policy source** — its job: provide rules, via loaded SELinux policy, AppArmor profiles, or a Landlock ruleset the process installed on itself ✅[^1] ✅[^2].

```
open("/srv/data/report.csv")
  │
  ├─ DAC: mode bits / ACL for this UID ── fail → EACCES
  ├─ capabilities (capability LSM, always first) ── fail → EPERM/EACCES
  └─ LSM hooks, in stack order:
       landlock: is this path beneath an allowed hierarchy for this process?  ── deny → EACCES
       yama:     (only for ptrace)
       selinux/apparmor (if present): does policy allow label/profile X to read Y? ── deny → EACCES + audit log
  ▼
operation runs
```

1. **Selection:** LSMs are chosen at kernel build time (`CONFIG_LSM`) and can be overridden at boot with `lsm=…`; despite the name they are not loadable modules ✅[^1].
2. **Stacking:** capability is always included; then any number of minor modules and at most one major module; checks run in list order ✅[^1].
3. **Major modules** — SELinux, Smack, TOMOYO, AppArmor — enforce full mandatory access control policies ✅[^1].
4. **Minor modules** — e.g. Yama, LoadPin, SafeSetID, IPE, Landlock — make narrower changes ✅[^1].
5. **Landlock (self-sandboxing)** ✅[^2]:
   - Any process, even unprivileged, builds a **ruleset** (`landlock_create_ruleset`), adds rules (`landlock_add_rule`: file hierarchies with rights such as read, write, execute, make directory; TCP bind/connect ports from ABI v4), and enforces it on itself (`landlock_restrict_self`).
   - Handled rights not granted by a rule are denied; rules on a directory cover everything beneath it.
   - Unprivileged callers must set `no_new_privs` first.
   - Each enforcement adds a layer (max 16); access needs every layer's approval; layers cannot be removed; children inherit them.
   - Applications should query the ABI version and drop unsupported rights (best-effort).

**SELinux vs AppArmor in practice:**

| Aspect | SELinux | AppArmor |
|---|---|---|
| Identifies objects by | Security labels (contexts) on every process and resource ✅[^5] | Per-program profiles ✅[^6] |
| Default on | Fedora documents SELinux for every process and resource ✅[^5] | Ubuntu: installed and loaded by default ✅[^7] |
| Container integration | `:z`/`:Z` bind-mount relabeling ✅[^8] | `docker-default` profile ✅[^9] |
| Debug | `ausearch -m AVC`, `audit2why` | `dmesg`/audit `apparmor="DENIED"`, `aa-complain` |

## Worked example
A web service on an SELinux host cannot read `/srv/app/config.yml` even though `ls -l` shows `rw-r--r-- app app`:

| Step | Check | Result |
|---|---|---|
| 1 | DAC: owner `app`, service runs as `app` | Allowed |
| 2 | Capabilities: none needed | Allowed |
| 3 | LSM: `ausearch -m AVC -ts recent` | `denied { read } … scontext=…:httpd_t … tcontext=…:default_t` (illustrative message shape, not captured) |
| 4 | Meaning | The file kept a generic label after being copied in; policy lets `httpd_t` read web content labels, not `default_t` |
| 5 | Fix | Give the path the right label (`semanage fcontext -a -t httpd_sys_content_t '/srv/app(/.*)?'` then `restorecon -Rv /srv/app`) instead of `setenforce 0` (illustrative commands, not run) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Root denied an operation | Expected under MAC | LSM checks apply to root too ✅[^1] |
| `ptrace` / `strace -p` fails for non-children | Yama `ptrace_scope` restriction | Minor LSM ✅[^10] |
| Landlock call on an old kernel | Returns an error or a lower ABI | Query ABI and degrade ✅[^2] |
| Landlock without `no_new_privs`, unprivileged | Refused | Required ✅[^2] |
| More than 16 Landlock layers | `E2BIG` | Layer limit ✅[^2] |
| Lab VM | No SELinux/AppArmor active | Only `capability,landlock,yama,bpf` ✅[^4] |

## Takeaways
- When access fails despite correct permissions, read the audit log for an LSM denial before changing modes. [rule-candidate]
- Fix labels or profiles; never disable SELinux/AppArmor as a fix.
- Consider Landlock for programs that handle untrusted input: restrict yourself to the paths and ports you need, right after start-up.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Linux Security Module Usage](https://docs.kernel.org/admin-guide/LSM/index.html) — Linux kernel documentation, living. Backs: hook framework, build-time selection and `lsm=`, capability always included, major vs minor, stacking order, module list, `/sys/kernel/security/lsm`. [^1]
- [Landlock: unprivileged access control](https://docs.kernel.org/userspace-api/landlock.html) — Linux kernel documentation, living. Backs: rulesets and rules, system calls, rights, network rights from ABI v4, `no_new_privs`, 16 layers and `E2BIG`, inheritance, ABI best-effort. [^2]
- [SELinux](https://docs.kernel.org/admin-guide/LSM/SELinux.html) and [AppArmor](https://docs.kernel.org/admin-guide/LSM/apparmor.html) — Linux kernel documentation, living. Backs: further reading on the two major modules.
- `linux/lab-setup.md` — the lab where the active LSM list was read on 2026-11-04. [^4]
- [Getting started with SELinux](https://docs.fedoraproject.org/en-US/quick-docs/selinux-getting-started/) — Fedora Project, living. Backs: every process and resource has an SELinux label (context); type enforcement example `mysqld_t`. [^5]
- [AppArmor](https://docs.kernel.org/admin-guide/LSM/apparmor.html) — Linux kernel documentation, living. Backs: AppArmor is a MAC-style security extension selectable as the major LSM. [^6]
- [AppArmor (Ubuntu Server documentation)](https://documentation.ubuntu.com/server/how-to/security/apparmor/) — Canonical, living. Backs: AppArmor is installed and loaded by default on Ubuntu. [^7]
- [Bind mounts: Configure the SELinux label](https://docs.docker.com/engine/storage/bind-mounts/) — Docker, living. Backs: `z` / `Z` mount options relabel content for SELinux. [^8]
- [AppArmor security profiles for Docker](https://docs.docker.com/engine/security/apparmor/) — Docker, living. Backs: `docker-default` is the default profile for containers. [^9]
- [Yama](https://docs.kernel.org/admin-guide/LSM/Yama.html) — Linux kernel documentation, living. Backs: `ptrace_scope` restricts PTRACE_ATTACH to descendants. [^10]

## Related
- `linux/containers/container-isolation.md` — capabilities, seccomp and user namespaces.
- `linux/system-management/ebpf-tracing.md` — eBPF, which also powers the BPF LSM.
