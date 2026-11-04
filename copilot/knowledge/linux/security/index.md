---
schema: topic-index/v1
kind: subtopic
topic: linux/security
last-updated: 2026-11-04
---

# Security

Mandatory access control and sandboxing through Linux Security Modules: SELinux, AppArmor, Yama, Landlock and the BPF LSM. Capabilities, seccomp and user namespaces for containers are in `containers/container-isolation.md`. Not covered: audit subsystem, IMA/EVM integrity.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [lsm-and-landlock.md](lsm-and-landlock.md) | concept | Beyond Unix permissions (discretionary access control) and capabilities, the kernel calls **Linux Security Module (LSM)** hooks at security-relevant points (opening files, executing programs, connecting sockets, ptrace…) | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
