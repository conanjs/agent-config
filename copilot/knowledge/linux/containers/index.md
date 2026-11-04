---
schema: topic-index/v1
kind: subtopic
topic: linux/containers
last-updated: 2026-11-04
---

# Containers

How a container is built from kernel primitives: namespaces, cgroups v2, overlayfs image layers, veth/bridge/NAT networking, and capabilities/seccomp/user namespaces; with an end-to-end deep dive that builds one by hand. Not covered: orchestration (see `kubernetes/`), Linux Security Modules.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [container-from-primitives-deep-dive.md](container-from-primitives-deep-dive.md) | deep-dive | Builds a container by hand from namespaces, a cgroup, an overlay root, veth/bridge/NAT and dropped capabilities on Linux 6.17, with real output, the mapping to Docker/runc and cross-mechanism and failure matrices | verified |
| [namespaces.md](namespaces.md) | concept | A namespace wraps one kind of global resource so that processes inside it get their own private copy: their own PID numbers, mount table, network stack, hostname, IPC objects, user IDs, cgroup root or clocks | verified |
| [cgroups-v2.md](cgroups-v2.md) | concept | A cgroup is a directory under `/sys/fs/cgroup` that holds a set of processes; files in it set and report resource use for the whole group | verified |
| [overlayfs-and-image-layers.md](overlayfs-and-image-layers.md) | concept | A container image is a stack of read-only layers; overlayfs merges them (`lowerdir`, leftmost = top) with one writable layer per container (`upperdir`) into a single view (the merged mount) | verified |
| [container-networking.md](container-networking.md) | concept | A container starts with its own **network namespace**, which contains only a loopback that is down | verified |
| [container-isolation.md](container-isolation.md) | concept | A container shares the host kernel, so its security depends on limiting what the process may ask that kernel to do | verified |

## References
- [The Linux kernel documentation](https://docs.kernel.org/) — Linux kernel community, living. Backs: topic scope.
- [Linux man-pages](https://man7.org/linux/man-pages/) — Linux man-pages project, living. Backs: topic scope.

## Related
- `linux/learning-path.md` — where this subtopic sits in the learning order.
- `linux/lab-setup.md` — the lab used for every captured example.
